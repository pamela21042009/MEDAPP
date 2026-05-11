from __future__ import annotations

import hashlib
import os
import random
from datetime import datetime, timedelta, timezone

from flask import Blueprint, current_app, jsonify, redirect, session

from .api_helpers import fail, log_event, ok, payload, select
from app.services.database import DatabaseService
from app.services.email_service import EmailService

bp = Blueprint("auth", __name__, url_prefix="/auth")


def _hash_password(password: str) -> str:
    salt = os.environ.get("PASSWORD_SALT", "medapp_salt")
    return hashlib.sha256(f"{salt}{password}".encode()).hexdigest()


def _hash_code(code: str) -> str:
    salt = os.environ.get("PASSWORD_RESET_SALT", os.environ.get("PASSWORD_SALT", "medapp_salt"))
    return hashlib.sha256(f"{salt}{code}".encode()).hexdigest()


def _send_email(to_email: str, subject: str, body: str) -> bool:
    return EmailService().send(to_email, subject, body)


def _send_reset_email(email: str, code: str) -> bool:
    return _send_email(
        email,
        "Codigo de recuperacion MedApp",
        "Tu codigo de recuperacion de MedApp es: "
        f"{code}\n\nEste codigo expira en 10 minutos.",
    )


def _send_welcome_email(email: str, full_name: str, role: str) -> bool:
    role_labels = {
        "admin": "administrador",
        "doctor": "medico",
        "paciente": "paciente",
        "staff": "personal",
        "secretaria": "secretaria",
    }
    name = full_name or email
    role_label = role_labels.get(role, role)
    return _send_email(
        email,
        "Bienvenido a MedApp",
        (
            f"Hola {name},\n\n"
            f"Tu cuenta de MedApp fue creada correctamente con rol de {role_label}.\n\n"
            "Ya puedes iniciar sesion y acceder a las funciones disponibles para tu perfil.\n\n"
            "Gracias por usar MedApp."
        ),
    )


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
    session["user_avatar_url"] = public["avatar_url"]


def _normalize_role(value: str) -> str:
    role_aliases = {
        "medico": "doctor",
        "médico": "doctor",
    }
    normalized = str(value or "paciente").strip().lower()
    return role_aliases.get(normalized, normalized)


def _full_name(data: dict) -> str:
    explicit = str(data.get("full_name") or data.get("name") or "").strip()
    if explicit:
        return explicit
    first_name = str(data.get("first_name") or "").strip()
    last_name = str(data.get("last_name") or "").strip()
    return f"{first_name} {last_name}".strip() or str(data.get("email") or "").strip()


def _register_code(data: dict) -> str:
    return str(
        data.get("register_code")
        or data.get("authorization_code")
        or data.get("admin_code")
        or ""
    ).strip()


def _active_specialties() -> list[str]:
    rows = select("specialties", "name,is_active")
    values = [
        str(item.get("name") or "").strip()
        for item in rows
        if item.get("is_active") is not False and str(item.get("name") or "").strip()
    ]
    if values:
        return sorted(set(values))
    return [
        "Medicina General",
        "Cardiologia",
        "Dermatologia",
        "Ginecologia",
        "Neurologia",
        "Oftalmologia",
        "Ortopedia",
        "Pediatria",
        "Psiquiatria",
        "Radiologia",
    ]


def _ensure_specialty(name: str) -> None:
    specialty = str(name or "").strip()
    if not specialty:
        return
    existing = select("specialties", "id,name", {"name": specialty})
    if existing:
        return
    DatabaseService.get_instance().insert("specialties", {"name": specialty, "is_active": True})


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


