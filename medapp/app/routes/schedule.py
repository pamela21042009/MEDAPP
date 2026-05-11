from __future__ import annotations

from flask import Blueprint, request

from .api_helpers import by_id, current_user, default_week, doctors, fail, log_event, ok, payload, role, select
from app.services.schedule_service import ScheduleService

bp = Blueprint("schedule", __name__, url_prefix="/schedule")


def current_doctor_id() -> int | None:
    user = current_user()
    if user.get("id"):
        rows = select("doctors", "id,user_id,email", {"user_id": user["id"]})
        if rows:
            return rows[0].get("id")
    if user.get("email"):
        rows = select("doctors", "id,user_id,email", {"email": user["email"]})
        if rows:
            return rows[0].get("id")
    return None


def resolve_doctor_id(value: int | None = None) -> int | None:
    if value:
        return value
    if role() == "doctor":
        return current_doctor_id()
    return None


def normalize_days(days: list[dict]) -> list[dict]:
    if days:
        return days
    return [
        {
            **day,
            "day_of_week": day.get("weekday"),
            "slot_duration": day.get("slot_minutes"),
            "name": day.get("label"),
        }
        for day in default_week()
    ]


def normalize_unavailability(items: list[dict]) -> list[dict]:
    normalized = []
    for item in items:
        date_value = str(
            item.get("date")
            or item.get("start_date")
            or item.get("unavailable_date")
            or item.get("starts_at")
            or ""
        )[:10]
        if not date_value:
            continue
        normalized.append({
            **item,
            "date": date_value,
            "label": item.get("label") or item.get("reason") or "Fecha bloqueada",
        })
    return normalized


@bp.route("/api/bootstrap")
def api_bootstrap():
    svc = ScheduleService()
    doctor_id = resolve_doctor_id(request.args.get("doctor_id", type=int))
    doctor = by_id("doctors", doctor_id) if doctor_id else None
    days = svc.get_by_doctor(doctor_id) if doctor_id else []
    holidays = svc.get_unavailability(doctor_id) if doctor_id else []
    return ok({
        "role": role(),
        "doctors": doctors(),
        "doctor": doctor,
        "days": normalize_days(days),
        "holidays": normalize_unavailability(holidays),
    })


@bp.route("/api", methods=["POST"])
def api_save():
    svc = ScheduleService()
    data = payload()
    doctor_id = resolve_doctor_id(data.get("doctor_id"))
    if not doctor_id:
        return fail("Selecciona un medico antes de guardar el horario.", 400)

    saved_days = []
    for day in data.get("days") or []:
        saved = svc.upsert(doctor_id, int(day.get("day_of_week", day.get("index", 0))), day)
        if saved:
            saved_days.append(saved)
    if len(saved_days) != len(data.get("days") or []):
        return fail("No fue posible guardar todos los dias del horario en Supabase.", 500)

    holidays = data.get("holidays") or []
    valid_holidays = [
        item for item in holidays
        if str(item.get("date") or item.get("start_date") or item.get("starts_at") or "").strip()
    ]
    saved_holidays = svc.replace_unavailability(doctor_id, holidays)
    if len(saved_holidays) != len(valid_holidays):
        return fail("No fue posible guardar todas las fechas bloqueadas en Supabase.", 500)
    result = {
        "doctors": doctors(),
        "doctor": by_id("doctors", doctor_id),
        "days": normalize_days(saved_days or data.get("days") or []),
        "holidays": normalize_unavailability(saved_holidays or data.get("holidays") or []),
    }
    log_event("save", "doctor_schedules", doctor_id)
    return ok({"message": "Horario guardado correctamente.", "payload": result})
