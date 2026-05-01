from __future__ import annotations
from typing import Dict, List, Optional
from datetime import datetime

from .database import DatabaseService


class PatientService:
    def __init__(self) -> None:
        self._db = DatabaseService.get_instance()

    def get_all(self) -> List[Dict]:
        return self._db.select("patients", "*")

    def get_by_id(self, patient_id: int) -> Optional[Dict]:
        results = self._db.select("patients", "*", {"id": patient_id})
        return results[0] if results else None

    def search(self, query: str) -> List[Dict]:
        try:
            response = (
                self._db.client
                .table("patients")
                .select("*")
                .ilike("full_name", f"%{query}%")
                .execute()
            )
            return response.data or []
        except Exception as e:
            print(f"[PatientService] search error: {e}")
            return []

    def create(self, data: Dict) -> Optional[Dict]:
        data["created_at"] = datetime.utcnow().isoformat()
        return self._db.insert("patients", data)

    def update(self, patient_id: int, data: Dict) -> Optional[Dict]:
        data["updated_at"] = datetime.utcnow().isoformat()
        return self._db.update("patients", data, {"id": patient_id})

    def get_history(self, patient_id: int) -> List[Dict]:
        return self._db.select_with_join(
            "appointments",
            "*, doctors(full_name, specialty)",
            {"patient_id": patient_id}
        )
