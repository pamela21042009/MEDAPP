from __future__ import annotations

from typing import Dict, Optional

from flask import session

from .database import DatabaseService
from .security import hash_password, verify_password


class AuthService:
    def __init__(self) -> None:
        self._db = DatabaseService.get_instance()

    def login(self, email: str, password: str) -> Optional[Dict]:
        users = self._db.select("users", "*", {"email": email, "is_active": True})
        if not users:
            return None
        user = users[0]
        valid, needs_upgrade = verify_password(password, user.get("password_hash", ""))
        if not valid:
            return None
        if needs_upgrade:
            user = self._db.update("users", {"password_hash": hash_password(password)}, {"id": user["id"]}) or user
        session["user_id"] = user["id"]
        session["user_name"] = user["full_name"]
        session["user_role"] = user["role"]
        session["user_email"] = user["email"]
        return user

    def logout(self) -> None:
        session.clear()

    def is_authenticated(self) -> bool:
        return "user_id" in session

    def current_user(self) -> Optional[Dict]:
        if not self.is_authenticated():
            return None
        return {
            "id": session.get("user_id"),
            "name": session.get("user_name"),
            "role": session.get("user_role"),
            "email": session.get("user_email"),
        }

    def require_role(self, *roles: str) -> bool:
        user = self.current_user()
        if not user:
            return False
        return user.get("role") in roles

    def register(self, data: Dict) -> Optional[Dict]:
        data["password_hash"] = hash_password(data.pop("password", ""))
        data["is_active"] = True
        return self._db.insert("users", data)
