from __future__ import annotations

from flask import Blueprint, request

from .api_helpers import by_id, doctors, fail, insert, ok, patients, payload, role, select

bp = Blueprint("prescriptions", __name__, url_prefix="/prescriptions")


@bp.route("/api/bootstrap")
def api_bootstrap():
    return ok({
        "role": role(),
        "can_write": role() in {"admin", "staff", "doctor", "secretaria"},
        "doctors": doctors(),
        "patients": patients(),
        "medications": select("medications", "*", {"is_active": True}),
    })


@bp.route("/api/list")
def api_list():
    return ok(select("prescriptions", "*"))


@bp.route("/api/<int:rx_id>")
def api_detail(rx_id: int):
    item = by_id("prescriptions", rx_id)
    if not item:
        return fail("Receta no encontrada.", 404)
    item["items"] = select("prescription_items", "*", {"prescription_id": rx_id})
    return ok(item)


@bp.route("/api", methods=["POST"])
def api_create():
    data = payload()
    items = data.pop("items", [])
    item = insert("prescriptions", data)
    if item and items:
        for child in items:
            child["prescription_id"] = item.get("id")
            insert("prescription_items", child)
    if not item:
        return fail("No fue posible crear la receta.", 500)
    return ok({"item": item, "prescription": item})


@bp.route("/api/medications")
def api_medications():
    query = str(request.args.get("q", "")).lower()
    items = select("medications", "*", {"is_active": True})
    if query:
        items = [
            item for item in items
            if query in str(item.get("name", "")).lower()
            or query in str(item.get("generic_name", "")).lower()
        ]
    return ok(items[:20])
