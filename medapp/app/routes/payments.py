from __future__ import annotations

import os
from decimal import Decimal, InvalidOperation

import requests
from flask import Blueprint, current_app, request

from .api_helpers import appointments, by_id, current_doctor_id, current_patient_id, delete, fail, insert, log_event, ok, patients, payload, payment_stats, payments, role, update

bp = Blueprint("payments", __name__, url_prefix="/payments")


STRIPE_API_BASE = "https://api.stripe.com/v1"
PAYMENT_COLUMNS = {
    "appointment_id",
    "patient_id",
    "amount",
    "currency",
    "status",
    "method",
    "reference",
}


def _stripe_secret_key() -> str:
    return os.environ.get("STRIPE_SECRET_KEY", "").strip()


def _stripe_enabled() -> bool:
    return (
        os.environ.get("ONLINE_PAYMENT_ENABLED", "false").lower() == "true"
        and os.environ.get("ONLINE_PAYMENT_PROVIDER", "stripe").lower() == "stripe"
    )


def _frontend_origin() -> str:
    origin = request.headers.get("Origin", "").strip().rstrip("/")
    if origin:
        return origin

    configured = current_app.config.get("FRONTEND_DEV_ORIGINS", ())
    if configured:
        return str(configured[0]).rstrip("/")

    return request.host_url.rstrip("/")


def _amount_to_cents(value) -> int:
    try:
        amount = Decimal(str(value or "0"))
    except (InvalidOperation, ValueError):
        amount = Decimal("0")
    return int((amount * Decimal("100")).quantize(Decimal("1")))


def _stripe_error(response) -> str:
    try:
        return response.json().get("error", {}).get("message") or response.text
    except ValueError:
        return response.text or "Stripe no devolvio una respuesta valida."


def _payment_payload(data: dict) -> dict:
    return {key: value for key, value in data.items() if key in PAYMENT_COLUMNS}


def _insert_payment(data: dict):
    item = insert("payments", data)
    if item:
        return item
    clean = _payment_payload(data)
    return insert("payments", clean) if clean != data else None


def _update_payment(payment_id: int, data: dict):
    item = update("payments", payment_id, data)
    if item:
        return item
    clean = _payment_payload(data)
    return update("payments", payment_id, clean) if clean != data else None


def _appointment_belongs_to_doctor(appointment: dict | None, doctor_id: int | None) -> bool:
    if not appointment or not doctor_id:
        return False
    return str(appointment.get("doctor_id") or "") == str(doctor_id)


def _payment_belongs_to_doctor(payment: dict | None, appointment: dict | None, doctor_id: int | None) -> bool:
    if not payment or not doctor_id:
        return False
    if str(payment.get("doctor_id") or "") == str(doctor_id):
        return True
    return _appointment_belongs_to_doctor(appointment, doctor_id)


def _payment_belongs_to_patient(payment: dict | None, appointment: dict | None, patient_id: int | None) -> bool:
    if not payment or not patient_id:
        return False
    if str(payment.get("patient_id") or "") == str(patient_id):
        return True
    return bool(appointment and str(appointment.get("patient_id") or "") == str(patient_id))


def _can_manage_payments() -> bool:
    return role() in {"admin", "staff", "secretaria"}


def _visible_appointments(all_appointments: list[dict] | None = None) -> list[dict]:
    items = all_appointments if all_appointments is not None else appointments()
    current_role = role()
    if current_role == "paciente":
        patient_id = current_patient_id()
        return [item for item in items if str(item.get("patient_id") or "") == str(patient_id)]
    if current_role != "doctor":
        return items

    doctor_id = current_doctor_id()
    return [item for item in items if _appointment_belongs_to_doctor(item, doctor_id)]


def _visible_payment_items(all_payments: list[dict] | None = None, all_appointments: list[dict] | None = None) -> list[dict]:
    items = all_payments if all_payments is not None else payments()
    current_role = role()
    appointments_by_id = {item.get("id"): item for item in (all_appointments if all_appointments is not None else appointments())}
    if current_role == "paciente":
        patient_id = current_patient_id()
        return [
            item for item in items
            if _payment_belongs_to_patient(item, appointments_by_id.get(item.get("appointment_id")), patient_id)
        ]
    if current_role != "doctor":
        return items

    doctor_id = current_doctor_id()
    return [
        item for item in items
        if _payment_belongs_to_doctor(item, appointments_by_id.get(item.get("appointment_id")), doctor_id)
    ]


