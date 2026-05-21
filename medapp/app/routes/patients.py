from __future__ import annotations

from datetime import date, datetime, timezone

from flask import Blueprint, jsonify, request

from .api_helpers import (
    by_id,
    current_patient_id,
    current_user,
    db,
    fail,
    insert,
    log_event,
    ok,
    patient_belongs_to_doctor,
    payload,
    role,
    select,
    update,
    visible_patients,
)
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


def patient_user_for_email(email: str | None) -> dict | None:
    normalized = str(email or "").strip().lower()
    if not normalized:
        return None

    for candidate in (normalized, str(email or "").strip()):
        if not candidate:
            continue
        rows = select("users", "id,email,role,full_name", {"email": candidate})
        user = rows[0] if rows else None
        if user and user.get("role") == "paciente":
            return user
    return None


def sync_patient_user_link(patient: dict | None) -> dict | None:
    if not patient:
        return patient

    user = patient_user_for_email(patient.get("email"))
    if not user:
        return patient

    if str(patient.get("user_id") or "") == str(user.get("id") or ""):
        return patient

    linked = update("patients", patient.get("id"), {"user_id": user.get("id")})
    if linked:
        log_event("patient_user_linked", "patients", patient.get("id"), {"user_id": user.get("id")})
        return linked
    return patient


def can_manage_patients() -> bool:
    return role() in {"admin", "staff", "secretaria", "doctor"}


def can_manage_all_patients() -> bool:
    return role() in {"admin", "staff", "secretaria"}


def can_create_patients() -> bool:
    if can_manage_all_patients():
        return True
    return role() == "doctor" and bool(current_doctor_id())


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
    if can_manage_all_patients():
        return True
    current_role = role()
    if current_role == "doctor":
        return patient_belongs_to_doctor(patient_id, current_doctor_id())
    if current_role == "paciente":
        return str(ensure_current_patient_id() or "") == str(patient_id)
    return False


def filter_patient_list(items: list[dict]) -> list[dict]:
    query = str(request.args.get("q") or request.args.get("search") or "").strip().lower()
    if not query:
        return items
    return [
        item for item in items
        if query in str(item.get("full_name") or "").lower()
        or query in str(item.get("email") or "").lower()
        or query in str(item.get("phone") or "").lower()
        or query in str(item.get("insurance_number") or "").lower()
    ]


def patient_payload(item: dict) -> dict:
    can_edit = can_manage_patients() and can_view_patient(int(item.get("id") or 0))
    patient_id = item.get("id")
    history = select("appointments", "*", {"patient_id": patient_id}) if patient_id else []
    clinical_history = select("medical_history", "*", {"patient_id": patient_id}) if patient_id else []

    if role() == "doctor":
        doctor_id = current_doctor_id()
        history = [
            appointment for appointment in history
            if str(appointment.get("doctor_id") or "") == str(doctor_id)
        ]
        clinical_history = [
            entry for entry in clinical_history
            if str(entry.get("doctor_id") or "") == str(doctor_id)
        ]

    return {
        "patient": item,
        "history": history,
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


def link_patient_to_current_doctor(patient_id: int | None) -> bool:
    if role() != "doctor":
        return True

    doctor_id = current_doctor_id()
    if not patient_id or not doctor_id:
        return False

    now = datetime.now(timezone.utc).isoformat()
    base = {
        "patient_id": patient_id,
        "doctor_id": doctor_id,
        "visit_date": date.today().isoformat(),
        "diagnosis": "Registro de paciente",
        "treatment": "",
        "notes": "Paciente registrado desde el perfil del medico.",
        "created_at": now,
    }
    attempts = [
        base,
        {key: value for key, value in base.items() if key != "created_at"},
        {key: value for key, value in base.items() if key not in {"created_at", "treatment"}},
        {"patient_id": patient_id, "doctor_id": doctor_id, "notes": base["notes"]},
        {"patient_id": patient_id, "doctor_id": doctor_id},
    ]

    seen = set()
    for attempt in attempts:
        signature = tuple(sorted(attempt.keys()))
        if signature in seen:
            continue
        seen.add(signature)
        if insert("medical_history", attempt):
            log_event("doctor_patient_linked", "patients", patient_id, {"doctor_id": doctor_id})
            return True
    return False


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
        "can_create": can_create_patients(),
        "current_patient_id": ensure_current_patient_id() if role() == "paciente" else None,
        "current_doctor_id": current_doctor_id() if role() == "doctor" else None,
    })


