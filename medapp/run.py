import os
import sys


PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))
EXPECTED_ENV_DIRS = (
    os.path.join(PROJECT_ROOT, "venv"),
    os.path.join(PROJECT_ROOT, ".venv"),
)


def _using_project_environment() -> bool:
    executable = os.path.abspath(sys.executable).lower()
    return any(executable.startswith(env_dir.lower()) for env_dir in EXPECTED_ENV_DIRS)


def _print_environment_help() -> None:
    print("Este proyecto debe ejecutarse con el entorno virtual local.")
    print(f"Python actual: {sys.executable}")
    print("")
    print("Usa uno de estos comandos desde la carpeta del proyecto:")
    print(r"  .\.venv\Scripts\python.exe run.py")
    print(r"  .\venv\Scripts\python.exe run.py")


if not _using_project_environment():
    _print_environment_help()
    raise SystemExit(1)

from app import create_app

app = create_app()

if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)