def _can_view_payment(payment: dict | None) -> bool:
    if not payment:
        return False
    current_role = role()
    if current_role == "paciente":
        appointment = by_id("appointments", payment.get("appointment_id")) if payment.get("appointment_id") else None
        return _payment_belongs_to_patient(payment, appointment, current_patient_id())
    if current_role != "doctor":
        return True

    appointment = by_id("appointments", payment.get("appointment_id")) if payment.get("appointment_id") else None
    return _payment_belongs_to_doctor(payment, appointment, current_doctor_id())


def _enrich_payment(payment: dict | None, all_patients: list[dict] | None = None, all_appointments: list[dict] | None = None) -> dict | None:
    if not payment:
        return payment
    patient_id = payment.get("patient_id")
    appointment_id = payment.get("appointment_id")
    patient_items = all_patients if all_patients is not None else patients()
    appointment_items = all_appointments if all_appointments is not None else appointments()
    patient = next((item for item in patient_items if item.get("id") == patient_id), None)
    appointment = next((item for item in appointment_items if item.get("id") == appointment_id), None)
    return {
        **payment,
        "patients": patient,
        "appointments": appointment,
    }

    #creacion  la sesión de pago en Stripe.    
def _create_checkout_session(payment: dict):
    secret_key = _stripe_secret_key()
    if not _stripe_enabled() or not secret_key:
        return None, "El pago en linea no esta configurado correctamente."

    amount_cents = _amount_to_cents(payment.get("amount"))
    if amount_cents <= 0:
        return None, "El monto del pago debe ser mayor que cero."

    payment_id = payment.get("id")
    currency = str(payment.get("currency") or os.environ.get("ONLINE_PAYMENT_CURRENCY", "USD")).lower()
    origin = _frontend_origin()
    success_url = f"{origin}/payments/{payment_id}/receipt?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{origin}/payments"

    data = [
        ("mode", "payment"),
        ("success_url", success_url),
        ("cancel_url", cancel_url),
        ("client_reference_id", str(payment_id)),
        ("line_items[0][quantity]", "1"),
        ("line_items[0][price_data][currency]", currency),
        ("line_items[0][price_data][unit_amount]", str(amount_cents)),
        ("line_items[0][price_data][product_data][name]", f"Pago MedApp #{payment_id}"),
        ("metadata[payment_id]", str(payment_id)),
        ("payment_intent_data[metadata][payment_id]", str(payment_id)),
    ]

    response = requests.post(
        f"{STRIPE_API_BASE}/checkout/sessions",
        auth=(secret_key, ""),
        data=data,
        timeout=20,
    )
    if response.status_code >= 400:
        return None, _stripe_error(response)

    return response.json(), ""


    #consulta a Stripe para verificar si el pago fue confirmado
def _retrieve_checkout_session(session_id: str):
    secret_key = _stripe_secret_key()
    if not secret_key:
        return None, "Falta la clave secreta de Stripe."

    response = requests.get(
        f"{STRIPE_API_BASE}/checkout/sessions/{session_id}",
        auth=(secret_key, ""),
        timeout=20,
    )
    if response.status_code >= 400:
        return None, _stripe_error(response)

    return response.json(), ""


@bp.route("/api/bootstrap")
def api_bootstrap():
    all_patients = patients()
    appointment_items = appointments()
    visible_appointments = _visible_appointments(appointment_items)
    visible_payments = _visible_payment_items(payments(), appointment_items)
    visible_patient_ids = {
        item.get("patient_id")
        for item in [*visible_payments, *visible_appointments]
        if item.get("patient_id")
    }
    patient_items = (
        [item for item in all_patients if item.get("id") in visible_patient_ids]
        if role() in {"doctor", "paciente"}
        else all_patients
    )
    items = [
        _enrich_payment(item, patient_items, appointment_items)
        for item in visible_payments
    ]
    return ok({
        "role": role(),
        "current_doctor_id": current_doctor_id() if role() == "doctor" else None,
        "payments": items,
        "patients": patient_items,
        "appointments": visible_appointments,
        "methods": ["cash", "card", "transfer", "online"],
        "stats": payment_stats(items),
        "online_payment": {
            "enabled": os.environ.get("ONLINE_PAYMENT_ENABLED", "false").lower() == "true",
            "provider": os.environ.get("ONLINE_PAYMENT_PROVIDER", "stripe"),
            "currency": os.environ.get("ONLINE_PAYMENT_CURRENCY", "USD"),
            "display_name": "Stripe",
            "stripe": {"publishable_key": os.environ.get("STRIPE_PUBLISHABLE_KEY", "")},
        },
    })


@bp.route("/api/<int:payment_id>")
def api_detail(payment_id: int):
    payment = by_id("payments", payment_id)
    if not _can_view_payment(payment):
        return fail("Pago no encontrado.", 404)
    item = _enrich_payment(payment)
    if not item:
        return fail("Pago no encontrado.", 404)
    return ok({"payment": item})


