from flask import render_template, request, redirect, url_for, flash, jsonify
from app.services import AppointmentService, DoctorService, PatientService


class AgendaController:
    def __init__(self) -> None:
        self._appointments = AppointmentService()
        self._doctors = DoctorService()
        self._patients = PatientService()

    def index(self):
        doctors = self._doctors.get_all()
        specialties = self._doctors.get_specialties()
        return render_template(
            "agenda/index.html",
            doctors=doctors,
            specialties=specialties,
            page="agenda"
        )

    def api_events(self):
        start = request.args.get("start", "")
        end = request.args.get("end", "")
        doctor_id = request.args.get("doctor_id")
        status = request.args.get("status")

        if start and end:
            appointments = self._appointments.get_by_date_range(start[:10], end[:10])
        else:
            appointments = self._appointments.get_all()

        if doctor_id:
            appointments = [a for a in appointments if str(a.get("doctor_id")) == str(doctor_id)]
        if status:
            appointments = [a for a in appointments if a.get("status") == status]

        events = [self._appointments.to_calendar_event(a) for a in appointments]
        return jsonify(events)

    def api_create(self):
        data = request.get_json() or {}
        required = ["doctor_id", "patient_id", "appointment_date", "appointment_time"]
        if not all(data.get(f) for f in required):
            return jsonify({"error": "Campos requeridos incompletos."}), 400
        result = self._appointments.create(data)
        if result:
            return jsonify(result), 201
        return jsonify({"error": "Error al crear la cita."}), 500

    def api_update(self, appointment_id: int):
        data = request.get_json() or {}
        result = self._appointments.update(appointment_id, data)
        if result:
            return jsonify(result)
        return jsonify({"error": "Error al actualizar."}), 500

    def api_cancel(self, appointment_id: int):
        data = request.get_json() or {}
        result = self._appointments.cancel(appointment_id, data.get("reason", ""))
        if result:
            return jsonify(result)
        return jsonify({"error": "Error al cancelar."}), 500

    def api_reschedule(self, appointment_id: int):
        data = request.get_json() or {}
        result = self._appointments.reschedule(
            appointment_id,
            data.get("appointment_date", ""),
            data.get("appointment_time", "")
        )
        if result:
            return jsonify(result)
        return jsonify({"error": "Error al reprogramar."}), 500

    def api_doctors(self):
        doctors = self._doctors.get_all()
        return jsonify(doctors)

    def api_patients(self):
        q = request.args.get("q", "")
        patients = self._patients.search(q) if q else self._patients.get_all()
        return jsonify(patients)
