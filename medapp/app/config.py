import os
from dataclasses import dataclass

from dotenv import load_dotenv


PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
WORKSPACE_ROOT = os.path.abspath(os.path.join(PROJECT_ROOT, ".."))

for env_path in (
    os.path.join(PROJECT_ROOT, ".env"),
    os.path.join(WORKSPACE_ROOT, ".env"),
):
    if os.path.exists(env_path):
        load_dotenv(env_path, override=False)


def _csv(value: str, default: str = "") -> tuple[str, ...]:
    raw = value or default
    return tuple(item.strip().rstrip("/") for item in raw.split(",") if item.strip())


@dataclass
class AppConfig:
    SECRET_KEY: str = os.environ.get("SECRET_KEY", "dev-secret-key-change-in-production")
    SUPABASE_URL: str = os.environ.get("SUPABASE_URL", "")
    SUPABASE_KEY: str = os.environ.get("SUPABASE_KEY", "")
    DEBUG: bool = os.environ.get("FLASK_DEBUG", "false").lower() == "true"
    SESSION_COOKIE_SECURE: bool = not DEBUG
    SESSION_COOKIE_HTTPONLY: bool = True
    PERMANENT_SESSION_LIFETIME: int = 3600
    FRONTEND_DEV_ORIGINS: tuple[str, ...] = _csv(
        os.environ.get("FRONTEND_DEV_ORIGINS", ""),
        "http://localhost:5173,http://127.0.0.1:5173",
    )
    ADMIN_REGISTER_CODE: str = os.environ.get("ADMIN_REGISTER_CODE", "ADMIN2025")
    DOCTOR_REGISTER_CODE: str = os.environ.get("DOCTOR_REGISTER_CODE", "MEDICO2025")


class DevelopmentConfig(AppConfig):
    DEBUG = True


class ProductionConfig(AppConfig):
    DEBUG = False


config_map = {
    "development": DevelopmentConfig,
    "production": ProductionConfig,
    "default": DevelopmentConfig,
}


def get_config(env: str = "default") -> AppConfig:
    return config_map.get(env, config_map["default"])()
