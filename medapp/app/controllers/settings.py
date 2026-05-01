from flask import render_template, request, flash, redirect, url_for
from app.services import AuthService


class SettingsController:
    def __init__(self) -> None:
        self._auth = AuthService()

    def index(self):
        user = self._auth.current_user()
        return render_template("settings/index.html", user=user, page="settings")
