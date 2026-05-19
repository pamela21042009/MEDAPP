from __future__ import annotations

import hashlib
import os
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any

import bcrypt
import jwt
from flask import Response, current_app, request, session


JWT_ALGORITHM = "HS256"


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def jwt_secret() -> str:
    return (
        os.environ.get("JWT_SECRET_KEY")
        or os.environ.get("SECRET_KEY")
        or current_app.config.get("SECRET_KEY")
        or "dev-secret-key-change-in-production"
    )


def auth_cookie_name() -> str:
    return os.environ.get("AUTH_COOKIE_NAME", "medapp_access_token")


def token_ttl_minutes() -> int:
    return int(os.environ.get("JWT_ACCESS_TOKEN_MINUTES", "60") or 60)


def create_access_token(user: dict[str, Any]) -> str:
    now = utc_now()
    public_user = {
        "id": user.get("id"),
        "email": user.get("email"),
        "role": user.get("role"),
        "name": user.get("full_name") or user.get("name") or user.get("email"),
        "avatar_url": user.get("avatar_url", ""),
    }
    payload = {
        "sub": str(public_user["id"]),
        "typ": "access",
        "iat": now,
        "exp": now + timedelta(minutes=token_ttl_minutes()),
        "user": public_user,
    }
    return jwt.encode(payload, jwt_secret(), algorithm=JWT_ALGORITHM)


def decode_access_token(token: str) -> dict[str, Any] | None:
    if not token:
        return None
    try:
        payload = jwt.decode(token, jwt_secret(), algorithms=[JWT_ALGORITHM])
    except jwt.PyJWTError:
        return None
    if payload.get("typ") != "access":
        return None
    return payload


def token_from_request() -> str:
    authorization = request.headers.get("Authorization", "")
    if authorization.lower().startswith("bearer "):
        return authorization.split(" ", 1)[1].strip()
    return request.cookies.get(auth_cookie_name(), "")


def current_identity() -> dict[str, Any] | None:
    payload = decode_access_token(token_from_request())
    if payload and isinstance(payload.get("user"), dict):
        return payload["user"]

    if "user_id" not in session:
        return None
    return {
        "id": session.get("user_id"),
        "name": session.get("user_name", "Usuario"),
        "full_name": session.get("user_name", "Usuario"),
        "email": session.get("user_email", ""),
        "role": session.get("user_role", "staff"),
        "avatar_url": session.get("user_avatar_url", ""),
    }


def is_authenticated_request() -> bool:
    return current_identity() is not None


def set_auth_cookie(response: Response, token: str) -> None:
    secure = bool(current_app.config.get("SESSION_COOKIE_SECURE", False))
    response.set_cookie(
        auth_cookie_name(),
        token,
        max_age=token_ttl_minutes() * 60,
        httponly=True,
        secure=secure,
        samesite=os.environ.get("AUTH_COOKIE_SAMESITE", "Lax"),
    )


def clear_auth_cookie(response: Response) -> None:
    response.delete_cookie(auth_cookie_name())


def hash_password(password: str) -> str:
    rounds = int(os.environ.get("BCRYPT_ROUNDS", "12") or 12)
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt(rounds=rounds)).decode("utf-8")


def legacy_sha256_password(password: str) -> str:
    salt = os.environ.get("PASSWORD_SALT", "medapp_salt")
    return hashlib.sha256(f"{salt}{password}".encode()).hexdigest()


def verify_password(password: str, stored_hash: str) -> tuple[bool, bool]:
    if not stored_hash:
        return False, False

    if stored_hash.startswith("$2a$") or stored_hash.startswith("$2b$") or stored_hash.startswith("$2y$"):
        try:
            return bcrypt.checkpw(password.encode("utf-8"), stored_hash.encode("utf-8")), False
        except (TypeError, ValueError):
            return False, False

    return legacy_sha256_password(password) == stored_hash, True


def validate_password_strength(password: str) -> tuple[bool, str]:
    if len(password) < 8:
        return False, "La contrasena debe tener al menos 8 caracteres."
    if len(password.encode("utf-8")) > 72:
        return False, "La contrasena es demasiado larga para bcrypt."
    return True, ""


def generate_invitation_token() -> str:
    return secrets.token_urlsafe(48)


def hash_invitation_token(token: str) -> str:
    pepper = os.environ.get("INVITATION_TOKEN_PEPPER") or jwt_secret()
    return hashlib.sha256(f"{pepper}{token}".encode("utf-8")).hexdigest()