@bp.route("/api/specialties")
def api_specialties():
    return ok({"items": _active_specialties()})


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
            "avatar_url": session.get("user_avatar_url", ""),
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
    role = _normalize_role(data.get("role", "paciente"))
    register_code = _register_code(data)
    full_name = _full_name(data)
    if not email or not password:
        return fail("Correo y contrasena requeridos.", 400)
    if len(password) < 8:
        return fail("La contrasena debe tener al menos 8 caracteres.", 400)
    if data.get("confirm_password") and password != data.get("confirm_password"):
        return fail("Las contrasenas no coinciden.", 400)

    cfg = current_app.config
    if role == "admin" and register_code != cfg.get("ADMIN_REGISTER_CODE", "ADMIN2025"):
        return fail("Codigo de administrador invalido.", 403)
    if role == "doctor" and register_code != cfg.get("DOCTOR_REGISTER_CODE", "MEDICO2025"):
        return fail("Codigo de medico invalido.", 403)

    existing = select("users", "id", {"email": email})
    if existing:
        return fail("Ya existe una cuenta con ese correo.", 409)

    user = DatabaseService.get_instance().insert("users", {
        "full_name": full_name,
        "email": email,
        "password_hash": _hash_password(password),
        "role": role,
        "is_active": True,
    })
    if not user:
        return fail("No fue posible crear la cuenta.", 500)

    if role == "doctor":
        specialty = str(data.get("specialty") or "").strip() or "Medicina General"
        _ensure_specialty(specialty)
        DatabaseService.get_instance().insert("doctors", {
            "user_id": user.get("id"),
            "full_name": full_name,
            "specialty": specialty,
            "email": email,
            "phone": data.get("phone") or "",
            "license_number": data.get("license_number") or data.get("professional_id") or "",
            "is_active": True,
        })
    elif role == "paciente":
        patient_data = {
            "user_id": user.get("id"),
            "full_name": full_name,
            "email": email,
            "phone": data.get("phone") or "",
        }
        patient = DatabaseService.get_instance().insert("patients", patient_data)
        if not patient:
            DatabaseService.get_instance().insert(
                "patients",
                {key: value for key, value in patient_data.items() if key != "user_id"},
            )

    _store_session(user)
    log_event("register", "users", user.get("id"), {"role": role})
    try:
        if _send_welcome_email(email, full_name, role):
            log_event("welcome_email_sent", "users", user.get("id"), {"email": email})
        else:
            current_app.logger.warning("Correo de bienvenida no enviado: configuracion SMTP incompleta.")
    except Exception as exc:
        current_app.logger.warning("No fue posible enviar el correo de bienvenida: %s", exc)
    return ok({"user": _public_user(user), "redirect": "/dashboard"})


@bp.route("/api/forgot-password", methods=["POST"])
def api_forgot_password():
    data = payload()
    email = str(data.get("email", "")).strip().lower()
    if not email:
        return fail("Correo requerido.", 400)

    users = select("users", "*", {"email": email, "is_active": True})
    if not users:
        return fail("No existe una cuenta activa con ese correo.", 404)

    code = f"{random.randint(0, 999999):06d}"
    session["reset_email"] = email
    session["reset_code_hash"] = _hash_code(code)
    session["reset_expires_at"] = (datetime.now(timezone.utc) + timedelta(minutes=10)).isoformat()
    session["reset_verified"] = False

    sent_by_email = False
    try:
        sent_by_email = _send_reset_email(email, code)
    except Exception as exc:
        current_app.logger.warning("No fue posible enviar el correo de recuperacion: %s", exc)

    response = {
        "sent": True,
        "next_step": "/auth/verify-code",
        "message": "Codigo enviado. Revisa el correo indicado.",
    }
    if not sent_by_email:
        response["debug_code"] = code
        session["reset_debug_code"] = code
        response["message"] = "Codigo generado para prueba local."
    else:
        session.pop("reset_debug_code", None)
    return ok(response)


@bp.route("/api/reset-context")
def api_reset_context():
    return ok({
        "email": session.get("reset_email", ""),
        "has_verified_code": bool(session.get("reset_verified")),
        "debug_code": session.get("reset_debug_code", ""),
    })


@bp.route("/api/verify-code", methods=["POST"])
def api_verify_code():
    data = payload()
    code = str(data.get("code", "")).strip()
    expires_at = session.get("reset_expires_at", "")
    if not session.get("reset_email") or not session.get("reset_code_hash"):
        return fail("No hay una recuperacion de contrasena activa.", 400)
    if not code or len(code) != 6:
        return fail("Ingresa el codigo de 6 digitos.", 400)
    try:
        expired = datetime.fromisoformat(expires_at) < datetime.now(timezone.utc)
    except ValueError:
        expired = True
    if expired:
        return fail("El codigo expiro. Solicita uno nuevo.", 400)
    if _hash_code(code) != session.get("reset_code_hash"):
        return fail("Codigo de verificacion invalido.", 400)

    session["reset_verified"] = True
    return ok(message="Codigo verificado.", next_step="/auth/new-password")


@bp.route("/api/new-password", methods=["POST"])
def api_new_password():
    if not session.get("reset_email") or not session.get("reset_verified"):
        return fail("Primero verifica el codigo de recuperacion.", 400)

    data = payload()
    password = str(data.get("password", ""))
    confirm_password = str(data.get("confirm_password", ""))
    if len(password) < 8:
        return fail("La contrasena debe tener al menos 8 caracteres.", 400)
    if password != confirm_password:
        return fail("Las contrasenas no coinciden.", 400)

    item = DatabaseService.get_instance().update(
        "users",
        {"password_hash": _hash_password(password)},
        {"email": session["reset_email"]},
    )
    if not item:
        return fail("No fue posible actualizar la contrasena.", 500)

    session.pop("reset_email", None)
    session.pop("reset_code_hash", None)
    session.pop("reset_expires_at", None)
    session.pop("reset_verified", None)
    session.pop("reset_debug_code", None)
    log_event("password_reset", "users", item.get("id"))
    return ok(message="Contrasena actualizada correctamente. Ya puedes iniciar sesion.")
