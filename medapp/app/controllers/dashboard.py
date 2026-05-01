from flask import render_template
from app.services import AppointmentService, DoctorService, PatientService, PaymentService


class DashboardController:
    def __init__(self) -> None:
        self._appointments = AppointmentService()
        self._doctors = DoctorService()
        self._patients = PatientService()
        self._payments = PaymentService()

    def index(self):
        stats = {
            "appointments": self._appointments.get_stats(),
            "doctors": len(self._doctors.get_all()),
            "patients": len(self._patients.get_all()),
            "revenue": self._payments.get_revenue_stats(),
        }
        recent_appointments = self._appointments.get_all()[-5:]
        return render_template(
            "dashboard/index.html",
            stats=stats,
            recent_appointments=recent_appointments,
            page="dashboard"
        )
