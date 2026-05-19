from __future__ import annotations

from datetime import date, datetime, timedelta, timezone

from flask import Blueprint, jsonify, request

from .api_helpers import current_patient_id, current_user, doctors, fail, log_event, ok, patient_belongs_to_doctor, payload, role, select, visible_patients
from app.services.database import DatabaseService

bp = Blueprint("prescriptions", __name__, url_prefix="/prescriptions")

PRESCRIPTION_COLUMNS = {
    "appointment_id",
    "doctor_id",
    "patient_id",
    "notes",
    "issued_at",
    "valid_until",
}

PRESCRIPTION_ITEM_COLUMNS = {
    "prescription_id",
    "medication_id",
    "dose",
    "frequency",
    "duration_days",
    "instructions",
}


def can_write_prescriptions() -> bool:
    return role() in {"admin", "doctor"}


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


def prescriptions(filters: dict | None = None) -> list[dict]:
    rows = DatabaseService.get_instance().select_with_join(
        "prescriptions",
        "*, patients(full_name,birth_date), doctors(full_name,specialty,license_number)",
        filters or {},
    )
    return rows or select("prescriptions", "*", filters or {})


def visible_prescription_filters(filters: dict | None = None) -> dict | None:
    current_role = role()
    scoped_filters = dict(filters or {})
    if current_role == "doctor":
        doctor_id = current_doctor_id()
        if not doctor_id:
            return None
        scoped_filters["doctor_id"] = doctor_id
    elif current_role == "paciente":
        patient_id = current_patient_id()
        if not patient_id:
            return None
        scoped_filters["patient_id"] = patient_id
    return scoped_filters


def visible_prescriptions(filters: dict | None = None) -> list[dict]:
    scoped_filters = visible_prescription_filters(filters)
    if scoped_filters is None:
        return []
    return prescriptions(scoped_filters)


def prescription_items(rx_id: int) -> list[dict]:
    rows = DatabaseService.get_instance().select_with_join(
        "prescription_items",
        "*, medications(name,generic_name,unit)",
        {"prescription_id": rx_id},
    )
    return rows or select("prescription_items", "*", {"prescription_id": rx_id})


def clean_prescription_payload(data: dict) -> dict:
    return {key: value for key, value in data.items() if key in PRESCRIPTION_COLUMNS}


def clean_prescription_item_payload(data: dict) -> dict:
    return {key: value for key, value in data.items() if key in PRESCRIPTION_ITEM_COLUMNS}


@bp.route("/api/bootstrap")
def api_bootstrap():
    return ok({
        "role": role(),
        "can_write": can_write_prescriptions(),
        "current_doctor_id": current_doctor_id(),
        "doctors": doctors(),
        "patients": visible_patients(),
        "medications": select("medications", "*", {"is_active": True}),
    })


@bp.route("/api/list")
def api_list():
    return jsonify(visible_prescriptions())


@bp.route("/api/<int:rx_id>")
def api_detail(rx_id: int):
    rows = visible_prescriptions({"id": rx_id})
    item = rows[0] if rows else None
    if not item:
        return fail("Receta no encontrada.", 404)
    item["items"] = prescription_items(rx_id)
    return ok({"prescription": item})


@bp.route("/api", methods=["POST"])
def api_create():
    if not can_write_prescriptions():
        return fail("No tienes permiso para crear recetas medicas.", 403)
    data = payload()
    items = data.pop("items", [])
    doctor_id = current_doctor_id() if role() == "doctor" else data.get("doctor_id") or current_doctor_id()
    patient_id = data.get("patient_id")

    if not doctor_id:
        return fail("No se encontro un perfil medico asociado a tu cuenta.", 400)
    if not patient_id:
        return fail("Selecciona un paciente para crear la receta.", 400)
    if role() == "doctor" and not patient_belongs_to_doctor(patient_id, doctor_id):
        return fail("No puedes crear recetas para pacientes de otro medico.", 403)

    data = clean_prescription_payload({
        **data,
        "doctor_id": doctor_id,
        "patient_id": patient_id,
        "issued_at": data.get("issued_at") or datetime.now(timezone.utc).isoformat(),
        "valid_until": data.get("valid_until") or (date.today() + timedelta(days=30)).isoformat(),
    })

    database = DatabaseService.get_instance()
    item = database.insert("prescriptions", data)
    if item and items:
        for child in items:
            child["prescription_id"] = item.get("id")
            database.insert("prescription_items", clean_prescription_item_payload(child))
    if not item:
        error = database.get_last_error()
        message = "No fue posible crear la receta."
        if error:
            message = f"{message} Detalle: {error}"
        return fail(message, 500)
    saved = prescriptions({"id": item.get("id")})
    prescription = saved[0] if saved else item
    prescription["items"] = prescription_items(item.get("id")) if item.get("id") else []
    log_event("create", "prescriptions", item.get("id"), {"patient_id": patient_id})
    return ok({"id": item.get("id"), "item": prescription, "prescription": prescription})


@bp.route("/api/medications")
def api_medications():
    query = str(request.args.get("q", "")).lower()
    items = select("medications", "*", {"is_active": True})
    if query:
        items = [
            item for item in items
            if query in str(item.get("name", "")).lower()
            or query in str(item.get("generic_name", "")).lower()
        ]
    return jsonify(items[:20])
