# app/services/schedule_service.py
from __future__ import annotations
from typing import Dict, List, Optional
from datetime import datetime, timedelta
from .database import DatabaseService

DAYS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"]


class ScheduleService:
    def __init__(self):
        self._db = DatabaseService.get_instance()

    def get_by_doctor(self, doctor_id: int) -> List[Dict]:
        rows = self._db.select("doctor_schedules", "*", {"doctor_id": doctor_id})
        for r in rows:
            r["day_name"] = DAYS[r["day_of_week"]] if 0 <= r.get("day_of_week", -1) <= 6 else ""
        return sorted(rows, key=lambda r: r.get("day_of_week", 0))

    def upsert(self, doctor_id: int, day_of_week: int, data: Dict) -> Optional[Dict]:
        data.update({"doctor_id": doctor_id, "day_of_week": day_of_week})
        existing = self._db.select("doctor_schedules", "*",
                                   {"doctor_id": doctor_id, "day_of_week": day_of_week})
        if existing:
            return self._db.update("doctor_schedules", data, {"id": existing[0]["id"]})
        return self._db.insert("doctor_schedules", data)

    def get_available_slots(self, doctor_id: int, date_str: str) -> List[str]:
        d = datetime.strptime(date_str, "%Y-%m-%d")
        day_idx = d.weekday()   # 0=Lunes … 6=Domingo
        schedules = self._db.select("doctor_schedules", "*",
                                    {"doctor_id": doctor_id, "day_of_week": day_idx,
                                     "is_active": True})
        if not schedules:
            return []
        sched = schedules[0]
        start = datetime.strptime(sched["start_time"][:5], "%H:%M")
        end   = datetime.strptime(sched["end_time"][:5],   "%H:%M")
        slot  = int(sched.get("slot_duration", 30))
        slots, cur = [], start
        while cur + timedelta(minutes=slot) <= end:
            slots.append(cur.strftime("%H:%M"))
            cur += timedelta(minutes=slot)
        busy = {b["appointment_time"][:5]
                for b in self._db.select("appointments", "appointment_time",
                                         {"doctor_id": doctor_id,
                                          "appointment_date": date_str})}
        return [s for s in slots if s not in busy]
