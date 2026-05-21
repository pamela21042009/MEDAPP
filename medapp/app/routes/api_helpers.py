from __future__ import annotations

from datetime import date, datetime, timedelta
from typing import Any

from flask import jsonify, request, session

from app.services.database import DatabaseService
from app.services.security import current_identity


STATUS_LABELS = {
    "pending": "Pendiente",
    "confirmed": "Confirmada",
    "cancelled": "Cancelada",
    "completed": "Atendida",
    "no_show": "No asistida",
    "rescheduled": "Reprogramada",
    "paid": "Pagado",
    "refunded": "Reembolsado",
}


def db() -> DatabaseService:
    return DatabaseService.get_instance()


def payload() -> dict[str, Any]:
    return request.get_json(silent=True) or {}


def ok(data: Any = None, **extra: Any):
    if isinstance(data, dict):
        body = {**data, **extra}
    elif data is None:
        body = {**extra} if extra else {"ok": True}
    else:
        body = {"items": data, **extra}
    return jsonify(body)


def fail(message: str, status: int = 400):
    return jsonify({"error": message}), status


def current_user() -> dict[str, Any]:
    identity = current_identity()
    if identity:
        return {
            "id": identity.get("id"),
            "name": identity.get("name") or identity.get("full_name") or "Usuario",
            "full_name": identity.get("full_name") or identity.get("name") or "Usuario",
            "role": identity.get("role", "staff"),
            "email": identity.get("email", ""),
            "avatar_url": identity.get("avatar_url", ""),
        }
    current_role = session.get("user_role", "staff")
    return {
        "id": session.get("user_id"),
        "name": session.get("user_name", "Usuario"),
        "full_name": session.get("user_name", "Usuario"),
        "role": current_role,
        "email": session.get("user_email", ""),
        "avatar_url": session.get("user_avatar_url", ""),
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


def current_patient_id() -> int | None:
    user = current_user()
    candidates: list[dict[str, Any]] = []

    def add_candidates(rows: list[dict[str, Any]]) -> None:
        seen_ids = {str(item.get("id") or "") for item in candidates}
        for row in rows:
            row_id = str(row.get("id") or "")
            if row_id and row_id not in seen_ids:
                candidates.append(row)
                seen_ids.add(row_id)

    if user.get("email"):
        email = str(user["email"]).strip()
        normalized_email = email.lower()
        add_candidates(select("patients", "id,user_id,email,full_name,phone,birth_date,gender,address,blood_type,allergies,insurance_number,avatar_url", {"email": normalized_email}))
        if email != normalized_email:
            add_candidates(select("patients", "id,user_id,email,full_name,phone,birth_date,gender,address,blood_type,allergies,insurance_number,avatar_url", {"email": email}))
    if user.get("id"):
        add_candidates(select("patients", "id,user_id,email,full_name,phone,birth_date,gender,address,blood_type,allergies,insurance_number,avatar_url", {"user_id": user["id"]}))

    if not candidates:
        return None

    def related_count(patient_id: Any) -> int:
        return sum(
            len(select(table, "id", {"patient_id": patient_id}))
            for table in ("appointments", "medical_history", "vital_signs", "patient_documents", "payments", "prescriptions")
        )

    def profile_count(patient: dict[str, Any]) -> int:
        fields = ("phone", "birth_date", "gender", "address", "blood_type", "allergies", "insurance_number", "avatar_url")
        return sum(1 for field in fields if patient.get(field))

    def patient_score(patient: dict[str, Any]) -> tuple[int, int, int]:
        return (
            related_count(patient.get("id")),
            profile_count(patient),
            1 if str(patient.get("user_id") or "") == str(user.get("id") or "") else 0,
        )

    selected = max(candidates, key=patient_score)
    if user.get("id") and str(selected.get("user_id") or "") != str(user["id"]):
        linked = update("patients", selected.get("id"), {"user_id": user["id"]})
        if linked:
            selected = linked
    return selected.get("id")


def role() -> str:
    return str(current_user().get("role") or "staff")


def can_manage() -> bool:
    return role() == "admin"


def log_event(action: str, entity: str = "", entity_id: Any = None, details: dict[str, Any] | None = None) -> None:
    details = details or {}
    audit_log_data = {
        "user_id": session.get("user_id"),
        "action": str(action or "").upper(),
        "table_name": entity or "",
        "record_id": entity_id,
        "new_values": details,
        "ip_address": request.remote_addr or "",
        "created_at": datetime.utcnow().isoformat(),
    }
    database = db()
    if database.insert("audit_log", audit_log_data):
        return

    data = {
        "user_id": session.get("user_id"),
        "user_name": session.get("user_name", ""),
        "role": role(),
        "action": action,
        "entity": entity,
        "entity_id": entity_id,
        "details": details,
        "created_at": datetime.utcnow().isoformat(),
    }
    database.insert("audit_logs", data)


def select(table: str, columns: str = "*", filters: dict[str, Any] | None = None) -> list[dict[str, Any]]:
    return db().select(table, columns, filters or {})


def by_id(table: str, item_id: int, columns: str = "*") -> dict[str, Any] | None:
    rows = select(table, columns, {"id": item_id})
    return rows[0] if rows else None


def insert(table: str, data: dict[str, Any]):
    return db().insert(table, data)


def update(table: str, item_id: int, data: dict[str, Any]):
    return db().update(table, data, {"id": item_id})


def delete(table: str, item_id: int) -> bool:
    return db().delete(table, {"id": item_id})


def doctors() -> list[dict[str, Any]]:
    return select("doctors", "*")


def patients() -> list[dict[str, Any]]:
    return select("patients", "*")


def patient_ids_for_doctor(doctor_id: int | None = None) -> set[Any]:
    doctor_id = doctor_id or current_doctor_id()
    if not doctor_id:
        return set()

    patient_ids: set[Any] = set()
    for table in ("appointments", "prescriptions", "medical_history"):
        for item in select(table, "patient_id", {"doctor_id": doctor_id}):
            patient_id = item.get("patient_id")
            if patient_id:
                patient_ids.add(patient_id)
    return patient_ids


def patient_belongs_to_doctor(patient_id: int | None, doctor_id: int | None = None) -> bool:
    if not patient_id:
        return False
    return str(patient_id) in {str(item) for item in patient_ids_for_doctor(doctor_id)}


def visible_patients() -> list[dict[str, Any]]:
    current_role = role()
    if current_role == "paciente":
        patient_id = current_patient_id()
        return [item for item in patients() if str(item.get("id") or "") == str(patient_id)]

    if current_role != "doctor":
        return patients()

    allowed_ids = {str(item) for item in patient_ids_for_doctor()}
    return [item for item in patients() if str(item.get("id") or "") in allowed_ids]


def appointments() -> list[dict[str, Any]]:
    return select("appointments", "*")


def payments() -> list[dict[str, Any]]:
    return select("payments", "*")


def specialties() -> list[str]:
    rows = select("specialties", "name,is_active")
    if rows:
        return sorted({
            str(item.get("name") or "").strip()
            for item in rows
            if item.get("is_active") is not False and str(item.get("name") or "").strip()
        })

    values = []
    for item in doctors():
        specialty = item.get("specialty")
        if specialty and specialty not in values:
            values.append(specialty)
    return sorted(values)


def payment_stats(items: list[dict[str, Any]]) -> dict[str, Any]:
    paid = [item for item in items if item.get("status") == "paid"]
    pending = [item for item in items if item.get("status") in {None, "", "pending"}]
    refunded = [item for item in items if item.get("status") == "refunded"]
    return {
        "total_revenue": sum(float(item.get("amount") or 0) for item in paid),
        "pending_revenue": sum(float(item.get("amount") or 0) for item in pending),
        "paid_count": len(paid),
        "pending_count": len(pending),
        "refunded_count": len(refunded),
        "total_count": len(items),
    }


def default_week() -> list[dict[str, Any]]:
    labels = ["Lunes", "Martes", "Miercoles", "Jueves", "Viernes", "Sabado", "Domingo"]
    return [
        {
            "weekday": index,
            "label": label,
            "is_active": index < 5,
            "start_time": "08:00",
            "end_time": "17:00",
            "break_start": "12:00",
            "break_end": "13:00",
            "slot_minutes": 30,
        }
        for index, label in enumerate(labels)
    ]


def next_slots() -> list[str]:
    start = datetime.combine(date.today(), datetime.strptime("08:00", "%H:%M").time())
    return [(start + timedelta(minutes=30 * index)).strftime("%H:%M") for index in range(18)]
