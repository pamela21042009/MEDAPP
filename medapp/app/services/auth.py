from __future__ import annotations
from typing import Optional, Dict
from flask import session
import hashlib
import os

from .database import DatabaseService


class AuthService:
    def __init__(self) -> None:
        self._db = DatabaseService.get_instance()

    def login(self, email: str, password: str) -> Optional[Dict]:
        hashed = self._hash_password(password)
        users = self._db.select("users", "*", {"email": email, "password_hash": hashed, "is_active": True})
        if not users:
            return None
        user = users[0]
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
        data["password_hash"] = self._hash_password(data.pop("password", ""))
        data["is_active"] = True
        return self._db.insert("users", data)

    @staticmethod
    def _hash_password(password: str) -> str:
        salt = os.environ.get("PASSWORD_SALT", "medapp_salt")
        return hashlib.sha256(f"{salt}{password}".encode()).hexdigest()
