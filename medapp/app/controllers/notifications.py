# app/controllers/notifications.py
from flask import render_template, session, jsonify, redirect, url_for
from app.services.notification_service import NotificationService


class NotificationsController:
    def __init__(self):
        self._svc = NotificationService()

    def index(self):
        user_id = session.get("user_id")
        notifs  = self._svc.get_for_user(user_id)
        self._svc.mark_all_read(user_id)
        return render_template("notifications/index.html",
                               notifications=notifs, page="notifications")

    def api_unread(self):
        user_id = session.get("user_id")
        count   = self._svc.count_unread(user_id)
        notifs  = self._svc.get_for_user(user_id, unread_only=True)
        return jsonify({"count": count, "items": notifs})

    def mark_read(self, notif_id: int):
        self._svc.mark_read(notif_id)
        return jsonify({"ok": True})
