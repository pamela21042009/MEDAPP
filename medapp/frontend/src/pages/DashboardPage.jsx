import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import AppShell from "../components/app/AppShell";
import Icon from "../components/ui/Icon";
import { useAuth } from "../context/AuthContext";
import { getDashboardData } from "../lib/dashboard";

const DONUT_COLORS = ["#5E60CE", "#4EA8DE", "#80ED99", "#FFD166", "#F72585", "#B980F0", "#4ECDC4", "#FF9A3C"];
const STATUS_COLORS = {
  pending: "#FFD166",
  confirmed: "#80ED99",
  cancelled: "#F72585",
  completed: "#4EA8DE",
  no_show: "#ADB5BD",
  rescheduled: "#4EA8DE",
};

const EMPTY_DASHBOARD = {
  stats: {
    today_total: 0,
    today_confirmed: 0,
    pending_total: 0,
    revenue_today: 0,
    patients_count: 0,
    doctors_count: 0,
    upcoming: [],
  },
  monthly_revenue: [],
  by_status: [],
  by_specialty: [],
  role: "staff",
};

export default function DashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState(EMPTY_DASHBOARD);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadDashboard() {
      setLoading(true);
      setError("");

      try {
        const result = await getDashboardData();
        if (active) {
          setData(result);
        }
      } catch (err) {
        if (active) {
          setError(err.message || "No fue posible cargar el dashboard.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadDashboard();

    return () => {
      active = false;
    };
  }, []);

  const stats = data.stats || EMPTY_DASHBOARD.stats;
  const monthlyRevenue = data.monthly_revenue || [];
  const byStatus = data.by_status || [];
  const bySpecialty = data.by_specialty || [];

  return (
    <AppShell pageTitle="Dashboard" activePage="dashboard">
      <section className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-[1.45rem] font-bold tracking-[-0.02em] text-med-ink">Resumen general</h1>
          <p className="mt-1 text-sm text-med-ink-muted">Vista consolidada del sistema en tiempo real.</p>
        </div>
        <Link className="app-btn-violet justify-center" to="/agenda">
          <Icon className="h-4 w-4">
            <path d="M12 5v14" />
            <path d="M5 12h14" />
          </Icon>
          Nueva cita
        </Link>
      </section>

      {error ? (
        <div className="mb-6 rounded-2xl border border-[rgba(247,37,133,0.22)] bg-[rgba(247,37,133,0.08)] px-4 py-3 text-sm text-[#c0185a]">
          {error}
        </div>
      ) : null}

      <section className="mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Citas hoy" value={stats.today_total} detail={`${stats.today_confirmed} confirmadas`} tone="violet" icon={<CalendarMetricIcon />} loading={loading} />
        <StatCard label="Pendientes" value={stats.pending_total} detail="por confirmar" tone="amber" icon={<AlertMetricIcon />} loading={loading} />
        <StatCard label="Ingresos hoy" value={formatCurrency(stats.revenue_today)} detail="cobrado" tone="mint" icon={<PaymentMetricIcon />} loading={loading} />
        <StatCard label="Pacientes" value={stats.patients_count} detail="registrados" tone="rose" icon={<PatientMetricIcon />} loading={loading} />
        <StatCard label="Medicos" value={stats.doctors_count} detail="activos" tone="teal" icon={<TeamMetricIcon />} loading={loading} />
      </section>

      <section className="mb-6 grid gap-6 xl:grid-cols-[2fr_1fr]">
        <Card title="Ingresos ultimos 6 meses">
          <RevenueBars data={monthlyRevenue} loading={loading} />
        </Card>
        <Card title="Estado de citas">
          <StatusBreakdown data={byStatus} loading={loading} />
        </Card>
      </section>

      <section className="mb-6 grid gap-6 xl:grid-cols-[2fr_1fr]">
        <Card title="Citas por especialidad">
          <SpecialtyBreakdown data={bySpecialty} loading={loading} />
        </Card>
        <Card title="Acciones rapidas">
          <QuickActions role={user?.role || data.role} />
        </Card>
      </section>

      <Card
        title="Citas de hoy"
        action={(
          <Link className="app-btn-ghost px-3 py-1.5 text-xs" to="/agenda">
            Ver agenda
          </Link>
        )}
      >
        <UpcomingTable rows={stats.upcoming || []} loading={loading} />
      </Card>
    </AppShell>
  );
}

function Card({ title, action, children }) {
  return (
    <section className="app-surface overflow-hidden">
      <div className="flex items-center justify-between gap-4 border-b border-med-border px-6 py-5">
        <h2 className="text-[0.95rem] font-semibold text-med-ink">{title}</h2>
        {action}
      </div>
      <div className="p-6">{children}</div>
    </section>
  );
}

function StatCard({ label, value, detail, tone, icon, loading }) {
  const tones = {
    violet: "bg-[rgba(94,96,206,0.10)] text-med-violet",
    amber: "bg-[rgba(255,209,102,0.22)] text-[#b7860b]",
    mint: "bg-[rgba(128,237,153,0.18)] text-[#2fa84f]",
    rose: "bg-[rgba(247,37,133,0.14)] text-med-rose",
    teal: "bg-[rgba(78,168,222,0.14)] text-med-teal",
  };

  return (
    <div className="app-card relative overflow-hidden px-6 py-6">
      <div className="absolute right-0 top-0 h-20 w-20 rounded-bl-[80px] bg-current opacity-[0.05]" />
      <div className="flex items-start gap-5">
        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${tones[tone]}`}>
          {icon}
        </div>
        <div className="min-w-0">
          <div className="text-sm font-medium text-med-ink-muted">{label}</div>
          <div className="mt-1 text-[1.8rem] font-bold leading-none tracking-[-0.03em] text-med-ink">
            {loading ? <span className="inline-block h-8 w-20 animate-pulse rounded-lg bg-med-bg" /> : value}
          </div>
          <div className="mt-2 text-sm text-med-ink-muted">{detail}</div>
        </div>
      </div>
    </div>
  );
}

function RevenueBars({ data, loading }) {
  if (loading) {
    return <ChartSkeleton heightClass="h-64" />;
  }

  if (!data.length) {
    return <EmptyState title="Sin ingresos aun" description="Los datos de facturacion apareceran aqui." />;
  }

  const maxRevenue = Math.max(...data.map((item) => Number(item.revenue) || 0), 1);

  return (
    <div className="grid h-64 grid-cols-1">
      <div className="flex h-full items-end gap-3 overflow-x-auto pb-1">
        {data.map((item) => {
          const height = Math.max(((Number(item.revenue) || 0) / maxRevenue) * 100, 8);
          return (
            <div key={item.month} className="flex min-w-[78px] flex-1 flex-col justify-end">
              <div className="mb-2 text-center text-xs font-semibold text-med-violet">
                {formatCompactCurrency(item.revenue)}
              </div>
              <div className="relative flex-1 rounded-t-2xl bg-[linear-gradient(180deg,rgba(94,96,206,0.16)_0%,rgba(94,96,206,0.05)_100%)]">
                <div
                  className="absolute inset-x-0 bottom-0 rounded-t-2xl bg-[rgba(94,96,206,0.78)]"
                  style={{ height: `${height}%` }}
                />
              </div>
              <div className="mt-3 text-center text-xs font-medium text-med-ink-muted">
                {formatMonth(item.month)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StatusBreakdown({ data, loading }) {
  if (loading) {
    return <ChartSkeleton heightClass="h-64" />;
  }

  if (!data.length) {
    return <EmptyState title="Sin datos aun" description="Los estados de citas apareceran aqui." compact />;
  }

  const total = data.reduce((sum, item) => sum + (Number(item.count) || 0), 0) || 1;

  return (
    <div className="space-y-4">
      {data.map((item) => {
        const color = STATUS_COLORS[item.status] || "#5E60CE";
        const width = Math.round(((Number(item.count) || 0) / total) * 100);
        return (
          <div key={item.status}>
            <div className="mb-1.5 flex items-center justify-between text-sm">
              <span className="font-medium text-med-ink">{item.label}</span>
              <span className="font-semibold" style={{ color }}>
                {item.count}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-med-bg">
              <div className="h-full rounded-full transition-all duration-300" style={{ width: `${width}%`, backgroundColor: color }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SpecialtyBreakdown({ data, loading }) {
  if (loading) {
    return <ChartSkeleton heightClass="h-72" />;
  }

  if (!data.length) {
    return <EmptyState title="Sin especialidades aun" description="Las especialidades con citas apareceran aqui." />;
  }

  const total = data.reduce((sum, item) => sum + (Number(item.count) || 0), 0) || 1;
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="grid gap-6 lg:grid-cols-[240px_1fr] lg:items-center">
      <div className="flex justify-center">
        <div className="relative flex h-[180px] w-[180px] items-center justify-center">
          <svg className="h-[180px] w-[180px] -rotate-90" viewBox="0 0 140 140">
            <circle cx="70" cy="70" r={radius} fill="none" stroke="#E8EAF0" strokeWidth="16" />
            {data.map((item, index) => {
              const fraction = (Number(item.count) || 0) / total;
              const length = circumference * fraction;
              const segment = (
                <circle
                  key={item.specialty}
                  cx="70"
                  cy="70"
                  r={radius}
                  fill="none"
                  stroke={DONUT_COLORS[index % DONUT_COLORS.length]}
                  strokeWidth="16"
                  strokeLinecap="butt"
                  strokeDasharray={`${length} ${circumference - length}`}
                  strokeDashoffset={-offset}
                />
              );
              offset += length;
              return segment;
            })}
          </svg>
          <div className="absolute text-center">
            <div className="text-[11px] uppercase tracking-[0.12em] text-med-ink-subtle">Total</div>
            <div className="text-2xl font-bold tracking-[-0.03em] text-med-ink">{total}</div>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {data.map((item, index) => {
          const count = Number(item.count) || 0;
          const width = Math.max(Math.round((count / total) * 100), 4);
          return (
            <div key={item.specialty}>
              <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: DONUT_COLORS[index % DONUT_COLORS.length] }} />
                  <span className="font-medium text-med-ink">{item.specialty}</span>
                </div>
                <span className="font-semibold text-med-ink-muted">{count}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-med-bg">
                <div className="h-full rounded-full" style={{ width: `${width}%`, backgroundColor: DONUT_COLORS[index % DONUT_COLORS.length] }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function QuickActions({ role }) {
  return (
    <div className="flex flex-col gap-2">
      <Link className="app-btn-violet justify-center" to="/agenda">
        Nueva cita
      </Link>
      <Link className="app-btn-outline justify-center" to="/patients/new">
        Nuevo paciente
      </Link>
      {["doctor", "admin", "staff"].includes(role) ? (
        <Link className="app-btn-ghost justify-center" to="/prescriptions/create">
          Nueva receta
        </Link>
      ) : null}
      {["admin", "staff"].includes(role) ? (
        <Link className="app-btn-ghost justify-center" to="/reports">
          Ver reportes
        </Link>
      ) : null}
      <Link className="app-btn-ghost justify-center" to="/payments">
        Ver pagos
      </Link>
    </div>
  );
}

function UpcomingTable({ rows, loading }) {
  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-12 animate-pulse rounded-xl bg-med-bg" />
        ))}
      </div>
    );
  }

  if (!rows.length) {
    return <EmptyState title="Sin citas para hoy" description="Las citas del dia apareceran aqui." />;
  }

  return (
    <div className="-mx-6 overflow-x-auto">
      <table className="min-w-full border-separate border-spacing-0">
        <thead>
          <tr className="bg-med-bg">
            <TableHead>Hora</TableHead>
            <TableHead>Paciente</TableHead>
            <TableHead>Medico</TableHead>
            <TableHead>Motivo</TableHead>
            <TableHead>Estado</TableHead>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="transition hover:bg-[#fafafe]">
              <TableCell className="font-semibold text-med-violet">
                {row.appointment_time ? String(row.appointment_time).slice(0, 5) : "--"}
              </TableCell>
              <TableCell>
                <div className="font-semibold text-med-ink">{row.patients?.full_name || "--"}</div>
              </TableCell>
              <TableCell>{row.doctors?.full_name || "--"}</TableCell>
              <TableCell className="text-sm text-med-ink-muted">{row.reason || "--"}</TableCell>
              <TableCell>
                <span className={`status-pill status-${row.status}`}>{humanizeStatus(row.status)}</span>
              </TableCell>
            </tr>
          ))}
        </tbody>
      </table>
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
  return <td className={`border-b border-med-border px-6 py-4 text-sm text-med-ink ${className}`}>{children}</td>;
}

function ChartSkeleton({ heightClass }) {
  return <div className={`${heightClass} animate-pulse rounded-2xl bg-med-bg`} />;
}

function EmptyState({ title, description, compact = false }) {
  return (
    <div className={`text-center text-med-ink-muted ${compact ? "py-4" : "py-8"}`}>
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-med-bg text-med-ink-muted">
        <Icon className="h-6 w-6">
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M3 10h18" />
        </Icon>
      </div>
      <div className="text-base font-semibold text-med-ink">{title}</div>
      <div className="mt-1 text-sm">{description}</div>
    </div>
  );
}

function formatMonth(value) {
  if (!value) {
    return "--";
  }

  const date = new Date(`${value}-01T00:00:00`);
  return new Intl.DateTimeFormat("es-DO", { month: "short", year: "numeric" }).format(date);
}

function formatCurrency(value) {
  return new Intl.NumberFormat("es-DO", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
}

function formatCompactCurrency(value) {
  return new Intl.NumberFormat("es-DO", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
    notation: "compact",
  }).format(Number(value) || 0);
}

function humanizeStatus(value) {
  const labels = {
    pending: "Pendiente",
    confirmed: "Confirmada",
    cancelled: "Cancelada",
    completed: "Atendida",
    no_show: "No asistida",
    rescheduled: "Reprogramada",
  };

  return labels[value] || value || "--";
}

function CalendarMetricIcon() {
  return (
    <Icon className="h-[22px] w-[22px]">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M8 2v4" />
      <path d="M16 2v4" />
      <path d="M3 10h18" />
    </Icon>
  );
}

function AlertMetricIcon() {
  return (
    <Icon className="h-[22px] w-[22px]">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8v4" />
      <path d="M12 16h.01" />
    </Icon>
  );
}

function PaymentMetricIcon() {
  return (
    <Icon className="h-[22px] w-[22px]">
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="M2 10h20" />
    </Icon>
  );
}

function PatientMetricIcon() {
  return (
    <Icon className="h-[22px] w-[22px]">
      <path d="M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z" />
      <path d="M12 14a7 7 0 0 0-7 7h14a7 7 0 0 0-7-7Z" />
    </Icon>
  );
}

function TeamMetricIcon() {
  return (
    <Icon className="h-[22px] w-[22px]">
      <path d="M17 20h5v-2a4 4 0 0 0-5-3.87" />
      <path d="M9 20H4v-2a4 4 0 0 1 5-3.87" />
      <path d="M9 16.13A4 4 0 1 0 13 8a4 4 0 0 0-4 8.13Z" />
    </Icon>
  );
}
