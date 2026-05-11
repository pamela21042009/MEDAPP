from __future__ import annotations

import os
import smtplib
import ssl
from email.message import EmailMessage


class EmailService:
    def _smtp_config(self) -> dict:
        host = (os.environ.get("SMTP_HOST") or os.environ.get("MAIL_SERVER") or "").strip()
        username = (os.environ.get("SMTP_USERNAME") or os.environ.get("MAIL_USERNAME") or "").strip()
        password = (os.environ.get("SMTP_PASSWORD") or os.environ.get("MAIL_PASSWORD") or "").strip()
        if "gmail" in host.lower():
            password = password.replace(" ", "")
        sender_email = (
            os.environ.get("SMTP_FROM_EMAIL")
            or os.environ.get("SMTP_FROM")
            or os.environ.get("MAIL_DEFAULT_SENDER")
            or username
        ).strip()
        sender_name = (os.environ.get("SMTP_FROM_NAME") or "MedApp").strip()
        reply_to = (os.environ.get("SMTP_REPLY_TO") or sender_email).strip()
        port = int(os.environ.get("SMTP_PORT") or os.environ.get("MAIL_PORT") or 587)
        use_ssl = (os.environ.get("SMTP_USE_SSL") or "").strip().lower() == "true" or port == 465
        use_tls = (os.environ.get("SMTP_USE_TLS") or "true").strip().lower() != "false"
        sender = f"{sender_name} <{sender_email}>" if sender_name else sender_email
        return {
            "host": host,
            "username": username,
            "password": password,
            "sender": sender,
            "reply_to": reply_to,
            "port": port,
            "use_ssl": use_ssl,
            "use_tls": use_tls,
        }

    def send(self, to_email: str, subject: str, body: str) -> bool:
        config = self._smtp_config()
        host = config["host"]
        username = config["username"]
        password = config["password"]
        sender = config["sender"]
        port = config["port"]
        if not to_email or not host or not username or not password or not sender:
            return False

        message = EmailMessage()
        message["Subject"] = subject
        message["From"] = sender
        message["To"] = to_email
        if config["reply_to"]:
            message["Reply-To"] = config["reply_to"]
        message.set_content(body)

        context = ssl.create_default_context()
        if config["use_ssl"]:
            with smtplib.SMTP_SSL(host, port, context=context, timeout=20) as smtp:
                smtp.login(username, password)
                smtp.send_message(message)
        else:
            with smtplib.SMTP(host, port, timeout=20) as smtp:
                if config["use_tls"]:
                    smtp.starttls(context=context)
                smtp.login(username, password)
                smtp.send_message(message)
        return True
