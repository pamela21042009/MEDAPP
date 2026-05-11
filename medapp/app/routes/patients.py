from __future__ import annotations

from datetime import datetime, timezone

from flask import Blueprint, jsonify, request

from .api_helpers import by_id, current_patient_id, current_user, db, fail, insert, log_event, ok, patients, payload, role, select, update
from .avatar_upload import upload_avatar_to_supabase

bp = Blueprint("patients", __name__, url_prefix="/patients")

PATIENT_COLUMNS = {
    "full_name",
    "email",
    "phone",
    "avatar_url",
    "birth_date",
    "gender",
    "address",
    "blood_type",
    "allergies",
    "insurance_number",
}


def can_manage_patients() -> bool:
    return role() in {"admin", "staff", "secretaria", "doctor"}


def clean_patient_payload(data: dict, allow_avatar: bool = False) -> dict:
    allowed = set(PATIENT_COLUMNS)
    if not allow_avatar:
        allowed.discard("avatar_url")

    cleaned = {key: value for key, value in data.items() if key in allowed}
    if cleaned.get("birth_date") == "":
        cleaned["birth_date"] = None
    return cleaned


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


def can_view_patient(patient_id: int) -> bool:
    if can_manage_patients():
        return True
    if role() != "paciente":
        return False
    return str(ensure_current_patient_id() or "") == str(patient_id)


def patient_payload(item: dict) -> dict:
    can_edit = can_manage_patients()
    patient_id = item.get("id")
    clinical_history = select("medical_history", "*", {"patient_id": patient_id}) if patient_id else []
    if not clinical_history and patient_id:
        clinical_history = select("clinical_history", "*", {"patient_id": patient_id})
    return {
        "patient": item,
        "history": select("appointments", "*", {"patient_id": patient_id}) if patient_id else [],
        "clinical_history": clinical_history,
        "vital_signs": select("vital_signs", "*", {"patient_id": patient_id}) if patient_id else [],
        "documents": select("patient_documents", "*", {"patient_id": patient_id}) if patient_id else [],
        "permissions": {
            "can_edit": can_edit,
            "can_add_history": can_edit,
            "can_add_vitals": can_edit,
            "can_add_documents": can_edit,
        },
    }


def current_doctor_id() -> int | None:
    user = current_user()
    if user.get("id"):
        doctors = select("doctors", "id,user_id,email", {"user_id": user["id"]})
        if doctors:
            return doctors[0].get("id")
    if user.get("email"):
        doctors = select("doctors", "id,user_id,email", {"email": user["email"]})
        if doctors:
            return doctors[0].get("id")
    return None


def clean_vitals_payload(raw: dict, patient_id: int) -> dict:
    numeric_fields = {
        "appointment_id": int,
        "weight_kg": float,
        "height_cm": float,
        "heart_rate": int,
        "temperature_c": float,
        "oxygen_saturation": int,
    }
    data = {"patient_id": patient_id}
    for key, caster in numeric_fields.items():
        value = raw.get(key)
        if value in (None, ""):
            continue
        try:
            data[key] = caster(value)
        except (TypeError, ValueError):
            continue
    blood_pressure = str(raw.get("blood_pressure") or "").strip()
    if blood_pressure:
        data["blood_pressure"] = blood_pressure
    data["recorded_at"] = datetime.now(timezone.utc).isoformat()
    return data


def insert_vitals(data: dict):
    attempts = [data]
    if "appointment_id" in data:
        attempts.append({key: value for key, value in data.items() if key != "appointment_id"})
    attempts.append({key: value for key, value in data.items() if key not in {"appointment_id", "recorded_at"}})

    seen = set()
    for attempt in attempts:
        signature = tuple(sorted(attempt.keys()))
        if signature in seen:
            continue
        seen.add(signature)
        item = insert("vital_signs", attempt)
        if item:
            return item
    return None


@bp.route("/api/bootstrap")
def api_bootstrap():
    return ok({
        "role": role(),
        "can_manage": can_manage_patients(),
        "current_patient_id": ensure_current_patient_id() if role() == "paciente" else None,
    })


@bp.route("/api/list")
def api_list():
    if role() == "paciente":
        patient_id = ensure_current_patient_id()
        item = by_id("patients", patient_id) if patient_id else None
        return jsonify([item] if item else [])
    return jsonify(patients())


@bp.route("/api/search")
def api_search():
    if role() == "paciente":
        patient_id = ensure_current_patient_id()
        item = by_id("patients", patient_id) if patient_id else None
        return jsonify([item] if item else [])
    return jsonify(patients())


