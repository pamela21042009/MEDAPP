
import os
from flask import Flask, jsonify, redirect, request, send_from_directory, session, url_for

from app.config import get_config
from app.services.database import DatabaseService


def _is_api_path(path: str) -> bool:
    segments = [segment for segment in str(path or "/").split("/") if segment]
    return "api" in segments


def _get_frontend_dev_origin(app: Flask) -> str:
    origins = app.config.get("FRONTEND_DEV_ORIGINS", ())
    return origins[0].rstrip("/") if origins else ""


def _build_frontend_url(origin: str, path: str, query_string: bytes = b"") -> str:
    normalized_path = path if str(path).startswith("/") else f"/{path}"
    target = f"{origin}{normalized_path}"
    if query_string:
        target = f"{target}?{query_string.decode()}"
    return target


def create_app(env: str = None) -> Flask:
    env = env or os.environ.get("FLASK_ENV", "development")
    cfg = get_config(env)

    app = Flask(__name__, template_folder="../templates", static_folder="../static")
    app.secret_key = cfg.SECRET_KEY
    app.config.from_object(cfg)

    frontend_dist = os.path.abspath(os.path.join(app.root_path, "..", "frontend", "dist"))
    frontend_assets = os.path.join(frontend_dist, "assets")
    frontend_dev_origin = _get_frontend_dev_origin(app)

    db = DatabaseService.get_instance()
    db.connect()


    from app.routes import auth, dashboard, doctors, patients, agenda, reports, payments, settings
    from app.routes.prescriptions import bp as prescriptions_bp
    from app.routes.notifications import bp as notifications_bp
    from app.routes.schedule import bp as schedule_bp
    from app.routes.audit import bp as audit_bp
    from app.routes.catalogs import bp as catalogs_bp
    app.register_blueprint(audit_bp)
    app.register_blueprint(schedule_bp)
    app.register_blueprint(catalogs_bp)
    

    app.register_blueprint(auth.bp)
    app.register_blueprint(dashboard.bp)
    app.register_blueprint(doctors.bp)
    app.register_blueprint(patients.bp)
    app.register_blueprint(agenda.bp)
    app.register_blueprint(reports.bp)
    app.register_blueprint(payments.bp)
    app.register_blueprint(settings.bp)
    app.register_blueprint(prescriptions_bp)
    app.register_blueprint(notifications_bp)

    from app.services.reminder_service import start_reminder_worker
    start_reminder_worker(app)

    @app.route("/assets/<path:filename>")
    def frontend_asset(filename: str):
        if not os.path.isdir(frontend_assets) and frontend_dev_origin:
            return redirect(_build_frontend_url(frontend_dev_origin, f"/assets/{filename}", request.query_string))
        return send_from_directory(frontend_assets, filename)

    @app.route("/uploads/<path:filename>")
    def uploaded_file(filename: str):
        upload_root = os.path.abspath(os.path.join(app.root_path, "..", "uploads"))
        return send_from_directory(upload_root, filename)

    @app.route("/<path:filename>")
    def frontend_public_file(filename: str):
        candidate = os.path.join(frontend_dist, filename)
        if os.path.isfile(candidate):
            return send_from_directory(frontend_dist, filename)
        if frontend_dev_origin:
            return redirect(_build_frontend_url(frontend_dev_origin, f"/{filename}", request.query_string))
        return redirect(url_for("auth.login"))
    
    _apply_auth_guards(app)

    @app.context_processor
    def inject_user():
        return {
            "current_user": {
                "id":    session.get("user_id"),
                "name":  session.get("user_name", "Usuario"),
                "role":  session.get("user_role", "staff"),
                "email": session.get("user_email", ""),
            }
        }

    @app.after_request
    def apply_dev_cors(response):
        origin = request.headers.get("Origin", "")
        allowed_origins = set(app.config.get("FRONTEND_DEV_ORIGINS", ()))
        is_api_request = _is_api_path(request.path)

        if origin in allowed_origins and is_api_request:
            response.headers["Access-Control-Allow-Origin"] = origin
            response.headers["Access-Control-Allow-Credentials"] = "true"
            response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
            response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, PATCH, DELETE, OPTIONS"
            response.headers["Vary"] = "Origin"

        return response

    return app


def _apply_auth_guards(app: Flask) -> None:
    frontend_dist = os.path.abspath(os.path.join(app.root_path, "..", "frontend", "dist"))
    frontend_index = os.path.join(frontend_dist, "index.html")
    frontend_dev_origin = _get_frontend_dev_origin(app)

    frontend_exact_routes = {
        "/",
        "/auth",
        "/auth/login",
        "/auth/register",
        "/auth/forgot-password",
        "/auth/verify-code",
        "/auth/new-password",
        "/dashboard",
        "/agenda",
        "/reports",
        "/schedule",
        "/settings",
        "/notifications",
        "/audit",
        "/catalogs",
    }
    frontend_prefix_routes = [
        "/doctors",
        "/patients",
        "/prescriptions",
        "/payments",
    ]
    
    exempt_endpoints = {
        "auth.login",
        "auth.register",
        "auth.forgot_password",
        "auth.verify_code",
        "auth.new_password",
        "auth.index",
        "frontend_asset",
        "frontend_public_file",
        "uploaded_file",
        "static",
    }

    def is_frontend_route(path: str) -> bool:
        normalized = path.rstrip("/") or "/"
        if normalized in frontend_exact_routes:
            return True
        return any(
            normalized == prefix or normalized.startswith(f"{prefix}/")
            for prefix in frontend_prefix_routes
        )

    @app.before_request
    def serve_frontend_app():
        if request.method != "GET":
            return None
        if request.path.startswith("/assets/") or request.path.startswith("/static/"):
            return None
        if _is_api_path(request.path):
            return None
        accept = request.headers.get("Accept", "")
        if "text/html" not in accept and "*/*" not in accept:
            return None
        if is_frontend_route(request.path):
            if os.path.exists(frontend_index):
                return send_from_directory(frontend_dist, "index.html")
            if frontend_dev_origin:
                return redirect(_build_frontend_url(frontend_dev_origin, request.path, request.query_string))
            return (
                "Frontend React no disponible. Genera frontend/dist o inicia el frontend en desarrollo.",
                503,
            )
        return None

    @app.before_request
    def check_auth():
        from flask import request, redirect, url_for, session
        if request.method == "OPTIONS":
            return None
        if request.path == "/auth/api" or request.path.startswith("/auth/api/"):
            return None
        if request.endpoint in exempt_endpoints:
            return None
        if "user_id" not in session:
            if _is_api_path(request.path):
                return jsonify({"error": "Sesion requerida."}), 401
            return redirect(url_for("auth.login"))
        return None
