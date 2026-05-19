from __future__ import annotations

from datetime import datetime
from typing import Dict, Optional

from .database import DatabaseService
from .security import hash_password, validate_password_strength, verify_password


class SettingsService:
    def __init__(self):
        self._db = DatabaseService.get_instance()

    def get_all(self) -> Dict[str, str]:
        rows = self._db.select("system_settings", "*")
        return {row["key"]: row["value"] for row in rows}

    def get(self, key: str, default: str = "") -> str:
        rows = self._db.select("system_settings", "value", {"key": key})
        return rows[0]["value"] if rows else default

    def set(self, key: str, value: str, updated_by: int) -> Optional[Dict]:
        existing = self._db.select("system_settings", "id", {"key": key})
        data = {
            "value": value,
            "updated_by": updated_by,
            "updated_at": datetime.utcnow().isoformat(),
        }
        if existing:
            return self._db.update("system_settings", data, {"key": key})
        data["key"] = key
        return self._db.insert("system_settings", data)

    def update_many(self, updates: Dict[str, str], updated_by: int) -> bool:
        try:
            for key, value in updates.items():
                self.set(key, value, updated_by)
            return True
        except Exception:
            return False

    def get_profile(self, user_id: int) -> Optional[Dict]:
        rows = self._db.select("users", "*", {"id": user_id})
        if rows:
            rows[0].pop("password_hash", None)
        return rows[0] if rows else None

    def update_profile(self, user_id: int, data: Dict) -> Optional[Dict]:
        allowed = {"first_name", "last_name", "full_name", "phone", "avatar_url"}
        payload = {key: value for key, value in data.items() if key in allowed}
        if "first_name" in payload and "last_name" in payload:
            payload["full_name"] = f'{payload["first_name"]} {payload["last_name"]}'
        payload["updated_at"] = datetime.utcnow().isoformat()
        return self._db.update("users", payload, {"id": user_id})

    def change_password(self, user_id: int, current_pw: str, new_pw: str):
        rows = self._db.select("users", "password_hash", {"id": user_id})
        if not rows:
            return False, "Usuario no encontrado"

        valid, _needs_upgrade = verify_password(current_pw, rows[0].get("password_hash", ""))
        if not valid:
            return False, "La contrasena actual es incorrecta"

        strong, message = validate_password_strength(new_pw)
        if not strong:
            return False, message

        updated = self._db.update(
            "users",
            {
                "password_hash": hash_password(new_pw),
                "updated_at": datetime.utcnow().isoformat(),
            },
            {"id": user_id},
        )
        return (True, "Contrasena actualizada") if updated else (False, "Error al actualizar")
