from __future__ import annotations
from typing import Dict, List, Optional
from datetime import datetime

from .database import DatabaseService


class DoctorService:
    def __init__(self) -> None:
        self._db = DatabaseService.get_instance()

    def get_all(self, active_only: bool = True) -> List[Dict]:
        filters = {"is_active": True} if active_only else None
        return self._db.select("doctors", "*", filters)

    def get_by_id(self, doctor_id: int) -> Optional[Dict]:
        results = self._db.select("doctors", "*", {"id": doctor_id})
        return results[0] if results else None

    def get_by_specialty(self, specialty: str) -> List[Dict]:
        return self._db.select("doctors", "*", {"specialty": specialty, "is_active": True})

    def create(self, data: Dict) -> Optional[Dict]:
        data["is_active"] = True
        data["created_at"] = datetime.utcnow().isoformat()
        return self._db.insert("doctors", data)

    def update(self, doctor_id: int, data: Dict) -> Optional[Dict]:
        data["updated_at"] = datetime.utcnow().isoformat()
        return self._db.update("doctors", data, {"id": doctor_id})

    def deactivate(self, doctor_id: int) -> Optional[Dict]:
        return self._db.update("doctors", {"is_active": False}, {"id": doctor_id})

    def get_specialties(self) -> List[str]:
        doctors = self._db.select("doctors", "specialty")
        seen = set()
        result = []
        for d in doctors:
            s = d.get("specialty")
            if s and s not in seen:
                seen.add(s)
                result.append(s)
        return sorted(result)
