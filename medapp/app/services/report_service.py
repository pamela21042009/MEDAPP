# app/services/report_service.py
from __future__ import annotations
from typing import Dict, List
from datetime import date, datetime, timedelta
from .database import DatabaseService


class ReportService:
    def __init__(self):
        self._db = DatabaseService.get_instance()

    def revenue_by_month(self, months: int = 6) -> List[Dict]:
        cutoff = (date.today() - timedelta(days=30 * months)).isoformat()
        try:
            rows = self._db.client.table("payments").select("amount,paid_at") \
                .eq("status", "paid").gte("paid_at", cutoff).execute().data or []
        except Exception:
            return []
        m: Dict[str, float] = {}
        for r in rows:
            if r.get("paid_at"):
                key = r["paid_at"][:7]
                m[key] = round(m.get(key, 0) + float(r.get("amount", 0)), 2)
        return [{"month": k, "revenue": v} for k, v in sorted(m.items())]

    def appointments_by_status(self) -> List[Dict]:
        try:
            rows = self._db.select("appointments", "status")
        except Exception:
            return []
        c: Dict[str, int] = {}
        for r in rows:
            s = r.get("status", "?")
            c[s] = c.get(s, 0) + 1
        labels = {"pending": "Pendiente", "confirmed": "Confirmada",
                  "cancelled": "Cancelada", "completed": "Completada", "no_show": "No asistió"}
        return [{"status": k, "label": labels.get(k, k), "count": v} for k, v in c.items()]

    def top_doctors(self, limit: int = 10) -> List[Dict]:
        try:
            rows = self._db.client.table("appointments") \
                .select("doctor_id,doctors(full_name,specialty)").execute().data or []
        except Exception:
            return []
        c: Dict[int, Dict] = {}
        for r in rows:
            did = r.get("doctor_id")
            if did:
                if did not in c:
                    doc = r.get("doctors") or {}
                    c[did] = {"doctor_id": did, "name": doc.get("full_name", ""),
                              "specialty": doc.get("specialty", ""), "count": 0}
                c[did]["count"] += 1
        return sorted(c.values(), key=lambda x: x["count"], reverse=True)[:limit]

    def new_patients_by_month(self, months: int = 6) -> List[Dict]:
        cutoff = (date.today() - timedelta(days=30 * months)).isoformat()
        try:
            rows = self._db.client.table("patients").select("created_at") \
                .gte("created_at", cutoff).execute().data or []
        except Exception:
            return []
        m: Dict[str, int] = {}
        for r in rows:
            if r.get("created_at"):
                key = r["created_at"][:7]
                m[key] = m.get(key, 0) + 1
        return [{"month": k, "count": v} for k, v in sorted(m.items())]

    def payment_methods(self) -> List[Dict]:
        try:
            rows = self._db.select("payments", "method,amount", {"status": "paid"})
        except Exception:
            return []
        c: Dict[str, Dict] = {}
        for r in rows:
            mth = r.get("method") or "Otro"
            if mth not in c:
                c[mth] = {"method": mth, "count": 0, "total": 0.0}
            c[mth]["count"] += 1
            c[mth]["total"] = round(c[mth]["total"] + float(r.get("amount", 0)), 2)
        return list(c.values())

    def summary(self) -> Dict:
        monthly  = self.revenue_by_month()
        statuses = self.appointments_by_status()
        doctors  = self.top_doctors()
        methods  = self.payment_methods()
        patients = self.new_patients_by_month()
        total_revenue = sum(r["revenue"] for r in monthly)
        total_appts   = sum(s["count"]   for s in statuses)
        return {
            "monthly_revenue":    monthly,
            "by_status":          statuses,
            "top_doctors":        doctors,
            "payment_methods":    methods,
            "new_patients":       patients,
            "total_revenue":      total_revenue,
            "total_appointments": total_appts,
        }
