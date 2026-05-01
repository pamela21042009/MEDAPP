# app/services/clinical_service.py
from __future__ import annotations
from typing import Dict, List, Optional
from datetime import datetime
from .database import DatabaseService


class ClinicalService:
    def __init__(self):
        self._db = DatabaseService.get_instance()

    # ── Historial médico ──────────────────────────────────
    def get_history(self, patient_id: int) -> List[Dict]:
        return self._db.select_with_join(
            "medical_history",
            "*, doctors(full_name, specialty)",
            {"patient_id": patient_id}
        )

    def add_history(self, patient_id: int, doctor_id: int, data: Dict) -> Optional[Dict]:
        data.update({
            "patient_id": patient_id,
            "doctor_id":  doctor_id,
            "visit_date": data.get("visit_date", datetime.utcnow().date().isoformat()),
            "created_at": datetime.utcnow().isoformat(),
        })
        return self._db.insert("medical_history", data)

    # ── Signos vitales ────────────────────────────────────
    def get_vitals(self, patient_id: int) -> List[Dict]:
        try:
            return self._db.client.table("vital_signs").select("*") \
                .eq("patient_id", patient_id) \
                .order("recorded_at", desc=True).execute().data or []
        except Exception:
            return []

    def add_vitals(self, patient_id: int, data: Dict) -> Optional[Dict]:
        data.update({"patient_id": patient_id,
                     "recorded_at": datetime.utcnow().isoformat()})
        return self._db.insert("vital_signs", data)

    def get_latest_vitals(self, patient_id: int) -> Optional[Dict]:
        rows = self.get_vitals(patient_id)
        return rows[0] if rows else None

    # ── Documentos ────────────────────────────────────────
    def get_documents(self, patient_id: int) -> List[Dict]:
        return self._db.select("patient_documents", "*", {"patient_id": patient_id})

    def add_document(self, patient_id: int, uploaded_by: int, data: Dict) -> Optional[Dict]:
        data.update({"patient_id": patient_id, "uploaded_by": uploaded_by,
                     "created_at": datetime.utcnow().isoformat()})
        return self._db.insert("patient_documents", data)
