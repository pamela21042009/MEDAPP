from __future__ import annotations

from flask import Blueprint, current_app, jsonify, request

from .api_helpers import appointments, by_id, current_patient_id, current_user, db, doctors, fail, insert, log_event, next_slots, ok, patients, payload, role, select, specialties, update, visible_patients
from app.services.notification_service import NotificationService
from app.services.schedule_service import ScheduleService

bp = Blueprint("agenda", __name__, url_prefix="/agenda")

APPOINTMENT_STATUSES = {"pending", "confirmed", "cancelled", "completed", "no_show", "rescheduled"}

APPOINTMENT_STATUS_COLORS = {
    "pending": {"background": "#FFF0BF", "text": "#8A6200"},
    "confirmed": {"background": "#DDF8E6", "text": "#24823B"},
    "completed": {"background": "#DDF2FB", "text": "#287AA8"},
    "no_show": {"background": "#E9ECEF", "text": "#5C6770"},
    "cancelled": {"background": "#FFD4E7", "text": "#C0105E"},
    "rescheduled": {"background": "#DDF2FB", "text": "#287AA8"},
}


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


def ensure_current_patient_id() -> int | None:
    patient_id = current_patient_id()
    if patient_id or role() != "paciente":
        return patient_id

    user = current_user()
    data = {
        "user_id": user.get("id"),
        "full_name": user.get("full_name") or user.get("name") or user.get("email") or "Paciente",
        "email": user.get("email") or "",
    }
    item = insert("patients", data)
    if not item:
        item = insert("patients", {key: value for key, value in data.items() if key != "user_id"})
    if item:
        log_event("create", "patients", item.get("id"), {"source": "auto_patient_profile"})
        return item.get("id")
    return None


def slot_is_available(data: dict, appointment_id: int | None = None) -> bool:
    doctor_id = data.get("doctor_id")
    date_value = data.get("appointment_date")
    time_value = str(data.get("appointment_time") or "")[:5]
    if not doctor_id or not date_value or not time_value:
        return True

    if appointment_id:
        current = by_id("appointments", appointment_id)
        if current and str(current.get("doctor_id")) == str(doctor_id):
            same_date = str(current.get("appointment_date") or "")[:10] == str(date_value)[:10]
            same_time = str(current.get("appointment_time") or "")[:5] == time_value
            if same_date and same_time:
                return True

    slots = ScheduleService().get_available_slots(int(doctor_id), str(date_value)[:10], appointment_id)
    return time_value in slots


def _patient_notification_user_id(patient_id: int | None) -> int | None:
    if not patient_id:
        return None
    patient = by_id("patients", int(patient_id))
    if not patient:
        return None
    if patient.get("user_id"):
        return patient.get("user_id")
    email = patient.get("email")
    if email:
        rows = select("users", "id,email", {"email": email})
        if rows:
            return rows[0].get("id")
    return None


def _notify_appointment_confirmed(appointment: dict | None, previous_status: str | None = None) -> None:
    if not appointment or appointment.get("status") != "confirmed" or previous_status == "confirmed":
        return

    patient = by_id("patients", int(appointment.get("patient_id"))) if appointment.get("patient_id") else None
    doctor = by_id("doctors", int(appointment.get("doctor_id"))) if appointment.get("doctor_id") else None
    doctor_name = (doctor or {}).get("full_name") or "tu medico"
    date_value = str(appointment.get("appointment_date") or appointment.get("date") or "")
    time_value = str(appointment.get("appointment_time") or appointment.get("time") or "")[:5]
    appointment_date = f"{date_value} {time_value}".strip()
    notification_service = NotificationService()

    user_id = _patient_notification_user_id(appointment.get("patient_id"))
    if user_id:
        notification_service.notify_appointment_confirmed(int(user_id), appointment_date, doctor_name)

    patient_email = str((patient or {}).get("email") or "").strip()
    if not patient_email:
        return
    try:
        sent = notification_service.email_appointment_confirmed(
            patient_email,
            str((patient or {}).get("full_name") or ""),
            appointment_date,
            doctor_name,
        )
        if not sent:
            current_app.logger.warning("Correo de confirmacion no enviado: configuracion SMTP incompleta.")
    except Exception as exc:
        current_app.logger.warning("No fue posible enviar correo de confirmacion de cita: %s", exc)


@bp.route("/api/bootstrap")
def api_bootstrap():
    patient_id = ensure_current_patient_id() if role() == "paciente" else None
    patient_items = visible_patients()
    if role() == "paciente":
        patient_items = [item for item in patient_items if str(item.get("id") or "") == str(patient_id)]
    return ok({
        "role": role(),
        "current_doctor_id": current_doctor_id() if role() == "doctor" else None,
        "current_patient_id": patient_id,
        "doctors": doctors(),
        "patients": patient_items,
        "specialties": specialties(),
        "statuses": ["pending", "confirmed", "cancelled", "completed", "no_show", "rescheduled"],
    })


