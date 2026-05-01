from __future__ import annotations

from collections import Counter

from flask import Blueprint

from .api_helpers import ok, role, select

bp = Blueprint("audit", __name__, url_prefix="/audit")


@bp.route("/api/bootstrap")
def api_bootstrap():
    logs = select("audit_logs", "*")
    actions = Counter(item.get("action") or "accion" for item in logs)
    return ok({
        "role": role(),
        "stats": {
            "total": len(logs),
            "by_action": [{"action": key, "count": value} for key, value in actions.items()],
        },
        "logs": logs,
    })
