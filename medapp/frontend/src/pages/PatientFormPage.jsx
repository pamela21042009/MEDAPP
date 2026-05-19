import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import AppShell from "../components/app/AppShell";
import Icon from "../components/ui/Icon";
import ProfileAvatar from "../components/ui/ProfileAvatar";
import { createPatient, getPatientDetail, getPatientsBootstrap, updatePatient, uploadPatientAvatar } from "../lib/patients";

const EMPTY_FORM = {
  full_name: "",
  email: "",
  phone: "",
  avatar_url: "",
  birth_date: "",
  gender: "",
  address: "",
  blood_type: "",
  allergies: "",
  insurance_number: "",
};

function buildFormState(patient) {
  if (!patient) {
    return EMPTY_FORM;
  }

  return {
    full_name: patient.full_name || "",
    email: patient.email || "",
    phone: patient.phone || "",
    avatar_url: patient.avatar_url || "",
    birth_date: patient.birth_date || "",
    gender: patient.gender || "",
    address: patient.address || "",
    blood_type: patient.blood_type || "",
    allergies: patient.allergies || "",
    insurance_number: patient.insurance_number || "",
  };
}

export default function PatientFormPage() {
  const navigate = useNavigate();
  const { patientId } = useParams();
  const editing = Boolean(patientId);

  const [bootstrap, setBootstrap] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [permissions, setPermissions] = useState({ can_edit: false });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [pendingAvatarFile, setPendingAvatarFile] = useState(null);
  const [avatarNotice, setAvatarNotice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadForm() {
      setLoading(true);
      setError("");

      try {
        const bootstrapData = await getPatientsBootstrap();
        if (!active) {
          return;
        }

        setBootstrap(bootstrapData);

        if (!editing) {
          if (!bootstrapData?.can_create) {
            setError("No tienes permiso para registrar pacientes.");
          }
          setLoading(false);
          return;
        }

        const detailData = await getPatientDetail(patientId);
        if (!active) {
          return;
        }

        setPermissions(detailData?.permissions || { can_edit: false });
        setForm(buildFormState(detailData?.patient || null));
      } catch (err) {
        if (active) {
          setError(err.message || "No fue posible cargar el formulario del paciente.");
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
  }, [editing, patientId]);

  const canCreate = Boolean(bootstrap?.can_create);
  const submitLabel = useMemo(() => {
    if (saving) {
      return editing ? "Guardando..." : "Registrando...";
    }

    return editing ? "Guardar cambios" : "Registrar paciente";
  }, [editing, saving]);

  const cancelPath = editing ? `/patients/${patientId}` : "/patients";
  const blocked = !loading && ((editing && !permissions.can_edit) || (!editing && !canCreate));

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSaving(true);

    try {
      let result;
      if (editing) {
        result = await updatePatient(patientId, form);
      } else {
        result = await createPatient({
          ...form,
          avatar_url: pendingAvatarFile ? "" : form.avatar_url,
        });
      }

      if (!editing && pendingAvatarFile && result?.id) {
        result = await uploadPatientAvatar(result.id, pendingAvatarFile).then((payload) => payload?.patient || result);
      }

      navigate(`/patients/${result.id || patientId}`, { replace: true });
    } catch (err) {
      setError(err.message || "No fue posible guardar el paciente.");
      setSaving(false);
    }
  }

  async function handleAvatarFile(event) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    if (!file.type.startsWith("image/")) {
      setError("Selecciona una imagen PNG, JPG, JPEG o WEBP.");
      event.target.value = "";
      return;
    }

    setError("");
    setAvatarNotice("");
    if (!editing) {
      setPendingAvatarFile(file);
      setForm((current) => ({ ...current, avatar_url: URL.createObjectURL(file) }));
      setAvatarNotice("Imagen seleccionada. Se subira cuando guardes el paciente.");
      return;
    }

    setUploadingAvatar(true);
    try {
      const result = await uploadPatientAvatar(patientId, file);
      setForm((current) => ({ ...current, avatar_url: result.avatar_url || "" }));
      setAvatarNotice("Foto actualizada correctamente.");
    } catch (err) {
      setError(err.message || "No fue posible subir la imagen.");
    } finally {
      setUploadingAvatar(false);
      event.target.value = "";
    }
  }

  return (
    <AppShell pageTitle={editing ? "Editar paciente" : "Nuevo paciente"} activePage="patients">
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
                {editing ? "Editar paciente" : "Registrar paciente"}
              </h1>
              <p className="mt-1 text-sm text-med-ink-muted">
                {editing
                  ? "Actualiza el expediente del paciente sin tocar la logica del backend."
                  : "Completa el formulario para registrar un nuevo paciente en el sistema."}
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
                  fallback="PA"
                  className="h-16 w-16 rounded-2xl"
                  textClassName="text-lg text-med-rose"
                  backgroundClassName="bg-[rgba(247,37,133,0.12)] text-med-rose"
                />
                <div className="text-sm text-med-ink-muted">
                  <div className="font-semibold text-med-ink">Foto del paciente</div>
                  Selecciona una imagen desde tu equipo para mostrarla en el expediente y el listado.
                  <div className="mt-3">
                    <input
                      className="block w-full text-sm text-med-ink-muted file:mr-3 file:rounded-lg file:border-0 file:bg-med-violet file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white"
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={handleAvatarFile}
                      disabled={uploadingAvatar}
                    />
                    {uploadingAvatar ? <div className="mt-2 text-xs text-med-violet">Subiendo imagen...</div> : null}
                    {avatarNotice ? <div className="mt-2 text-xs text-[#1f7a3a]">{avatarNotice}</div> : null}
                  </div>
                </div>
              </div>
              <div className="grid gap-5 md:grid-cols-2">
                <Field label="Nombre completo *" className="md:col-span-2">
                  <input
                    className="med-input px-4 py-3"
                    type="text"
                    value={form.full_name}
                    onChange={(event) => setForm((current) => ({ ...current, full_name: event.target.value }))}
                    required
                  />
                </Field>

                <Field label="Correo electronico">
                  <input
                    className="med-input px-4 py-3"
                    type="email"
                    value={form.email}
                    onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                  />
                </Field>

                <Field label="Telefono">
                  <input
                    className="med-input px-4 py-3"
                    type="tel"
                    value={form.phone}
                    onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
                  />
                </Field>

                <Field label="Fecha de nacimiento">
                  <input
                    className="med-input px-4 py-3"
                    type="date"
                    value={form.birth_date}
                    onChange={(event) => setForm((current) => ({ ...current, birth_date: event.target.value }))}
                  />
                </Field>

                <Field label="Genero">
                  <select
                    className="med-input px-4 py-3"
                    value={form.gender}
                    onChange={(event) => setForm((current) => ({ ...current, gender: event.target.value }))}
                  >
                    <option value="">Seleccionar...</option>
                    <option value="Masculino">Masculino</option>
                    <option value="Femenino">Femenino</option>
                    <option value="Otro">Otro</option>
                  </select>
                </Field>

                <Field label="Direccion" className="md:col-span-2">
                  <input
                    className="med-input px-4 py-3"
                    type="text"
                    value={form.address}
                    onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))}
                  />
                </Field>
              </div>
            </SectionCard>

            <SectionCard title="Informacion medica">
              <div className="grid gap-5 md:grid-cols-2">
                <Field label="Tipo de sangre">
                  <select
                    className="med-input px-4 py-3"
                    value={form.blood_type}
                    onChange={(event) => setForm((current) => ({ ...current, blood_type: event.target.value }))}
                  >
                    <option value="">Desconocido</option>
                    {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((bloodType) => (
                      <option key={bloodType} value={bloodType}>
                        {bloodType}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Numero de seguro">
                  <input
                    className="med-input px-4 py-3"
                    type="text"
                    value={form.insurance_number}
                    onChange={(event) => setForm((current) => ({ ...current, insurance_number: event.target.value }))}
                  />
                </Field>

                <Field label="Alergias conocidas" className="md:col-span-2">
                  <input
                    className="med-input px-4 py-3"
                    type="text"
                    value={form.allergies}
                    onChange={(event) => setForm((current) => ({ ...current, allergies: event.target.value }))}
                    placeholder="Penicilina, latex, etc. (dejar en blanco si ninguna)"
                  />
                </Field>
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