@bp.route("/api/events")
def api_events():
    events = []
    current_role = role()
    doctor_id = current_doctor_id() if current_role == "doctor" else None
    patient_id = ensure_current_patient_id() if current_role == "paciente" else None
    doctors_by_id = {item.get("id"): item for item in doctors()}
    patients_by_id = {item.get("id"): item for item in patients()}
    for item in appointments():
        if current_role == "doctor" and str(item.get("doctor_id") or "") != str(doctor_id):
            continue
        if current_role == "paciente" and str(item.get("patient_id") or "") != str(patient_id):
            continue
        date_value = item.get("appointment_date") or item.get("date") or ""
        time_value = str(item.get("appointment_time") or item.get("time") or "08:00")[:5]
        doctor = doctors_by_id.get(item.get("doctor_id"), {})
        patient = patients_by_id.get(item.get("patient_id"), {})
        title = item.get("title") or patient.get("full_name") or item.get("reason") or "Cita medica"
        status = item.get("status") or "pending"
        colors = APPOINTMENT_STATUS_COLORS.get(status, APPOINTMENT_STATUS_COLORS["pending"])
        extended_props = {
            **item,
            "appointment_id": item.get("id"),
            "doctor": doctor.get("full_name", ""),
            "specialty": doctor.get("specialty", ""),
            "patient": patient.get("full_name", ""),
            "phone": patient.get("phone", ""),
        }
        events.append({
            "id": item.get("id"),
            "title": title,
            "start": f"{date_value}T{time_value}:00" if date_value else "",
            "backgroundColor": colors["background"],
            "borderColor": colors["background"],
            "textColor": colors["text"],
            "classNames": [f"agenda-event-{status}"],
            "extendedProps": extended_props,
        })
    return jsonify(events)


@bp.route("/api/slots")
def api_slots():
    doctor_id = request.args.get("doctor_id", type=int)
    date_value = request.args.get("date", "")
    appointment_id = request.args.get("appointment_id", type=int)
    if doctor_id and date_value:
        return ok(ScheduleService().get_availability(doctor_id, date_value, appointment_id))
    return ok({"slots": next_slots(), "message": ""})


@bp.route("/api/appointments", methods=["POST"])
def api_create():
    data = payload()
    user = current_user()
    if role() == "paciente":
        patient_id = ensure_current_patient_id()
        if not patient_id:
            return fail("No se encontro tu expediente para crear la cita.", 400)
        data["patient_id"] = patient_id
        data["status"] = "pending"
    elif not data.get("patient_id"):
        return fail("Selecciona un paciente antes de crear la cita.", 400)
    if user.get("id"):
        data.setdefault("created_by", user["id"])
    if not slot_is_available(data):
        return fail("Ese horario no esta disponible para el medico seleccionado.", 409)
    item = insert("appointments", data)
    if not item:
        return fail("No fue posible crear la cita.", 500)
    _notify_appointment_confirmed(item)
    log_event("create", "appointments", item.get("id"), {"status": item.get("status")})
    return ok({"item": item, "appointment": item})


@bp.route("/api/appointments/<int:appointment_id>", methods=["PUT"])
def api_update(appointment_id: int):
    data = payload()
    current = by_id("appointments", appointment_id)
    if data.get("status") and data["status"] not in APPOINTMENT_STATUSES:
        return fail("Estado de cita no valido.", 400)
    if not slot_is_available(data, appointment_id):
        return fail("Ese horario no esta disponible para el medico seleccionado.", 409)
    item = update("appointments", appointment_id, data)
    if not item:
        error = db().get_last_error()
        message = "No fue posible actualizar la cita."
        if error:
            message = f"{message} Detalle: {error}"
        return fail(message, 500)
    _notify_appointment_confirmed(item, (current or {}).get("status"))
    log_event("update", "appointments", appointment_id, {"status": item.get("status")})
    return ok({"item": item, "appointment": item})


@bp.route("/api/appointments/<int:appointment_id>/cancel", methods=["POST"])
def api_cancel(appointment_id: int):
    user = current_user()
    data = {"status": "cancelled", "cancellation_reason": payload().get("reason", "")}
    if user.get("id"):
        data["cancelled_by"] = user["id"]
    item = update("appointments", appointment_id, data)
    if not item:
        error = db().get_last_error()
        message = "No fue posible cancelar la cita."
        if error:
            message = f"{message} Detalle: {error}"
        return fail(message, 500)
    log_event("cancel", "appointments", appointment_id, {"reason": data.get("cancellation_reason")})
    return ok({"item": item, "appointment": item})


@bp.route("/api/appointments/<int:appointment_id>/reschedule", methods=["POST"])
def api_reschedule(appointment_id: int):
    data = payload()
    data["status"] = "rescheduled"
    if not slot_is_available(data, appointment_id):
        return fail("Ese horario no esta disponible para el medico seleccionado.", 409)
    item = update("appointments", appointment_id, data)
    if not item:
        error = db().get_last_error()
        message = "No fue posible reprogramar la cita."
        if error:
            message = f"{message} Detalle: {error}"
        return fail(message, 500)
    log_event("reschedule", "appointments", appointment_id, {"appointment_date": data.get("appointment_date")})
    return ok({"item": item, "appointment": item})


@bp.route("/api/doctors")
def api_doctors():
    return ok({"items": doctors()})


@bp.route("/api/patients")
def api_patients():
    return ok({"items": visible_patients()})
