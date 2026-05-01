from __future__ import annotations

from flask import Blueprint, request

from .api_helpers import appointments, by_id, doctors, fail, insert, next_slots, ok, patients, payload, role, specialties, update

bp = Blueprint("agenda", __name__, url_prefix="/agenda")


@bp.route("/api/bootstrap")
def api_bootstrap():
    return ok({
        "role": role(),
        "current_doctor_id": None,
        "current_patient_id": None,
        "doctors": doctors(),
        "patients": patients(),
        "specialties": specialties(),
        "statuses": ["pending", "confirmed", "cancelled", "completed", "no_show", "rescheduled"],
    })


@bp.route("/api/events")
def api_events():
    events = []
    for item in appointments():
        date_value = item.get("appointment_date") or item.get("date") or ""
        time_value = str(item.get("appointment_time") or item.get("time") or "08:00")[:5]
        title = item.get("title") or item.get("reason") or "Cita medica"
        events.append({
            "id": item.get("id"),
            "title": title,
            "start": f"{date_value}T{time_value}:00" if date_value else "",
            "extendedProps": item,
            **item,
        })
    return ok(events)


@bp.route("/api/slots")
def api_slots():
    return ok({"slots": next_slots()})


@bp.route("/api/appointments", methods=["POST"])
def api_create():
    item = insert("appointments", payload())
    if not item:
        return fail("No fue posible crear la cita.", 500)
    return ok({"item": item, "appointment": item})


@bp.route("/api/appointments/<int:appointment_id>", methods=["PUT"])
def api_update(appointment_id: int):
    item = update("appointments", appointment_id, payload())
    if not item:
        return fail("No fue posible actualizar la cita.", 500)
    return ok({"item": item, "appointment": item})


@bp.route("/api/appointments/<int:appointment_id>/cancel", methods=["POST"])
def api_cancel(appointment_id: int):
    data = {"status": "cancelled", "cancellation_reason": payload().get("reason", "")}
    item = update("appointments", appointment_id, data)
    return ok({"item": item, "appointment": item})


@bp.route("/api/appointments/<int:appointment_id>/reschedule", methods=["POST"])
def api_reschedule(appointment_id: int):
    data = payload()
    data["status"] = "rescheduled"
    item = update("appointments", appointment_id, data)
    return ok({"item": item, "appointment": item})


@bp.route("/api/doctors")
def api_doctors():
    return ok({"items": doctors()})


@bp.route("/api/patients")
def api_patients():
    return ok({"items": patients()})
