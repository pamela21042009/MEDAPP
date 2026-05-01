from flask import render_template, request, redirect, url_for, flash, jsonify
from app.services import DoctorService


class DoctorsController:
    def __init__(self) -> None:
        self._service = DoctorService()

    def index(self):
        specialty = request.args.get("specialty", "")
        if specialty:
            doctors = self._service.get_by_specialty(specialty)
        else:
            doctors = self._service.get_all(active_only=False)
        specialties = self._service.get_specialties()
        return render_template(
            "doctors/index.html",
            doctors=doctors,
            specialties=specialties,
            selected_specialty=specialty,
            page="doctors"
        )

    def detail(self, doctor_id: int):
        doctor = self._service.get_by_id(doctor_id)
        if not doctor:
            flash("Médico no encontrado.", "error")
            return redirect(url_for("doctors.index"))
        return render_template("doctors/detail.html", doctor=doctor, page="doctors")

    def create(self):
        if request.method == "GET":
            return render_template("doctors/form.html", doctor=None, page="doctors")
        data = self._extract_form_data()
        result = self._service.create(data)
        if result:
            flash("Médico registrado correctamente.", "success")
            return redirect(url_for("doctors.index"))
        flash("Error al registrar el médico.", "error")
        return redirect(url_for("doctors.create"))

    def edit(self, doctor_id: int):
        doctor = self._service.get_by_id(doctor_id)
        if not doctor:
            flash("Médico no encontrado.", "error")
            return redirect(url_for("doctors.index"))
        if request.method == "GET":
            return render_template("doctors/form.html", doctor=doctor, page="doctors")
        data = self._extract_form_data()
        result = self._service.update(doctor_id, data)
        if result:
            flash("Médico actualizado.", "success")
            return redirect(url_for("doctors.index"))
        flash("Error al actualizar.", "error")
        return redirect(url_for("doctors.edit", doctor_id=doctor_id))

    def deactivate(self, doctor_id: int):
        self._service.deactivate(doctor_id)
        flash("Médico desactivado.", "info")
        return redirect(url_for("doctors.index"))

    def api_list(self):
        doctors = self._service.get_all()
        return jsonify(doctors)

    @staticmethod
    def _extract_form_data() -> dict:
        return {
            "full_name": request.form.get("full_name", "").strip(),
            "specialty": request.form.get("specialty", "").strip(),
            "email": request.form.get("email", "").strip(),
            "phone": request.form.get("phone", "").strip(),
            "license_number": request.form.get("license_number", "").strip(),
        }
