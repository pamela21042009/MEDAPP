# app/services/dashboard_service.py
from __future__ import annotations
from typing import Dict, List
from datetime import date, timedelta
from .database import DatabaseService


class DashboardService:
    def __init__(self):
        self._db = DatabaseService.get_instance()

    def get_stats(self, doctor_id: int = None) -> Dict:
        today = date.today().isoformat()

        # Citas de hoy
        try:
            q = self._db.client.table("appointments").select("id,status") \
                .eq("appointment_date", today)
            if doctor_id:
                q = q.eq("doctor_id", doctor_id)
            appts_today = q.execute().data or []
        except Exception:
            appts_today = []

        # Pagos cobrados hoy
        try:
            paid_today = self._db.client.table("payments").select("amount") \
                .eq("status", "paid") \
                .gte("paid_at", f"{today}T00:00:00") \
                .execute().data or []
            revenue_today = sum(float(p.get("amount", 0)) for p in paid_today)
        except Exception:
            revenue_today = 0.0

        # Conteos globales
        try:
            doctors_count  = len(self._db.select("doctors",  "id", {"is_active": True}))
            patients_count = len(self._db.select("patients", "id"))
            pending_count  = len(self._db.select("appointments", "id", {"status": "pending"}))
        except Exception:
            doctors_count = patients_count = pending_count = 0

        # Próximas citas del día con join
        try:
            upcoming = self._db.client.table("appointments") \
                .select("id,appointment_time,status,reason,doctors(full_name),patients(full_name)") \
                .eq("appointment_date", today) \
                .in_("status", ["pending", "confirmed"]) \
                .order("appointment_time") \
                .limit(8).execute().data or []
        except Exception:
            upcoming = []

        return {
            "today_total":     len(appts_today),
            "today_pending":   sum(1 for a in appts_today if a.get("status") == "pending"),
            "today_confirmed": sum(1 for a in appts_today if a.get("status") == "confirmed"),
            "today_completed": sum(1 for a in appts_today if a.get("status") == "completed"),
            "pending_total":   pending_count,
            "revenue_today":   revenue_today,
            "doctors_count":   doctors_count,
            "patients_count":  patients_count,
            "upcoming":        upcoming,
        }

    def get_monthly_revenue(self, months: int = 6) -> List[Dict]:
        cutoff = (date.today() - timedelta(days=30 * months)).isoformat()
        try:
            rows = self._db.client.table("payments").select("amount,paid_at") \
                .eq("status", "paid").gte("paid_at", cutoff).execute().data or []
        except Exception:
            return []
        monthly: Dict[str, float] = {}
        for r in rows:
            if r.get("paid_at"):
                m = r["paid_at"][:7]
                monthly[m] = round(monthly.get(m, 0) + float(r.get("amount", 0)), 2)
        return [{"month": k, "revenue": v} for k, v in sorted(monthly.items())]

    def get_appointments_by_status(self) -> List[Dict]:
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

    def get_appointments_by_specialty(self) -> List[Dict]:
        try:
            rows = self._db.client.table("appointments") \
                .select("specialties(name)").execute().data or []
        except Exception:
            return []
        c: Dict[str, int] = {}
        for r in rows:
            name = (r.get("specialties") or {}).get("name", "Sin especialidad")
            c[name] = c.get(name, 0) + 1
        return [{"specialty": k, "count": v} for k, v in c.items()]
