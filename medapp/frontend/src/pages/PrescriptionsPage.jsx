import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import AppShell from "../components/app/AppShell";
import Icon from "../components/ui/Icon";
import { getPrescriptions, getPrescriptionsBootstrap } from "../lib/prescriptions";

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

export default function PrescriptionsPage() {
  const [bootstrap, setBootstrap] = useState(null);
  const [prescriptions, setPrescriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadPrescriptions() {
      setLoading(true);
      setError("");

      try {
        const [bootstrapData, items] = await Promise.all([
          getPrescriptionsBootstrap(),
          getPrescriptions(),
        ]);

        if (!active) {
          return;
        }

        setBootstrap(bootstrapData);
        setPrescriptions(Array.isArray(items) ? items : []);
      } catch (err) {
        if (active) {
          setError(err.message || "No fue posible cargar las recetas.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadPrescriptions();

    return () => {
      active = false;
    };
  }, []);

  const subtitle = useMemo(() => {
    if (loading) {
      return "Cargando recetas...";
    }

    const labels = {
      doctor: "Tus recetas emitidas recientemente.",
      paciente: "Tus recetas medicas disponibles.",
      admin: "Gestion general de prescripciones y medicamentos.",
      staff: "Gestion general de prescripciones y medicamentos.",
    };

    return labels[bootstrap?.role] || "Gestion de prescripciones y medicamentos.";
  }, [bootstrap?.role, loading]);

  return (
    <AppShell pageTitle="Recetas" activePage="prescriptions">
      <section className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-[1.45rem] font-bold tracking-[-0.02em] text-med-ink">Recetas medicas</h1>
          <p className="mt-1 text-sm text-med-ink-muted">{subtitle}</p>
        </div>
        {bootstrap?.can_write ? (
          <Link className="app-btn-violet justify-center" to="/prescriptions/create">
            <Icon className="h-4 w-4">
              <path d="M12 5v14" />
              <path d="M5 12h14" />
            </Icon>
            Nueva receta
          </Link>
        ) : null}
      </section>

      {error ? (
        <div className="mb-6 rounded-2xl border border-[rgba(247,37,133,0.22)] bg-[rgba(247,37,133,0.08)] px-4 py-3 text-sm text-[#c0185a]">
          {error}
        </div>
      ) : null}

      {loading ? (
        <section className="app-surface overflow-hidden">
          <div className="space-y-3 px-6 py-6">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="h-12 animate-pulse rounded-xl bg-med-bg" />
            ))}
          </div>
        </section>
      ) : prescriptions.length ? (
        <section className="app-surface overflow-hidden">
          <div className="-mx-0 overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-0">
              <thead>
                <tr className="bg-med-bg">
                  <TableHead>Codigo</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Paciente</TableHead>
                  <TableHead>Medico</TableHead>
                  <TableHead>Valida hasta</TableHead>
                  <TableHead className="text-right">Accion</TableHead>
                </tr>
              </thead>
              <tbody>
                {prescriptions.map((rx) => (
                  <tr key={rx.id} className="transition hover:bg-[#fafafe]">
                    <TableCell>
                      <span className="inline-flex rounded-full bg-[rgba(94,96,206,0.1)] px-3 py-1 text-xs font-semibold text-med-violet">
                        RX-{rx.id}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-med-ink-muted">{formatDate(rx.issued_at)}</TableCell>
                    <TableCell className="font-medium text-med-ink">{rx.patients?.full_name || "--"}</TableCell>
                    <TableCell>
                      <div className="text-sm text-med-ink">{rx.doctors?.full_name || "--"}</div>
                      <div className="text-xs text-med-ink-muted">{rx.doctors?.specialty || ""}</div>
                    </TableCell>
                    <TableCell className="text-sm text-med-ink-muted">{formatDate(rx.valid_until)}</TableCell>
                    <TableCell className="text-right">
                      <Link className="app-btn-ghost px-3 py-2 text-xs" to={`/prescriptions/${rx.id}`}>
                        Ver
                      </Link>
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
              <FileIcon className="h-7 w-7" />
            </div>
            <h2 className="text-lg font-semibold text-med-ink">Sin recetas registradas</h2>
            <p className="mt-2 text-sm text-med-ink-muted">Las recetas creadas apareceran aqui.</p>
            {bootstrap?.can_write ? (
              <Link className="app-btn-violet mt-5" to="/prescriptions/create">
                Crear receta
              </Link>
            ) : null}
          </div>
        </section>
      )}
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

function FileIcon({ className = "" }) {
  return (
    <Icon className={className}>
      <path d="M9 12h6" />
      <path d="M9 16h6" />
      <path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9Z" />
      <path d="M14 2v7h7" />
    </Icon>
  );
}
