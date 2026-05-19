from __future__ import annotations

import os
from html import escape
from datetime import datetime
from decimal import Decimal, InvalidOperation

import requests
from flask import Blueprint, current_app, request

from .api_helpers import appointments, by_id, current_doctor_id, current_patient_id, delete, fail, insert, log_event, ok, patients, payload, payment_stats, payments, role, update
from app.services.email_service import EmailService

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
    "paid_at",
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


def _utc_now_iso() -> str:
    return datetime.utcnow().isoformat()


def _normalize_paid_payload(data: dict, existing_payment: dict | None = None) -> dict:
    normalized = dict(data)
    if normalized.get("status") != "paid":
        return normalized

    if not normalized.get("paid_at"):
        normalized["paid_at"] = (existing_payment or {}).get("paid_at") or _utc_now_iso()

    amount = _to_decimal((existing_payment or {}).get("amount") if existing_payment else normalized.get("amount"))
    received_amount = _to_decimal(normalized.get("received_amount"))
    if received_amount is not None and amount is not None and received_amount > amount:
        normalized["returned_amount"] = str(received_amount - amount)
    return normalized


def _insert_payment(data: dict):
    data = _normalize_paid_payload(data)
    item = insert("payments", data)
    if item:
        return item
    clean = _payment_payload(data)
    return insert("payments", clean) if clean != data else None


def _update_payment(payment_id: int, data: dict, existing_payment: dict | None = None):
    data = _normalize_paid_payload(data, existing_payment)
    item = update("payments", payment_id, data)
    if item:
        return item
    clean = _payment_payload(data)
    return update("payments", payment_id, clean) if clean != data else None


def _to_decimal(value) -> Decimal | None:
    if value in (None, ""):
        return None
    try:
        return Decimal(str(value))
    except (InvalidOperation, ValueError):
        return None


def _format_money(value, currency: str | None = "USD") -> str:
    amount = _to_decimal(value) or Decimal("0")
    return f"{currency or 'USD'} {amount:,.2f}"


def _format_date(value) -> str:
    if not value:
        return "--"
    text = str(value)
    if "T" in text:
        date_part, time_part = text.split("T", 1)
        return f"{date_part} {time_part[:5]}"
    return text[:16]


def _status_label(value: str | None) -> str:
    labels = {
        "paid": "Pagado",
        "pending": "Pendiente",
        "refunded": "Reembolsado",
        "cancelled": "Cancelado",
    }
    return labels.get(str(value or ""), value or "Sin estado")


def _email_text(value) -> str:
    return escape(str(value or "--"))


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
    appointment_id = payment.get("appointment_id")
    patient_items = all_patients if all_patients is not None else patients()
    appointment_items = all_appointments if all_appointments is not None else appointments()
    appointment = next((item for item in appointment_items if item.get("id") == appointment_id), None)
    patient_id = payment.get("patient_id") or (appointment or {}).get("patient_id")
    patient = next((item for item in patient_items if str(item.get("id")) == str(patient_id)), None)
    return {
        **payment,
        "patients": patient,
        "appointments": appointment,
    }


def _receipt_url(payment_id: int | str | None) -> str:
    if not payment_id:
        return ""
    return f"{_frontend_origin()}/payments/{payment_id}/receipt"


def _receipt_email_body(payment: dict) -> str:
    patient = payment.get("patients") or {}
    appointment = payment.get("appointments") or {}
    patient_name = patient.get("full_name") or "Paciente"
    reference = payment.get("reference") or f"REC-{payment.get('id')}"
    receipt_url = _receipt_url(payment.get("id"))
    lines = [
        f"Hola {patient_name},",
        "",
        "Hemos recibido el pago de tu cita. Este correo funciona como comprobante de pago.",
        "",
        f"Comprobante: {reference}",
        f"Monto: {_format_money(payment.get('amount'), payment.get('currency'))}",
        f"Metodo: {payment.get('method') or 'No especificado'}",
        f"Fecha de pago: {_format_date(payment.get('paid_at') or payment.get('created_at'))}",
    ]
    if appointment:
        lines.extend([
            "",
            "Datos de la cita:",
            f"Fecha: {_format_date(appointment.get('appointment_date'))}",
            f"Hora: {str(appointment.get('appointment_time') or '--')[:5]}",
            f"Motivo: {appointment.get('reason') or 'Consulta medica'}",
        ])
    if receipt_url:
        lines.extend([
            "",
            f"Puedes ver o imprimir el recibo aqui: {receipt_url}",
        ])
    lines.extend([
        "",
        "Gracias por usar MedApp.",
    ])
    return "\n".join(lines)


