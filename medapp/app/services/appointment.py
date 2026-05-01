from __future__ import annotations
from typing import Dict, List, Optional
from datetime import datetime, date

from .database import DatabaseService


class AppointmentService:
    STATUS_CONFIRMED = "confirmed"
    STATUS_PENDING = "pending"
    STATUS_CANCELLED = "cancelled"
    STATUS_RESCHEDULED = "rescheduled"

    def __init__(self) -> None:
        self._db = DatabaseService.get_instance()

    def get_all(self, filters: Optional[Dict] = None) -> List[Dict]:
        columns = "*, doctors(full_name, specialty), patients(full_name, phone)"
        return self._db.select_with_join("appointments", columns, filters)

    def get_by_id(self, appointment_id: int) -> Optional[Dict]:
        results = self._db.select_with_join(
            "appointments",
            "*, doctors(full_name, specialty), patients(full_name, phone)",
            {"id": appointment_id}
        )
        return results[0] if results else None

    def get_by_date_range(self, start: str, end: str) -> List[Dict]:
        try:
            response = (
                self._db.client
                .table("appointments")
                .select("*, doctors(full_name, specialty), patients(full_name, phone)")
                .gte("appointment_date", start)
                .lte("appointment_date", end)
                .execute()
            )
            return response.data or []
        except Exception as e:
            print(f"[AppointmentService] date range error: {e}")
            return []

    def create(self, data: Dict) -> Optional[Dict]:
        data["status"] = data.get("status", self.STATUS_PENDING)
        data["created_at"] = datetime.utcnow().isoformat()
        return self._db.insert("appointments", data)

    def update(self, appointment_id: int, data: Dict) -> Optional[Dict]:
        data["updated_at"] = datetime.utcnow().isoformat()
        return self._db.update("appointments", data, {"id": appointment_id})

    def cancel(self, appointment_id: int, reason: str = "") -> Optional[Dict]:
        return self._db.update("appointments", {
            "status": self.STATUS_CANCELLED,
            "cancellation_reason": reason,
            "updated_at": datetime.utcnow().isoformat()
        }, {"id": appointment_id})

    def reschedule(self, appointment_id: int, new_date: str, new_time: str) -> Optional[Dict]:
        return self._db.update("appointments", {
            "status": self.STATUS_RESCHEDULED,
            "appointment_date": new_date,
            "appointment_time": new_time,
            "updated_at": datetime.utcnow().isoformat()
        }, {"id": appointment_id})

    def get_stats(self) -> Dict:
        all_appointments = self._db.select("appointments")
        total = len(all_appointments)
        confirmed = sum(1 for a in all_appointments if a.get("status") == self.STATUS_CONFIRMED)
        pending = sum(1 for a in all_appointments if a.get("status") == self.STATUS_PENDING)
        cancelled = sum(1 for a in all_appointments if a.get("status") == self.STATUS_CANCELLED)
        today = date.today().isoformat()
        today_count = sum(1 for a in all_appointments if a.get("appointment_date") == today)
        return {
            "total": total,
            "confirmed": confirmed,
            "pending": pending,
            "cancelled": cancelled,
            "today": today_count,
        }

    def to_calendar_event(self, appointment: Dict) -> Dict:
        status_colors = {
            self.STATUS_CONFIRMED: "#80ED99",
            self.STATUS_PENDING: "#FFD166",
            self.STATUS_CANCELLED: "#F72585",
            self.STATUS_RESCHEDULED: "#4EA8DE",
        }
        status = appointment.get("status", self.STATUS_PENDING)
        doctor = appointment.get("doctors", {}) or {}
        patient = appointment.get("patients", {}) or {}
        apt_date = appointment.get("appointment_date", "")
        apt_time = appointment.get("appointment_time", "00:00")
        start_dt = f"{apt_date}T{apt_time}" if apt_date else ""
        return {
            "id": appointment.get("id"),
            "title": f"{patient.get('full_name', 'Paciente')} — Dr. {doctor.get('full_name', '')}",
            "start": start_dt,
            "backgroundColor": status_colors.get(status, "#FFD166"),
            "borderColor": status_colors.get(status, "#FFD166"),
            "extendedProps": {
                "status": status,
                "doctor": doctor.get("full_name", ""),
                "specialty": doctor.get("specialty", ""),
                "patient": patient.get("full_name", ""),
                "phone": patient.get("phone", ""),
                "notes": appointment.get("notes", ""),
                "appointment_id": appointment.get("id"),
            }
        }
