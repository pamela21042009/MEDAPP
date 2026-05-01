from flask import render_template, request, redirect, url_for, flash, jsonify, session
from app.services import PaymentService


class PaymentsController:
    def __init__(self) -> None:
        self._service = PaymentService()

    def index(self):
        role = session.get("user_role", "staff")
        if role == "paciente":
            from app.services import PatientService
            svc     = PatientService()
            patient = svc.get_by_email(session.get("user_email", ""))
            payments = self._service.get_by_patient(patient["id"]) if patient else []
        else:
            payments = self._service.get_all()
        stats = self._service.get_revenue_stats()
        return render_template(
            "payments/index.html",
            payments=payments,
            stats=stats,
            methods=PaymentService.METHODS,
            role=role,
            page="payments"
        )

    def create(self):
        data = {
            "appointment_id": request.form.get("appointment_id") or None,
            "patient_id":     request.form.get("patient_id"),
            "amount":         request.form.get("amount"),
            "method":         request.form.get("method", "Efectivo"),
            "currency":       request.form.get("currency", "USD"),
            "reference":      request.form.get("reference", ""),
            "status":         "pending",
        }
        if not data["patient_id"] or not data["amount"]:
            flash("Paciente y monto son obligatorios.", "error")
            return redirect(url_for("payments.index"))
        result = self._service.create(data)
        if result:
            flash("Pago registrado correctamente.", "success")
        else:
            flash("Error al registrar el pago.", "error")
        return redirect(url_for("payments.index"))

    def mark_paid(self, payment_id: int):
        method = request.form.get("method", "Efectivo")
        result = self._service.mark_paid(payment_id, method)
        if result:
            flash("Pago confirmado correctamente.", "success")
        else:
            flash("Error al confirmar el pago.", "error")
        return redirect(url_for("payments.index"))

    def mark_refunded(self, payment_id: int):
        result = self._service.mark_refunded(payment_id)
        if result:
            flash("Reembolso registrado.", "info")
        else:
            flash("Error al registrar reembolso.", "error")
        return redirect(url_for("payments.index"))

    def receipt(self, payment_id: int):
        receipt = self._service.build_receipt(payment_id)
        if not receipt:
            flash("Recibo no encontrado.", "error")
            return redirect(url_for("payments.index"))
        return render_template("payments/receipt.html", receipt=receipt, page="payments")

    def online_payment(self, payment_id: int):
        payment = self._service.get_by_id(payment_id)
        if not payment:
            flash("Pago no encontrado.", "error")
            return redirect(url_for("payments.index"))
        if payment.get("status") == "paid":
            flash("Este pago ya fue procesado.", "info")
            return redirect(url_for("payments.index"))
        return render_template(
            "payments/online.html",
            payment=payment,
            payment_id=payment_id,
            page="payments"
        )

    def process_online_payment(self, payment_id: int):
        card_number = request.form.get("card_number", "")
        if not card_number or len(card_number.replace(" ", "")) < 16:
            flash("Datos de tarjeta inválidos.", "error")
            return redirect(url_for("payments.online_payment", payment_id=payment_id))
        method = request.form.get("payment_method", "Tarjeta de crédito")
        result = self._service.mark_paid(payment_id, method)
        if result:
            flash("Pago procesado exitosamente.", "success")
            return redirect(url_for("payments.receipt", payment_id=payment_id))
        flash("Error al procesar el pago. Intenta de nuevo.", "error")
        return redirect(url_for("payments.online_payment", payment_id=payment_id))

    def api_stats(self):
        return jsonify(self._service.get_revenue_stats())
