from __future__ import annotations

import os
from uuid import uuid4

from flask import Blueprint, request
from werkzeug.utils import secure_filename

from .api_helpers import by_id, can_manage, current_doctor_id, db, doctors, fail, insert, log_event, ok, payload, role, specialties, update
from .avatar_upload import upload_avatar_to_supabase

bp = Blueprint("doctors", __name__, url_prefix="/doctors")

DOCTOR_AVATAR_BUCKET = os.environ.get("DOCTOR_AVATAR_BUCKET", "doctor-avatars")
ALLOWED_AVATAR_MIMES = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/webp": ".webp",
}

DOCTOR_COLUMNS = {
    "full_name",
    "specialty",
    "specialty_id",
    "license_number",
    "email",
    "phone",
    "avatar_url",
    "bio",
    "clinic_address",
    "clinic_name",
    "consultation_fee",
    "slot_duration",
    "attention_type",
    "is_active",
}


def clean_doctor_payload(data: dict, allow_avatar: bool = False) -> dict:
    allowed = set(DOCTOR_COLUMNS)
    if not allow_avatar:
        allowed.discard("avatar_url")
    return {key: value for key, value in data.items() if key in allowed}


def storage_client():
    service_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    if service_key:
        from supabase import create_client

        return create_client(os.environ.get("SUPABASE_URL", ""), service_key).storage
    return db().client.storage


def ensure_avatar_bucket() -> None:
    storage = storage_client()
    try:
        buckets = storage.list_buckets()
        for bucket in buckets:
            name = bucket.get("name") if isinstance(bucket, dict) else getattr(bucket, "name", "")
            bucket_id = bucket.get("id") if isinstance(bucket, dict) else getattr(bucket, "id", "")
            if name == DOCTOR_AVATAR_BUCKET or bucket_id == DOCTOR_AVATAR_BUCKET:
                return
    except Exception:
        pass

    storage.create_bucket(
        DOCTOR_AVATAR_BUCKET,
        options={
            "public": True,
            "allowed_mime_types": list(ALLOWED_AVATAR_MIMES.keys()),
            "file_size_limit": 5 * 1024 * 1024,
        },
    )


def upload_doctor_avatar_to_supabase(doctor_id: int, file) -> str | None:
    filename = secure_filename(file.filename or "")
    extension = ALLOWED_AVATAR_MIMES.get(file.mimetype) or os.path.splitext(filename)[1].lower()
    if extension == ".jpeg":
        extension = ".jpg"
    if extension not in {".png", ".jpg", ".webp"}:
        return None

    return upload_avatar_to_supabase(f"doctors/doctor-{doctor_id}", file)


@bp.route("/api/bootstrap")
def api_bootstrap():
    current_id = current_doctor_id() if role() == "doctor" else None
    return ok({
        "role": role(),
        "can_manage": can_manage(),
        "current_doctor_id": current_id,
        "specialties": specialties(),
    })


@bp.route("/api/list")
def api_list():
    current_role = role()
    include_inactive = request.args.get("include_inactive") == "1" and can_manage()
    query = str(request.args.get("q") or "").strip().lower()
    specialty = str(request.args.get("specialty") or "").strip().lower()
    items = doctors()

    if not include_inactive:
        items = [item for item in items if item.get("is_active") is not False]
    if specialty:
        items = [item for item in items if str(item.get("specialty") or "").strip().lower() == specialty]
    if query:
        items = [
            item for item in items
            if query in " ".join([
                str(item.get("full_name") or ""),
                str(item.get("specialty") or ""),
                str(item.get("license_number") or ""),
                str(item.get("email") or ""),
            ]).lower()
        ]

    if current_role == "paciente":
        items = [item for item in items if item.get("is_active") is not False]

    return ok({"items": items})


@bp.route("/api/<int:doctor_id>")
def api_detail(doctor_id: int):
    item = by_id("doctors", doctor_id)
    if not item:
        return fail("Medico no encontrado.", 404)
    can_edit = can_manage() or (role() == "doctor" and current_doctor_id() == doctor_id)
    if item.get("is_active") is False and not can_edit:
        return fail("Medico no encontrado.", 404)
    return ok({
        "doctor": item,
        "permissions": {
            "can_edit": can_edit,
            "can_deactivate": can_manage(),
        },
    })


@bp.route("/api", methods=["POST"])
def api_create():
    if not can_manage():
        return fail("No tienes permiso para crear medicos.", 403)
    item = insert("doctors", clean_doctor_payload(payload(), allow_avatar=False))
    if not item:
        return fail("No fue posible crear el medico.", 500)
    return ok({"item": item, "doctor": item})


@bp.route("/api/<int:doctor_id>", methods=["PUT"])
def api_update(doctor_id: int):
    is_own_doctor = role() == "doctor" and current_doctor_id() == doctor_id
    if not (can_manage() or is_own_doctor):
        return fail("No tienes permiso para editar este medico.", 403)
    item = update("doctors", doctor_id, clean_doctor_payload(payload(), allow_avatar=False))
    if not item:
        return fail("No fue posible actualizar el medico.", 500)
    return ok({"item": item, "doctor": item})


@bp.route("/api/<int:doctor_id>/avatar", methods=["POST"])
def api_upload_avatar(doctor_id: int):
    is_own_doctor = role() == "doctor" and current_doctor_id() == doctor_id
    if not (can_manage() or is_own_doctor):
        return fail("No tienes permiso para subir la imagen de este medico.", 403)

    file = request.files.get("avatar")
    if not file or not file.filename:
        return fail("Selecciona una imagen desde tu equipo.", 400)

    filename = secure_filename(file.filename)
    extension = os.path.splitext(filename)[1].lower()
    if file.mimetype not in ALLOWED_AVATAR_MIMES and extension not in {".png", ".jpg", ".jpeg", ".webp"}:
        return fail("La imagen debe ser PNG, JPG, JPEG o WEBP.", 400)

    try:
        avatar_url = upload_doctor_avatar_to_supabase(doctor_id, file)
    except Exception as exc:
        return fail(
            "No fue posible subir la imagen a Supabase Storage. "
            f"Crea el bucket publico '{DOCTOR_AVATAR_BUCKET}' o configura SUPABASE_SERVICE_ROLE_KEY. Detalle: {exc}",
            500,
        )
    if not avatar_url:
        return fail("No fue posible leer la imagen seleccionada.", 400)

    item = update("doctors", doctor_id, {"avatar_url": avatar_url})
    if not item:
        return fail("No fue posible guardar la imagen del medico.", 500)
    log_event("update", "doctors", doctor_id, {"avatar_url": avatar_url})
    return ok({"avatar_url": avatar_url, "doctor": item, "item": item})


@bp.route("/api/<int:doctor_id>/deactivate", methods=["POST"])
def api_deactivate(doctor_id: int):
    if not can_manage():
        return fail("No tienes permiso para desactivar medicos.", 403)
    item = update("doctors", doctor_id, {"is_active": False})
    return ok({"item": item, "doctor": item})
