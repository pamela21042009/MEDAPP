# app/services/notification_service.py
from __future__ import annotations
from typing import Dict, List, Optional
from datetime import datetime
from .database import DatabaseService
from .email_service import EmailService


class NotificationService:
    def __init__(self):
        self._db = DatabaseService.get_instance()

    def get_for_user(self, user_id: int, unread_only: bool = False) -> List[Dict]:
        try:
            q = self._db.client.table("notifications") \
                .select("*").eq("user_id", user_id).order("created_at", desc=True)
            if unread_only:
                q = q.eq("is_read", False)
            return q.limit(50).execute().data or []
        except Exception:
            return []

    def count_unread(self, user_id: int) -> int:
        try:
            return len(self._db.select("notifications", "id",
                                       {"user_id": user_id, "is_read": False}))
        except Exception:
            return 0

    def create(self, user_id: int, type_: str, title: str,
               message: str, link: str = "") -> Optional[Dict]:
        return self._db.insert("notifications", {
            "user_id":    user_id,
            "type":       type_,
            "title":      title,
            "message":    message,
            "is_read":    False,
            "link":       link,
            "created_at": datetime.utcnow().isoformat(),
        })

    def mark_read(self, notif_id: int) -> Optional[Dict]:
        return self._db.update("notifications", {"is_read": True}, {"id": notif_id})

    def mark_all_read(self, user_id: int) -> bool:
        try:
            self._db.client.table("notifications") \
                .update({"is_read": True}) \
                .eq("user_id", user_id).execute()
            return True
        except Exception:
            return False

    # ── Helpers para disparar notifs automáticas ──────────
    def notify_appointment_confirmed(self, user_id: int, appt_date: str, doctor_name: str):
        self.create(user_id, "confirmation",
                    "Cita confirmada",
                    f"Tu cita del {appt_date} con {doctor_name} fue confirmada.",
                    "/agenda")

    def email_appointment_confirmed(self, to_email: str, patient_name: str, appt_date: str, doctor_name: str) -> bool:
        name = patient_name or "paciente"
        return EmailService().send(
            to_email,
            "Cita confirmada - MedApp",
            (
                f"Hola {name},\n\n"
                f"Tu cita del {appt_date} con {doctor_name} fue confirmada.\n\n"
                "Puedes revisar los detalles entrando a MedApp en la seccion Agenda.\n\n"
                "Gracias por usar MedApp."
            ),
        )

    def email_appointment_reminder(self, to_email: str, patient_name: str, appt_date: str, doctor_name: str) -> bool:
        name = patient_name or "paciente"
        return EmailService().send(
            to_email,
            "Recordatorio de cita - MedApp",
            (
                f"Hola {name},\n\n"
                f"Te recordamos que tienes una cita el {appt_date} con {doctor_name}.\n\n"
                "Por favor llega unos minutos antes y revisa tu agenda en MedApp si necesitas confirmar detalles.\n\n"
                "Gracias por usar MedApp."
            ),
        )

    def notify_payment_received(self, user_id: int, amount: float, reference: str):
        self.create(user_id, "payment",
                    "Pago recibido",
                    f"Se registró un pago de ${amount:.2f} — Ref: {reference}",
                    "/payments")

    def notify_appointment_cancelled(self, user_id: int, appt_date: str):
        self.create(user_id, "cancellation",
                    "Cita cancelada",
                    f"La cita del {appt_date} fue cancelada.",
                    "/agenda")
