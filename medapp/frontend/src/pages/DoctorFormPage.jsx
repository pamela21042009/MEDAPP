import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import AppShell from "../components/app/AppShell";
import Icon from "../components/ui/Icon";
import ProfileAvatar from "../components/ui/ProfileAvatar";
import { createDoctor, getDoctorDetail, getDoctorsBootstrap, updateDoctor } from "../lib/doctors";

const EMPTY_FORM = {
  full_name: "",
  specialty: "",
  license_number: "",
  email: "",
  phone: "",
  avatar_url: "",
  bio: "",
  clinic_address: "",
  clinic_name: "",
  consultation_fee: "",
  slot_duration: "30",
  attention_type: "presencial",
  is_active: true,
};

function buildFormState(doctor) {
  if (!doctor) {
    return EMPTY_FORM;
  }

  return {
    full_name: doctor.full_name || "",
    specialty: doctor.specialty || "",
    license_number: doctor.license_number || "",
    email: doctor.email || "",
    phone: doctor.phone || "",
    avatar_url: doctor.avatar_url || "",
    bio: doctor.bio || "",
    clinic_address: doctor.clinic_address || "",
    clinic_name: doctor.clinic_name || "",
    consultation_fee: doctor.consultation_fee ?? "",
    slot_duration: String(doctor.slot_duration || 30),
    attention_type: doctor.attention_type || "presencial",
    is_active: doctor.is_active !== false,
  };
}

