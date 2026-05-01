import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AppShell from "../components/app/AppShell";
import Icon from "../components/ui/Icon";
import ProfileAvatar from "../components/ui/ProfileAvatar";
import { getPatients, getPatientsBootstrap } from "../lib/patients";

function getInitials(name = "") {
  return (
    name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || "")
      .join("") || "PA"
  );
}

function formatDate(value) {
  if (!value) {
    return "--";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value).slice(0, 10);
  }

  return new Intl.DateTimeFormat("es-DO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export default function PatientsPage() {
  const navigate = useNavigate();
  const [bootstrap, setBootstrap] = useState(null);
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingList, setLoadingList] = useState(false);
  const [error, setError] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [filters, setFilters] = useState({ search: "" });

  useEffect(() => {
    let active = true;

    async function loadBootstrap() {
      setLoading(true);
      setError("");

      try {
        const data = await getPatientsBootstrap();
        if (!active) {
          return;
        }

        setBootstrap(data);

        if (data?.role === "paciente") {
          if (data.current_patient_id) {
            navigate(`/patients/${data.current_patient_id}`, { replace: true });
          } else {
            setError("No se encontro tu expediente. Contacta al administrador.");
          }
        }
      } catch (err) {
        if (active) {
          setError(err.message || "No fue posible cargar el modulo de pacientes.");
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
  }, [navigate]);

  useEffect(() => {
    if (!bootstrap || bootstrap.role === "paciente") {
      return undefined;
    }

    let active = true;
    setLoadingList(true);
    setError("");

    getPatients({ q: filters.search })
      .then((items) => {
        if (active) {
          setPatients(Array.isArray(items) ? items : []);
        }
      })
      .catch((err) => {
        if (active) {
          setError(err.message || "No fue posible cargar los pacientes.");
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

  const subtitle = useMemo(() => {
    if (loading || loadingList) {
      return "Cargando pacientes...";
    }

    return `${patients.length} paciente(s) en el sistema.`;
  }, [loading, loadingList, patients.length]);

  function handleSearchSubmit(event) {
    event.preventDefault();
    setFilters({ search: searchInput.trim() });
  }

  return (
    <AppShell pageTitle="Pacientes" activePage="patients">
      <section className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-[1.45rem] font-bold tracking-[-0.02em] text-med-ink">Pacientes</h1>
          <p className="mt-1 text-sm text-med-ink-muted">{subtitle}</p>
        </div>
        {bootstrap?.can_manage ? (
          <Link className="app-btn-violet justify-center" to="/patients/new">
            <Icon className="h-4 w-4">
              <path d="M12 5v14" />
              <path d="M5 12h14" />
            </Icon>
            Nuevo paciente
          </Link>
        ) : null}
      </section>

      {error ? (
        <div className="mb-6 rounded-2xl border border-[rgba(247,37,133,0.22)] bg-[rgba(247,37,133,0.08)] px-4 py-3 text-sm text-[#c0185a]">
          {error}
        </div>
      ) : null}

      {bootstrap?.role !== "paciente" ? (
        <>
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
                    placeholder="Buscar por nombre, correo o seguro"
                  />
                </div>
                <button className="app-btn-violet shrink-0" type="submit">
                  Buscar
                </button>
              </form>

              {filters.search ? (
                <button
                  type="button"
                  className="app-btn-ghost"
                  onClick={() => {
                    setSearchInput("");
                    setFilters({ search: "" });
                  }}
                >
                  Limpiar
                </button>
              ) : null}
            </div>
          </section>

          {loading || loadingList ? (
            <div className="app-surface overflow-hidden">
              <div className="space-y-3 px-6 py-6">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div key={index} className="h-12 animate-pulse rounded-xl bg-med-bg" />
                ))}
              </div>
            </div>
          ) : patients.length ? (
            <section className="app-surface overflow-hidden">
              <div className="-mx-0 overflow-x-auto">
                <table className="min-w-full border-separate border-spacing-0">
                  <thead>
                    <tr className="bg-med-bg">
                      <TableHead>Paciente</TableHead>
                      <TableHead>Contacto</TableHead>
                      <TableHead>Tipo de sangre</TableHead>
                      <TableHead>Seguro</TableHead>
                      <TableHead>Registro</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </tr>
                  </thead>
                  <tbody>
                    {patients.map((patient) => (
                      <tr key={patient.id} className="transition hover:bg-[#fafafe]">
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <ProfileAvatar
                              src={patient.avatar_url}
                              name={patient.full_name}
                              fallback="PA"
                              className="h-11 w-11 shrink-0 rounded-full"
                              textClassName="text-sm text-med-rose"
                              backgroundClassName="bg-[rgba(247,37,133,0.12)] text-med-rose"
                            />
                            <div className="min-w-0">
                              <div className="truncate font-semibold text-med-ink">{patient.full_name}</div>
                              <div className="truncate text-xs text-med-ink-muted">{patient.email || "--"}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm text-med-ink">{patient.phone || "--"}</div>
                          <div className="text-xs text-med-ink-muted">{patient.gender || "--"}</div>
                        </TableCell>
                        <TableCell>
                          {patient.blood_type ? (
                            <span className="inline-flex rounded-full bg-[rgba(247,37,133,0.12)] px-3 py-1 text-xs font-semibold text-med-rose">
                              {patient.blood_type}
                            </span>
                          ) : (
                            <span className="text-sm text-med-ink-subtle">--</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-med-ink-muted">{patient.insurance_number || "--"}</TableCell>
                        <TableCell className="text-sm text-med-ink-muted">{formatDate(patient.created_at)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Link className="app-btn-ghost px-3 py-2 text-xs" to={`/patients/${patient.id}`}>
                              Ver
                            </Link>
                            <Link className="app-btn-outline px-3 py-2 text-xs" to={`/patients/${patient.id}/edit`}>
                              Editar
                            </Link>
                          </div>
                        </TableCell>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : (
            <section className="app-surface px-6 py-10">
              <div className="mx-auto max-w-[420px] text-center">
                <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-med-bg text-med-ink-muted">
                  <PatientIcon className="h-7 w-7" />
                </div>
                <h2 className="text-lg font-semibold text-med-ink">Sin pacientes registrados</h2>
                <p className="mt-2 text-sm text-med-ink-muted">
                  {filters.search ? `No se encontraron resultados para "${filters.search}".` : "Registra el primer paciente para comenzar."}
                </p>
                {bootstrap?.can_manage ? (
                  <Link className="app-btn-violet mt-5" to="/patients/new">
                    Registrar paciente
                  </Link>
                ) : null}
              </div>
            </section>
          )}
        </>
      ) : null}
    </AppShell>
  );
}

function TableHead({ children, className = "" }) {
  return (
    <th className={`whitespace-nowrap border-b border-med-border px-6 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-med-ink-muted ${className}`}>
      {children}
    </th>
  );
}

function TableCell({ children, className = "" }) {
  return <td className={`border-b border-med-border px-6 py-4 align-middle ${className}`}>{children}</td>;
}

function PatientIcon({ className = "" }) {
  return (
    <Icon className={className}>
      <path d="M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z" />
      <path d="M12 14a7 7 0 0 0-7 7h14a7 7 0 0 0-7-7Z" />
    </Icon>
  );
}
