import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import AppShell from "../components/app/AppShell";
import Icon from "../components/ui/Icon";
import ProfileAvatar from "../components/ui/ProfileAvatar";
import { deactivateDoctor, getDoctorDetail, getDoctorsBootstrap } from "../lib/doctors";

function getInitials(name = "") {
  return (
    name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || "")
      .join("") || "DR"
  );
}

function doctorStatusClasses(isActive) {
  return isActive
    ? "bg-[rgba(128,237,153,0.18)] text-[#1f7a3a]"
    : "bg-[rgba(173,181,189,0.16)] text-med-ink-muted";
}

export default function DoctorDetailPage() {
  const { doctorId } = useParams();
  const [bootstrap, setBootstrap] = useState(null);
  const [doctor, setDoctor] = useState(null);
  const [permissions, setPermissions] = useState({ can_edit: false, can_deactivate: false });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [working, setWorking] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadDoctor() {
      setLoading(true);
      setError("");

      try {
        const [bootstrapData, detailData] = await Promise.all([
          getDoctorsBootstrap(),
          getDoctorDetail(doctorId),
        ]);

        if (!active) {
          return;
        }

        setBootstrap(bootstrapData);
        setDoctor(detailData?.doctor || null);
        setPermissions(detailData?.permissions || { can_edit: false, can_deactivate: false });
      } catch (err) {
        if (active) {
          setError(err.message || "No fue posible cargar el perfil del medico.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadDoctor();

    return () => {
      active = false;
    };
  }, [doctorId]);

  async function handleDeactivate() {
    if (!doctor) {
      return;
    }

    const confirmed = window.confirm(`Deseas desactivar a Dr. ${doctor.full_name}?`);
    if (!confirmed) {
      return;
    }

    setWorking(true);
    setNotice("");

    try {
      const result = await deactivateDoctor(doctor.id);
      setDoctor(result);
      setNotice("Medico desactivado correctamente.");
    } catch (err) {
      setError(err.message || "No fue posible desactivar el medico.");
    } finally {
      setWorking(false);
    }
  }

  return (
    <AppShell pageTitle="Perfil medico" activePage="doctors">
      {loading ? (
        <div className="space-y-6">
          <div className="h-20 animate-pulse rounded-3xl bg-white" />
          <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
            <div className="h-[360px] animate-pulse rounded-3xl bg-white" />
            <div className="space-y-6">
              <div className="h-[220px] animate-pulse rounded-3xl bg-white" />
              <div className="h-[140px] animate-pulse rounded-3xl bg-white" />
            </div>
          </div>
        </div>
      ) : error ? (
        <section className="app-surface px-6 py-8">
          <div className="rounded-2xl border border-[rgba(247,37,133,0.22)] bg-[rgba(247,37,133,0.08)] px-4 py-3 text-sm text-[#c0185a]">
            {error}
          </div>
          <div className="mt-5">
            <Link className="app-btn-ghost" to="/doctors">
              Volver
            </Link>
          </div>
        </section>
      ) : doctor ? (
        <>
          <section className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h1 className="text-[1.45rem] font-bold tracking-[-0.02em] text-med-ink">Dr. {doctor.full_name}</h1>
              <p className="mt-1 text-sm text-med-ink-muted">{doctor.specialty || "Sin especialidad"}</p>
            </div>
            <div className="flex flex-wrap gap-3">
              {permissions.can_edit ? (
                <Link className="app-btn-outline" to={`/doctors/${doctor.id}/edit`}>
                  Editar
                </Link>
              ) : null}
              <Link className="app-btn-ghost" to="/doctors">
                Volver
              </Link>
            </div>
          </section>

          {notice ? (
            <div className="mb-6 rounded-2xl border border-[rgba(128,237,153,0.35)] bg-white px-4 py-3 text-sm text-[#1f7a3a] shadow-sm">
              {notice}
            </div>
          ) : null}

          <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
            <section className="app-surface overflow-hidden">
              <div className="px-6 py-7 text-center">
                <ProfileAvatar
                  src={doctor.avatar_url}
                  name={doctor.full_name}
                  fallback="DR"
                  className="mx-auto h-[84px] w-[84px] rounded-[24px]"
                  textClassName="text-[1.5rem] text-med-violet"
                  backgroundClassName="bg-[rgba(94,96,206,0.12)] text-med-violet"
                />
                <div className="mt-4 text-[1.15rem] font-bold tracking-[-0.02em] text-med-ink">
                  Dr. {doctor.full_name}
                </div>
                <div className="mt-2 inline-flex rounded-full bg-[rgba(94,96,206,0.08)] px-3 py-1 text-xs font-semibold text-med-violet">
                  {doctor.specialty || "Sin especialidad"}
                </div>
                <div className="mt-4">
                  <span className={`rounded-full px-3 py-1 text-[11px] font-semibold ${doctorStatusClasses(doctor.is_active)}`}>
                    {doctor.is_active ? "Activo" : "Inactivo"}
                  </span>
                </div>
              </div>

              <div className="border-t border-med-border px-6 py-6">
                <div className="space-y-4 text-sm text-med-ink-muted">
                  {doctor.email ? <MetaRow icon={<MailIcon />} value={doctor.email} /> : null}
                  {doctor.phone ? <MetaRow icon={<PhoneIcon />} value={doctor.phone} /> : null}
                  {doctor.license_number ? <MetaRow icon={<LicenseIcon />} value={`Lic. ${doctor.license_number}`} /> : null}
                </div>
              </div>

              {permissions.can_deactivate && doctor.is_active ? (
                <div className="border-t border-med-border px-6 py-5">
                  <button
                    type="button"
                    disabled={working}
                    className="app-btn w-full justify-center border-[rgba(247,37,133,0.2)] bg-[rgba(247,37,133,0.08)] text-[#c0105e] hover:bg-[rgba(247,37,133,0.14)] disabled:opacity-70"
                    onClick={handleDeactivate}
                  >
                    {working ? "Desactivando..." : "Desactivar medico"}
                  </button>
                </div>
              ) : null}
            </section>

            <div className="space-y-6">
              <InfoCard title="Informacion profesional">
                <InfoGrid
                  items={[
                    { label: "Especialidad", value: doctor.specialty || "--" },
                    { label: "Tipo de atencion", value: humanizeAttentionType(doctor.attention_type) },
                    { label: "Duracion por cita", value: doctor.slot_duration ? `${doctor.slot_duration} min` : "--" },
                    { label: "Tarifa", value: formatCurrency(doctor.consultation_fee) },
                  ]}
                />
                <LongField
                  className="mt-5"
                  label="Biografia"
                  value={doctor.bio || "Sin descripcion profesional todavia."}
                />
              </InfoCard>

              <InfoCard title="Consultorio y contacto">
                <InfoGrid
                  items={[
                    { label: "Consultorio", value: doctor.clinic_name || "--" },
                    { label: "Correo", value: doctor.email || "--" },
                    { label: "Telefono", value: doctor.phone || "--" },
                    { label: "Foto", value: doctor.avatar_url ? "Registrada" : "Sin foto" },
                    { label: "Perfil actual", value: bootstrap?.current_doctor_id === doctor.id ? "Tu perfil" : "Directorio" },
                  ]}
                />
                <LongField
                  className="mt-5"
                  label="Direccion"
                  value={doctor.clinic_address || "Sin direccion registrada."}
                />
              </InfoCard>

              <InfoCard title="Informacion adicional">
                <p className="text-sm leading-6 text-med-ink-muted">
                  Aqui se mostrara el historial de citas y las estadisticas del medico cuando terminemos de migrar los
                  modulos clinicos restantes a React.
                </p>
              </InfoCard>
            </div>
          </div>
        </>
      ) : null}
    </AppShell>
  );
}

function InfoCard({ title, children }) {
  return (
    <section className="app-surface overflow-hidden">
      <div className="border-b border-med-border px-6 py-5">
        <h2 className="text-[0.95rem] font-semibold text-med-ink">{title}</h2>
      </div>
      <div className="px-6 py-6">{children}</div>
    </section>
  );
}

function InfoGrid({ items }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {items.map((item) => (
        <div key={item.label}>
          <div className="mb-1 text-xs font-semibold uppercase tracking-[0.08em] text-med-ink-muted">{item.label}</div>
          <div className="text-sm text-med-ink">{item.value}</div>
        </div>
      ))}
    </div>
  );
}

function LongField({ label, value, className = "" }) {
  return (
    <div className={className}>
      <div className="mb-1 text-xs font-semibold uppercase tracking-[0.08em] text-med-ink-muted">{label}</div>
      <div className="text-sm leading-6 text-med-ink">{value}</div>
    </div>
  );
}

function MetaRow({ icon, value }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-med-bg text-med-ink-muted">
        {icon}
      </span>
      <span className="truncate">{value}</span>
    </div>
  );
}

