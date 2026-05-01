from __future__ import annotations

from flask import Blueprint, session

from .api_helpers import ok, select, update

bp = Blueprint("notifications", __name__, url_prefix="/notifications")


def _items():
    user_id = session.get("user_id")
    if not user_id:
        return []
    return select("notifications", "*", {"user_id": user_id})


@bp.route("/api/bootstrap")
def api_bootstrap():
    items = _items()
    return ok({
        "items": items,
        "unread_count_before": len([item for item in items if not item.get("is_read")]),
    })


@bp.route("/api/unread")
def api_unread():
    items = [item for item in _items() if not item.get("is_read")]
    return ok({"items": items, "count": len(items)})


@bp.route("/api/<int:notification_id>/read", methods=["POST"])
def api_read(notification_id: int):
    item = update("notifications", notification_id, {"is_read": True})
    return ok({"item": item})


@bp.route("/api/read-all", methods=["POST"])
def api_read_all():
    for item in _items():
        if item.get("id"):
            update("notifications", int(item["id"]), {"is_read": True})
    return ok(message="Notificaciones actualizadas.")