def _receipt_email_html(payment: dict) -> str:
    patient = payment.get("patients") or {}
    appointment = payment.get("appointments") or {}
    patient_name = patient.get("full_name") or "Paciente"
    patient_email = patient.get("email") or ""
    patient_phone = patient.get("phone") or ""
    reference = payment.get("reference") or f"REC-{payment.get('id')}"
    amount = _format_money(payment.get("amount"), payment.get("currency"))
    method = payment.get("method") or "No especificado"
    paid_at = _format_date(payment.get("paid_at") or payment.get("created_at"))
    receipt_url = _receipt_url(payment.get("id"))
    status = _status_label(payment.get("status"))
    appointment_date = _format_date(appointment.get("appointment_date")) if appointment else "Sin cita asociada"
    appointment_time = str(appointment.get("appointment_time") or "--")[:5] if appointment else "--"
    appointment_reason = appointment.get("reason") or "Consulta medica"

    receipt_button = ""
    if receipt_url:
        receipt_button = f"""
          <tr>
            <td style="padding: 26px 0 0; text-align: center;">
              <a href="{_email_text(receipt_url)}" style="display: inline-block; border-radius: 14px; background: #28306b; color: #ffffff; font-family: Arial, sans-serif; font-size: 14px; font-weight: 700; padding: 13px 20px; text-decoration: none;">
                Ver o imprimir comprobante
              </a>
            </td>
          </tr>
        """

    return f"""<!doctype html>
<html lang="es">
  <body style="margin: 0; padding: 0; background: #f3f7fb;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: #f3f7fb; border-collapse: collapse; padding: 0;">
      <tr>
        <td align="center" style="padding: 28px 14px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 680px; overflow: hidden; border-radius: 24px; background: #ffffff; border: 1px solid #e8eaf0; border-collapse: separate; box-shadow: 0 18px 45px rgba(43,45,66,0.10);">
            <tr>
              <td style="background: linear-gradient(135deg,#28306b 0%,#4EA8DE 62%,#80ED99 100%); padding: 30px 32px; color: #ffffff;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse: collapse;">
                  <tr>
                    <td style="vertical-align: top;">
                      <div style="font-family: Arial, sans-serif; font-size: 24px; font-weight: 800; line-height: 1.1;">MedApp</div>
                      <div style="font-family: Arial, sans-serif; font-size: 13px; color: rgba(255,255,255,0.78); margin-top: 6px;">Sistema de Gestion Medica</div>
                    </td>
                    <td align="right" style="vertical-align: top;">
                      <div style="font-family: Arial, sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 1.8px; text-transform: uppercase; color: rgba(255,255,255,0.75);">Comprobante de pago</div>
                      <div style="font-family: 'Courier New', monospace; font-size: 18px; font-weight: 800; margin-top: 8px;">{_email_text(reference)}</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td style="padding: 30px 32px 12px;">
                <div style="font-family: Arial, sans-serif; font-size: 20px; font-weight: 800; color: #2b2d42;">Hola, {_email_text(patient_name)}</div>
                <div style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #6b7094; margin-top: 8px;">
                  Hemos recibido tu pago correctamente. Aqui tienes el comprobante con los detalles de la transaccion.
                </div>
              </td>
            </tr>

            <tr>
              <td style="padding: 12px 32px 0;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse: collapse;">
                  <tr>
                    <td width="50%" style="padding: 0 8px 12px 0;">
                      <div style="border: 1px solid #e8eaf0; border-radius: 18px; background: #f8f9fa; padding: 18px;">
                        <div style="font-family: Arial, sans-serif; font-size: 11px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; color: #6b7094;">Estado</div>
                        <div style="display: inline-block; border-radius: 999px; background: #e9fbef; border: 1px solid #89e6a0; color: #1f7a3a; font-family: Arial, sans-serif; font-size: 14px; font-weight: 800; margin-top: 10px; padding: 8px 13px;">{_email_text(status)}</div>
                      </div>
                    </td>
                    <td width="50%" style="padding: 0 0 12px 8px;">
                      <div style="border: 1px solid #e8eaf0; border-radius: 18px; background: #f8f9fa; padding: 18px;">
                        <div style="font-family: Arial, sans-serif; font-size: 11px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; color: #6b7094;">Fecha de pago</div>
                        <div style="font-family: Arial, sans-serif; font-size: 16px; font-weight: 800; color: #2b2d42; margin-top: 10px;">{_email_text(paid_at)}</div>
                      </div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td style="padding: 4px 32px 0;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border: 1px solid #e8eaf0; border-radius: 18px; border-collapse: separate;">
                  <tr>
                    <td width="50%" style="padding: 20px; vertical-align: top; border-right: 1px solid #e8eaf0;">
                      <div style="font-family: Arial, sans-serif; font-size: 11px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; color: #6b7094;">Paciente</div>
                      <div style="font-family: Arial, sans-serif; font-size: 16px; font-weight: 800; color: #2b2d42; margin-top: 8px;">{_email_text(patient_name)}</div>
                      <div style="font-family: Arial, sans-serif; font-size: 13px; line-height: 1.6; color: #6b7094; margin-top: 8px;">{_email_text(patient_email)}<br>{_email_text(patient_phone)}</div>
                    </td>
                    <td width="50%" style="padding: 20px; vertical-align: top;">
                      <div style="font-family: Arial, sans-serif; font-size: 11px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; color: #6b7094;">Datos de la cita</div>
                      <div style="font-family: Arial, sans-serif; font-size: 16px; font-weight: 800; color: #2b2d42; margin-top: 8px;">{_email_text(appointment_date)}</div>
                      <div style="font-family: Arial, sans-serif; font-size: 13px; line-height: 1.6; color: #6b7094; margin-top: 8px;">Hora: {_email_text(appointment_time)}<br>{_email_text(appointment_reason)}</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td style="padding: 24px 32px 0;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border: 1px solid #e8eaf0; border-radius: 18px; border-collapse: separate; overflow: hidden;">
                  <tr>
                    <td style="background: #f3f7fb; padding: 12px 16px; font-family: Arial, sans-serif; font-size: 11px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; color: #6b7094;">Descripcion</td>
                    <td align="center" style="background: #f3f7fb; padding: 12px 16px; font-family: Arial, sans-serif; font-size: 11px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; color: #6b7094;">Metodo</td>
                    <td align="right" style="background: #f3f7fb; padding: 12px 16px; font-family: Arial, sans-serif; font-size: 11px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; color: #6b7094;">Monto</td>
                  </tr>
                  <tr>
                    <td style="padding: 16px; font-family: Arial, sans-serif; font-size: 14px; color: #2b2d42; font-weight: 800;">Consulta medica</td>
                    <td align="center" style="padding: 16px; font-family: Arial, sans-serif; font-size: 13px; color: #236c96;">{_email_text(method)}</td>
                    <td align="right" style="padding: 16px; font-family: Arial, sans-serif; font-size: 16px; color: #2b2d42; font-weight: 800;">{_email_text(amount)}</td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td style="padding: 24px 32px 0;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse: collapse;">
                  <tr>
                    <td style="font-family: Arial, sans-serif; font-size: 13px; line-height: 1.6; color: #6b7094; padding-right: 18px;">
                      Este comprobante fue generado por MedApp como constancia del pago registrado.
                    </td>
                    <td width="260" style="border-radius: 18px; background: linear-gradient(135deg,#28306b,#4EA8DE); padding: 18px; color: #ffffff;">
                      <div style="font-family: Arial, sans-serif; font-size: 11px; font-weight: 800; letter-spacing: 1.4px; text-transform: uppercase; color: rgba(255,255,255,0.72);">Total {_email_text(payment.get('currency') or 'USD')}</div>
                      <div style="font-family: Arial, sans-serif; font-size: 30px; font-weight: 900; line-height: 1.2; text-align: right; margin-top: 4px;">{_email_text(amount)}</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            {receipt_button}

            <tr>
              <td style="padding: 26px 32px 30px;">
                <div style="border-top: 1px solid #e8eaf0; padding-top: 16px; font-family: Arial, sans-serif; font-size: 12px; color: #6b7094;">
                  Gracias por usar MedApp. REF: {_email_text(reference)}
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>"""


