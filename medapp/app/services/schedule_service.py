from __future__ import annotations

from datetime import datetime, timedelta
from typing import Dict, List, Optional

from .database import DatabaseService


DAYS = ["Lunes", "Martes", "Miercoles", "Jueves", "Viernes", "Sabado", "Domingo"]


class ScheduleService:
    def __init__(self):
        self._db = DatabaseService.get_instance()

    def get_by_doctor(self, doctor_id: int) -> List[Dict]:
        rows = self._db.select("doctor_schedules", "*", {"doctor_id": doctor_id})
        for row in rows:
            day_index = int(row.get("day_of_week") or 0)
            row["day_name"] = DAYS[day_index] if 0 <= day_index <= 6 else ""
            row["slot_duration"] = row.get("slot_duration") or row.get("slot_minutes") or 30
            row["break_start"] = str(row.get("break_start") or "")[:5]
            row["break_end"] = str(row.get("break_end") or "")[:5]
        return sorted(rows, key=lambda row: row.get("day_of_week", 0))

    def upsert(self, doctor_id: int, day_of_week: int, data: Dict) -> Optional[Dict]:
        base_payload = {
            "doctor_id": doctor_id,
            "day_of_week": day_of_week,
            "is_active": bool(data.get("is_active")),
            "start_time": str(data.get("start_time") or "08:00")[:5],
            "end_time": str(data.get("end_time") or "17:00")[:5],
            "slot_duration": int(data.get("slot_duration") or data.get("slot_minutes") or 30),
        }
        break_payload = {
            "break_start": str(data.get("break_start") or "")[:5] or None,
            "break_end": str(data.get("break_end") or "")[:5] or None,
        }
        existing = self._db.select(
            "doctor_schedules",
            "*",
            {"doctor_id": doctor_id, "day_of_week": day_of_week},
        )
        supports_breaks = existing and (
            "break_start" in existing[0] or "break_end" in existing[0]
        )
        payload = {**base_payload, **break_payload} if supports_breaks else base_payload
        if existing:
            return self._db.update("doctor_schedules", payload, {"id": existing[0]["id"]})
        return self._db.insert("doctor_schedules", payload)

    def get_unavailability(self, doctor_id: int) -> List[Dict]:
        return self._db.select("doctor_unavailability", "*", {"doctor_id": doctor_id})

    def replace_unavailability(self, doctor_id: int, items: List[Dict]) -> List[Dict]:
        self._db.delete("doctor_unavailability", {"doctor_id": doctor_id})
        saved: List[Dict] = []
        for item in items:
            date_value = str(
                item.get("date")
                or item.get("start_date")
                or item.get("starts_at")
                or item.get("unavailable_date")
                or ""
            ).strip()[:10]
            if not date_value:
                continue
            label = str(item.get("label") or item.get("reason") or "Fecha bloqueada").strip()
            row = self._db.insert("doctor_unavailability", {
                "doctor_id": doctor_id,
                "starts_at": f"{date_value}T00:00:00+00:00",
                "ends_at": f"{date_value}T23:59:59+00:00",
                "reason": label,
                "notes": item.get("notes") or "medapp_holiday",
            })
            if not row:
                row = self._db.insert("doctor_unavailability", {
                    "doctor_id": doctor_id,
                    "date": date_value,
                    "label": label,
                })
            if row:
                saved.append(row)
        return saved

    def _fallback_schedule(self, day_idx: int) -> Optional[Dict]:
        if day_idx >= 5:
            return None
        return {
            "is_active": True,
            "start_time": "08:00",
            "end_time": "17:00",
            "break_start": "12:00",
            "break_end": "13:00",
            "slot_duration": 30,
        }

    def _is_active(self, value) -> bool:
        if isinstance(value, bool):
            return value
        if isinstance(value, (int, float)):
            return bool(value)
        return str(value or "").strip().lower() in {"1", "true", "t", "yes", "si", "sí", "on"}

    def _is_blocked(self, doctor_id: int, date_str: str) -> bool:
        for row in self.get_unavailability(doctor_id):
            direct_date = str(row.get("date") or row.get("unavailable_date") or row.get("starts_at") or "")[:10]
            if direct_date == date_str:
                return True
            start_date = str(row.get("start_date") or "")[:10]
            if not start_date:
                start_date = str(row.get("starts_at") or "")[:10]
            end_date = str(row.get("end_date") or row.get("ends_at") or start_date)[:10]
            if start_date and start_date <= date_str <= end_date:
                return True
        return False

    def get_availability(self, doctor_id: int, date_str: str, appointment_id: int | None = None) -> Dict:
        try:
            target_date = datetime.strptime(date_str, "%Y-%m-%d")
        except ValueError:
            return {"slots": [], "message": "Selecciona una fecha valida."}

        day_idx = target_date.weekday()
        if self._is_blocked(doctor_id, date_str):
            return {"slots": [], "message": "La fecha esta bloqueada para este medico."}

        schedules = self._db.select(
            "doctor_schedules",
            "*",
            {"doctor_id": doctor_id, "day_of_week": day_idx},
        )
        if schedules:
            sched = schedules[0]
        else:
            doctor_has_schedule = bool(self._db.select("doctor_schedules", "id", {"doctor_id": doctor_id}))
            sched = None if doctor_has_schedule else self._fallback_schedule(day_idx)

        if not sched:
            return {"slots": [], "message": "Este medico no tiene horario configurado para ese dia."}
        if not self._is_active(sched.get("is_active")):
            return {"slots": [], "message": "Ese dia esta desactivado en el horario del medico."}

        try:
            start = datetime.strptime(str(sched["start_time"])[:5], "%H:%M")
            end = datetime.strptime(str(sched["end_time"])[:5], "%H:%M")
        except (KeyError, ValueError):
            return {"slots": [], "message": "El horario de ese dia no tiene horas validas."}
        slot = int(sched.get("slot_duration") or sched.get("slot_minutes") or 30)
        break_start = str(sched.get("break_start") or "")[:5]
        break_end = str(sched.get("break_end") or "")[:5]
        break_start_dt = datetime.strptime(break_start, "%H:%M") if break_start else None
        break_end_dt = datetime.strptime(break_end, "%H:%M") if break_end else None

        slots: List[str] = []
        current = start
        while current + timedelta(minutes=slot) <= end:
            slot_end = current + timedelta(minutes=slot)
            in_break = bool(
                break_start_dt
                and break_end_dt
                and current < break_end_dt
                and slot_end > break_start_dt
            )
            if not in_break:
                slots.append(current.strftime("%H:%M"))
            current += timedelta(minutes=slot)

        busy = {
            str(row.get("appointment_time") or "")[:5]
            for row in self._db.select(
                "appointments",
                "id,appointment_time,status",
                {"doctor_id": doctor_id, "appointment_date": date_str},
            )
            if row.get("status") not in {"cancelled", "canceled"}
            and (appointment_id is None or str(row.get("id")) != str(appointment_id))
        }
        available = [slot_value for slot_value in slots if slot_value not in busy]
        if not available and slots:
            return {"slots": [], "message": "Todas las horas de ese dia ya estan ocupadas."}
        return {"slots": available, "message": ""}

    def get_available_slots(self, doctor_id: int, date_str: str, appointment_id: int | None = None) -> List[str]:
        return self.get_availability(doctor_id, date_str, appointment_id).get("slots", [])