function formatCurrency(value) {
  if (value === null || value === undefined || value === "") {
    return "--";
  }

  return new Intl.NumberFormat("es-DO", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);
}

function humanizeAttentionType(value) {
  const labels = {
    presencial: "Presencial",
    virtual: "Virtual",
    ambos: "Presencial y virtual",
  };

  return labels[value] || "--";
}

function MailIcon() {
  return (
    <Icon className="h-4 w-4">
      <path d="M4 7h16" />
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m4 7 8 6 8-6" />
    </Icon>
  );
}

function PhoneIcon() {
  return (
    <Icon className="h-4 w-4">
      <path d="M3 5a2 2 0 0 1 2-2h3.28a1 1 0 0 1 .948.684l1.498 4.493a1 1 0 0 1-.502 1.21l-2.257 1.13a11.042 11.042 0 0 0 5.516 5.516l1.13-2.257a1 1 0 0 1 1.21-.502l4.493 1.498A1 1 0 0 1 21 15.72V19a2 2 0 0 1-2 2h-1C9.716 21 3 14.284 3 6V5z" />
    </Icon>
  );
}

function LicenseIcon() {
  return (
    <Icon className="h-4 w-4">
      <path d="M9 12h6" />
      <path d="M9 16h6" />
      <path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9Z" />
      <path d="M14 2v7h7" />
    </Icon>
  );
}