@bp.route("/api/<int:patient_id>")
def api_detail(patient_id: int):
    if not can_view_patient(patient_id):
        return fail("Paciente no encontrado.", 404)
    item = by_id("patients", patient_id)
    if not item:
        return fail("Paciente no encontrado.", 404)
    return ok(patient_payload(item))


@bp.route("/api", methods=["POST"])
def api_create():
    if not can_manage_patients():
        return fail("No tienes permiso para registrar pacientes.", 403)
    item = insert("patients", clean_patient_payload(payload(), allow_avatar=False))
    if not item:
        detail = db().get_last_error()
        return fail(f"No fue posible crear el paciente. Detalle: {detail}" if detail else "No fue posible crear el paciente.", 500)
    log_event("create", "patients", item.get("id"))
    return ok(item)


@bp.route("/api/<int:patient_id>", methods=["PUT"])
def api_update(patient_id: int):
    if not can_manage_patients():
        return fail("No tienes permiso para editar pacientes.", 403)
    item = update("patients", patient_id, clean_patient_payload(payload(), allow_avatar=False))
    if not item:
        detail = db().get_last_error()
        return fail(f"No fue posible actualizar el paciente. Detalle: {detail}" if detail else "No fue posible actualizar el paciente.", 500)
    log_event("update", "patients", patient_id)
    return ok(item)


@bp.route("/api/<int:patient_id>/avatar", methods=["POST"])
def api_upload_avatar(patient_id: int):
    if not can_view_patient(patient_id):
        return fail("No tienes permiso para subir la imagen de este paciente.", 403)

    file = request.files.get("avatar")
    if not file or not file.filename:
        return fail("Selecciona una imagen desde tu equipo.", 400)

    try:
        avatar_url = upload_avatar_to_supabase(f"patients/patient-{patient_id}", file)
    except Exception as exc:
        return fail(f"No fue posible subir la imagen. Detalle: {exc}", 500)
    if not avatar_url:
        return fail("La imagen debe ser PNG, JPG, JPEG o WEBP.", 400)

    item = update("patients", patient_id, {"avatar_url": avatar_url})
    if not item:
        return fail("No fue posible guardar la foto del paciente.", 500)
    log_event("update", "patients", patient_id, {"avatar_url": avatar_url})
    return ok({"avatar_url": avatar_url, "patient": item, "item": item})


@bp.route("/api/<int:patient_id>/appointments/<int:appointment_id>/notes", methods=["PUT"])
def api_notes(patient_id: int, appointment_id: int):
    item = update("appointments", appointment_id, payload())
    log_event("clinical_note", "appointments", appointment_id, {"patient_id": patient_id})
    return ok({"item": item, "patient_id": patient_id})


@bp.route("/api/<int:patient_id>/clinical-history", methods=["POST"])
def api_clinical_history(patient_id: int):
    if not can_manage_patients():
        return fail("No tienes permiso para registrar historial clinico.", 403)
    data = payload()
    data["patient_id"] = patient_id
    doctor_id = current_doctor_id()
    if doctor_id:
        data.setdefault("doctor_id", doctor_id)
    data.setdefault("visit_date", datetime.now(timezone.utc).date().isoformat())
    data.setdefault("created_at", datetime.now(timezone.utc).isoformat())
    item = insert("medical_history", data)
    log_event("create", "medical_history", item.get("id") if item else None, {"patient_id": patient_id})
    return ok({"item": item})


@bp.route("/api/<int:patient_id>/vitals", methods=["POST"])
def api_vitals(patient_id: int):
    if not can_manage_patients():
        return fail("No tienes permiso para registrar signos vitales.", 403)
    data = clean_vitals_payload(payload(), patient_id)
    item = insert_vitals(data)
    if not item:
        error = db().get_last_error() or "Supabase rechazo el registro de signos vitales."
        return fail(f"No fue posible guardar signos vitales: {error}", 500)
    log_event("create", "vital_signs", item.get("id") if item else None, {"patient_id": patient_id})
    return ok({"item": item})


@bp.route("/api/<int:patient_id>/documents", methods=["POST"])
def api_documents(patient_id: int):
    if not can_manage_patients():
        return fail("No tienes permiso para registrar documentos.", 403)
    data = payload()
    data["patient_id"] = patient_id
    item = insert("patient_documents", data)
    log_event("create", "patient_documents", item.get("id") if item else None, {"patient_id": patient_id})
    return ok({"item": item})
