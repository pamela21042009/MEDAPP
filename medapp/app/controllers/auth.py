from flask import redirect, render_template, request, url_for, flash
from app.services import AuthService


class AuthController:
    def __init__(self) -> None:
        self._auth = AuthService()

    def login_page(self):
        if self._auth.is_authenticated():
            return redirect(url_for("dashboard.index"))
        return render_template("auth/login.html")

    def login_action(self):
        email = request.form.get("email", "").strip()
        password = request.form.get("password", "")
        if not email or not password:
            flash("Credenciales requeridas.", "error")
            return redirect(url_for("auth.login"))
        user = self._auth.login(email, password)
        if not user:
            flash("Credenciales incorrectas.", "error")
            return redirect(url_for("auth.login"))
        return redirect(url_for("dashboard.index"))

    def logout_action(self):
        self._auth.logout()
        return redirect(url_for("auth.login"))
