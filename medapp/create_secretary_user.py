import argparse
import os
import sys

from dotenv import load_dotenv


PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))


def load_environment() -> None:
    for env_path in (
        os.path.join(PROJECT_ROOT, ".env"),
        os.path.abspath(os.path.join(PROJECT_ROOT, "..", ".env")),
    ):
        if os.path.exists(env_path):
            load_dotenv(env_path, override=False)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Crea o actualiza la cuenta interna de secretaria.")
    parser.add_argument("--email", required=True, help="Correo de inicio de sesion de la secretaria.")
    parser.add_argument("--password", required=True, help="Contrasena inicial de la secretaria.")
    parser.add_argument("--name", default="Secretaria", help="Nombre mostrado en el sistema.")
    return parser.parse_args()


def main() -> int:
    load_environment()

    from app.services.auth_service import AuthService
    from app.services.database import DatabaseService

    args = parse_args()
    email = args.email.strip().lower()
    password = args.password
    name = args.name.strip() or "Secretaria"

    if len(password) < 8:
        print("La contrasena debe tener al menos 8 caracteres.", file=sys.stderr)
        return 1

    db = DatabaseService.get_instance()
    db.connect()
    if db.get_last_error():
        print(f"No fue posible conectar con Supabase: {db.get_last_error()}", file=sys.stderr)
        return 1

    auth = AuthService()
    password_hash = auth._hash_password(password)  # noqa: SLF001 - usar el hash vigente del sistema.
    existing = db.select("users", "id,email", {"email": email})
    data = {
        "full_name": name,
        "email": email,
        "password_hash": password_hash,
        "role": "secretaria",
        "is_active": True,
    }

    if existing:
        updated = db.update("users", data, {"email": email})
        if not updated:
            print("No fue posible actualizar la cuenta de secretaria.", file=sys.stderr)
            return 1
        print(f"Cuenta de secretaria actualizada: {email}")
        return 0

    created = db.insert("users", data)
    if not created:
        print("No fue posible crear la cuenta de secretaria.", file=sys.stderr)
        if db.get_last_error():
            print(db.get_last_error(), file=sys.stderr)
        return 1

    print(f"Cuenta de secretaria creada: {email}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
