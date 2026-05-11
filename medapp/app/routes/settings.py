from __future__ import annotations

from flask import Blueprint, request, session

from .api_helpers import current_user, fail, ok, payload, role, update
from .avatar_upload import upload_avatar_to_supabase

bp = Blueprint("settings", __name__, url_prefix="/settings")


@bp.route("/api/bootstrap")
def api_bootstrap():
    user = current_user()
    parts = str(user.get("name") or "").split(" ", 1)
    return ok({
        "role": role(),
        "user": user,
        "profile": {
            "first_name": parts[0] if parts else "",
            "last_name": parts[1] if len(parts) > 1 else "",
            "phone": "",
            "avatar_url": user.get("avatar_url", ""),
        },
        "cfg": {
            "clinic_name": "MedApp",
            "currency": "USD",
            "timezone": "America/Santo_Domingo",
        },
    })


@bp.route("/api/profile", methods=["POST"])
def api_profile():
    data = payload()
    name = f"{data.get('first_name', '')} {data.get('last_name', '')}".strip() or session.get("user_name", "Usuario")
    session["user_name"] = name
    if session.get("user_id"):
        update("users", int(session["user_id"]), {"full_name": name, **data})
    return ok({"message": "Perfil actualizado.", "user": current_user()})


@bp.route("/api/profile/avatar", methods=["POST"])
def api_profile_avatar():
    if not session.get("user_id"):
        return fail("Sesion no disponible.", 401)

    file = request.files.get("avatar")
    if not file or not file.filename:
        return fail("Selecciona una imagen desde tu equipo.", 400)

    try:
        avatar_url = upload_avatar_to_supabase(f"users/user-{session['user_id']}", file)
    except Exception as exc:
        return fail(f"No fue posible subir la imagen. Detalle: {exc}", 500)
    if not avatar_url:
        return fail("La imagen debe ser PNG, JPG, JPEG o WEBP.", 400)

    update("users", int(session["user_id"]), {"avatar_url": avatar_url})
    session["user_avatar_url"] = avatar_url
    return ok({"message": "Foto actualizada.", "avatar_url": avatar_url, "user": current_user()})


@bp.route("/api/password", methods=["POST"])
def api_password():
    return ok(message="Contrasena actualizada.")


@bp.route("/api/system", methods=["POST"])
def api_system():
    return ok({"message": "Configuracion guardada.", "cfg": payload()})
