import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import AppShell from "../components/app/AppShell";
import Icon from "../components/ui/Icon";
import { useAuth } from "../context/AuthContext";
import { toBackendUrl } from "../lib/api";
import { getMedicalReport, getReportsBootstrap } from "../lib/reports";

const METHOD_COLORS = ["#5E60CE", "#4EA8DE", "#80ED99", "#FFD166", "#F72585", "#4ECDC4", "#FF9A3C"];
const STATUS_COLORS = {
  pending: "#FFD166",
  confirmed: "#80ED99",
  completed: "#4EA8DE",
  cancelled: "#F72585",
  no_show: "#ADB5BD",
  rescheduled: "#4EA8DE",
};
const FILTER_INPUT_CLASS = "med-input px-4 py-3";
const EMPTY_REPORTS = {
  monthly_revenue: [],
  by_status: [],
  top_doctors: [],
  payment_methods: [],
  new_patients: [],
  total_revenue: 0,
  total_appointments: 0,
  active_doctors: 0,
  new_patients_total: 0,
  role: "staff",
};
const EMPTY_MEDICAL_REPORT = {
  doctors: [],
  filters: {
    doctor_id: null,
    date_from: "",
    date_to: "",
  },
  total_appointments: 0,
  by_status: [],
  by_doctor: [],
  appointments: [],
};