@bp.route("/api/list")
def api_list():
    if role() == "paciente":
        patient_id = ensure_current_patient_id()
        item = by_id("patients", patient_id) if patient_id else None
        return jsonify([item] if item else [])
    return jsonify(filter_patient_list(visible_patients()))


@bp.route("/api/search")
def api_search():
    if role() == "paciente":
        patient_id = ensure_current_patient_id()
        item = by_id("patients", patient_id) if patient_id else None
        return jsonify([item] if item else [])
    return jsonify(filter_patient_list(visible_patients()))


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
    if not can_create_patients():
        return fail("No tienes permiso para registrar pacientes.", 403)
    item = insert("patients", clean_patient_payload(payload(), allow_avatar=False))
    if not item:
        detail = db().get_last_error()
        return fail(f"No fue posible crear el paciente. Detalle: {detail}" if detail else "No fue posible crear el paciente.", 500)
    if role() == "doctor" and not link_patient_to_current_doctor(item.get("id")):
        detail = db().get_last_error()
        return fail(
            "Paciente creado, pero no fue posible asociarlo a tu perfil medico."
            + (f" Detalle: {detail}" if detail else ""),
            500,
        )
    item = sync_patient_user_link(item)
    log_event("create", "patients", item.get("id"))
    return ok(item)


@bp.route("/api/<int:patient_id>", methods=["PUT"])
def api_update(patient_id: int):
    if not can_manage_patients():
        return fail("No tienes permiso para editar pacientes.", 403)
    if not can_view_patient(patient_id):
        return fail("Paciente no encontrado.", 404)
    item = update("patients", patient_id, clean_patient_payload(payload(), allow_avatar=False))
    if not item:
        detail = db().get_last_error()
        return fail(f"No fue posible actualizar el paciente. Detalle: {detail}" if detail else "No fue posible actualizar el paciente.", 500)
    item = sync_patient_user_link(item)
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
    if not can_manage_patients() or not can_view_patient(patient_id):
        return fail("Paciente no encontrado.", 404)
    appointment = by_id("appointments", appointment_id)
    if not appointment or str(appointment.get("patient_id") or "") != str(patient_id):
        return fail("Cita no encontrada.", 404)
    if role() == "doctor" and str(appointment.get("doctor_id") or "") != str(current_doctor_id()):
        return fail("Cita no encontrada.", 404)
    item = update("appointments", appointment_id, payload())
    log_event("clinical_note", "appointments", appointment_id, {"patient_id": patient_id})
    return ok({"item": item, "appointment": item, "patient_id": patient_id})


@bp.route("/api/<int:patient_id>/clinical-history", methods=["POST"])
def api_clinical_history(patient_id: int):
    if not can_manage_patients():
        return fail("No tienes permiso para registrar historial clinico.", 403)
    if not can_view_patient(patient_id):
        return fail("Paciente no encontrado.", 404)
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
    if not can_view_patient(patient_id):
        return fail("Paciente no encontrado.", 404)
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
    if not can_view_patient(patient_id):
        return fail("Paciente no encontrado.", 404)
    data = payload()
    data["patient_id"] = patient_id
    item = insert("patient_documents", data)
    log_event("create", "patient_documents", item.get("id") if item else None, {"patient_id": patient_id})
    return ok({"item": item})
