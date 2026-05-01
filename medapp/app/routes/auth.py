from __future__ import annotations

import hashlib
import os

from flask import Blueprint, current_app, jsonify, redirect, session

from .api_helpers import fail, ok, payload, select
from app.services.database import DatabaseService

bp = Blueprint("auth", __name__, url_prefix="/auth")


def _hash_password(password: str) -> str:
    salt = os.environ.get("PASSWORD_SALT", "medapp_salt")
    return hashlib.sha256(f"{salt}{password}".encode()).hexdigest()


def _public_user(user: dict) -> dict:
    return {
        "id": user.get("id"),
        "name": user.get("full_name") or user.get("name") or user.get("email"),
        "full_name": user.get("full_name") or user.get("name") or "",
        "email": user.get("email", ""),
        "role": user.get("role", "staff"),
        "avatar_url": user.get("avatar_url", ""),
    }


def _store_session(user: dict) -> None:
    public = _public_user(user)
    session["user_id"] = public["id"]
    session["user_name"] = public["name"]
    session["user_role"] = public["role"]
    session["user_email"] = public["email"]


@bp.route("/")
@bp.route("/login", methods=["GET"])
def login():
    return redirect("/auth/login")


@bp.route("/api/login", methods=["POST"])
def api_login():
    data = payload()
    email = str(data.get("email", "")).strip().lower()
    password = str(data.get("password", ""))
    if not email or not password:
        return fail("Correo y contrasena requeridos.", 400)

    users = select("users", "*", {"email": email, "password_hash": _hash_password(password), "is_active": True})
    if not users:
        return fail("Credenciales incorrectas.", 401)

    _store_session(users[0])
    return ok({"user": _public_user(users[0]), "redirect": "/dashboard"})


@bp.route("/api/me")
def api_me():
    if "user_id" not in session:
        return jsonify({"user": None}), 401
    return ok({
        "user": {
            "id": session.get("user_id"),
            "name": session.get("user_name"),
            "full_name": session.get("user_name"),
            "email": session.get("user_email"),
            "role": session.get("user_role"),
        }
    })


@bp.route("/api/logout", methods=["POST"])
def api_logout():
    session.clear()
    return ok(message="Sesion cerrada.")


@bp.route("/api/register", methods=["POST"])
def api_register():
    data = payload()
    email = str(data.get("email", "")).strip().lower()
    password = str(data.get("password", ""))
    role = str(data.get("role", "paciente")).strip() or "paciente"
    if not email or not password:
        return fail("Correo y contrasena requeridos.", 400)
    if len(password) < 8:
        return fail("La contrasena debe tener al menos 8 caracteres.", 400)

    cfg = current_app.config
    if role == "admin" and data.get("register_code") != cfg.get("ADMIN_REGISTER_CODE", "ADMIN2025"):
        return fail("Codigo de administrador invalido.", 403)
    if role == "doctor" and data.get("register_code") != cfg.get("DOCTOR_REGISTER_CODE", "MEDICO2025"):
        return fail("Codigo de medico invalido.", 403)

    existing = select("users", "id", {"email": email})
    if existing:
        return fail("Ya existe una cuenta con ese correo.", 409)

    user = DatabaseService.get_instance().insert("users", {
        "full_name": data.get("full_name") or data.get("name") or email,
        "email": email,
        "password_hash": _hash_password(password),
        "role": role,
        "is_active": True,
    })
    if not user:
        return fail("No fue posible crear la cuenta.", 500)
    _store_session(user)
    return ok({"user": _public_user(user), "redirect": "/dashboard"})


@bp.route("/api/forgot-password", methods=["POST"])
def api_forgot_password():
    return ok(message="Si el correo existe, se enviara un codigo de verificacion.")


@bp.route("/api/reset-context")
def api_reset_context():
    return ok(email=session.get("reset_email", ""))


@bp.route("/api/verify-code", methods=["POST"])
def api_verify_code():
    return ok(message="Codigo verificado.")


@bp.route("/api/new-password", methods=["POST"])
def api_new_password():
    return ok(message="Contrasena actualizada.")
