# app/controllers/prescriptions.py
from flask import render_template, request, redirect, url_for, flash, session, jsonify
from app.services.prescription_service import PrescriptionService
from app.services.doctor import DoctorService


class PrescriptionsController:
    def __init__(self):
        self._svc     = PrescriptionService()
        self._doc_svc = DoctorService()

    def _doctor_id(self):
        doc = self._doc_svc.get_by_email(session.get("user_email", ""))
        return doc["id"] if doc else None

    def _can_write(self):
        return session.get("user_role") in ("doctor", "admin", "staff")

    def index(self):
        role = session.get("user_role")
        if role == "paciente":
            from app.services.patient import PatientService
            pat = PatientService().get_by_email(session.get("user_email", ""))
            rxs = self._svc.get_by_patient(pat["id"]) if pat else []
        elif role == "doctor":
            doc_id = self._doctor_id()
            rxs    = self._svc.get_by_doctor(doc_id) if doc_id else []
        else:
            rxs = self._svc.get_all()
        return render_template("prescriptions/index.html", prescriptions=rxs, page="prescriptions")

    def create_form(self):
        if not self._can_write():
            flash("Acceso denegado.", "error")
            return redirect(url_for("dashboard.index"))
        meds = self._svc.get_all_medications()
        appt_id = request.args.get("appointment_id")
        return render_template("prescriptions/create.html",
                               medications=meds, appointment_id=appt_id, page="prescriptions")

    def create(self):
        if not self._can_write():
            flash("Acceso denegado.", "error")
            return redirect(url_for("dashboard.index"))

        doc_id     = self._doctor_id()
        patient_id = request.form.get("patient_id")
        if not doc_id or not patient_id:
            flash("Datos incompletos.", "error")
            return redirect(url_for("prescriptions.create_form"))

        med_ids   = request.form.getlist("medication_id[]")
        doses     = request.form.getlist("dose[]")
        freqs     = request.form.getlist("frequency[]")
        durations = request.form.getlist("duration_days[]")
        instrs    = request.form.getlist("instructions[]")

        items = [{
            "medication_id": int(med_ids[i]),
            "dose":          doses[i],
            "frequency":     freqs[i],
            "duration_days": int(durations[i]) if durations[i].isdigit() else None,
            "instructions":  instrs[i] if i < len(instrs) else "",
        } for i in range(len(med_ids))]

        rx = self._svc.create(doc_id, int(patient_id), {
            "appointment_id": request.form.get("appointment_id") or None,
            "notes":          request.form.get("notes", ""),
            "items":          items,
        })
        if rx:
            flash("Receta creada.", "success")
            return redirect(url_for("prescriptions.view", rx_id=rx["id"]))
        flash("Error al crear la receta.", "error")
        return redirect(url_for("prescriptions.create_form"))

    def view(self, rx_id: int):
        rx = self._svc.get_by_id(rx_id)
        if not rx:
            flash("Receta no encontrada.", "error")
            return redirect(url_for("prescriptions.index"))
        return render_template("prescriptions/view.html", rx=rx, page="prescriptions")

    def api_search_medications(self):
        q = request.args.get("q", "")
        return jsonify(self._svc.search_medications(q) if q else [])
