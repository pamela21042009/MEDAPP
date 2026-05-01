from __future__ import annotations

from flask import Blueprint, request

from .api_helpers import by_id, default_week, doctors, ok, payload, select

bp = Blueprint("schedule", __name__, url_prefix="/schedule")


@bp.route("/api/bootstrap")
def api_bootstrap():
    doctor_id = request.args.get("doctor_id", type=int)
    doctor = by_id("doctors", doctor_id) if doctor_id else None
    days = select("doctor_schedule", "*", {"doctor_id": doctor_id}) if doctor_id else []
    holidays = select("doctor_holidays", "*", {"doctor_id": doctor_id}) if doctor_id else []
    return ok({
        "doctors": doctors(),
        "doctor": doctor,
        "days": days or default_week(),
        "holidays": holidays,
    })


@bp.route("/api", methods=["POST"])
def api_save():
    data = payload()
    result = {
        "doctors": doctors(),
        "doctor": by_id("doctors", int(data.get("doctor_id"))) if data.get("doctor_id") else None,
        "days": data.get("days") or default_week(),
        "holidays": data.get("holidays") or [],
    }
    return ok({"message": "Horario guardado correctamente.", "payload": result})
