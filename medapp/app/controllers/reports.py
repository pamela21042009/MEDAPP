from flask import render_template, jsonify
from app.services import AppointmentService, DoctorService, PatientService, PaymentService


class ReportsController:
    def __init__(self) -> None:
        self._appointments = AppointmentService()
        self._doctors = DoctorService()
        self._patients = PatientService()
        self._payments = PaymentService()

    def index(self):
        appointment_stats = self._appointments.get_stats()
        revenue_stats = self._payments.get_revenue_stats()
        doctors_count = len(self._doctors.get_all())
        patients_count = len(self._patients.get_all())
        return render_template(
            "reports/index.html",
            appointment_stats=appointment_stats,
            revenue_stats=revenue_stats,
            doctors_count=doctors_count,
            patients_count=patients_count,
            page="reports"
        )