@bp.route("/api", methods=["POST"])
def api_create():
    if not _can_manage_payments():
        return fail("No tienes permiso para registrar pagos.", 403)
    item = _insert_payment(payload())
    if not item:
        return fail("No fue posible registrar el pago.", 500)
    log_event("create", "payments", item.get("id"), {"amount": item.get("amount")})
    return ok({"item": item, "payment": item})

    
    #orden de pago y devuelve la URL de Stripe.
@bp.route("/api/<int:payment_id>/mark-paid", methods=["POST"])
def api_mark_paid(payment_id: int):
    if not _can_manage_payments():
        return fail("No tienes permiso para marcar pagos como cobrados.", 403)
    payment = by_id("payments", payment_id)
    if not _can_view_payment(payment):
        return fail("Pago no encontrado.", 404)
    data = payload()
    data["status"] = "paid"
    item = _update_payment(payment_id, data)
    log_event("mark_paid", "payments", payment_id)
    return ok({"item": item, "payment": item})


@bp.route("/api/<int:payment_id>/online-pay", methods=["POST"])
def api_online_pay(payment_id: int):
    if not _can_manage_payments():
        return fail("No tienes permiso para actualizar pagos directamente.", 403)
    payment = by_id("payments", payment_id)
    if not _can_view_payment(payment):
        return fail("Pago no encontrado.", 404)
    item = _update_payment(payment_id, {"status": "paid", **payload()})
    log_event("online_pay", "payments", payment_id)
    return ok({"item": item, "payment": item})


@bp.route("/api/<int:payment_id>/online-pay/create-order", methods=["POST"])
def api_create_order(payment_id: int):
    item = by_id("payments", payment_id)
    if not _can_view_payment(item):
        return fail("Pago no encontrado.", 404)
    if item.get("status") == "paid":
        return fail("Este pago ya esta marcado como pagado.", 400)

    session, error = _create_checkout_session(item)
    if error:
        return fail(error, 502)

    checkout_url = session.get("url")
    if not checkout_url:
        return fail("Stripe no devolvio una URL de checkout.", 502)

    log_event("stripe_checkout_created", "payments", payment_id, {"session_id": session.get("id")})
    return ok({"order_id": session.get("id"), "checkout_url": checkout_url})

#Confirma el pago y actualiza la tabla payments
@bp.route("/api/<int:payment_id>/online-pay/capture", methods=["POST"])
def api_capture_order(payment_id: int):
    payment = by_id("payments", payment_id)
    if not _can_view_payment(payment):
        return fail("Pago no encontrado.", 404)

    data = payload()
    session_id = str(data.get("session_id") or "").strip()
    if not session_id:
        return fail("Falta el identificador de la sesion de Stripe.", 400)

    session, error = _retrieve_checkout_session(session_id)
    if error:
        return fail(error, 502)

    expected_payment_id = str(payment_id)
    session_payment_id = str((session.get("metadata") or {}).get("payment_id") or session.get("client_reference_id") or "")
    if session_payment_id != expected_payment_id:
        return fail("La sesion de Stripe no corresponde a este pago.", 400)

    if session.get("payment_status") != "paid":
        return fail("Stripe aun no ha confirmado el pago.", 402)

    item = _update_payment(payment_id, {
        "status": "paid",
        "method": "stripe",
        "reference": session.get("payment_intent") or session.get("id"),
    })
    if not item:
        return fail("Stripe confirmo el pago, pero no fue posible actualizar MedApp.", 500)

    log_event("stripe_payment_confirmed", "payments", payment_id, {"session_id": session_id})
    return ok({"message": "Pago en linea confirmado correctamente.", "item": item, "payment": item})


@bp.route("/api/<int:payment_id>/refund", methods=["POST"])
def api_refund(payment_id: int):
    if not _can_manage_payments():
        return fail("No tienes permiso para reembolsar pagos.", 403)
    payment = by_id("payments", payment_id)
    if not _can_view_payment(payment):
        return fail("Pago no encontrado.", 404)
    item = _update_payment(payment_id, {"status": "refunded"})
    log_event("refund", "payments", payment_id)
    return ok({"item": item, "payment": item})


@bp.route("/api/<int:payment_id>", methods=["DELETE"])
def api_delete(payment_id: int):
    if not _can_manage_payments():
        return fail("No tienes permiso para eliminar pagos.", 403)
    payment = by_id("payments", payment_id)
    if not _can_view_payment(payment):
        return fail("Pago no encontrado.", 404)
    deleted = delete("payments", payment_id)
    log_event("delete", "payments", payment_id)
    return ok(deleted=deleted)


@bp.route("/api/stats")
def api_stats():
    return ok(payment_stats(_visible_payment_items()))
