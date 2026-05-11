from __future__ import annotations

from collections import Counter

from flask import Blueprint

from .api_helpers import fail, ok, role
from app.services.database import DatabaseService

bp = Blueprint("audit", __name__, url_prefix="/audit")

ACTION_LABELS = {
    "CREATE": "Creacion",
    "UPDATE": "Actualizacion",
    "DELETE": "Eliminacion",
    "CANCEL": "Cancelacion",
    "SAVE": "Guardado",
    "REGISTER": "Registro",
    "PASSWORD_RESET": "Cambio de contrasena",
    "WELCOME_EMAIL_SENT": "Correo enviado",
    "MARK_PAID": "Pago marcado",
    "ONLINE_PAY": "Pago en linea",
    "STRIPE_CHECKOUT_CREATED": "Checkout Stripe",
    "STRIPE_PAYMENT_CONFIRMED": "Pago Stripe confirmado",
    "REFUND": "Reembolso",
    "CLINICAL_NOTE": "Nota clinica",
}


def _description(log: dict) -> str:
    values = log.get("new_values") or log.get("details") or {}
    if isinstance(values, dict):
        if values.get("description"):
            return str(values["description"])
        if values:
            parts = [f"{key}: {value}" for key, value in values.items() if value not in (None, "")]
            if parts:
                return ", ".join(parts)
    table_name = log.get("table_name") or log.get("entity") or "registro"
    record_id = log.get("record_id") or log.get("entity_id")
    return f"{table_name} #{record_id}" if record_id else str(table_name)


def _normalize_log(log: dict) -> dict:
    action = str(log.get("action") or "").upper()
    return {
        **log,
        "action": action,
        "action_label": ACTION_LABELS.get(action, action.title() if action else "Accion"),
        "description": _description(log),
        "table_name": log.get("table_name") or log.get("entity") or "",
    }


@bp.route("/api/bootstrap")
def api_bootstrap():
    if role() != "admin":
        return fail("Solo el administrador puede ver la auditoria.", 403)

    logs = DatabaseService.get_instance().select_with_join(
        "audit_log",
        "*, users(full_name,email,role)",
        {},
    )
    logs = [_normalize_log(item) for item in logs]
    logs = sorted(logs, key=lambda item: str(item.get("created_at") or ""), reverse=True)[:200]
    actions = Counter(item.get("action") or "accion" for item in logs)
    return ok({
        "role": role(),
        "stats": {
            "total": len(logs),
            "by_action": [
                {"action": key, "label": ACTION_LABELS.get(key, key.title()), "count": value}
                for key, value in actions.items()
            ],
        },
        "logs": logs,
    })
