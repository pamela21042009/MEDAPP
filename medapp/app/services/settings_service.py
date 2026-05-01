# app/services/settings_service.py
from __future__ import annotations
from typing import Dict, Optional
from datetime import datetime
import hashlib, os
from .database import DatabaseService


class SettingsService:
    def __init__(self):
        self._db = DatabaseService.get_instance()

    def get_all(self) -> Dict[str, str]:
        rows = self._db.select("system_settings", "*")
        return {r["key"]: r["value"] for r in rows}

    def get(self, key: str, default: str = "") -> str:
        rows = self._db.select("system_settings", "value", {"key": key})
        return rows[0]["value"] if rows else default

    def set(self, key: str, value: str, updated_by: int) -> Optional[Dict]:
        existing = self._db.select("system_settings", "id", {"key": key})
        payload  = {"value": value, "updated_by": updated_by,
                    "updated_at": datetime.utcnow().isoformat()}
        if existing:
            return self._db.update("system_settings", payload, {"key": key})
        payload["key"] = key
        return self._db.insert("system_settings", payload)

    def update_many(self, updates: Dict[str, str], updated_by: int) -> bool:
        try:
            for k, v in updates.items():
                self.set(k, v, updated_by)
            return True
        except Exception:
            return False

    # ── Perfil de usuario ─────────────────────────────────
    def get_profile(self, user_id: int) -> Optional[Dict]:
        rows = self._db.select("users", "*", {"id": user_id})
        if rows:
            rows[0].pop("password_hash", None)
        return rows[0] if rows else None

    def update_profile(self, user_id: int, data: Dict) -> Optional[Dict]:
        allowed = {"first_name", "last_name", "full_name", "phone", "avatar_url"}
        payload = {k: v for k, v in data.items() if k in allowed}
        if "first_name" in payload and "last_name" in payload:
            payload["full_name"] = f'{payload["first_name"]} {payload["last_name"]}'
        payload["updated_at"] = datetime.utcnow().isoformat()
        return self._db.update("users", payload, {"id": user_id})

    def change_password(self, user_id: int, current_pw: str, new_pw: str):
        salt = os.environ.get("PASSWORD_SALT", "")
        rows = self._db.select("users", "password_hash", {"id": user_id})
        if not rows:
            return False, "Usuario no encontrado"
        cur_hash = hashlib.sha256(f"{salt}{current_pw}".encode()).hexdigest()
        if rows[0]["password_hash"] != cur_hash:
            return False, "La contraseña actual es incorrecta"
        if len(new_pw) < 8:
            return False, "Mínimo 8 caracteres"
        new_hash = hashlib.sha256(f"{salt}{new_pw}".encode()).hexdigest()
        ok = self._db.update("users",
                             {"password_hash": new_hash,
                              "updated_at": datetime.utcnow().isoformat()},
                             {"id": user_id})
        return (True, "Contraseña actualizada") if ok else (False, "Error al actualizar")