def _send_payment_receipt_email(payment: dict | None, previous_status: str | None = None) -> bool:
    if not payment or payment.get("status") != "paid" or previous_status == "paid":
        return False

    enriched = _enrich_payment(payment)
    patient = (enriched or {}).get("patients") or {}
    patient_email = str(patient.get("email") or "").strip()
    if not patient_email:
        current_app.logger.warning("Comprobante de pago no enviado: el paciente no tiene correo registrado.")
        return False

    subject = f"Comprobante de pago MedApp {enriched.get('reference') or enriched.get('id')}"
    try:
        sent = EmailService().send(
            patient_email,
            subject,
            _receipt_email_body(enriched),
            html_body=_receipt_email_html(enriched),
        )
    except Exception as exc:
        current_app.logger.warning("No fue posible enviar el comprobante de pago: %s", exc)
        return False

    if sent:
        log_event("payment_receipt_email_sent", "payments", enriched.get("id"), {"email": patient_email})
    else:
        current_app.logger.warning("Comprobante de pago no enviado: configuracion SMTP incompleta.")
    return sent


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
    receipt_email_sent = _send_payment_receipt_email(item)
    log_event("create", "payments", item.get("id"), {"amount": item.get("amount")})
    return ok({"item": item, "payment": item, "receipt_email_sent": receipt_email_sent})

    
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
    item = _update_payment(payment_id, data, payment)
    if not item:
        return fail("No fue posible marcar el pago como cobrado.", 500)
    receipt_email_sent = _send_payment_receipt_email(item, payment.get("status"))
    log_event("mark_paid", "payments", payment_id)
    return ok({"item": item, "payment": item, "receipt_email_sent": receipt_email_sent})


@bp.route("/api/<int:payment_id>/online-pay", methods=["POST"])
def api_online_pay(payment_id: int):
    if not _can_manage_payments():
        return fail("No tienes permiso para actualizar pagos directamente.", 403)
    payment = by_id("payments", payment_id)
    if not _can_view_payment(payment):
        return fail("Pago no encontrado.", 404)
    item = _update_payment(payment_id, {"status": "paid", **payload()}, payment)
    if not item:
        return fail("No fue posible actualizar el pago.", 500)
    receipt_email_sent = _send_payment_receipt_email(item, payment.get("status"))
    log_event("online_pay", "payments", payment_id)
    return ok({"item": item, "payment": item, "receipt_email_sent": receipt_email_sent})


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
    }, payment)
    if not item:
        return fail("Stripe confirmo el pago, pero no fue posible actualizar MedApp.", 500)

    receipt_email_sent = _send_payment_receipt_email(item, payment.get("status"))
    log_event("stripe_payment_confirmed", "payments", payment_id, {"session_id": session_id})
    return ok({
        "message": "Pago en linea confirmado correctamente.",
        "item": item,
        "payment": item,
        "receipt_email_sent": receipt_email_sent,
    })


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
