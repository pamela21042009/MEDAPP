from __future__ import annotations
from typing import Dict, List, Optional
from datetime import datetime
import uuid

from .database import DatabaseService


class PaymentService:
    STATUS_PAID     = "paid"
    STATUS_PENDING  = "pending"
    STATUS_REFUNDED = "refunded"

    METHODS = ["Efectivo", "Tarjeta de crédito", "Tarjeta de débito",
               "Transferencia", "PayPal", "Otro"]

    def __init__(self) -> None:
        self._db = DatabaseService.get_instance()

    # ── Consultas ──────────────────────────────────────────
    def get_all(self) -> List[Dict]:
        return self._db.select_with_join(
            "payments",
            "*, appointments(appointment_date, appointment_time, reason), patients(full_name, email)"
        )

    def get_by_id(self, payment_id: int) -> Optional[Dict]:
        results = self._db.select_with_join(
            "payments",
            "*, appointments(appointment_date, appointment_time, reason, doctors(full_name, specialty)), patients(full_name, email, phone)",
            {"id": payment_id}
        )
        return results[0] if results else None

    def get_by_patient(self, patient_id: int) -> List[Dict]:
        return self._db.select_with_join(
            "payments",
            "*, appointments(appointment_date, appointment_time, reason)",
            {"patient_id": patient_id}
        )

    # ── Crear pago ─────────────────────────────────────────
    def create(self, data: Dict) -> Optional[Dict]:
        data["status"]     = data.get("status", self.STATUS_PENDING)
        data["currency"]   = data.get("currency", "USD")
        data["reference"]  = data.get("reference") or self._generate_reference()
        data["created_at"] = datetime.utcnow().isoformat()
        return self._db.insert("payments", data)

    def create_from_appointment(self, appointment_id: int, patient_id: int,
                                 amount: float, method: str = "Efectivo") -> Optional[Dict]:
        """Crea un pago directamente desde una cita."""
        return self.create({
            "appointment_id": appointment_id,
            "patient_id":     patient_id,
            "amount":         amount,
            "method":         method,
            "status":         self.STATUS_PENDING,
        })

    # ── Actualizar estado ──────────────────────────────────
    def mark_paid(self, payment_id: int, method: str = None) -> Optional[Dict]:
        data = {
            "status":  self.STATUS_PAID,
            "paid_at": datetime.utcnow().isoformat(),
        }
        if method:
            data["method"] = method
        return self._db.update("payments", data, {"id": payment_id})

    def mark_refunded(self, payment_id: int) -> Optional[Dict]:
        return self._db.update("payments", {
            "status": self.STATUS_REFUNDED,
        }, {"id": payment_id})

    def update_method(self, payment_id: int, method: str) -> Optional[Dict]:
        return self._db.update("payments", {"method": method}, {"id": payment_id})

    # ── Estadísticas ───────────────────────────────────────
    def get_revenue_stats(self) -> Dict:
        payments = self._db.select("payments")
        paid     = [p for p in payments if p.get("status") == self.STATUS_PAID]
        pending  = [p for p in payments if p.get("status") == self.STATUS_PENDING]
        refunded = [p for p in payments if p.get("status") == self.STATUS_REFUNDED]

        total_revenue    = sum(float(p.get("amount", 0)) for p in paid)
        pending_revenue  = sum(float(p.get("amount", 0)) for p in pending)
        refunded_revenue = sum(float(p.get("amount", 0)) for p in refunded)

        # Ingresos por mes (últimos 6 meses)
        monthly = {}
        for p in paid:
            if p.get("paid_at"):
                month = p["paid_at"][:7]  # YYYY-MM
                monthly[month] = monthly.get(month, 0) + float(p.get("amount", 0))

        return {
            "total_revenue":    total_revenue,
            "pending_revenue":  pending_revenue,
            "refunded_revenue": refunded_revenue,
            "paid_count":       len(paid),
            "pending_count":    len(pending),
            "refunded_count":   len(refunded),
            "monthly":          monthly,
        }

    # ── Recibo ─────────────────────────────────────────────
    def build_receipt(self, payment_id: int) -> Optional[Dict]:
        """Construye los datos completos para generar un recibo."""
        payment = self.get_by_id(payment_id)
        if not payment:
            return None

        apt     = payment.get("appointments") or {}
        patient = payment.get("patients")     or {}
        doctor  = apt.get("doctors")          or {}

        return {
            "receipt_number": f"REC-{payment['id']:05d}",
            "reference":      payment.get("reference", "—"),
            "date":           payment.get("paid_at") or payment.get("created_at", ""),
            "amount":         float(payment.get("amount", 0)),
            "currency":       payment.get("currency", "USD"),
            "method":         payment.get("method", "—"),
            "status":         payment.get("status", "pending"),
            "patient": {
                "name":  patient.get("full_name", "—"),
                "email": patient.get("email", "—"),
                "phone": patient.get("phone", "—"),
            },
            "doctor": {
                "name":      doctor.get("full_name", "—"),
                "specialty": doctor.get("specialty", "—"),
            },
            "appointment": {
                "date":   apt.get("appointment_date", "—"),
                "time":   apt.get("appointment_time", "—"),
                "reason": apt.get("reason", "Consulta médica"),
            },
        }

    # ── Helper ─────────────────────────────────────────────
    @staticmethod
    def _generate_reference() -> str:
        return "PAY-" + uuid.uuid4().hex[:8].upper()
