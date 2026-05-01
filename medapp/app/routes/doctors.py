from __future__ import annotations

from flask import Blueprint

from .api_helpers import by_id, can_manage, doctors, fail, insert, ok, payload, role, specialties, update

bp = Blueprint("doctors", __name__, url_prefix="/doctors")


@bp.route("/api/bootstrap")
def api_bootstrap():
    return ok({
        "role": role(),
        "can_manage": can_manage(),
        "current_doctor_id": None,
        "specialties": specialties(),
    })


@bp.route("/api/list")
def api_list():
    return ok({"items": doctors()})


@bp.route("/api/<int:doctor_id>")
def api_detail(doctor_id: int):
    item = by_id("doctors", doctor_id)
    if not item:
        return fail("Medico no encontrado.", 404)
    return ok(item)


@bp.route("/api", methods=["POST"])
def api_create():
    item = insert("doctors", payload())
    if not item:
        return fail("No fue posible crear el medico.", 500)
    return ok({"item": item, "doctor": item})


@bp.route("/api/<int:doctor_id>", methods=["PUT"])
def api_update(doctor_id: int):
    item = update("doctors", doctor_id, payload())
    if not item:
        return fail("No fue posible actualizar el medico.", 500)
    return ok({"item": item, "doctor": item})


@bp.route("/api/<int:doctor_id>/deactivate", methods=["POST"])
def api_deactivate(doctor_id: int):
    item = update("doctors", doctor_id, {"is_active": False})
    return ok({"item": item, "doctor": item})
