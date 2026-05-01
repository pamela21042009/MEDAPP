from __future__ import annotations

from flask import Blueprint

from .api_helpers import by_id, can_manage, fail, insert, ok, patients, payload, role, update

bp = Blueprint("patients", __name__, url_prefix="/patients")


@bp.route("/api/bootstrap")
def api_bootstrap():
    return ok({"role": role(), "can_manage": can_manage(), "current_patient_id": None})


@bp.route("/api/list")
def api_list():
    return ok({"items": patients()})


@bp.route("/api/search")
def api_search():
    return ok({"items": patients()})


@bp.route("/api/<int:patient_id>")
def api_detail(patient_id: int):
    item = by_id("patients", patient_id)
    if not item:
        return fail("Paciente no encontrado.", 404)
    return ok({
        **item,
        "appointments": [],
        "clinical_history": [],
        "vitals": [],
        "documents": [],
    })


@bp.route("/api", methods=["POST"])
def api_create():
    item = insert("patients", payload())
    if not item:
        return fail("No fue posible crear el paciente.", 500)
    return ok({"item": item, "patient": item})


@bp.route("/api/<int:patient_id>", methods=["PUT"])
def api_update(patient_id: int):
    item = update("patients", patient_id, payload())
    if not item:
        return fail("No fue posible actualizar el paciente.", 500)
    return ok({"item": item, "patient": item})


@bp.route("/api/<int:patient_id>/appointments/<int:appointment_id>/notes", methods=["PUT"])
def api_notes(patient_id: int, appointment_id: int):
    item = update("appointments", appointment_id, payload())
    return ok({"item": item, "patient_id": patient_id})


@bp.route("/api/<int:patient_id>/clinical-history", methods=["POST"])
def api_clinical_history(patient_id: int):
    data = payload()
    data["patient_id"] = patient_id
    item = insert("clinical_history", data)
    return ok({"item": item})


@bp.route("/api/<int:patient_id>/vitals", methods=["POST"])
def api_vitals(patient_id: int):
    data = payload()
    data["patient_id"] = patient_id
    item = insert("vitals", data)
    return ok({"item": item})


@bp.route("/api/<int:patient_id>/documents", methods=["POST"])
def api_documents(patient_id: int):
    data = payload()
    data["patient_id"] = patient_id
    item = insert("patient_documents", data)
    return ok({"item": item})
