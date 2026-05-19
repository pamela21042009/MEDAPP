import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import AuthLayout from "../components/auth/AuthLayout";
import Icon from "../components/ui/Icon";
import { useAuth } from "../context/AuthContext";
import { getRegistrationSpecialties, registerUser } from "../lib/auth";
import { getLandingPath } from "../lib/routes";

const ROLE_OPTIONS = [
  { value: "paciente", label: "Paciente" },
];
const BLOOD_TYPES = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const FALLBACK_SPECIALTIES = [
  "Medicina General",
  "Cardiologia",
  "Dermatologia",
  "Ginecologia",
  "Neurologia",
  "Oftalmologia",
  "Ortopedia",
  "Pediatria",
  "Psiquiatria",
  "Radiologia",
];
const INITIAL_FORM = {
  role: "paciente",
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  birthdate: "",
  gender: "",
  blood_type: "",
  allergies: "",
  specialty: "",
  custom_specialty: "",
  license_number: "",
  professional_id: "",
  admin_code: "",
  authorization_code: "",
  department: "",
  position: "",
  password: "",
  confirm_password: "",
  accept_terms: false,
};

export default function RegisterPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading } = useAuth();
  const [form, setForm] = useState(INITIAL_FORM);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [specialties, setSpecialties] = useState(FALLBACK_SPECIALTIES);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      navigate(getLandingPath(user.role), { replace: true });
    }
  }, [loading, navigate, user]);

  useEffect(() => {
    let active = true;
    getRegistrationSpecialties()
      .then((payload) => {
        if (active && Array.isArray(payload?.items) && payload.items.length) {
          setSpecialties(payload.items);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const specialty = form.specialty === "__other__" ? form.custom_specialty.trim() : form.specialty;
      if (form.role === "medico" && !specialty) {
        setError("Selecciona o escribe una especialidad.");
        setSubmitting(false);
        return;
      }
      const result = await registerUser({ ...form, specialty });
      navigate("/auth/login", {
        replace: true,
        state: {
          notice: result?.message || "Cuenta creada exitosamente. Ya puedes iniciar sesion.",
          from: location.pathname,
        },
      });
    } catch (err) {
      setError(err.message || "No fue posible crear la cuenta.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout
      title="Crear cuenta"
      subtitle="Completa tus datos para crear tu cuenta de paciente."
      visualTitle={<>Tu salud,<br />tu acceso.</>}
      visualText="Agenda citas, consulta tus datos y mantente conectado con tu atencion medica."
      maxWidthClass="max-w-[1080px]"
      chips={[
        { label: "Pacientes", color: "#80ED99" },
        { label: "Citas", color: "#FFD166" },
        { label: "Seguimiento", color: "#F72585" },
      ]}
      footer={(
        <p className="text-center text-sm text-med-ink-muted">
          Ya tienes cuenta?{" "}
          <Link className="font-semibold text-med-violet transition hover:opacity-75" to="/auth/login">
            Iniciar sesion
          </Link>
        </p>
      )}
    >
      {error ? (
        <div className="mb-5 rounded-2xl border border-[rgba(247,37,133,0.22)] bg-[rgba(247,37,133,0.08)] px-4 py-3 text-sm text-[#c0185a]">
          {error}
        </div>
      ) : null}

      <div className="mb-6 flex flex-wrap gap-2">
        {ROLE_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            className={`rounded-2xl border px-4 py-2 text-sm font-semibold transition ${
              form.role === option.value
                ? "border-med-violet bg-[rgba(94,96,206,0.12)] text-med-violet"
                : "border-med-border bg-white text-med-ink-muted hover:border-med-violet hover:text-med-violet"
            }`}
            onClick={() => setForm((current) => ({ ...current, role: option.value }))}
          >
            {option.label}
          </button>
        ))}
      </div>

      <form className="space-y-5" onSubmit={handleSubmit}>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Nombre">
            <TextInput value={form.first_name} onChange={(value) => setForm((current) => ({ ...current, first_name: value }))} required />
          </Field>
          <Field label="Apellido">
            <TextInput value={form.last_name} onChange={(value) => setForm((current) => ({ ...current, last_name: value }))} required />
          </Field>
          <Field label="Correo electronico" className="md:col-span-2">
            <TextInput type="email" value={form.email} onChange={(value) => setForm((current) => ({ ...current, email: value }))} required />
          </Field>
          <Field label="Telefono">
            <TextInput value={form.phone} onChange={(value) => setForm((current) => ({ ...current, phone: value }))} />
          </Field>
          <Field label="Fecha de nacimiento">
            <TextInput type="date" value={form.birthdate} onChange={(value) => setForm((current) => ({ ...current, birthdate: value }))} />
          </Field>
        </div>

        {form.role === "paciente" ? (
          <section className="rounded-[22px] border border-med-border bg-med-bg/60 px-5 py-5">
            <div className="mb-4 text-sm font-semibold text-med-ink">Informacion del paciente</div>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Genero">
                <select className="med-input px-4 py-3" value={form.gender} onChange={(event) => setForm((current) => ({ ...current, gender: event.target.value }))}>
                  <option value="">Seleccionar...</option>
                  <option value="Masculino">Masculino</option>
                  <option value="Femenino">Femenino</option>
                  <option value="Otro">Otro</option>
                  <option value="No indica">Prefiero no indicar</option>
                </select>
              </Field>
              <Field label="Tipo de sangre">
                <select className="med-input px-4 py-3" value={form.blood_type} onChange={(event) => setForm((current) => ({ ...current, blood_type: event.target.value }))}>
                  <option value="">Seleccionar...</option>
                  {BLOOD_TYPES.map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </Field>
              <Field label="Alergias conocidas" className="md:col-span-2">
                <TextInput value={form.allergies} onChange={(value) => setForm((current) => ({ ...current, allergies: value }))} placeholder="Ej. Penicilina, latex..." />
              </Field>
            </div>
          </section>
        ) : null}

        {form.role === "medico" ? (
          <section className="rounded-[22px] border border-med-border bg-med-bg/60 px-5 py-5">
            <div className="mb-4 text-sm font-semibold text-med-ink">Perfil medico</div>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Especialidad">
                <select className="med-input px-4 py-3" value={form.specialty} onChange={(event) => setForm((current) => ({ ...current, specialty: event.target.value }))}>
                  <option value="">Seleccionar...</option>
                  {specialties.map((specialty) => (
                    <option key={specialty} value={specialty}>{specialty}</option>
                  ))}
                  <option value="__other__">Otra especialidad</option>
                </select>
              </Field>
              {form.specialty === "__other__" ? (
                <Field label="Nueva especialidad">
                  <TextInput
                    value={form.custom_specialty}
                    onChange={(value) => setForm((current) => ({ ...current, custom_specialty: value }))}
                    placeholder="Ej. Endocrinologia"
                    required
                  />
                </Field>
              ) : null}
              <Field label="No. de licencia">
                <TextInput value={form.license_number} onChange={(value) => setForm((current) => ({ ...current, license_number: value }))} />
              </Field>
              <Field label="Cedula profesional">
                <TextInput value={form.professional_id} onChange={(value) => setForm((current) => ({ ...current, professional_id: value }))} />
              </Field>
            </div>
          </section>
        ) : null}

        {form.role === "admin" ? (
          <section className="rounded-[22px] border border-med-border bg-med-bg/60 px-5 py-5">
            <div className="mb-4 text-sm font-semibold text-med-ink">Acceso administrativo</div>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Departamento">
                <TextInput value={form.department} onChange={(value) => setForm((current) => ({ ...current, department: value }))} />
              </Field>
              <Field label="Cargo">
                <TextInput value={form.position} onChange={(value) => setForm((current) => ({ ...current, position: value }))} />
              </Field>
            </div>
          </section>
        ) : null}

        {form.role !== "paciente" ? (
          <section className="rounded-[22px] border border-med-border bg-white px-5 py-5">
            <div className="mb-4 text-sm font-semibold text-med-ink">Autorizacion de registro</div>
            <Field label={`Codigo para ${getRoleLabel(form.role)}`}>
              <TextInput
                value={form.authorization_code}
                onChange={(value) => setForm((current) => ({
                  ...current,
                  authorization_code: value,
                  admin_code: value,
                }))}
                required
              />
            </Field>
          </section>
        ) : null}

        <section className="rounded-[22px] border border-med-border bg-white px-5 py-5">
          <div className="mb-4 text-sm font-semibold text-med-ink">Seguridad</div>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Contrasena">
              <PasswordInput
                value={form.password}
                onChange={(value) => setForm((current) => ({ ...current, password: value }))}
                show={showPassword}
                onToggle={() => setShowPassword((value) => !value)}
              />
            </Field>
            <Field label="Confirmar contrasena">
              <PasswordInput
                value={form.confirm_password}
                onChange={(value) => setForm((current) => ({ ...current, confirm_password: value }))}
                show={showConfirm}
                onToggle={() => setShowConfirm((value) => !value)}
              />
            </Field>
          </div>
          <label className="mt-5 inline-flex items-start gap-3 text-sm text-med-ink-muted">
            <input
              type="checkbox"
              checked={form.accept_terms}
              onChange={(event) => setForm((current) => ({ ...current, accept_terms: event.target.checked }))}
              className="mt-1 h-4 w-4 rounded border-med-border text-med-violet focus:ring-med-violet"
            />
            <span>Acepto los terminos de uso y la politica de privacidad.</span>
          </label>
        </section>

        <button
          type="submit"
          disabled={submitting}
          className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(105deg,#5E60CE_0%,#4EA8DE_100%)] px-5 py-3.5 font-display text-[0.95rem] font-semibold text-white shadow-auth-btn transition hover:-translate-y-0.5 hover:shadow-[0_14px_36px_rgba(94,96,206,0.46)] disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:translate-y-0"
        >
          <span>{submitting ? "Creando cuenta..." : "Crear cuenta"}</span>
          <Icon className="h-4 w-4">
            <path d="M5 12h14" />
            <path d="m13 6 6 6-6 6" />
          </Icon>
        </button>
      </form>
    </AuthLayout>
  );
}

function getRoleLabel(role) {
  const option = ROLE_OPTIONS.find((item) => item.value === role);
  return option?.label || "el rol seleccionado";
}

function Field({ label, children, className = "" }) {
  return (
    <div className={className}>
      <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.08em] text-med-ink-muted">{label}</label>
      {children}
    </div>
  );
}

function TextInput({ type = "text", value, onChange, placeholder = "", required = false }) {
  return (
    <input
      className="med-input px-4 py-3"
      type={type}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      required={required}
    />
  );
}

function PasswordInput({ value, onChange, show, onToggle }) {
  return (
    <div className="relative">
      <input
        className="med-input px-4 py-3 pr-12"
        type={show ? "text" : "password"}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Minimo 8 caracteres"
        required
      />
      <button
        type="button"
        onClick={onToggle}
        className="absolute right-4 top-1/2 -translate-y-1/2 text-med-ink-subtle transition hover:text-med-violet"
      >
        <Icon className="h-5 w-5">
          {show ? (
            <>
              <path d="M3 3l18 18" />
              <path d="M10.58 10.58a2 2 0 0 0 2.83 2.83" />
              <path d="M9.88 5.09A10.94 10.94 0 0 1 12 5c5 0 9.27 3.11 11 7-1 2.23-2.66 4.08-4.72 5.19" />
              <path d="M6.61 6.61C4.62 7.8 3 9.68 2 12c1.73 3.89 6 7 10 7a11.2 11.2 0 0 0 4.36-.88" />
            </>
          ) : (
            <>
              <path d="M2 12s3.64-7 10-7 10 7 10 7-3.64 7-10 7-10-7-10-7Z" />
              <circle cx="12" cy="12" r="3" />
            </>
          )}
        </Icon>
      </button>
    </div>
  );
}
