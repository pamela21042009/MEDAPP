from __future__ import annotations

from collections import Counter
from datetime import date

from flask import Blueprint, redirect

from .api_helpers import appointments, doctors, ok, patients, payments, payment_stats, role

bp = Blueprint("dashboard", __name__, url_prefix="/")


@bp.route("/")
@bp.route("/dashboard")
def index():
    return redirect("/dashboard")


@bp.route("/api/dashboard")
def api_dashboard():
    appts = appointments()
    docs = doctors()
    pats = patients()
    pays = payments()
    today = date.today().isoformat()
    today_items = [item for item in appts if str(item.get("appointment_date", "")).startswith(today)]
    stats = payment_stats(pays)
    status_counts = Counter(item.get("status") or "pending" for item in appts)
    specialty_counts = Counter(item.get("specialty") or item.get("doctors", {}).get("specialty", "") for item in appts)
    return ok({
        "stats": {
            "today_total": len(today_items),
            "today_confirmed": len([item for item in today_items if item.get("status") == "confirmed"]),
            "pending_total": len([item for item in appts if item.get("status") in {None, "", "pending"}]),
            "revenue_today": stats["total_revenue"],
            "patients_count": len(pats),
            "doctors_count": len(docs),
            "upcoming": today_items[:8],
        },
        "monthly_revenue": [],
        "by_status": [{"status": key, "label": key.title(), "count": value} for key, value in status_counts.items()],
        "by_specialty": [
            {"specialty": key or "General", "count": value}
            for key, value in specialty_counts.items()
            if key
        ],
        "role": role(),
    })