export default function DoctorFormPage() {
  const navigate = useNavigate();
  const { doctorId } = useParams();
  const editing = Boolean(doctorId);

  const [bootstrap, setBootstrap] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [permissions, setPermissions] = useState({ can_edit: false });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadForm() {
      setLoading(true);
      setError("");

      try {
        const bootstrapData = await getDoctorsBootstrap();
        if (!active) {
          return;
        }

        setBootstrap(bootstrapData);

        if (!editing) {
          if (!bootstrapData?.can_manage) {
            setError("No tienes permiso para registrar medicos.");
          }
          setLoading(false);
          return;
        }

        const detailData = await getDoctorDetail(doctorId);
        if (!active) {
          return;
        }

        setPermissions(detailData?.permissions || { can_edit: false });
        setForm(buildFormState(detailData?.doctor || null));
      } catch (err) {
        if (active) {
          setError(err.message || "No fue posible cargar el formulario del medico.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadForm();

    return () => {
      active = false;
    };
  }, [doctorId, editing]);

  const canManage = Boolean(bootstrap?.can_manage);
  const submitLabel = useMemo(() => {
    if (saving) {
      return editing ? "Guardando..." : "Registrando...";
    }

    return editing ? "Guardar cambios" : "Registrar medico";
  }, [editing, saving]);

  const cancelPath = editing ? `/doctors/${doctorId}` : "/doctors";
  const blocked = !loading && ((editing && !permissions.can_edit) || (!editing && !canManage));

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSaving(true);

    try {
      const payload = {
        ...form,
        consultation_fee: form.consultation_fee === "" ? null : Number(form.consultation_fee),
        slot_duration: Number(form.slot_duration || 30),
      };

      let result;
      if (editing) {
        result = await updateDoctor(doctorId, payload);
      } else {
        result = await createDoctor(payload);
      }

      navigate(`/doctors/${result.id || doctorId}`, { replace: true });
    } catch (err) {
      setError(err.message || "No fue posible guardar el medico.");
      setSaving(false);
    }
  }

  return (
    <AppShell pageTitle={editing ? "Editar medico" : "Nuevo medico"} activePage="doctors">
      {loading ? (
        <div className="space-y-6">
          <div className="h-20 animate-pulse rounded-3xl bg-white" />
          <div className="h-[520px] animate-pulse rounded-3xl bg-white" />
        </div>
      ) : blocked ? (
        <section className="app-surface px-6 py-8">
          <div className="rounded-2xl border border-[rgba(247,37,133,0.22)] bg-[rgba(247,37,133,0.08)] px-4 py-3 text-sm text-[#c0185a]">
            {error || "No tienes permiso para acceder a este formulario."}
          </div>
          <div className="mt-5">
            <Link className="app-btn-ghost" to={cancelPath}>
              Volver
            </Link>
          </div>
        </section>
      ) : (
        <div className="mx-auto max-w-[920px]">
          <section className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h1 className="text-[1.45rem] font-bold tracking-[-0.02em] text-med-ink">
                {editing ? "Editar medico" : "Registrar medico"}
              </h1>
              <p className="mt-1 text-sm text-med-ink-muted">
                {editing
                  ? "Actualiza los datos del medico sin tocar la logica del backend."
                  : "Completa el formulario para registrar un nuevo medico en el sistema."}
              </p>
            </div>
            <Link className="app-btn-ghost" to={cancelPath}>
              <Icon className="h-4 w-4">
                <path d="M19 12H5" />
                <path d="m12 19-7-7 7-7" />
              </Icon>
              Volver
            </Link>
          </section>

          {error ? (
            <div className="mb-6 rounded-2xl border border-[rgba(247,37,133,0.22)] bg-[rgba(247,37,133,0.08)] px-4 py-3 text-sm text-[#c0185a]">
              {error}
            </div>
          ) : null}

          <form className="space-y-6" onSubmit={handleSubmit}>
            <SectionCard title="Datos personales">
              <div className="mb-5 flex items-center gap-4 rounded-[24px] bg-med-bg px-4 py-4">
                <ProfileAvatar
                  src={form.avatar_url}
                  name={form.full_name}
                  fallback="DR"
                  className="h-16 w-16 rounded-2xl"
                  textClassName="text-lg text-med-violet"
                  backgroundClassName="bg-[rgba(94,96,206,0.12)] text-med-violet"
                />
                <div className="text-sm text-med-ink-muted">
                  <div className="font-semibold text-med-ink">Foto del medico</div>
                  Usa una URL publica para mostrar la foto en el directorio y el perfil.
                </div>
              </div>
              <div className="grid gap-5 md:grid-cols-2">
                <Field label="Nombre completo *" className="md:col-span-2">
                  <input
                    className="med-input px-4 py-3"
                    type="text"
                    value={form.full_name}
                    onChange={(event) => setForm((current) => ({ ...current, full_name: event.target.value }))}
                    placeholder="Ej. Maria Gonzalez"
                    required
                  />
                </Field>

                <Field label="Especialidad *">
                  <input
                    className="med-input px-4 py-3"
                    type="text"
                    value={form.specialty}
                    onChange={(event) => setForm((current) => ({ ...current, specialty: event.target.value }))}
                    placeholder="Ej. Cardiologia"
                    required
                  />
                </Field>

                <Field label="Numero de licencia">
                  <input
                    className="med-input px-4 py-3"
                    type="text"
                    value={form.license_number}
                    onChange={(event) => setForm((current) => ({ ...current, license_number: event.target.value }))}
                    placeholder="Ej. MED-12345"
                  />
                </Field>

                <Field label="Correo electronico">
                  <input
                    className="med-input px-4 py-3"
                    type="email"
                    value={form.email}
                    onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                    placeholder="correo@clinica.com"
                  />
                </Field>

                <Field label="Telefono">
                  <input
                    className="med-input px-4 py-3"
                    type="tel"
                    value={form.phone}
                    onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
                    placeholder="+1 (809) 000-0000"
                  />
                </Field>

                <Field label="URL de foto de perfil" className="md:col-span-2">
                  <input
                    className="med-input px-4 py-3"
                    type="url"
                    value={form.avatar_url}
                    onChange={(event) => setForm((current) => ({ ...current, avatar_url: event.target.value }))}
                    placeholder="https://.../medico.jpg"
                  />
                </Field>

                <Field label="Biografia / descripcion" className="md:col-span-2">
                  <textarea
                    className="med-input min-h-[110px] resize-y px-4 py-3"
                    value={form.bio}
                    onChange={(event) => setForm((current) => ({ ...current, bio: event.target.value }))}
                    placeholder="Breve descripcion profesional del medico..."
                  />
                </Field>
              </div>
            </SectionCard>

            <SectionCard title="Tarifas y atencion">
              <div className="grid gap-5 md:grid-cols-2">
                <Field label="Tarifa de consulta (USD)">
                  <input
                    className="med-input px-4 py-3"
                    type="number"
                    value={form.consultation_fee}
                    onChange={(event) => setForm((current) => ({ ...current, consultation_fee: event.target.value }))}
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                  />
                </Field>

                <Field label="Duracion de cita (minutos)">
                  <select
                    className="med-input px-4 py-3"
                    value={form.slot_duration}
                    onChange={(event) => setForm((current) => ({ ...current, slot_duration: event.target.value }))}
                  >
                    {[15, 20, 30, 45, 60].map((minutes) => (
                      <option key={minutes} value={minutes}>
                        {minutes} minutos
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Tipo de atencion">
                  <select
                    className="med-input px-4 py-3"
                    value={form.attention_type}
                    onChange={(event) => setForm((current) => ({ ...current, attention_type: event.target.value }))}
                  >
                    <option value="presencial">Presencial</option>
                    <option value="virtual">Virtual</option>
                    <option value="ambos">Presencial y virtual</option>
                  </select>
                </Field>

                {canManage ? (
                  <Field label="Estado">
                    <select
                      className="med-input px-4 py-3"
                      value={form.is_active ? "1" : "0"}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, is_active: event.target.value === "1" }))
                      }
                    >
                      <option value="1">Activo</option>
                      <option value="0">Inactivo</option>
                    </select>
                  </Field>
                ) : null}
              </div>
            </SectionCard>

            <div className="flex flex-wrap items-center justify-end gap-3">
              <Link className="app-btn-ghost" to={cancelPath}>
                Cancelar
              </Link>
              <button className="app-btn-violet" type="submit" disabled={saving}>
                {submitLabel}
              </button>
            </div>
          </form>
        </div>
      )}
    </AppShell>
  );
}

function SectionCard({ title, children }) {
  return (
    <section className="app-surface overflow-hidden">
      <div className="border-b border-med-border px-6 py-5">
        <h2 className="text-[0.95rem] font-semibold text-med-ink">{title}</h2>
      </div>
      <div className="px-6 py-6">{children}</div>
    </section>
  );
}

function Field({ label, children, className = "" }) {
  return (
    <div className={className}>
      <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.08em] text-med-ink-muted">{label}</label>
      {children}
    </div>
  );
}
