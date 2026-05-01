from __future__ import annotations

import os

from flask import Blueprint

from .api_helpers import appointments, by_id, delete, fail, insert, ok, patients, payload, payment_stats, payments, role, update

bp = Blueprint("payments", __name__, url_prefix="/payments")


@bp.route("/api/bootstrap")
def api_bootstrap():
    items = payments()
    return ok({
        "role": role(),
        "payments": items,
        "patients": patients(),
        "appointments": appointments(),
        "methods": ["cash", "card", "transfer", "online"],
        "stats": payment_stats(items),
        "online_payment": {
            "enabled": os.environ.get("ONLINE_PAYMENT_ENABLED", "false").lower() == "true",
            "provider": os.environ.get("ONLINE_PAYMENT_PROVIDER", "stripe"),
            "currency": os.environ.get("ONLINE_PAYMENT_CURRENCY", "USD"),
            "stripe": {"publishable_key": os.environ.get("STRIPE_PUBLISHABLE_KEY", "")},
        },
    })


@bp.route("/api/<int:payment_id>")
def api_detail(payment_id: int):
    item = by_id("payments", payment_id)
    if not item:
        return fail("Pago no encontrado.", 404)
    return ok(item)


@bp.route("/api", methods=["POST"])
def api_create():
    item = insert("payments", payload())
    if not item:
        return fail("No fue posible registrar el pago.", 500)
    return ok({"item": item, "payment": item})


@bp.route("/api/<int:payment_id>/mark-paid", methods=["POST"])
def api_mark_paid(payment_id: int):
    data = payload()
    data["status"] = "paid"
    item = update("payments", payment_id, data)
    return ok({"item": item, "payment": item})


@bp.route("/api/<int:payment_id>/online-pay", methods=["POST"])
def api_online_pay(payment_id: int):
    item = update("payments", payment_id, {"status": "paid", **payload()})
    return ok({"item": item, "payment": item})


@bp.route("/api/<int:payment_id>/online-pay/create-order", methods=["POST"])
def api_create_order(payment_id: int):
    return ok({"order_id": f"local-{payment_id}", "checkout_url": ""})


@bp.route("/api/<int:payment_id>/online-pay/capture", methods=["POST"])
def api_capture_order(payment_id: int):
    item = update("payments", payment_id, {"status": "paid"})
    return ok({"item": item, "payment": item})


@bp.route("/api/<int:payment_id>/refund", methods=["POST"])
def api_refund(payment_id: int):
    item = update("payments", payment_id, {"status": "refunded"})
    return ok({"item": item, "payment": item})


@bp.route("/api/<int:payment_id>", methods=["DELETE"])
def api_delete(payment_id: int):
    return ok(deleted=delete("payments", payment_id))


@bp.route("/api/stats")
def api_stats():
    return ok(payment_stats(payments()))
