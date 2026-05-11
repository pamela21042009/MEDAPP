from __future__ import annotations

from flask import Blueprint

from .api_helpers import db, fail, log_event, ok, payload, role, select, update

bp = Blueprint("catalogs", __name__, url_prefix="/catalogs")

SPECIALTY_COLUMNS = {"name", "description", "icon", "color_hex", "is_active"}
MEDICATION_COLUMNS = {"name", "generic_name", "category", "unit", "requires_rx", "is_active"}


def can_manage_catalogs() -> bool:
    return role() in {"admin", "staff", "doctor"}


def _clean(data: dict, allowed: set[str]) -> dict:
    return {key: value for key, value in data.items() if key in allowed}


def _items(table: str) -> list[dict]:
    return select(table, "*")


def _insert(table: str, data: dict):
    item = db().insert(table, data)
    if item:
        return item
    if "is_active" in data:
        fallback = {key: value for key, value in data.items() if key != "is_active"}
        item = db().insert(table, fallback)
    return item


@bp.route("/api/bootstrap")
def api_bootstrap():
    return ok({
        "role": role(),
        "can_manage": can_manage_catalogs(),
        "specialties": _items("specialties"),
        "medications": _items("medications"),
    })


@bp.route("/api/specialties", methods=["POST"])
def api_create_specialty():
    if not can_manage_catalogs():
        return fail("No tienes permiso para crear especialidades.", 403)
    data = _clean(payload(), SPECIALTY_COLUMNS)
    data.setdefault("is_active", True)
    item = _insert("specialties", data)
    if not item:
        return fail(f"No fue posible crear la especialidad. Detalle: {db().get_last_error()}", 500)
    log_event("create", "specialties", item.get("id"), {"name": item.get("name")})
    return ok({"item": item})


@bp.route("/api/specialties/<int:item_id>", methods=["PUT"])
def api_update_specialty(item_id: int):
    if not can_manage_catalogs():
        return fail("No tienes permiso para editar especialidades.", 403)
    data = _clean(payload(), SPECIALTY_COLUMNS)
    item = update("specialties", item_id, data)
    if not item:
        return fail(f"No fue posible actualizar la especialidad. Detalle: {db().get_last_error()}", 500)
    log_event("update", "specialties", item_id, {"name": item.get("name")})
    return ok({"item": item})


@bp.route("/api/specialties/<int:item_id>", methods=["DELETE"])
def api_delete_specialty(item_id: int):
    if not can_manage_catalogs():
        return fail("No tienes permiso para eliminar especialidades.", 403)
    item = update("specialties", item_id, {"is_active": False})
    if not item:
        return fail(f"No fue posible desactivar la especialidad. Detalle: {db().get_last_error()}", 500)
    log_event("delete", "specialties", item_id)
    return ok({"item": item})


@bp.route("/api/medications", methods=["POST"])
def api_create_medication():
    if not can_manage_catalogs():
        return fail("No tienes permiso para crear medicamentos.", 403)
    data = _clean(payload(), MEDICATION_COLUMNS)
    data.setdefault("is_active", True)
    data.setdefault("requires_rx", True)
    item = _insert("medications", data)
    if not item:
        return fail(f"No fue posible crear el medicamento. Detalle: {db().get_last_error()}", 500)
    log_event("create", "medications", item.get("id"), {"name": item.get("name")})
    return ok({"item": item})


@bp.route("/api/medications/<int:item_id>", methods=["PUT"])
def api_update_medication(item_id: int):
    if not can_manage_catalogs():
        return fail("No tienes permiso para editar medicamentos.", 403)
    data = _clean(payload(), MEDICATION_COLUMNS)
    item = update("medications", item_id, data)
    if not item:
        return fail(f"No fue posible actualizar el medicamento. Detalle: {db().get_last_error()}", 500)
    log_event("update", "medications", item_id, {"name": item.get("name")})
    return ok({"item": item})


@bp.route("/api/medications/<int:item_id>", methods=["DELETE"])
def api_delete_medication(item_id: int):
    if not can_manage_catalogs():
        return fail("No tienes permiso para eliminar medicamentos.", 403)
    item = update("medications", item_id, {"is_active": False})
    if not item:
        return fail(f"No fue posible desactivar el medicamento. Detalle: {db().get_last_error()}", 500)
    log_event("delete", "medications", item_id)
    return ok({"item": item})
