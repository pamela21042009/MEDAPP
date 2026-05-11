from __future__ import annotations

from collections import Counter
from datetime import date

from flask import Blueprint, redirect

from .api_helpers import appointments, current_doctor_id, current_patient_id, doctors, ok, patients, payments, role

bp = Blueprint("dashboard", __name__, url_prefix="/")


@bp.route("/")
@bp.route("/dashboard")
def index():
    return redirect("/dashboard")


def _belongs_to_doctor(item: dict, doctor_id: int | None) -> bool:
    if not doctor_id:
        return False
    return str(item.get("doctor_id") or "") == str(doctor_id)


def _belongs_to_patient(item: dict, patient_id: int | None) -> bool:
    if not patient_id:
        return False
    return str(item.get("patient_id") or "") == str(patient_id)


def _payment_belongs_to_doctor(payment: dict, appointments_by_id: dict, doctor_id: int | None) -> bool:
    if not doctor_id:
        return False
    if str(payment.get("doctor_id") or "") == str(doctor_id):
        return True
    appointment = appointments_by_id.get(payment.get("appointment_id"))
    return bool(appointment and _belongs_to_doctor(appointment, doctor_id))


def _payment_belongs_to_patient(payment: dict, appointments_by_id: dict, patient_id: int | None) -> bool:
    if not patient_id:
        return False
    if str(payment.get("patient_id") or "") == str(patient_id):
        return True
    appointment = appointments_by_id.get(payment.get("appointment_id"))
    return bool(appointment and _belongs_to_patient(appointment, patient_id))


def _payment_date(payment: dict) -> str:
    return str(payment.get("paid_at") or payment.get("created_at") or "")[:10]


def _monthly_revenue(items: list[dict]) -> list[dict]:
    monthly = Counter()
    for item in items:
        if item.get("status") != "paid":
            continue
        paid_at = str(item.get("paid_at") or "")
        if not paid_at:
            continue
        monthly[paid_at[:7]] += float(item.get("amount") or 0)
    return [
        {"month": month, "revenue": round(amount, 2)}
        for month, amount in sorted(monthly.items())[-6:]
    ]


@bp.route("/api/dashboard")
def api_dashboard():
    appts = appointments()
    docs = doctors()
    pats = patients()
    pays = payments()
    current_role = role()
    doctor_id = current_doctor_id() if current_role == "doctor" else None
    patient_id = current_patient_id() if current_role == "paciente" else None
    appointments_by_id = {item.get("id"): item for item in appts}

    if current_role == "doctor":
        appts = [item for item in appts if _belongs_to_doctor(item, doctor_id)]
        pays = [item for item in pays if _payment_belongs_to_doctor(item, appointments_by_id, doctor_id)]
        patient_ids = {
            item.get("patient_id")
            for item in [*appts, *pays]
            if item.get("patient_id")
        }
        pats = [item for item in pats if item.get("id") in patient_ids]
        docs = [item for item in docs if str(item.get("id") or "") == str(doctor_id)]

    if current_role == "paciente":
        appts = [item for item in appts if _belongs_to_patient(item, patient_id)]
        pays = [item for item in pays if _payment_belongs_to_patient(item, appointments_by_id, patient_id)]
        doctor_ids = {
            item.get("doctor_id")
            for item in appts
            if item.get("doctor_id")
        }
        pats = [item for item in pats if str(item.get("id") or "") == str(patient_id)]
        docs = [item for item in docs if item.get("id") in doctor_ids]

    doctors_by_id = {item.get("id"): item for item in doctors()}
    patients_by_id = {item.get("id"): item for item in patients()}
    today = date.today().isoformat()
    today_items = [item for item in appts if str(item.get("appointment_date", "")).startswith(today)]
    paid = [item for item in pays if item.get("status") == "paid"]
    revenue_today = sum(float(item.get("amount") or 0) for item in paid if _payment_date(item) == today)
    status_counts = Counter(item.get("status") or "pending" for item in appts)
    specialty_counts = Counter(
        item.get("specialty")
        or (doctors_by_id.get(item.get("doctor_id")) or {}).get("specialty", "")
        for item in appts
    )
    upcoming = sorted(
        [
            {
                **item,
                "doctors": doctors_by_id.get(item.get("doctor_id")),
                "patients": patients_by_id.get(item.get("patient_id")),
            }
            for item in today_items
            if item.get("status") in {None, "", "pending", "confirmed"}
        ],
        key=lambda item: str(item.get("appointment_time") or ""),
    )[:8]
    return ok({
        "stats": {
            "today_total": len(today_items),
            "today_confirmed": len([item for item in today_items if item.get("status") == "confirmed"]),
            "pending_total": len([item for item in appts if item.get("status") in {None, "", "pending"}]),
            "revenue_today": revenue_today,
            "patients_count": len(pats),
            "doctors_count": len(docs),
            "upcoming": upcoming,
        },
        "monthly_revenue": _monthly_revenue(pays),
        "by_status": [{"status": key, "label": key.title(), "count": value} for key, value in status_counts.items()],
        "by_specialty": [
            {"specialty": key or "General", "count": value}
            for key, value in specialty_counts.items()
            if key
        ],
        "role": current_role,
        "current_doctor_id": doctor_id,
        "current_patient_id": patient_id,
    })
