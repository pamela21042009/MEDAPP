from __future__ import annotations

import os
import threading
import time
from datetime import datetime, timedelta

from app.routes.api_helpers import by_id, insert, select
from app.services.email_service import EmailService
from app.services.notification_service import NotificationService


REMINDER_ACTION = "APPOINTMENT_REMINDER_SENT"


def _truthy_env(name: str, default: str = "false") -> bool:
    return str(os.environ.get(name, default)).strip().lower() in {"1", "true", "yes", "on"}


def _appointment_datetime(appointment: dict) -> datetime | None:
    date_value = str(appointment.get("appointment_date") or appointment.get("date") or "")[:10]
    time_value = str(appointment.get("appointment_time") or appointment.get("time") or "00:00")[:5]
    if not date_value:
        return None
    try:
        return datetime.fromisoformat(f"{date_value}T{time_value}:00")
    except ValueError:
        return None


def _patient_user_id(patient: dict | None) -> int | None:
    if not patient:
        return None
    if patient.get("user_id"):
        return int(patient["user_id"])
    email = str(patient.get("email") or "").strip()
    if not email:
        return None
    rows = select("users", "id,email", {"email": email})
    return int(rows[0]["id"]) if rows and rows[0].get("id") else None


def _reminder_already_sent(appointment_id: int) -> bool:
    checks = [
        ("audit_log", {"action": REMINDER_ACTION, "table_name": "appointments", "record_id": appointment_id}),
        ("audit_logs", {"action": "appointment_reminder_sent", "entity": "appointments", "entity_id": appointment_id}),
    ]
    for table, filters in checks:
        try:
            if select(table, "id", filters):
                return True
        except Exception:
            continue
    return False


def _mark_reminder_sent(appointment_id: int, patient_email: str, sent: bool) -> None:
    insert("audit_log", {
        "user_id": None,
        "action": REMINDER_ACTION,
        "table_name": "appointments",
        "record_id": appointment_id,
        "new_values": {"email": patient_email, "sent": sent},
        "ip_address": "reminder-worker",
        "created_at": datetime.utcnow().isoformat(),
    })


class ReminderService:
    def __init__(self):
        self._email = EmailService()
        self._notifications = NotificationService()

    def scan_and_send(self, now: datetime | None = None) -> dict:
        now = now or datetime.now()
        reminder_hours = int(os.environ.get("REMINDER_HOURS_DEFAULT") or 24)
        window_minutes = int(os.environ.get("REMINDER_WINDOW_MINUTES") or 15)
        target_start = now + timedelta(hours=reminder_hours)
        target_end = target_start + timedelta(minutes=window_minutes)
        scanned = 0
        sent = 0
        skipped = 0
        errors: list[str] = []

        for appointment in select("appointments", "*"):
            appointment_id = appointment.get("id")
            status = appointment.get("status") or "pending"
            if not appointment_id or status not in {"confirmed", "pending"}:
                skipped += 1
                continue

            appointment_dt = _appointment_datetime(appointment)
            if not appointment_dt or appointment_dt < target_start or appointment_dt > target_end:
                skipped += 1
                continue

            scanned += 1
            if _reminder_already_sent(int(appointment_id)):
                skipped += 1
                continue

            patient = by_id("patients", int(appointment.get("patient_id"))) if appointment.get("patient_id") else None
            doctor = by_id("doctors", int(appointment.get("doctor_id"))) if appointment.get("doctor_id") else None
            patient_email = str((patient or {}).get("email") or "").strip()
            if not patient_email:
                skipped += 1
                _mark_reminder_sent(int(appointment_id), "", False)
                continue

            patient_name = (patient or {}).get("full_name") or "paciente"
            doctor_name = (doctor or {}).get("full_name") or "tu medico"
            appointment_label = appointment_dt.strftime("%Y-%m-%d %H:%M")
            subject = "Recordatorio de cita - MedApp"
            body = (
                f"Hola {patient_name},\n\n"
                f"Te recordamos que tienes una cita el {appointment_label} con {doctor_name}.\n\n"
                "Por favor llega unos minutos antes y revisa tu agenda en MedApp si necesitas confirmar detalles.\n\n"
                "Gracias por usar MedApp."
            )

            try:
                email_sent = self._email.send(patient_email, subject, body)
                user_id = _patient_user_id(patient)
                if user_id:
                    self._notifications.create(
                        user_id,
                        "reminder",
                        "Recordatorio de cita",
                        f"Tienes una cita el {appointment_label} con {doctor_name}.",
                        "/agenda",
                    )
                _mark_reminder_sent(int(appointment_id), patient_email, email_sent)
                sent += 1 if email_sent else 0
            except Exception as exc:
                errors.append(f"Cita {appointment_id}: {exc}")

        return {"scanned": scanned, "sent": sent, "skipped": skipped, "errors": errors}


def start_reminder_worker(app) -> None:
    if _truthy_env("DISABLE_REMINDER_WORKER", "false"):
        app.logger.info("Worker de recordatorios desactivado por DISABLE_REMINDER_WORKER.")
        return
    if not _truthy_env("REMINDER_WORKER_ENABLED", "true"):
        app.logger.info("Worker de recordatorios desactivado por REMINDER_WORKER_ENABLED.")
        return
    if app.debug and os.environ.get("WERKZEUG_RUN_MAIN") != "true":
        return

    interval = int(os.environ.get("REMINDER_SCAN_INTERVAL_SECONDS") or 300)

    def run_loop():
        with app.app_context():
            service = ReminderService()
            while True:
                try:
                    result = service.scan_and_send()
                    if result.get("scanned") or result.get("errors"):
                        app.logger.info("Recordatorios procesados: %s", result)
                except Exception as exc:
                    app.logger.warning("Worker de recordatorios fallo: %s", exc)
                time.sleep(interval)

    thread = threading.Thread(target=run_loop, name="medapp-reminder-worker", daemon=True)
    thread.start()
