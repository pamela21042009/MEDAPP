# app/services/prescription_service.py
from __future__ import annotations
from typing import Dict, List, Optional
from datetime import datetime, date, timedelta
from .database import DatabaseService


class PrescriptionService:
    def __init__(self):
        self._db = DatabaseService.get_instance()

    def get_by_doctor(self, doctor_id: int) -> List[Dict]:
        return self._db.select_with_join(
            "prescriptions",
            "*, patients(full_name), appointments(appointment_date)",
            {"doctor_id": doctor_id}
        )

    def get_by_patient(self, patient_id: int) -> List[Dict]:
        return self._db.select_with_join(
            "prescriptions",
            "*, doctors(full_name, specialty)",
            {"patient_id": patient_id}
        )

    def get_all(self) -> List[Dict]:
        try:
            return self._db.client.table("prescriptions") \
                .select("*, patients(full_name), doctors(full_name)") \
                .order("issued_at", desc=True).execute().data or []
        except Exception:
            return []

    def get_by_id(self, rx_id: int) -> Optional[Dict]:
        rows = self._db.select_with_join(
            "prescriptions",
            "*, doctors(full_name,specialty,license_number), patients(full_name,birth_date)",
            {"id": rx_id}
        )
        if not rows:
            return None
        rx = rows[0]
        rx["items"] = self._db.select_with_join(
            "prescription_items",
            "*, medications(name,generic_name,unit)",
            {"prescription_id": rx_id}
        )
        return rx

    def create(self, doctor_id: int, patient_id: int, data: Dict) -> Optional[Dict]:
        items = data.pop("items", [])
        data.update({
            "doctor_id":   doctor_id,
            "patient_id":  patient_id,
            "issued_at":   datetime.utcnow().isoformat(),
            "valid_until": (date.today() + timedelta(days=30)).isoformat(),
        })
        rx = self._db.insert("prescriptions", data)
        if rx and items:
            for item in items:
                item["prescription_id"] = rx["id"]
                self._db.insert("prescription_items", item)
        return rx

    def get_all_medications(self) -> List[Dict]:
        return self._db.select("medications", "*", {"is_active": True})

    def search_medications(self, query: str) -> List[Dict]:
        try:
            return self._db.client.table("medications") \
                .select("*").ilike("name", f"%{query}%") \
                .eq("is_active", True).limit(20).execute().data or []
        except Exception:
            return []
