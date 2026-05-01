import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import AppShell from "../components/app/AppShell";
import Icon from "../components/ui/Icon";
import ProfileAvatar from "../components/ui/ProfileAvatar";
import { deactivateDoctor, getDoctors, getDoctorsBootstrap } from "../lib/doctors";

function doctorStatusClasses(isActive) {
  return isActive
    ? "bg-[rgba(128,237,153,0.18)] text-[#1f7a3a]"
    : "bg-[rgba(173,181,189,0.16)] text-med-ink-muted";
}

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

export default function DoctorsPage() {
  const [bootstrap, setBootstrap] = useState(null);
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingList, setLoadingList] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState(null);
  const [searchInput, setSearchInput] = useState("");
  const [filters, setFilters] = useState({
    search: "",
    specialty: "",
    includeInactive: false,
  });

  useEffect(() => {
    let active = true;

    async function loadBootstrap() {
      setLoading(true);
      setError("");

      try {
        const data = await getDoctorsBootstrap();
        if (!active) {
          return;
        }

        setBootstrap(data);
        setFilters((current) => ({
          ...current,
          includeInactive: Boolean(data?.can_manage),
        }));
      } catch (err) {
        if (active) {
          setError(err.message || "No fue posible cargar el modulo de medicos.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadBootstrap();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!bootstrap) {
      return undefined;
    }

    let active = true;
    setLoadingList(true);
    setError("");

    getDoctors({
      q: filters.search,
      specialty: filters.specialty,
      include_inactive: filters.includeInactive ? "1" : "0",
    })
      .then((items) => {
        if (active) {
          setDoctors(Array.isArray(items) ? items : []);
        }
      })
      .catch((err) => {
        if (active) {
          setError(err.message || "No fue posible cargar los medicos.");
        }
      })
      .finally(() => {
        if (active) {
          setLoadingList(false);
        }
      });

    return () => {
      active = false;
    };
  }, [bootstrap, filters]);

  useEffect(() => {
    if (!toast) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(timeoutId);
  }, [toast]);

  const currentDoctorId = bootstrap?.current_doctor_id;
  const canManage = Boolean(bootstrap?.can_manage);
  const specialties = bootstrap?.specialties || [];
  const subtitle = useMemo(() => {
    if (loading || loadingList) {
      return "Cargando equipo medico...";
    }

    return `${doctors.length} medico(s) visible(s) en este momento.`;
  }, [doctors.length, loading, loadingList]);

  function canEditDoctor(doctor) {
    return canManage || (currentDoctorId && currentDoctorId === doctor.id);
  }

  async function handleDeactivate(doctor) {
    const confirmed = window.confirm(`Deseas desactivar a Dr. ${doctor.full_name}?`);
    if (!confirmed) {
      return;
    }

    try {
      await deactivateDoctor(doctor.id);
      setDoctors((current) => current.map((item) => (item.id === doctor.id ? { ...item, is_active: false } : item)));
      setToast({ type: "success", message: "Medico desactivado correctamente." });
    } catch (err) {
      setToast({ type: "error", message: err.message || "No fue posible desactivar el medico." });
    }
  }

  function handleSearchSubmit(event) {
    event.preventDefault();
    setFilters((current) => ({ ...current, search: searchInput.trim() }));
  }

  return (
    <AppShell pageTitle="Medicos" activePage="doctors">
      <section className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-[1.45rem] font-bold tracking-[-0.02em] text-med-ink">Equipo medico</h1>
          <p className="mt-1 text-sm text-med-ink-muted">{subtitle}</p>
        </div>
        {canManage ? (
          <Link className="app-btn-violet justify-center" to="/doctors/new">
            <Icon className="h-4 w-4">
              <path d="M12 5v14" />
              <path d="M5 12h14" />
            </Icon>
            Nuevo medico
          </Link>
        ) : null}
      </section>

      {error ? (
        <div className="mb-6 rounded-2xl border border-[rgba(247,37,133,0.22)] bg-[rgba(247,37,133,0.08)] px-4 py-3 text-sm text-[#c0185a]">
          {error}
        </div>
      ) : null}

      <section className="mb-6 app-surface overflow-hidden">
        <div className="flex flex-col gap-4 border-b border-med-border px-5 py-5 lg:flex-row lg:items-center lg:justify-between">
          <form className="flex w-full max-w-[460px] gap-3" onSubmit={handleSearchSubmit}>
            <div className="field-group relative flex-1">
              <Icon className="input-icon">
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" />
              </Icon>
              <input
                className="med-input"
                type="search"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Buscar por nombre, especialidad o licencia"
              />
            </div>
            <button className="app-btn-violet shrink-0" type="submit">
              Buscar
            </button>
          </form>

          {canManage ? (
            <label className="inline-flex items-center gap-3 text-sm text-med-ink-muted">
              <input
                type="checkbox"
                checked={filters.includeInactive}
                onChange={(event) => setFilters((current) => ({ ...current, includeInactive: event.target.checked }))}
                className="h-4 w-4 rounded border-med-border text-med-violet focus:ring-med-violet"
              />
              Mostrar inactivos
            </label>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2 px-5 py-4">
          <button
            type="button"
            onClick={() => setFilters((current) => ({ ...current, specialty: "" }))}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
              !filters.specialty
                ? "border-med-violet bg-[rgba(94,96,206,0.1)] text-med-violet"
                : "border-med-border bg-white text-med-ink-muted hover:bg-med-bg hover:text-med-ink"
            }`}
          >
            Todas
          </button>
          {specialties.map((specialty) => (
            <button
              key={specialty}
              type="button"
              onClick={() => setFilters((current) => ({ ...current, specialty }))}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                filters.specialty === specialty
                  ? "border-med-violet bg-[rgba(94,96,206,0.1)] text-med-violet"
                  : "border-med-border bg-white text-med-ink-muted hover:bg-med-bg hover:text-med-ink"
              }`}
            >
              {specialty}
            </button>
          ))}
        </div>
      </section>

      {loading || loadingList ? (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="app-card h-[245px] animate-pulse bg-white" />
          ))}
        </div>
      ) : doctors.length ? (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {doctors.map((doctor) => (
            <article key={doctor.id} className="app-card overflow-hidden px-6 py-5">
              <div className="flex items-start gap-4">
                <ProfileAvatar
                  src={doctor.avatar_url}
                  name={doctor.full_name}
                  fallback="DR"
                  className="h-14 w-14 shrink-0 rounded-2xl"
                  textClassName="text-lg text-med-violet"
                  backgroundClassName="bg-[rgba(94,96,206,0.12)] text-med-violet"
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[1rem] font-bold tracking-[-0.02em] text-med-ink">
                    Dr. {doctor.full_name}
                  </div>
                  <div className="mt-2 inline-flex rounded-full bg-[rgba(94,96,206,0.08)] px-3 py-1 text-xs font-semibold text-med-violet">
                    {doctor.specialty || "Sin especialidad"}
                  </div>
                </div>
                <span className={`rounded-full px-3 py-1 text-[11px] font-semibold ${doctorStatusClasses(doctor.is_active)}`}>
                  {doctor.is_active ? "Activo" : "Inactivo"}
                </span>
              </div>

              <div className="mt-5 space-y-3 text-sm text-med-ink-muted">
                {doctor.email ? <MetaRow icon={<MailIcon />} value={doctor.email} /> : null}
                {doctor.phone ? <MetaRow icon={<PhoneIcon />} value={doctor.phone} /> : null}
                {doctor.license_number ? <MetaRow icon={<LicenseIcon />} value={`Lic. ${doctor.license_number}`} /> : null}
                {doctor.clinic_name ? <MetaRow icon={<ClinicIcon />} value={doctor.clinic_name} /> : null}
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-2">
                <Link className="app-btn-ghost px-3 py-2 text-xs" to={`/doctors/${doctor.id}`}>
                  Ver perfil
                </Link>
                {canEditDoctor(doctor) ? (
                  <Link className="app-btn-outline px-3 py-2 text-xs" to={`/doctors/${doctor.id}/edit`}>
                    Editar
                  </Link>
                ) : null}
                {canManage && doctor.is_active ? (
                  <button
                    type="button"
                    className="app-btn ml-auto border-[rgba(247,37,133,0.2)] bg-[rgba(247,37,133,0.08)] px-3 py-2 text-xs text-[#c0105e] hover:bg-[rgba(247,37,133,0.14)]"
                    onClick={() => handleDeactivate(doctor)}
                  >
                    Desactivar
                  </button>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <section className="app-surface px-6 py-10">
          <div className="mx-auto max-w-[420px] text-center">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-med-bg text-med-ink-muted">
              <TeamIcon className="h-7 w-7" />
            </div>
            <h2 className="text-lg font-semibold text-med-ink">No hay medicos para mostrar</h2>
            <p className="mt-2 text-sm text-med-ink-muted">
              Ajusta los filtros o registra el primer medico del equipo para comenzar.
            </p>
            {canManage ? (
              <Link className="app-btn-violet mt-5" to="/doctors/new">
                Registrar medico
              </Link>
            ) : null}
          </div>
        </section>
      )}

      {toast ? (
        <div className="pointer-events-none fixed bottom-6 right-6 z-[100]">
          <div
            className={`rounded-xl border px-4 py-3 text-sm font-medium shadow-lg ${
              toast.type === "error"
                ? "border-[rgba(247,37,133,0.25)] bg-white text-[#c0185a]"
                : "border-[rgba(128,237,153,0.35)] bg-white text-[#1f7a3a]"
            }`}
          >
            {toast.message}
          </div>
        </div>
      ) : null}
    </AppShell>
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

function ClinicIcon() {
  return (
    <Icon className="h-4 w-4">
      <path d="M3 21h18" />
      <path d="M5 21V7l7-4 7 4v14" />
      <path d="M9 10h.01" />
      <path d="M15 10h.01" />
      <path d="M9 14h.01" />
      <path d="M15 14h.01" />
    </Icon>
  );
}

function TeamIcon({ className = "" }) {
  return (
    <Icon className={className}>
      <path d="M17 20h5v-2a4 4 0 0 0-5-3.87" />
      <path d="M9 20H4v-2a4 4 0 0 1 5-3.87" />
      <path d="M9 16.13A4 4 0 1 0 13 8a4 4 0 0 0-4 8.13Z" />
    </Icon>
  );
}
