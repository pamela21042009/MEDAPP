from __future__ import annotations

import hashlib
import os
import random
from datetime import datetime, timedelta, timezone
from typing import Any

from flask import Blueprint, current_app, jsonify, redirect, request, session

from .api_helpers import current_user, fail, log_event, ok, payload, role, select
from app.services.database import DatabaseService
from app.services.email_service import EmailService
from app.services.security import (
    clear_auth_cookie,
    create_access_token,
    generate_invitation_token,
    hash_invitation_token,
    hash_password,
    set_auth_cookie,
    token_ttl_minutes,
    utc_now,
    validate_password_strength,
    verify_password,
)

bp = Blueprint("auth", __name__, url_prefix="/auth")


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


def _send_welcome_email(email: str, full_name: str, current_role: str) -> bool:
    role_labels = {
        "admin": "administrador",
        "doctor": "medico",
        "paciente": "paciente",
        "staff": "personal",
        "secretaria": "secretaria",
    }
    name = full_name or email
    role_label = role_labels.get(current_role, current_role)
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


def _send_doctor_invitation_email(email: str, full_name: str, invite_url: str, expires_at: str) -> bool:
    name = full_name or email
    return _send_email(
        email,
        "Invitacion para activar tu cuenta medica",
        (
            f"Hola {name},\n\n"
            "Un administrador te invito a activar tu cuenta de doctor en MedApp.\n\n"
            f"Abre este enlace para crear tu contrasena:\n{invite_url}\n\n"
            f"El enlace expira el {expires_at} y solo puede usarse una vez.\n\n"
            "Si no esperabas esta invitacion, ignora este correo."
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
        "email_verified": user.get("email_verified") is True,
    }


def _store_session(user: dict) -> None:
    public = _public_user(user)
    session["user_id"] = public["id"]
    session["user_name"] = public["name"]
    session["user_role"] = public["role"]
    session["user_email"] = public["email"]
    session["user_avatar_url"] = public["avatar_url"]


def _issue_auth_response(user: dict, message: str = "Autenticado correctamente."):
    token = create_access_token(user)
    _store_session(user)
    response = ok({
        "message": message,
        "user": _public_user(user),
        "access_token": token,
        "token_type": "Bearer",
        "expires_in": token_ttl_minutes() * 60,
        "redirect": "/dashboard",
        "redirect_to": "/dashboard",
    })
    set_auth_cookie(response, token)
    return response


def _normalize_role(value: str) -> str:
    role_aliases = {
        "medico": "doctor",
        "medico/a": "doctor",
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


def _parse_datetime(value: Any) -> datetime | None:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed


def _frontend_base_url() -> str:
    configured = (
        current_app.config.get("INVITE_BASE_URL")
        or os.environ.get("INVITE_BASE_URL")
        or os.environ.get("FRONTEND_PUBLIC_URL")
        or os.environ.get("APP_PUBLIC_URL")
        or ""
    )
    if configured:
        return str(configured).rstrip("/")

    origin = request.headers.get("Origin", "").strip()
    if origin:
        return origin.rstrip("/")

    origins = current_app.config.get("FRONTEND_DEV_ORIGINS", ())
    if origins:
        return str(origins[0]).rstrip("/")

    return request.host_url.rstrip("/")


def _invite_url(token: str) -> str:
    return f"{_frontend_base_url()}/verify?token={token}"


def _invitation_expiry() -> datetime:
    hours = int(current_app.config.get("DOCTOR_INVITE_EXPIRE_HOURS", 24) or 24)
    return utc_now() + timedelta(hours=hours)


def _public_invitation(invitation: dict | None) -> dict:
    if not invitation:
        return {}
    return {
        "id": invitation.get("id"),
        "email": invitation.get("email"),
        "full_name": invitation.get("full_name"),
        "role": invitation.get("role", "doctor"),
        "doctor_id": invitation.get("doctor_id"),
        "expires_at": invitation.get("expires_at"),
        "used_at": invitation.get("used_at"),
    }


def _find_invitation(token: str) -> dict | None:
    token_hash = hash_invitation_token(str(token or "").strip())
    rows = select("doctor_invitations", "*", {"token_hash": token_hash})
    return rows[0] if rows else None


def _validate_invitation(token: str) -> tuple[dict | None, str, int]:
    if not token:
        return None, "Token requerido.", 400

    invitation = _find_invitation(token)
    if not invitation:
        return None, "Invitacion no encontrada.", 404
    if invitation.get("used_at"):
        return None, "Esta invitacion ya fue utilizada.", 400
    if invitation.get("revoked_at"):
        return None, "Esta invitacion fue revocada.", 400

    expires_at = _parse_datetime(invitation.get("expires_at"))
    if not expires_at or expires_at <= utc_now():
        return None, "La invitacion expiro. Solicita una nueva.", 400

    return invitation, "", 200


def _require_admin():
    if role() != "admin":
        return fail("Solo un administrador puede realizar esta accion.", 403)
    return None


def _upsert_pending_doctor_user(data: dict, admin_user: dict) -> dict | None:
    database = DatabaseService.get_instance()
    email = str(data.get("email") or "").strip().lower()
    full_name = _full_name(data)
    existing = select("users", "*", {"email": email})

    if existing:
        user = existing[0]
        if user.get("is_active") is True:
            return None
        user = database.update("users", {
            "full_name": full_name,
            "role": "doctor",
            "is_active": False,
            "email_verified": False,
            "updated_at": utc_now().isoformat(),
        }, {"id": user.get("id")})
        return user

    return database.insert("users", {
        "full_name": full_name,
        "email": email,
        "password_hash": "",
        "role": "doctor",
        "is_active": False,
        "email_verified": False,
        "invited_by_user_id": admin_user.get("id"),
        "created_at": utc_now().isoformat(),
    })


def _upsert_doctor_profile(user: dict, data: dict) -> dict | None:
    database = DatabaseService.get_instance()
    email = str(data.get("email") or "").strip().lower()
    specialty = str(data.get("specialty") or "").strip() or "Medicina General"
    _ensure_specialty(specialty)
    profile = {
        "user_id": user.get("id"),
        "full_name": _full_name(data),
        "specialty": specialty,
        "email": email,
        "phone": data.get("phone") or "",
        "license_number": data.get("license_number") or data.get("professional_id") or "",
        "clinic_name": data.get("clinic_name") or "",
        "clinic_address": data.get("clinic_address") or "",
        "bio": data.get("bio") or "",
        "is_active": False,
    }
    by_user = select("doctors", "*", {"user_id": user.get("id")}) if user.get("id") else []
    existing = by_user or select("doctors", "*", {"email": email})
    if existing:
        return database.update("doctors", profile, {"id": existing[0].get("id")})
    return database.insert("doctors", profile)


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

    users = select("users", "*", {"email": email})
    user = users[0] if users else None
    if not user:
        return fail("Credenciales incorrectas.", 401)
    if user.get("is_active") is False:
        return fail("La cuenta no esta activa. Revisa tu invitacion o contacta al administrador.", 403)

    valid, needs_upgrade = verify_password(password, str(user.get("password_hash") or ""))
    if not valid:
        return fail("Credenciales incorrectas.", 401)

    updates = {"last_login": utc_now().isoformat()}
    if needs_upgrade:
        updates["password_hash"] = hash_password(password)
    updated_user = DatabaseService.get_instance().update("users", updates, {"id": user.get("id")}) or user
    return _issue_auth_response(updated_user)


@bp.route("/api/specialties")
def api_specialties():
    return ok({"items": _active_specialties()})


@bp.route("/api/me")
def api_me():
    identity = current_user()
    if not identity or not identity.get("id"):
        return jsonify({"user": None}), 401
    return ok({"user": identity})


@bp.route("/api/logout", methods=["POST"])
def api_logout():
    session.clear()
    response = ok(message="Sesion cerrada.")
    clear_auth_cookie(response)
    return response


@bp.route("/api/register", methods=["POST"])
def api_register():
    data = payload()
    email = str(data.get("email", "")).strip().lower()
    password = str(data.get("password", ""))
    current_role = _normalize_role(data.get("role", "paciente"))
    full_name = _full_name(data)
    if not email or not password:
        return fail("Correo y contrasena requeridos.", 400)
    strong, message = validate_password_strength(password)
    if not strong:
        return fail(message, 400)
    if data.get("confirm_password") and password != data.get("confirm_password"):
        return fail("Las contrasenas no coinciden.", 400)
    if current_role != "paciente":
        return fail("El registro publico solo esta disponible para pacientes.", 403)

    existing = select("users", "id", {"email": email})
    if existing:
        return fail("Ya existe una cuenta con ese correo.", 409)

    user = DatabaseService.get_instance().insert("users", {
        "full_name": full_name,
        "email": email,
        "password_hash": hash_password(password),
        "role": current_role,
        "is_active": True,
        "email_verified": True,
        "created_at": utc_now().isoformat(),
    })
    if not user:
        return fail("No fue posible crear la cuenta. Verifica que ejecutaste la migracion SQL de autenticacion.", 500)

    if current_role == "paciente":
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

    log_event("register", "users", user.get("id"), {"role": current_role})
    try:
        if _send_welcome_email(email, full_name, current_role):
            log_event("welcome_email_sent", "users", user.get("id"), {"email": email})
    except Exception as exc:
        current_app.logger.warning("No fue posible enviar el correo de bienvenida: %s", exc)
    return _issue_auth_response(user, "Cuenta creada correctamente.")


@bp.route("/api/admin/doctors/invite", methods=["POST"])
def api_invite_doctor():
    denied = _require_admin()
    if denied:
        return denied

    data = payload()
    email = str(data.get("email", "")).strip().lower()
    full_name = _full_name(data)
    if not email or "@" not in email:
        return fail("Correo del doctor requerido.", 400)
    if not full_name:
        return fail("Nombre del doctor requerido.", 400)

    admin_user = current_user()
    user = _upsert_pending_doctor_user(data, admin_user)
    if not user:
        return fail("Ya existe una cuenta activa con ese correo.", 409)

    doctor = _upsert_doctor_profile(user, data)
    if not doctor:
        return fail("No fue posible crear el perfil medico.", 500)

    token = generate_invitation_token()
    expires_at = _invitation_expiry()
    invitation = DatabaseService.get_instance().insert("doctor_invitations", {
        "token_hash": hash_invitation_token(token),
        "email": email,
        "full_name": full_name,
        "role": "doctor",
        "user_id": user.get("id"),
        "doctor_id": doctor.get("id"),
        "invited_by_user_id": admin_user.get("id"),
        "expires_at": expires_at.isoformat(),
        "created_at": utc_now().isoformat(),
    })
    if not invitation:
        detail = DatabaseService.get_instance().get_last_error()
        return fail(
            "No fue posible guardar la invitacion. Ejecuta la migracion SQL de doctor_invitations."
            + (f" Detalle: {detail}" if detail else ""),
            500,
        )

    invite_link = _invite_url(token)
    email_sent = False
    try:
        email_sent = _send_doctor_invitation_email(email, full_name, invite_link, expires_at.isoformat())
    except Exception as exc:
        current_app.logger.warning("No fue posible enviar invitacion al doctor: %s", exc)

    log_event("doctor_invited", "doctor_invitations", invitation.get("id"), {"doctor_id": doctor.get("id"), "email": email})
    response = {
        "message": "Invitacion enviada al correo del doctor." if email_sent else "Invitacion creada. Configura SMTP para enviar el correo automaticamente.",
        "email_sent": email_sent,
        "doctor": doctor,
        "invitation": _public_invitation(invitation),
    }
    if current_app.debug or not email_sent:
        response["invite_link"] = invite_link
    return ok(response)


@bp.route("/api/invitations/verify")
def api_verify_invitation():
    token = str(request.args.get("token") or "").strip()
    invitation, error, status = _validate_invitation(token)
    if error:
        return fail(error, status)
    return ok({"valid": True, "invitation": _public_invitation(invitation)})


@bp.route("/api/invitations/accept", methods=["POST"])
def api_accept_invitation():
    data = payload()
    token = str(data.get("token") or "").strip()
    password = str(data.get("password") or "")
    confirm_password = str(data.get("confirm_password") or "")

    strong, message = validate_password_strength(password)
    if not strong:
        return fail(message, 400)
    if password != confirm_password:
        return fail("Las contrasenas no coinciden.", 400)

    invitation, error, status = _validate_invitation(token)
    if error:
        return fail(error, status)

    user_rows = select("users", "*", {"id": invitation.get("user_id")})
    user = user_rows[0] if user_rows else None
    if not user:
        return fail("Usuario de invitacion no encontrado.", 404)

    now = utc_now().isoformat()
    updated_user = DatabaseService.get_instance().update("users", {
        "password_hash": hash_password(password),
        "is_active": True,
        "email_verified": True,
        "updated_at": now,
    }, {"id": user.get("id")})
    if not updated_user:
        return fail("No fue posible activar la cuenta.", 500)

    if invitation.get("doctor_id"):
        DatabaseService.get_instance().update("doctors", {"is_active": True}, {"id": invitation.get("doctor_id")})

    DatabaseService.get_instance().update("doctor_invitations", {
        "used_at": now,
        "used_by_user_id": user.get("id"),
    }, {"id": invitation.get("id")})

    log_event("doctor_invitation_accepted", "doctor_invitations", invitation.get("id"), {"doctor_id": invitation.get("doctor_id")})
    return _issue_auth_response(updated_user, "Cuenta activada correctamente.")


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
    session["reset_expires_at"] = (utc_now() + timedelta(minutes=10)).isoformat()
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
    parsed_expiry = _parse_datetime(expires_at)
    if not parsed_expiry or parsed_expiry < utc_now():
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
    strong, message = validate_password_strength(password)
    if not strong:
        return fail(message, 400)
    if password != confirm_password:
        return fail("Las contrasenas no coinciden.", 400)

    item = DatabaseService.get_instance().update(
        "users",
        {"password_hash": hash_password(password), "updated_at": utc_now().isoformat()},
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
