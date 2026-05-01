import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import AppShell from "../components/app/AppShell";
import Icon from "../components/ui/Icon";
import { useAuth } from "../context/AuthContext";
import { getScheduleBootstrap, saveSchedule } from "../lib/schedule";

const WEEK_DAYS = ["Lunes", "Martes", "Miercoles", "Jueves", "Viernes", "Sabado", "Domingo"];
const SLOT_OPTIONS = [15, 20, 30, 45, 60];
const FIELD_CLASS = "w-full rounded-xl border border-med-border bg-white px-4 py-2.5 text-sm text-med-ink outline-none transition focus:border-med-violet focus:ring-4 focus:ring-[rgba(94,96,206,0.10)] disabled:cursor-not-allowed disabled:bg-med-bg disabled:text-med-ink-muted";

function buildHolidays(items = []) {
  return (Array.isArray(items) ? items : []).map((item, index) => ({
    id: `${item?.date || "holiday"}-${index}`,
    date: String(item?.date || "").slice(0, 10),
    label: String(item?.label || ""),
  }));
}

function buildWeek(days = []) {
  const byIndex = new Map(
    (Array.isArray(days) ? days : []).map((day) => [
      Number(day?.day_of_week ?? day?.index),
      day,
    ]),
  );

  return WEEK_DAYS.map((name, index) => {
    const day = byIndex.get(index) || {};
    return {
      day_of_week: index,
      index,
      name: day.name || name,
      is_weekend: day.is_weekend ?? index >= 5,
      is_active: Boolean(day.is_active),
      start_time: String(day.start_time || "08:00").slice(0, 5),
      end_time: String(day.end_time || "17:00").slice(0, 5),
      break_start: String(day.break_start || "").slice(0, 5),
      break_end: String(day.break_end || "").slice(0, 5),
      slot_duration: Number(day.slot_duration ?? day.slot ?? 30) || 30,
    };
  });
}

function timeToMinutes(value = "") {
  if (!value || !String(value).includes(":")) {
    return 0;
  }

  const [hour, minute] = String(value).split(":").map(Number);
  if (Number.isNaN(hour) || Number.isNaN(minute)) {
    return 0;
  }

  return hour * 60 + minute;
}

