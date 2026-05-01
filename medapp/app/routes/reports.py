from __future__ import annotations

from flask import Blueprint, Response

from .api_helpers import appointments, doctors, ok, payments, payment_stats

bp = Blueprint("reports", __name__, url_prefix="/reports")


def _reports_payload():
    pays = payments()
    stats = payment_stats(pays)
    return {
        "summary": stats,
        "doctors": doctors(),
        "revenue_by_month": [],
        "appointments_by_status": [],
        "appointments_by_specialty": [],
        "payments": pays,
    }


@bp.route("/api/bootstrap")
def api_bootstrap():
    return ok(_reports_payload())


@bp.route("/api/medical-summary")
def api_medical_summary():
    return ok({
        "totals": {
            "appointments": len(appointments()),
            "completed": len([item for item in appointments() if item.get("status") == "completed"]),
            "cancelled": len([item for item in appointments() if item.get("status") == "cancelled"]),
        },
        "by_doctor": [],
        "by_status": [],
        "items": appointments(),
    })


@bp.route("/export/excel")
def export_excel():
    return Response("MedApp reportes\n", mimetype="text/csv")


@bp.route("/export/pdf")
def export_pdf():
    return Response("Reporte MedApp", mimetype="text/plain")