export default function ReportsPage() {
  const { user } = useAuth();
  const [reports, setReports] = useState(EMPTY_REPORTS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [medicalReport, setMedicalReport] = useState(EMPTY_MEDICAL_REPORT);
  const [medicalLoading, setMedicalLoading] = useState(true);
  const [medicalError, setMedicalError] = useState("");
  const [filters, setFilters] = useState({
    doctorId: "",
    dateFrom: "",
    dateTo: "",
  });

  const canAccess = ["admin", "doctor", "staff", "paciente"].includes(user?.role);

  useEffect(() => {
    if (!canAccess) {
      setLoading(false);
      return undefined;
    }

    let active = true;

    async function loadReports() {
      setLoading(true);
      setError("");

      try {
        const payload = await getReportsBootstrap();
        if (active) {
          setReports(payload || EMPTY_REPORTS);
        }
      } catch (err) {
        if (active) {
          setError(err.message || "No fue posible cargar los reportes.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadReports();

    return () => {
      active = false;
    };
  }, [canAccess]);

  useEffect(() => {
    if (!canAccess) {
      setMedicalLoading(false);
      return undefined;
    }

    let active = true;

    async function loadMedicalReport() {
      setMedicalLoading(true);
      setMedicalError("");

      try {
        const payload = await getMedicalReport(filters);
        if (active) {
          setMedicalReport(payload || EMPTY_MEDICAL_REPORT);
        }
      } catch (err) {
        if (active) {
          setMedicalError(err.message || "No fue posible cargar el reporte medico.");
          setMedicalReport(EMPTY_MEDICAL_REPORT);
        }
      } finally {
        if (active) {
          setMedicalLoading(false);
        }
      }
    }

    loadMedicalReport();

    return () => {
      active = false;
    };
  }, [canAccess, filters]);

  if (!canAccess) {
    return (
      <AppShell pageTitle="Reportes" activePage="reports">
        <AccessDeniedCard />
      </AppShell>
    );
  }

  const monthlyRevenue = reports.monthly_revenue || [];
  const byStatus = reports.by_status || [];
  const topDoctors = reports.top_doctors || [];
  const paymentMethods = reports.payment_methods || [];
  const newPatients = reports.new_patients || [];
  const reportDoctors = medicalReport.doctors?.length ? medicalReport.doctors : reports.doctors || [];
  const selectedDoctor = reportDoctors.find((doctor) => String(doctor.id) === String(filters.doctorId));
  const exportQuery = buildReportQuery(filters);
  const excelExportUrl = toBackendUrl(`/reports/export/excel${exportQuery ? `?${exportQuery}` : ""}`);
  const pdfExportUrl = toBackendUrl(`/reports/export/pdf${exportQuery ? `?${exportQuery}` : ""}`);

  return (
    <AppShell pageTitle="Reportes" activePage="reports">
      <section className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-[1.45rem] font-bold tracking-[-0.02em] text-med-ink">Reportes y analitica</h1>
          <p className="mt-1 text-sm text-med-ink-muted">Vista consolidada de ingresos, citas y crecimiento del sistema.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <a className="app-btn-ghost justify-center px-4 py-2.5 text-sm" href={excelExportUrl}>
            <ExportIcon className="h-4 w-4" />
            Exportar Excel
          </a>
          <a className="app-btn-violet justify-center px-4 py-2.5 text-sm" href={pdfExportUrl}>
            <ExportIcon className="h-4 w-4" />
            Exportar PDF
          </a>
        </div>
      </section>

      {error ? (
        <div className="mb-6 rounded-2xl border border-[rgba(247,37,133,0.22)] bg-[rgba(247,37,133,0.08)] px-4 py-3 text-sm text-[#c0185a]">
          {error}
        </div>
      ) : null}

      <section className="app-surface mb-6 overflow-hidden">
        <div className="border-b border-med-border px-6 py-5">
          <h2 className="text-[0.95rem] font-semibold text-med-ink">Reporte medico por periodo</h2>
          <p className="mt-1 text-sm text-med-ink-muted">Filtra citas por medico y rango de fechas para ver volumen y estados.</p>
        </div>
        <div className="grid gap-4 px-6 py-6 lg:grid-cols-[minmax(0,1fr)_180px_180px_auto] lg:items-end">
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.08em] text-med-ink-muted">Medico</label>
            <select
              className={FILTER_INPUT_CLASS}
              value={filters.doctorId}
              onChange={(event) => setFilters((current) => ({ ...current, doctorId: event.target.value }))}
            >
              <option value="">Todos los medicos</option>
              {reportDoctors.map((doctor) => (
                <option key={doctor.id} value={doctor.id}>
                  {doctor.full_name} {doctor.specialty ? `- ${doctor.specialty}` : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.08em] text-med-ink-muted">Desde</label>
            <input
              className={FILTER_INPUT_CLASS}
              type="date"
              value={filters.dateFrom}
              onChange={(event) => setFilters((current) => ({ ...current, dateFrom: event.target.value }))}
            />
          </div>
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.08em] text-med-ink-muted">Hasta</label>
            <input
              className={FILTER_INPUT_CLASS}
              type="date"
              value={filters.dateTo}
              onChange={(event) => setFilters((current) => ({ ...current, dateTo: event.target.value }))}
            />
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className="app-btn-ghost justify-center"
              onClick={() => setFilters({ doctorId: "", dateFrom: "", dateTo: "" })}
            >
              Limpiar filtros
            </button>
          </div>
        </div>
        <div className="border-t border-med-border px-6 py-4 text-sm text-med-ink-muted">
          {medicalLoading
            ? "Cargando reporte medico..."
            : `${medicalReport.total_appointments || 0} citas encontradas${selectedDoctor ? ` para ${selectedDoctor.full_name}` : ""}${formatDateRange(filters)}.`}
        </div>
        {medicalError ? (
          <div className="border-t border-med-border px-6 py-4 text-sm text-[#c0185a]">{medicalError}</div>
        ) : null}
      </section>

      <section className="mb-6 grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Card title="Estados del reporte medico">
          {medicalLoading ? (
            <ChartSkeleton heightClass="h-64" />
          ) : !medicalReport.by_status?.length ? (
            <EmptyState title="Sin citas en el filtro" description="Ajusta el medico o el rango de fechas para ver resultados." compact />
          ) : (
            <StatusBreakdown data={medicalReport.by_status} loading={false} />
          )}
        </Card>
        <Card title="Citas por medico en el periodo">
          {medicalLoading ? (
            <ChartSkeleton heightClass="h-64" />
          ) : !medicalReport.by_doctor?.length ? (
            <EmptyState title="Sin medicos en el filtro" description="No hay citas registradas para la seleccion actual." compact />
          ) : (
            <TopDoctorsTable rows={medicalReport.by_doctor} loading={false} />
          )}
        </Card>
      </section>

      <Card title="Detalle de citas filtradas">
        {medicalLoading ? (
          <ChartSkeleton heightClass="h-64" />
        ) : !medicalReport.appointments?.length ? (
          <EmptyState title="Sin citas en el filtro" description="Selecciona otro medico o rango para ver el detalle." compact />
        ) : (
          <AppointmentsTable rows={medicalReport.appointments} />
        )}
      </Card>

      <section className="mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Ingresos (6 meses)"
          value={formatCurrency(reports.total_revenue)}
          detail="total cobrado"
          tone="mint"
          icon={<CardIcon />}
          loading={loading}
        />
        <StatCard
          label="Total citas"
          value={reports.total_appointments}
          detail="registradas"
          tone="violet"
          icon={<CalendarIcon />}
          loading={loading}
        />
        <StatCard
          label="Medicos activos"
          value={reports.active_doctors}
          detail="con citas"
          tone="teal"
          icon={<TeamIcon />}
          loading={loading}
        />
        <StatCard
          label="Nuevos pacientes"
          value={reports.new_patients_total}
          detail="ultimos 6 meses"
          tone="rose"
          icon={<PatientIcon />}
          loading={loading}
        />
      </section>

      <section className="mb-6 grid gap-6 xl:grid-cols-[2fr_1fr]">
        <Card title="Ingresos por mes">
          <RevenueBars data={monthlyRevenue} loading={loading} />
        </Card>
        <Card title="Metodos de pago">
          <MethodsDonut data={paymentMethods} loading={loading} />
        </Card>
      </section>

      <section className="mb-6 grid gap-6 xl:grid-cols-[1.05fr_1fr]">
        <Card title="Estado de citas">
          <StatusBreakdown data={byStatus} loading={loading} />
        </Card>
        <Card title="Nuevos pacientes por mes">
          <PatientsTrend data={newPatients} loading={loading} />
        </Card>
      </section>

      <Card title="Medicos por volumen de citas">
        <TopDoctorsTable rows={topDoctors} loading={loading} />
      </Card>
    </AppShell>
  );
}

function Card({ title, children }) {
  return (
    <section className="app-surface overflow-hidden">
      <div className="border-b border-med-border px-6 py-5">
        <h2 className="text-[0.95rem] font-semibold text-med-ink">{title}</h2>
      </div>
      <div className="p-6">{children}</div>
    </section>
  );
}

function StatCard({ label, value, detail, tone, icon, loading }) {
  const tones = {
    mint: "bg-[rgba(128,237,153,0.18)] text-[#2fa84f]",
    violet: "bg-[rgba(94,96,206,0.10)] text-med-violet",
    teal: "bg-[rgba(78,168,222,0.14)] text-med-teal",
    rose: "bg-[rgba(247,37,133,0.14)] text-med-rose",
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
            {loading ? <span className="inline-block h-8 w-24 animate-pulse rounded-lg bg-med-bg" /> : value}
          </div>
          <div className="mt-2 text-sm text-med-ink-muted">{detail}</div>
        </div>
      </div>
    </div>
  );
}

function RevenueBars({ data, loading }) {
  if (loading) {
    return <ChartSkeleton heightClass="h-72" />;
  }

  if (!data.length) {
    return <EmptyState title="Sin ingresos aun" description="Los pagos cobrados apareceran aqui." />;
  }

  const maxRevenue = Math.max(...data.map((item) => Number(item.revenue) || 0), 1);

  return (
    <div className="grid h-72 grid-cols-1">
      <div className="flex h-full items-end gap-3 overflow-x-auto pb-1">
        {data.map((item) => {
          const amount = Number(item.revenue) || 0;
          const height = Math.max((amount / maxRevenue) * 100, 8);
          return (
            <div key={item.month} className="flex min-w-[86px] flex-1 flex-col justify-end">
              <div className="mb-2 text-center text-xs font-semibold text-med-violet">
                {formatCompactCurrency(amount)}
              </div>
              <div className="relative flex-1 rounded-t-2xl bg-[linear-gradient(180deg,rgba(94,96,206,0.15)_0%,rgba(94,96,206,0.05)_100%)]">
                <div
                  className="absolute inset-x-0 bottom-0 rounded-t-2xl bg-[linear-gradient(180deg,#7f81df_0%,#5E60CE_100%)]"
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

function MethodsDonut({ data, loading }) {
  if (loading) {
    return <ChartSkeleton heightClass="h-72" />;
  }

  if (!data.length) {
    return <EmptyState title="Sin cobros aun" description="Los metodos de pago apareceran aqui." />;
  }

  const total = data.reduce((sum, item) => sum + (Number(item.total) || 0), 0) || 1;
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="grid gap-6 lg:grid-cols-[220px_1fr] lg:items-center">
      <div className="flex justify-center">
        <div className="relative flex h-[180px] w-[180px] items-center justify-center">
          <svg className="h-[180px] w-[180px] -rotate-90" viewBox="0 0 140 140">
            <circle cx="70" cy="70" r={radius} fill="none" stroke="#E8EAF0" strokeWidth="16" />
            {data.map((item, index) => {
              const amount = Number(item.total) || 0;
              const segmentLength = circumference * (amount / total);
              const segment = (
                <circle
                  key={item.method}
                  cx="70"
                  cy="70"
                  r={radius}
                  fill="none"
                  stroke={METHOD_COLORS[index % METHOD_COLORS.length]}
                  strokeWidth="16"
                  strokeDasharray={`${segmentLength} ${circumference - segmentLength}`}
                  strokeDashoffset={-offset}
                />
              );
              offset += segmentLength;
              return segment;
            })}
          </svg>
          <div className="absolute text-center">
            <div className="text-[11px] uppercase tracking-[0.12em] text-med-ink-subtle">Cobrado</div>
            <div className="text-2xl font-bold tracking-[-0.03em] text-med-ink">{formatCompactCurrency(total)}</div>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {data.map((item, index) => {
          const amount = Number(item.total) || 0;
          const width = Math.max(Math.round((amount / total) * 100), 4);
          return (
            <div key={item.method}>
              <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
                <div className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: METHOD_COLORS[index % METHOD_COLORS.length] }}
                  />
                  <span className="font-medium text-med-ink">{item.method}</span>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-med-ink">{formatCurrency(amount)}</div>
                  <div className="text-xs text-med-ink-muted">{item.count} cobros</div>
                </div>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-med-bg">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${width}%`,
                    backgroundColor: METHOD_COLORS[index % METHOD_COLORS.length],
                  }}
                />
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
    return <ChartSkeleton heightClass="h-72" />;
  }

  if (!data.length) {
    return <EmptyState title="Sin estados aun" description="La distribucion de citas aparecera aqui." />;
  }

  const total = data.reduce((sum, item) => sum + (Number(item.count) || 0), 0) || 1;

  return (
    <div className="space-y-4">
      {data.map((item) => {
        const color = STATUS_COLORS[item.status] || "#5E60CE";
        const count = Number(item.count) || 0;
        const width = Math.max(Math.round((count / total) * 100), 4);
        return (
          <div key={item.status}>
            <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
              <span className="font-medium text-med-ink">{item.label}</span>
              <div className="text-right">
                <div className="font-semibold" style={{ color }}>
                  {count}
                </div>
                <div className="text-xs text-med-ink-muted">{Math.round((count / total) * 100)}%</div>
              </div>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-med-bg">
              <div className="h-full rounded-full" style={{ width: `${width}%`, backgroundColor: color }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PatientsTrend({ data, loading }) {
  if (loading) {
    return <ChartSkeleton heightClass="h-72" />;
  }

  if (!data.length) {
    return <EmptyState title="Sin crecimiento aun" description="Los nuevos pacientes apareceran aqui." />;
  }

  const width = 360;
  const height = 180;
  const paddingX = 24;
  const paddingY = 22;
  const baseY = height - paddingY;
  const maxValue = Math.max(...data.map((item) => Number(item.count) || 0), 1);
  const step = data.length > 1 ? (width - paddingX * 2) / (data.length - 1) : 0;
  const points = data.map((item, index) => {
    const count = Number(item.count) || 0;
    return {
      x: paddingX + step * index,
      y: baseY - (count / maxValue) * (height - paddingY * 2),
      count,
      label: item.month,
    };
  });
  const linePath = points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
  const areaPath = `M ${points[0].x} ${baseY} ${points.map((point) => `L ${point.x} ${point.y}`).join(" ")} L ${
    points[points.length - 1].x
  } ${baseY} Z`;

  return (
    <div>
      <div className="relative h-[220px] overflow-hidden rounded-[24px] bg-[linear-gradient(180deg,rgba(78,168,222,0.10)_0%,rgba(78,168,222,0.02)_100%)] px-3 pt-4">
        <svg className="h-full w-full" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
          {[0.25, 0.5, 0.75].map((ratio) => {
            const y = paddingY + (height - paddingY * 2) * ratio;
            return <line key={ratio} x1={paddingX} x2={width - paddingX} y1={y} y2={y} stroke="#DCE6EF" strokeDasharray="4 6" />;
          })}
          <path d={areaPath} fill="rgba(78,168,222,0.18)" />
          <path d={linePath} fill="none" stroke="#4EA8DE" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
          {points.map((point) => (
            <g key={`${point.label}-${point.count}`}>
              <circle cx={point.x} cy={point.y} r="5" fill="#4EA8DE" />
              <circle cx={point.x} cy={point.y} r="9" fill="rgba(78,168,222,0.14)" />
            </g>
          ))}
        </svg>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {points.map((point) => (
          <div key={point.label} className="rounded-2xl bg-med-bg px-3 py-3 text-center">
            <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-med-ink-subtle">
              {formatMonth(point.label)}
            </div>
            <div className="mt-1 text-lg font-bold tracking-[-0.02em] text-med-ink">{point.count}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TopDoctorsTable({ rows, loading }) {
  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="h-12 animate-pulse rounded-xl bg-med-bg" />
        ))}
      </div>
    );
  }

  if (!rows.length) {
    return <EmptyState title="Sin actividad aun" description="Los medicos con citas apareceran aqui." />;
  }

  return (
    <div className="-mx-6 overflow-x-auto">
      <table className="min-w-full border-separate border-spacing-0">
        <thead>
          <tr className="bg-med-bg">
            <TableHead>#</TableHead>
            <TableHead>Medico</TableHead>
            <TableHead>Especialidad</TableHead>
            <TableHead>Citas</TableHead>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.doctor_id || `${row.name}-${index}`} className="transition hover:bg-[#fafafe]">
              <TableCell className="font-semibold text-med-ink-muted">{index + 1}</TableCell>
              <TableCell>
                <div className="font-semibold text-med-ink">{row.name || "--"}</div>
              </TableCell>
              <TableCell>
                {row.specialty ? (
                  <span className="inline-flex rounded-full bg-[rgba(94,96,206,0.10)] px-3 py-1 text-xs font-semibold text-med-violet">
                    {row.specialty}
                  </span>
                ) : (
                  <span className="text-sm text-med-ink-subtle">--</span>
                )}
              </TableCell>
              <TableCell className="font-semibold text-med-violet">{row.count || 0}</TableCell>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AppointmentsTable({ rows }) {
  return (
    <div className="-mx-6 overflow-x-auto">
      <table className="min-w-full border-separate border-spacing-0">
        <thead>
          <tr className="bg-med-bg">
            <TableHead>Fecha</TableHead>
            <TableHead>Hora</TableHead>
            <TableHead>Medico</TableHead>
            <TableHead>Paciente</TableHead>
            <TableHead>Estado</TableHead>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="transition hover:bg-[#fafafe]">
              <TableCell>{row.appointment_date || "--"}</TableCell>
              <TableCell>{String(row.appointment_time || "--").slice(0, 5)}</TableCell>
              <TableCell>
                <div className="font-semibold text-med-ink">{row.doctor_name || "--"}</div>
                {row.doctor_specialty ? <div className="mt-1 text-xs text-med-ink-muted">{row.doctor_specialty}</div> : null}
              </TableCell>
              <TableCell>{row.patient_name || "--"}</TableCell>
              <TableCell>
                <span className={`status-pill status-${row.status || "pending"}`}>
                  {humanizeStatus(row.status)}
                </span>
              </TableCell>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AccessDeniedCard() {
  return (
    <section className="app-surface px-6 py-10">
      <div className="mx-auto max-w-[420px] text-center">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-med-bg text-med-ink-muted">
          <LockIcon className="h-7 w-7" />
        </div>
        <h1 className="text-lg font-semibold text-med-ink">Acceso restringido</h1>
        <p className="mt-2 text-sm leading-6 text-med-ink-muted">
          Este modulo solo esta disponible para usuarios con rol paciente, doctor, admin o staff.
        </p>
        <Link className="app-btn-violet mt-5 inline-flex" to="/dashboard">
          Volver al dashboard
        </Link>
      </div>
    </section>
  );
}

function EmptyState({ title, description }) {
  return (
    <div className="py-8 text-center text-med-ink-muted">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-med-bg text-med-ink-muted">
        <ReportIcon className="h-6 w-6" />
      </div>
      <div className="text-base font-semibold text-med-ink">{title}</div>
      <div className="mt-1 text-sm">{description}</div>
    </div>
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
  return <td className={`border-b border-med-border px-6 py-4 align-middle text-sm text-med-ink ${className}`}>{children}</td>;
}

function ChartSkeleton({ heightClass }) {
  return <div className={`${heightClass} animate-pulse rounded-2xl bg-med-bg`} />;
}

function buildReportQuery(filters) {
  const query = new URLSearchParams();
  if (filters.doctorId) {
    query.set("doctor_id", filters.doctorId);
  }
  if (filters.dateFrom) {
    query.set("date_from", filters.dateFrom);
  }
  if (filters.dateTo) {
    query.set("date_to", filters.dateTo);
  }
  return query.toString();
}

function formatDateRange(filters) {
  if (filters.dateFrom && filters.dateTo) {
    return ` entre ${filters.dateFrom} y ${filters.dateTo}`;
  }
  if (filters.dateFrom) {
    return ` desde ${filters.dateFrom}`;
  }
  if (filters.dateTo) {
    return ` hasta ${filters.dateTo}`;
  }
  return "";
}

function humanizeStatus(status) {
  const labels = {
    pending: "Pendiente",
    confirmed: "Confirmada",
    cancelled: "Cancelada",
    completed: "Atendida",
    no_show: "No asistida",
    rescheduled: "Reprogramada",
  };
  return labels[status] || status || "--";
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

function formatMonth(value) {
  if (!value) {
    return "--";
  }

  const date = new Date(`${value}-01T00:00:00`);
  return new Intl.DateTimeFormat("es-DO", { month: "short", year: "numeric" }).format(date);
}

function ExportIcon({ className }) {
  return (
    <Icon className={className}>
      <path d="M12 10v8" />
      <path d="m8 14 4 4 4-4" />
      <path d="M4 20h16" />
      <path d="M6 4h12" />
    </Icon>
  );
}

function CardIcon() {
  return (
    <Icon className="h-[22px] w-[22px]">
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="M2 10h20" />
    </Icon>
  );
}

function CalendarIcon() {
  return (
    <Icon className="h-[22px] w-[22px]">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M8 2v4" />
      <path d="M16 2v4" />
      <path d="M3 10h18" />
    </Icon>
  );
}

function TeamIcon() {
  return (
    <Icon className="h-[22px] w-[22px]">
      <path d="M17 20h5v-2a4 4 0 0 0-5-3.87" />
      <path d="M9 20H4v-2a4 4 0 0 1 5-3.87" />
      <path d="M9 16.13A4 4 0 1 0 13 8a4 4 0 0 0-4 8.13Z" />
    </Icon>
  );
}

function PatientIcon() {
  return (
    <Icon className="h-[22px] w-[22px]">
      <path d="M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z" />
      <path d="M12 14a7 7 0 0 0-7 7h14a7 7 0 0 0-7-7Z" />
    </Icon>
  );
}

function ReportIcon({ className = "h-[22px] w-[22px]" }) {
  return (
    <Icon className={className}>
      <path d="M4 19V11a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v8" />
      <path d="M10 19V7a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v12" />
      <path d="M16 19V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v15" />
    </Icon>
  );
}

function LockIcon({ className = "h-[22px] w-[22px]" }) {
  return (
    <Icon className={className}>
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 1 1 8 0v3" />
    </Icon>
  );
}
