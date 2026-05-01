import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import AppShell from "../components/app/AppShell";
import Icon from "../components/ui/Icon";
import { useAuth } from "../context/AuthContext";
import { getAuditBootstrap } from "../lib/audit";

const ACTION_COLORS = {
  LOGIN: "bg-[rgba(128,237,153,0.18)] text-[#1f7a3a]",
  LOGOUT: "bg-[rgba(78,168,222,0.15)] text-[#236c96]",
  CREATE: "bg-[rgba(128,237,153,0.18)] text-[#1f7a3a]",
  UPDATE: "bg-[rgba(255,209,102,0.22)] text-[#8a6200]",
  DELETE: "bg-[rgba(247,37,133,0.14)] text-[#c0105e]",
  PAYMENT: "bg-[rgba(128,237,153,0.18)] text-[#1f7a3a]",
  REFUND: "bg-[rgba(247,37,133,0.14)] text-[#c0105e]",
  CANCEL: "bg-[rgba(247,37,133,0.14)] text-[#c0105e]",
  CONFIRM: "bg-[rgba(128,237,153,0.18)] text-[#1f7a3a]",
  PRESCRIPTION: "bg-[rgba(78,168,222,0.15)] text-[#236c96]",
};

export default function AuditPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ total: 0, by_action: [] });
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const canAccess = user?.role === "admin";

  useEffect(() => {
    if (!canAccess) {
      setLoading(false);
      return undefined;
    }

    let active = true;

    async function loadAudit() {
      setLoading(true);
      setError("");
      try {
        const payload = await getAuditBootstrap();
        if (!active) {
          return;
        }
        setStats(payload?.stats || { total: 0, by_action: [] });
        setLogs(payload?.logs || []);
      } catch (err) {
        if (active) {
          setError(err.message || "No fue posible cargar la auditoria.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadAudit();

    return () => {
      active = false;
    };
  }, [canAccess]);

  if (!canAccess) {
    return (
      <AppShell pageTitle="Auditoria" activePage="audit">
        <section className="app-surface px-6 py-10">
          <div className="mx-auto max-w-[420px] text-center">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-med-bg text-med-ink-muted">
              <ClipboardIcon className="h-7 w-7" />
            </div>
            <h1 className="text-lg font-semibold text-med-ink">Acceso restringido</h1>
            <p className="mt-2 text-sm leading-6 text-med-ink-muted">Solo el administrador puede ver la auditoria.</p>
            <Link className="app-btn-violet mt-5 inline-flex" to="/dashboard">Volver al dashboard</Link>
          </div>
        </section>
      </AppShell>
    );
  }

  return (
    <AppShell pageTitle="Auditoria" activePage="audit">
      <section className="mb-8">
        <h1 className="text-[1.45rem] font-bold tracking-[-0.02em] text-med-ink">Auditoria del sistema</h1>
        <p className="mt-1 text-sm text-med-ink-muted">Registro de acciones y eventos relevantes en la plataforma.</p>
      </section>

      {error ? (
        <div className="mb-6 rounded-2xl border border-[rgba(247,37,133,0.22)] bg-[rgba(247,37,133,0.08)] px-4 py-3 text-sm text-[#c0185a]">
          {error}
        </div>
      ) : null}

      <section className="mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Total acciones" value={loading ? "--" : stats.total} detail="registradas" tone="violet" icon={<ClipboardIcon />} />
        {(stats.by_action || []).slice(0, 4).map((item, index) => (
          <StatCard
            key={item.action}
            label={item.label}
            value={loading ? "--" : item.count}
            detail="eventos"
            tone={["teal", "mint", "amber", "rose"][index] || "violet"}
            icon={<ActivityIcon />}
          />
        ))}
      </section>

      {loading ? (
        <section className="app-surface px-6 py-6">
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="h-12 animate-pulse rounded-xl bg-med-bg" />
            ))}
          </div>
        </section>
      ) : (
        <section className="app-surface overflow-hidden">
          <div className="flex items-center justify-between border-b border-med-border px-6 py-5">
            <h2 className="text-[0.95rem] font-semibold text-med-ink">Registro de acciones</h2>
            <span className="text-sm text-med-ink-muted">Ultimas 200 acciones</span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-0">
              <thead>
                <tr className="bg-med-bg">
                  <TableHead>Fecha</TableHead>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Accion</TableHead>
                  <TableHead>Modulo</TableHead>
                  <TableHead>Descripcion</TableHead>
                  <TableHead>IP</TableHead>
                </tr>
              </thead>
              <tbody>
                {logs.length ? logs.map((log) => (
                  <tr key={log.id} className="transition hover:bg-[#fafafe]">
                    <TableCell className="whitespace-nowrap text-xs text-med-ink-muted">{formatDateTime(log.created_at)}</TableCell>
                    <TableCell>
                      <div className="font-semibold text-med-ink">{log.users?.full_name || "--"}</div>
                      <div className="text-xs text-med-ink-muted">{log.users?.email || ""}</div>
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex rounded-full bg-[rgba(94,96,206,0.08)] px-3 py-1 text-xs font-semibold capitalize text-med-violet">
                        {log.users?.role || "--"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex rounded-full px-3 py-1 text-[11px] font-semibold ${ACTION_COLORS[log.action] || "bg-med-bg text-med-ink-muted"}`}>
                        {log.action_label}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-med-ink-muted">{log.table_name || "--"}</TableCell>
                    <TableCell className="text-sm text-med-ink-muted">{log.description || "--"}</TableCell>
                    <TableCell className="text-xs text-med-ink-muted">{log.ip_address || "--"}</TableCell>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={7} className="px-6 py-10 text-center text-sm text-med-ink-muted">
                      Sin registros de auditoria todavia.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </AppShell>
  );
}

function StatCard({ label, value, detail, tone, icon }) {
  const tones = {
    violet: "bg-[rgba(94,96,206,0.10)] text-med-violet",
    teal: "bg-[rgba(78,168,222,0.14)] text-med-teal",
    mint: "bg-[rgba(128,237,153,0.18)] text-[#2fa84f]",
    amber: "bg-[rgba(255,209,102,0.22)] text-[#8a6200]",
    rose: "bg-[rgba(247,37,133,0.14)] text-med-rose",
  };

  return (
    <div className="app-card relative overflow-hidden px-6 py-6">
      <div className="absolute right-0 top-0 h-20 w-20 rounded-bl-[80px] bg-current opacity-[0.05]" />
      <div className="flex items-start gap-5">
        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${tones[tone]}`}>
          {icon}
        </div>
        <div>
          <div className="text-sm font-medium text-med-ink-muted">{label}</div>
          <div className="mt-1 text-[1.8rem] font-bold leading-none tracking-[-0.03em] text-med-ink">{value}</div>
          <div className="mt-2 text-sm text-med-ink-muted">{detail}</div>
        </div>
      </div>
    </div>
  );
}

function TableHead({ children }) {
  return (
    <th className="whitespace-nowrap border-b border-med-border px-6 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-med-ink-muted">
      {children}
    </th>
  );
}

function TableCell({ children, className = "" }) {
  return <td className={`border-b border-med-border px-6 py-4 align-middle text-sm text-med-ink ${className}`}>{children}</td>;
}

function formatDateTime(value) {
  if (!value) {
    return "--";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value).replace("T", " ").slice(0, 16);
  }
  return new Intl.DateTimeFormat("es-DO", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function ClipboardIcon({ className = "h-[22px] w-[22px]" }) {
  return (
    <Icon className={className}>
      <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
      <path d="M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2" />
      <path d="M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2" />
    </Icon>
  );
}

function ActivityIcon({ className = "h-[22px] w-[22px]" }) {
  return (
    <Icon className={className}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8v4" />
      <path d="M12 16h.01" />
    </Icon>
  );
}