function countSlots(day) {
  if (!day?.is_active || !day.start_time || !day.end_time) {
    return 0;
  }

  const slotDuration = Number(day.slot_duration) || 30;
  const workStart = timeToMinutes(day.start_time);
  const workEnd = timeToMinutes(day.end_time);
  const totalMinutes = workEnd - workStart;

  if (totalMinutes <= 0) {
    return 0;
  }

  let breakMinutes = 0;
  if (day.break_start && day.break_end) {
    const breakStart = timeToMinutes(day.break_start);
    const breakEnd = timeToMinutes(day.break_end);
    if (breakEnd > breakStart) {
      const overlapStart = Math.max(workStart, breakStart);
      const overlapEnd = Math.min(workEnd, breakEnd);
      breakMinutes = Math.max(overlapEnd - overlapStart, 0);
    }
  }

  const availableMinutes = Math.max(totalMinutes - breakMinutes, 0);

  return availableMinutes > 0 ? Math.floor(availableMinutes / slotDuration) : 0;
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

export default function SchedulePage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [bootstrap, setBootstrap] = useState({
    role: "staff",
    doctor: null,
    doctors: [],
    days: buildWeek(),
    holidays: [],
  });
  const [days, setDays] = useState(buildWeek());
  const [holidays, setHolidays] = useState(buildHolidays());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  const selectedDoctorId = searchParams.get("doctor_id") || "";
  const canAccess = ["admin", "staff", "doctor"].includes(user?.role);
  const doctor = bootstrap.doctor || null;
  const activeDays = days.filter((day) => day.is_active).length;
  const totalSlots = days.reduce((sum, day) => sum + countSlots(day), 0);
  const averageDuration = activeDays
    ? Math.round(days.filter((day) => day.is_active).reduce((sum, day) => sum + (Number(day.slot_duration) || 0), 0) / activeDays)
    : 0;

  useEffect(() => {
    if (!canAccess) {
      setLoading(false);
      return undefined;
    }

    let active = true;

    async function loadSchedule() {
      setLoading(true);
      setError("");

      try {
        const payload = await getScheduleBootstrap(selectedDoctorId);
        if (!active) {
          return;
        }

        setBootstrap(payload || {});
        setDays(buildWeek(payload?.days));
        setHolidays(buildHolidays(payload?.holidays));
      } catch (err) {
        if (active) {
          setError(err.message || "No fue posible cargar los horarios.");
          setBootstrap((current) => ({ ...current, doctor: null, days: buildWeek(), holidays: [] }));
          setDays(buildWeek());
          setHolidays(buildHolidays());
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadSchedule();

    return () => {
      active = false;
    };
  }, [canAccess, selectedDoctorId]);

  useEffect(() => {
    if (!toast) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => setToast(""), 3200);
    return () => window.clearTimeout(timeoutId);
  }, [toast]);

  function updateDay(dayIndex, updates) {
    setDays((current) => current.map((day) => (
      day.day_of_week === dayIndex ? { ...day, ...updates } : day
    )));
  }

  function addHoliday() {
    setHolidays((current) => [
      ...current,
      { id: `holiday-${Date.now()}-${current.length}`, date: "", label: "" },
    ]);
  }

  function updateHoliday(holidayId, updates) {
    setHolidays((current) => current.map((holiday) => (
      holiday.id === holidayId ? { ...holiday, ...updates } : holiday
    )));
  }

  function removeHoliday(holidayId) {
    setHolidays((current) => current.filter((holiday) => holiday.id !== holidayId));
  }

  function handleDoctorChange(event) {
    const value = event.target.value;
    setError("");
    setToast("");
    setSearchParams(value ? { doctor_id: value } : {});
  }

  async function handleSave(event) {
    event.preventDefault();
    if (!doctor) {
      setError("Selecciona un medico antes de guardar el horario.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const result = await saveSchedule({
        doctorId: doctor.id,
        days: days.map((day) => ({
          day_of_week: day.day_of_week,
          is_active: day.is_active,
          start_time: day.start_time,
          end_time: day.end_time,
          break_start: day.break_start,
          break_end: day.break_end,
          slot_duration: day.slot_duration,
        })),
        holidays: holidays
          .filter((holiday) => holiday.date || holiday.label)
          .map((holiday) => ({
            date: holiday.date,
            label: holiday.label,
          })),
      });

      setBootstrap(result?.payload || {});
      setDays(buildWeek(result?.payload?.days));
      setHolidays(buildHolidays(result?.payload?.holidays));
      setToast(result?.message || "Horario guardado correctamente.");
    } catch (err) {
      setError(err.message || "No fue posible guardar el horario.");
    } finally {
      setSaving(false);
    }
  }

  if (!canAccess) {
    return (
      <AppShell pageTitle="Horarios" activePage="schedule">
        <AccessDeniedCard />
      </AppShell>
    );
  }

  return (
    <AppShell pageTitle="Horarios" activePage="schedule">
      <section className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-[1.45rem] font-bold tracking-[-0.02em] text-med-ink">Gestion de horarios</h1>
          <p className="mt-1 text-sm text-med-ink-muted">Configura jornada, descansos y fechas bloqueadas por medico sin mover la logica de Flask.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link className="app-btn-ghost" to={user?.role === "doctor" ? "/dashboard" : "/doctors"}>
            Volver
          </Link>
          <button
            type="submit"
            form="schedule-form"
            className="app-btn-violet"
            disabled={loading || saving || !doctor}
          >
            <SaveIcon className="h-4 w-4" />
            {saving ? "Guardando..." : "Guardar horario"}
          </button>
        </div>
      </section>

      {error ? (
        <div className="mb-6 rounded-2xl border border-[rgba(247,37,133,0.22)] bg-[rgba(247,37,133,0.08)] px-4 py-3 text-sm text-[#c0185a]">
          {error}
        </div>
      ) : null}

      {["admin", "staff"].includes(user?.role) ? (
        <section className="app-surface mb-6 px-6 py-6">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px] lg:items-end">
            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-med-ink-muted">Medico</div>
              <select className={FIELD_CLASS} value={selectedDoctorId} onChange={handleDoctorChange} disabled={loading || saving}>
                <option value="">Seleccionar medico...</option>
                {bootstrap.doctors?.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.full_name} {item.specialty ? `- ${item.specialty}` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="rounded-2xl bg-med-bg px-4 py-4 text-sm text-med-ink-muted">
              El horario semanal, los descansos y las fechas bloqueadas impactan la disponibilidad usada por el sistema de citas.
            </div>
          </div>
        </section>
      ) : null}

      {!loading && !doctor ? (
        <EmptySelectionCard role={user?.role} />
      ) : (
        <form id="schedule-form" onSubmit={handleSave}>
          <section className="app-surface mb-6 overflow-hidden">
            <div className="flex flex-col gap-4 px-6 py-6 sm:flex-row sm:items-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[rgba(94,96,206,0.12)] text-base font-bold text-med-violet">
                {doctor ? getInitials(doctor.full_name) : "DR"}
              </div>
              <div>
                <div className="text-lg font-semibold tracking-[-0.02em] text-med-ink">{doctor?.full_name || "Sin medico seleccionado"}</div>
                <div className="mt-1 text-sm text-med-ink-muted">{doctor?.specialty || "Sin especialidad registrada"}</div>
              </div>
              <div className="sm:ml-auto">
                <span className="inline-flex rounded-full bg-[rgba(94,96,206,0.08)] px-3 py-1 text-xs font-semibold text-med-violet">
                  Configurando horario
                </span>
              </div>
            </div>
          </section>

          <section className="mb-6 grid gap-4 md:grid-cols-3">
            <SummaryCard
              label="Dias activos"
              value={loading ? "--" : activeDays}
              detail="semanales"
              tone="violet"
              icon={<CalendarIcon />}
            />
            <SummaryCard
              label="Slots estimados"
              value={loading ? "--" : totalSlots}
              detail="por semana"
              tone="teal"
              icon={<SlotsIcon />}
            />
            <SummaryCard
              label="Duracion media"
              value={loading ? "--" : `${averageDuration || 0} min`}
              detail="por cita"
              tone="mint"
              icon={<ClockIcon />}
            />
          </section>

          <section className="app-surface overflow-hidden">
            <div className="flex items-center justify-between gap-4 border-b border-med-border px-6 py-5">
              <div>
                <h2 className="text-[0.95rem] font-semibold text-med-ink">Dias de atencion</h2>
                <p className="mt-1 text-sm text-med-ink-muted">Activa los dias de trabajo, define la jornada y reserva un bloque de descanso si aplica.</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full border-separate border-spacing-0">
                <thead>
                  <tr className="bg-med-bg">
                    <TableHead>Activo</TableHead>
                    <TableHead>Dia</TableHead>
                    <TableHead>Hora inicio</TableHead>
                    <TableHead>Hora fin</TableHead>
                    <TableHead>Descanso inicio</TableHead>
                    <TableHead>Descanso fin</TableHead>
                    <TableHead>Duracion</TableHead>
                    <TableHead>Slots</TableHead>
                  </tr>
                </thead>
                <tbody>
                  {days.map((day) => {
                    const slotCount = countSlots(day);
                    return (
                      <tr key={day.day_of_week} className={`transition hover:bg-[#fafafe] ${day.is_active ? "" : "opacity-70"}`}>
                        <TableCell className="text-center">
                          <input
                            type="checkbox"
                            checked={day.is_active}
                            onChange={(event) => updateDay(day.day_of_week, event.target.checked
                              ? { is_active: true }
                              : { is_active: false, break_start: "", break_end: "" })}
                            className="h-4 w-4 cursor-pointer rounded border-med-border text-med-violet focus:ring-med-violet"
                            disabled={saving}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="font-semibold text-med-ink">{day.name}</div>
                          <div className="mt-1">
                            <span className={`inline-flex rounded-full px-3 py-1 text-[11px] font-semibold ${day.is_weekend ? "bg-[rgba(78,168,222,0.14)] text-med-teal" : "bg-[rgba(94,96,206,0.10)] text-med-violet"}`}>
                              {day.is_weekend ? "Fin de semana" : "Laboral"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <input
                            className={FIELD_CLASS}
                            type="time"
                            value={day.start_time}
                            onChange={(event) => updateDay(day.day_of_week, { start_time: event.target.value })}
                            disabled={!day.is_active || saving}
                          />
                        </TableCell>
                        <TableCell>
                          <input
                            className={FIELD_CLASS}
                            type="time"
                            value={day.end_time}
                            onChange={(event) => updateDay(day.day_of_week, { end_time: event.target.value })}
                            disabled={!day.is_active || saving}
                          />
                        </TableCell>
                        <TableCell>
                          <input
                            className={FIELD_CLASS}
                            type="time"
                            value={day.break_start}
                            onChange={(event) => updateDay(day.day_of_week, { break_start: event.target.value })}
                            disabled={!day.is_active || saving}
                          />
                        </TableCell>
                        <TableCell>
                          <input
                            className={FIELD_CLASS}
                            type="time"
                            value={day.break_end}
                            onChange={(event) => updateDay(day.day_of_week, { break_end: event.target.value })}
                            disabled={!day.is_active || saving}
                          />
                        </TableCell>
                        <TableCell>
                          <select
                            className={FIELD_CLASS}
                            value={day.slot_duration}
                            onChange={(event) => updateDay(day.day_of_week, { slot_duration: Number(event.target.value) })}
                            disabled={!day.is_active || saving}
                          >
                            {SLOT_OPTIONS.map((minutes) => (
                              <option key={minutes} value={minutes}>
                                {minutes} minutos
                              </option>
                            ))}
                          </select>
                        </TableCell>
                        <TableCell>
                          <div className="font-semibold text-med-violet">{day.is_active ? `${slotCount} slots` : "--"}</div>
                        </TableCell>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="border-t border-med-border px-6 py-5 text-sm text-med-ink-muted">
              Los cambios se guardan en Flask y se usan para calcular disponibilidad real, omitiendo descansos y dias bloqueados.
            </div>
          </section>

          <section className="app-surface mt-6 overflow-hidden">
            <div className="flex flex-col gap-4 border-b border-med-border px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-[0.95rem] font-semibold text-med-ink">Feriados y fechas bloqueadas</h2>
                <p className="mt-1 text-sm text-med-ink-muted">Bloquea dias puntuales como feriados, vacaciones o ausencias del medico.</p>
              </div>
              <button type="button" className="app-btn-ghost" onClick={addHoliday} disabled={saving || !doctor}>
                Agregar fecha
              </button>
            </div>

            <div className="space-y-4 px-6 py-6">
              {holidays.length ? (
                holidays.map((holiday) => (
                  <div key={holiday.id} className="grid gap-4 rounded-2xl border border-med-border bg-white p-4 md:grid-cols-[180px_minmax(0,1fr)_auto] md:items-end">
                    <div>
                      <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.08em] text-med-ink-muted">Fecha</label>
                      <input
                        className={FIELD_CLASS}
                        type="date"
                        value={holiday.date}
                        onChange={(event) => updateHoliday(holiday.id, { date: event.target.value })}
                        disabled={saving}
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.08em] text-med-ink-muted">Motivo</label>
                      <input
                        className={FIELD_CLASS}
                        type="text"
                        value={holiday.label}
                        placeholder="Ej. feriado nacional, vacaciones, congreso..."
                        onChange={(event) => updateHoliday(holiday.id, { label: event.target.value })}
                        disabled={saving}
                      />
                    </div>
                    <button type="button" className="app-btn-ghost justify-center" onClick={() => removeHoliday(holiday.id)} disabled={saving}>
                      Quitar
                    </button>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl bg-med-bg px-4 py-4 text-sm text-med-ink-muted">
                  No hay fechas bloqueadas registradas. Puedes agregar feriados, ausencias o vacaciones del medico.
                </div>
              )}
            </div>
          </section>
        </form>
      )}

      {toast ? (
        <div className="pointer-events-none fixed bottom-6 right-6 z-[100]">
          <div className="rounded-xl border border-[rgba(128,237,153,0.35)] bg-white px-4 py-3 text-sm font-medium text-[#1f7a3a] shadow-lg">
            {toast}
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}

function SummaryCard({ label, value, detail, tone, icon }) {
  const tones = {
    violet: "bg-[rgba(94,96,206,0.10)] text-med-violet",
    teal: "bg-[rgba(78,168,222,0.14)] text-med-teal",
    mint: "bg-[rgba(128,237,153,0.18)] text-[#2fa84f]",
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

function EmptySelectionCard({ role }) {
  const isDoctor = role === "doctor";

  return (
    <section className="app-surface px-6 py-10">
      <div className="mx-auto max-w-[420px] text-center">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-med-bg text-med-ink-muted">
          {isDoctor ? <DoctorIcon className="h-7 w-7" /> : <CalendarIcon className="h-7 w-7" />}
        </div>
        <h2 className="text-lg font-semibold text-med-ink">
          {isDoctor ? "Perfil medico no disponible" : "Selecciona un medico"}
        </h2>
        <p className="mt-2 text-sm leading-6 text-med-ink-muted">
          {isDoctor
            ? "No se encontro tu perfil de medico para cargar el horario semanal."
            : "Elige un medico del selector superior para configurar su disponibilidad."}
        </p>
      </div>
    </section>
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
          Este modulo solo esta disponible para usuarios con rol admin, staff o doctor.
        </p>
        <Link className="app-btn-violet mt-5 inline-flex" to="/dashboard">
          Volver al dashboard
        </Link>
      </div>
    </section>
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

function SaveIcon({ className }) {
  return (
    <Icon className={className}>
      <path d="M5 13l4 4L19 7" />
    </Icon>
  );
}

function CalendarIcon({ className = "h-[22px] w-[22px]" }) {
  return (
    <Icon className={className}>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M8 2v4" />
      <path d="M16 2v4" />
      <path d="M3 10h18" />
    </Icon>
  );
}

function SlotsIcon() {
  return (
    <Icon className="h-[22px] w-[22px]">
      <path d="M4 7h16" />
      <path d="M4 12h16" />
      <path d="M4 17h10" />
    </Icon>
  );
}

function ClockIcon() {
  return (
    <Icon className="h-[22px] w-[22px]">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6" />
      <path d="m12 12 4 2" />
    </Icon>
  );
}

function DoctorIcon({ className = "h-[22px] w-[22px]" }) {
  return (
    <Icon className={className}>
      <path d="M17 20h5v-2a4 4 0 0 0-5-3.87" />
      <path d="M9 20H4v-2a4 4 0 0 1 5-3.87" />
      <path d="M9 16.13A4 4 0 1 0 13 8a4 4 0 0 0-4 8.13Z" />
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
