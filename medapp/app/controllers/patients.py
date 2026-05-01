from flask import render_template, request, redirect, url_for, flash, jsonify
from app.services import PatientService


class PatientsController:
    def __init__(self) -> None:
        self._service = PatientService()

    def index(self):
        search = request.args.get("q", "").strip()
        if search:
            patients = self._service.search(search)
        else:
            patients = self._service.get_all()
        return render_template(
            "patients/index.html",
            patients=patients,
            search=search,
            page="patients"
        )

    def detail(self, patient_id: int):
        patient = self._service.get_by_id(patient_id)
        if not patient:
            flash("Paciente no encontrado.", "error")
            return redirect(url_for("patients.index"))
        history = self._service.get_history(patient_id)
        return render_template(
            "patients/detail.html",
            patient=patient,
            history=history,
            page="patients"
        )

    def create(self):
        if request.method == "GET":
            return render_template("patients/form.html", patient=None, page="patients")
        data = self._extract_form_data()
        result = self._service.create(data)
        if result:
            flash("Paciente registrado correctamente.", "success")
            return redirect(url_for("patients.index"))
        flash("Error al registrar el paciente.", "error")
        return redirect(url_for("patients.create"))

    def edit(self, patient_id: int):
        patient = self._service.get_by_id(patient_id)
        if not patient:
            flash("Paciente no encontrado.", "error")
            return redirect(url_for("patients.index"))
        if request.method == "GET":
            return render_template("patients/form.html", patient=patient, page="patients")
        data = self._extract_form_data()
        result = self._service.update(patient_id, data)
        if result:
            flash("Paciente actualizado.", "success")
            return redirect(url_for("patients.index"))
        flash("Error al actualizar.", "error")
        return redirect(url_for("patients.edit", patient_id=patient_id))

    def api_search(self):
        q = request.args.get("q", "")
        patients = self._service.search(q)
        return jsonify(patients)

    @staticmethod
    def _extract_form_data() -> dict:
        return {
            "full_name": request.form.get("full_name", "").strip(),
            "email": request.form.get("email", "").strip(),
            "phone": request.form.get("phone", "").strip(),
            "birth_date": request.form.get("birth_date", ""),
            "gender": request.form.get("gender", ""),
            "address": request.form.get("address", "").strip(),
            "blood_type": request.form.get("blood_type", ""),
            "allergies": request.form.get("allergies", "").strip(),
            "insurance_number": request.form.get("insurance_number", "").strip(),
        }
