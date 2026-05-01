import { useEffect, useRef, useState } from "react";
import AppShell from "../components/app/AppShell";
import Icon from "../components/ui/Icon";
import {
  cancelAgendaAppointment,
  createAgendaAppointment,
  getAgendaBootstrap,
  getAgendaEvents,
  getAgendaSlots,
  rescheduleAgendaAppointment,
  updateAgendaAppointment,
} from "../lib/agenda";

const STATUS_OPTIONS = [
  { value: "pending", label: "Pendiente", chipClass: "bg-[rgba(255,209,102,0.22)] text-[#8a6200]" },
  { value: "confirmed", label: "Confirmada", chipClass: "bg-[rgba(128,237,153,0.18)] text-[#1f7a3a]" },
  { value: "completed", label: "Atendida", chipClass: "bg-[rgba(78,168,222,0.15)] text-[#236c96]" },
  { value: "no_show", label: "No asistida", chipClass: "bg-[rgba(173,181,189,0.22)] text-[#5c6770]" },
  { value: "cancelled", label: "Cancelada", chipClass: "bg-[rgba(247,37,133,0.14)] text-[#c0105e]" },
  { value: "rescheduled", label: "Reprogramada", chipClass: "bg-[rgba(78,168,222,0.15)] text-[#236c96]" },
];

const EDITABLE_STATUS_OPTIONS = STATUS_OPTIONS.filter((option) => option.value !== "cancelled");

const EMPTY_FORM = {
  patient_id: "",
  doctor_id: "",
  appointment_date: "",
  appointment_time: "",
  duration_minutes: "30",
  status: "pending",
  notes: "",
  virtual_link: "",
};

function getStatusBadgeClass(status) {
  return `status-pill status-${status || "pending"}`;
}

function getStatusOption(status) {
  return STATUS_OPTIONS.find((option) => option.value === status) || null;
}

function humanizeAppointmentStatus(status) {
  return getStatusOption(status)?.label || status || "--";
}

function getEditableStatusOptions(currentStatus) {
  const currentOption = getStatusOption(currentStatus);
  if (currentOption && !EDITABLE_STATUS_OPTIONS.some((option) => option.value === currentOption.value)) {
    return [...EDITABLE_STATUS_OPTIONS, currentOption];
  }
  return EDITABLE_STATUS_OPTIONS;
}

function formatDateLocal(value) {
  const date = value instanceof Date ? value : new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatTimeLocal(date) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function sortSlots(slots) {
  return [...slots].sort((left, right) => left.localeCompare(right));
}

export default function AgendaPage() {
  const calendarContainerRef = useRef(null);
  const calendarRef = useRef(null);
  const filtersRef = useRef({ doctorId: "", specialty: "", statuses: [] });

  const [bootstrap, setBootstrap] = useState(null);
  const [loadingBootstrap, setLoadingBootstrap] = useState(true);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({ doctorId: "", specialty: "", statuses: [] });
  const [modal, setModal] = useState({ open: false, mode: "create" });
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [slots, setSlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [cancellationReason, setCancellationReason] = useState("");
  const [toast, setToast] = useState(null);

  useEffect(() => {
    let active = true;

    async function loadBootstrap() {
      setLoadingBootstrap(true);
      setError("");

      try {
        const data = await getAgendaBootstrap();
        if (!active) {
          return;
        }

        setBootstrap(data);
        setFilters({
          doctorId: data.current_doctor_id ? String(data.current_doctor_id) : "",
          specialty: "",
          statuses: [],
        });
      } catch (err) {
        if (active) {
          setError(err.message || "No fue posible cargar la agenda.");
        }
      } finally {
        if (active) {
          setLoadingBootstrap(false);
        }
      }
    }

    loadBootstrap();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    filtersRef.current = filters;
    if (calendarRef.current) {
      calendarRef.current.refetchEvents();
    }
  }, [filters]);

  useEffect(() => {
    if (!bootstrap || !calendarContainerRef.current || calendarRef.current) {
      return undefined;
    }

    const CalendarCtor = window.FullCalendar?.Calendar;

    if (!CalendarCtor) {
      setError("No se pudo cargar el calendario. Revisa la conexion con el CDN actual.");
      return undefined;
    }

    const calendar = new CalendarCtor(calendarContainerRef.current, {
      initialView: "dayGridMonth",
      locale: "es",
      firstDay: 1,
      height: "auto",
      nowIndicator: true,
      editable: true,
      selectable: true,
      headerToolbar: {
        left: "prev,next today",
        center: "title",
        right: "dayGridMonth,timeGridWeek,timeGridDay",
      },
      buttonText: {
        today: "Hoy",
        month: "Mes",
        week: "Semana",
        day: "Dia",
      },
      eventTimeFormat: {
        hour: "2-digit",
        minute: "2-digit",
        meridiem: false,
      },
      events: async (info, successCallback, failureCallback) => {
        try {
          const params = new URLSearchParams({
            start: info.startStr,
            end: info.endStr,
          });

          if (filtersRef.current.doctorId) {
            params.set("doctor_id", filtersRef.current.doctorId);
          }

          if (filtersRef.current.specialty) {
            params.set("specialty", filtersRef.current.specialty);
          }

          let events = await getAgendaEvents(params);
          if (filtersRef.current.statuses.length > 0) {
            events = events.filter((event) => filtersRef.current.statuses.includes(event.extendedProps?.status));
          }

          successCallback(events);
        } catch (err) {
          setError(err.message || "No fue posible cargar los eventos.");
          failureCallback(err);
        }
      },
      eventClick: (info) => {
        const appointment = normalizeCalendarEvent(info.event);
        setSelectedAppointment(appointment);
        setCancellationReason(appointment.cancellation_reason || "");
        setModal({ open: true, mode: "view" });
      },
      dateClick: (info) => {
        openCreateModal(info.dateStr.slice(0, 10));
      },
      eventDrop: async (info) => {
        const appointmentId = info.event.extendedProps?.appointment_id;
        const appointmentDate = formatDateLocal(info.event.start);
        const appointmentTime = formatTimeLocal(info.event.start);

        try {
          await rescheduleAgendaAppointment(appointmentId, {
            appointment_date: appointmentDate,
            appointment_time: appointmentTime,
          });
          showToast("Cita reprogramada.", "success");
          info.event.setExtendedProp("appointment_date", appointmentDate);
          info.event.setExtendedProp("appointment_time", appointmentTime);
        } catch (err) {
          info.revert();
          showToast(err.message || "No se pudo reprogramar la cita.", "error");
        }
      },
    });

    calendar.render();
    calendarRef.current = calendar;

    return () => {
      calendar.destroy();
      calendarRef.current = null;
    };
  }, [bootstrap]);

  useEffect(() => {
    if (!modal.open || modal.mode === "view" || !form.doctor_id || !form.appointment_date) {
      setSlots([]);
      return undefined;
    }

    let active = true;
    setSlotsLoading(true);

    getAgendaSlots(form.doctor_id, form.appointment_date)
      .then((result) => {
        if (!active) {
          return;
        }

        const nextSlots = result || [];
        const isEditingCurrentSelection =
          modal.mode === "edit" &&
          selectedAppointment &&
          String(selectedAppointment.doctor_id || "") === String(form.doctor_id) &&
          (selectedAppointment.appointment_date || "") === form.appointment_date &&
          (selectedAppointment.appointment_time || "") === form.appointment_time;

        if (form.appointment_time && !nextSlots.includes(form.appointment_time) && isEditingCurrentSelection) {
          setSlots(sortSlots([...nextSlots, form.appointment_time]));
        } else {
          setSlots(sortSlots(nextSlots));
          if (form.appointment_time && !nextSlots.includes(form.appointment_time)) {
            setForm((current) => ({ ...current, appointment_time: "" }));
          }
        }
      })
      .catch(() => {
        if (active) {
          setSlots([]);
          setForm((current) => ({ ...current, appointment_time: "" }));
        }
      })
      .finally(() => {
        if (active) {
          setSlotsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [form.appointment_date, form.appointment_time, form.doctor_id, modal.mode, modal.open]);

  useEffect(() => {
    if (!toast) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(timeoutId);
  }, [toast]);

  function showToast(message, type = "success") {
    setToast({ message, type });
  }

  function refetchCalendar() {
    if (calendarRef.current) {
      calendarRef.current.refetchEvents();
    }
  }

  function openCreateModal(date = "") {
    setSelectedAppointment(null);
    setCancellationReason("");
    setModal({ open: true, mode: "create" });
    setForm({
      patient_id: bootstrap?.current_patient_id ? String(bootstrap.current_patient_id) : "",
      doctor_id: bootstrap?.current_doctor_id ? String(bootstrap.current_doctor_id) : "",
      appointment_date: date,
      appointment_time: "",
      duration_minutes: "30",
      status: "pending",
      notes: "",
      virtual_link: "",
    });
  }

  function switchToEditMode() {
    if (!selectedAppointment) {
      return;
    }

    setCancellationReason(selectedAppointment.cancellation_reason || "");
    setForm({
      patient_id: selectedAppointment.patient_id ? String(selectedAppointment.patient_id) : "",
      doctor_id: selectedAppointment.doctor_id ? String(selectedAppointment.doctor_id) : "",
      appointment_date: selectedAppointment.appointment_date || "",
      appointment_time: selectedAppointment.appointment_time || "",
      duration_minutes: String(selectedAppointment.duration_minutes || 30),
      status: selectedAppointment.status || "pending",
      notes: selectedAppointment.notes || selectedAppointment.reason || "",
      virtual_link: selectedAppointment.virtual_link || "",
    });
    setModal({ open: true, mode: "edit" });
  }

  function closeModal() {
    setModal({ open: false, mode: "create" });
    setSelectedAppointment(null);
    setCancellationReason("");
    setForm(EMPTY_FORM);
    setSlots([]);
    setSaving(false);
  }

  function buildAppointmentPayload(appointment, overrides = {}) {
    return {
      patient_id: appointment.patient_id ? Number(appointment.patient_id) : undefined,
      doctor_id: Number(appointment.doctor_id),
      appointment_date: appointment.appointment_date,
      appointment_time: appointment.appointment_time,
      duration_minutes: Number(appointment.duration_minutes || 30),
      status: appointment.status || "pending",
      notes: appointment.notes || appointment.reason || "",
      virtual_link: appointment.virtual_link || null,
      ...overrides,
    };
  }

  async function saveAppointment() {
    if (!form.doctor_id || !form.appointment_date || !form.appointment_time) {
      showToast("Completa todos los campos requeridos.", "error");
      return;
    }

    if (bootstrap?.role !== "paciente" && !form.patient_id) {
      showToast("Selecciona un paciente.", "error");
      return;
    }

    const payload = {
      patient_id: form.patient_id ? Number(form.patient_id) : undefined,
      doctor_id: Number(form.doctor_id),
      appointment_date: form.appointment_date,
      appointment_time: form.appointment_time,
      duration_minutes: Number(form.duration_minutes || 30),
      status: form.status,
      notes: form.notes,
      virtual_link: form.virtual_link || null,
    };

    setSaving(true);
    try {
      if (modal.mode === "edit" && selectedAppointment) {
        await updateAgendaAppointment(selectedAppointment.id, payload);
        showToast("Cita actualizada correctamente.", "success");
      } else {
        await createAgendaAppointment(payload);
        showToast("Cita creada correctamente.", "success");
      }

      closeModal();
      refetchCalendar();
    } catch (err) {
      showToast(err.message || "No fue posible guardar la cita.", "error");
      setSaving(false);
    }
  }

  async function cancelCurrentAppointment() {
    if (!selectedAppointment) {
      return;
    }

    const reason = cancellationReason.trim();
    if (!reason) {
      showToast("Debes indicar el motivo de cancelacion.", "error");
      return;
    }

    setSaving(true);
    try {
      await cancelAgendaAppointment(selectedAppointment.id, reason);
      setSelectedAppointment((current) =>
        current
          ? {
              ...current,
              status: "cancelled",
              cancellation_reason: reason,
            }
          : current,
      );
      showToast("Cita cancelada.", "info");
      refetchCalendar();
    } catch (err) {
      showToast(err.message || "No fue posible cancelar la cita.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function updateCurrentAppointmentStatus(status) {
    if (!selectedAppointment) {
      return;
    }

    setSaving(true);
    try {
      await updateAgendaAppointment(selectedAppointment.id, buildAppointmentPayload(selectedAppointment, { status }));
      setSelectedAppointment((current) =>
        current
          ? {
              ...current,
              status,
              cancellation_reason: status === "cancelled" ? current.cancellation_reason : "",
            }
          : current,
      );
      if (status !== "cancelled") {
        setCancellationReason("");
      }
      showToast(`Cita marcada como ${humanizeAppointmentStatus(status).toLowerCase()}.`, "success");
      refetchCalendar();
    } catch (err) {
      showToast(err.message || "No fue posible actualizar el estado de la cita.", "error");
    } finally {
      setSaving(false);
    }
  }

  function normalizeCalendarEvent(event) {
    const props = event.extendedProps || {};
    return {
      id: props.appointment_id || event.id,
      title: event.title,
      status: props.status,
      doctor: props.doctor,
      specialty: props.specialty,
      patient: props.patient,
      phone: props.phone,
      notes: props.notes,
      reason: props.reason,
      patient_id: props.patient_id,
      doctor_id: props.doctor_id,
      duration_minutes: props.duration_minutes,
      appointment_date: props.appointment_date,
      appointment_time: props.appointment_time,
      virtual_link: props.virtual_link,
      cancellation_reason: props.cancellation_reason,
    };
  }

  const doctors = bootstrap?.doctors || [];
  const patients = bootstrap?.patients || [];
  const specialties = bootstrap?.specialties || [];

  return (
    <AppShell pageTitle="Agenda" activePage="agenda">
      <section className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-[1.45rem] font-bold tracking-[-0.02em] text-med-ink">Agenda</h1>
          <p className="mt-1 text-sm text-med-ink-muted">Gestion de citas y disponibilidad.</p>
        </div>
        <button type="button" className="app-btn-violet justify-center" onClick={() => openCreateModal()}>
          <Icon className="h-4 w-4">
            <path d="M12 5v14" />
            <path d="M5 12h14" />
          </Icon>
          Nueva cita
        </button>
      </section>

      {error ? (
        <div className="mb-6 rounded-2xl border border-[rgba(247,37,133,0.22)] bg-[rgba(247,37,133,0.08)] px-4 py-3 text-sm text-[#c0185a]">
          {error}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="space-y-4 lg:sticky lg:top-[84px] lg:self-start">
          <section className="app-surface overflow-hidden">
            <div className="border-b border-med-border px-5 py-4">
              <h2 className="text-sm font-semibold text-med-ink">Filtros</h2>
            </div>
            <div className="space-y-4 px-5 py-5">
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.08em] text-med-ink-muted">Medico</label>
                <select
                  className="med-input px-4 py-3"
                  value={filters.doctorId}
                  disabled={loadingBootstrap || bootstrap?.role === "doctor"}
                  onChange={(event) => setFilters((current) => ({ ...current, doctorId: event.target.value }))}
                >
                  <option value="">Todos los medicos</option>
                  {doctors.map((doctor) => (
                    <option key={doctor.id} value={doctor.id}>
                      Dr. {doctor.full_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.08em] text-med-ink-muted">Especialidad</label>
                <select
                  className="med-input px-4 py-3"
                  value={filters.specialty}
                  onChange={(event) => setFilters((current) => ({ ...current, specialty: event.target.value }))}
                >
                  <option value="">Todas</option>
                  {specialties.map((specialty) => (
                    <option key={specialty} value={specialty}>
                      {specialty}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="mb-2 block text-xs font-semibold uppercase tracking-[0.08em] text-med-ink-muted">Estado</div>
                <div className="flex flex-wrap gap-2">
                  {STATUS_OPTIONS.map((status) => {
                    const active = filters.statuses.includes(status.value);
                    return (
                      <button
                        key={status.value}
                        type="button"
                        onClick={() => {
                          setFilters((current) => ({
                            ...current,
                            statuses: current.statuses.includes(status.value)
                              ? current.statuses.filter((item) => item !== status.value)
                              : [...current.statuses, status.value],
                          }));
                        }}
                        className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold transition ${status.chipClass} ${active ? "border-current" : "border-transparent"}`}
                      >
                        {status.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>

          <section className="app-surface overflow-hidden">
            <div className="border-b border-med-border px-5 py-4">
              <h2 className="text-sm font-semibold text-med-ink">Leyenda</h2>
            </div>
            <div className="space-y-3 px-5 py-5 text-sm text-med-ink-muted">
              {STATUS_OPTIONS.map((status) => (
                <div key={status.value} className="flex items-center gap-3">
                  <span className={`h-2.5 w-2.5 rounded-full ${status.chipClass.split(" ")[0]}`} />
                  <span>{status.label}</span>
                </div>
              ))}
            </div>
          </section>
        </aside>

        <section className="agenda-calendar-shell app-surface overflow-hidden">
          {loadingBootstrap ? (
            <div className="h-[720px] animate-pulse bg-med-bg" />
          ) : (
            <div ref={calendarContainerRef} className="min-h-[720px]" />
          )}
        </section>
      </div>

      {modal.open ? (
        <AgendaModal
          mode={modal.mode}
          bootstrap={bootstrap}
          form={form}
          patients={patients}
          doctors={doctors}
          selectedAppointment={selectedAppointment}
          saving={saving}
          slots={slots}
          slotsLoading={slotsLoading}
          cancellationReason={cancellationReason}
          onChange={setForm}
          onCancellationReasonChange={setCancellationReason}
          onClose={closeModal}
          onSave={saveAppointment}
          onCancelAppointment={cancelCurrentAppointment}
          onQuickStatusChange={updateCurrentAppointmentStatus}
          onSwitchToEdit={switchToEditMode}
        />
      ) : null}

      {toast ? (
        <div className="pointer-events-none fixed bottom-6 right-6 z-[100]">
          <div
            className={`rounded-xl border px-4 py-3 text-sm font-medium shadow-lg ${
              toast.type === "error"
                ? "border-[rgba(247,37,133,0.25)] bg-white text-[#c0185a]"
                : toast.type === "info"
                  ? "border-[rgba(78,168,222,0.3)] bg-white text-med-teal"
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

function AgendaModal({
  mode,
  bootstrap,
  form,
  patients,
  doctors,
  selectedAppointment,
  saving,
  slots,
  slotsLoading,
  cancellationReason,
  onChange,
  onCancellationReasonChange,
  onClose,
  onSave,
  onCancelAppointment,
  onQuickStatusChange,
  onSwitchToEdit,
}) {
  const readOnlyDoctor = bootstrap?.role === "doctor";
  const readOnlyPatient = bootstrap?.role === "paciente";
  const editableStatuses = getEditableStatusOptions(form.status);

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-med-ink/35 px-4 py-8" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-[560px] overflow-y-auto rounded-[20px] bg-white shadow-[0_24px_64px_rgba(0,0,0,0.18)]" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-med-border px-6 py-5">
          <div className="text-lg font-semibold text-med-ink">
            {mode === "view" ? "Detalle de la cita" : mode === "edit" ? "Editar cita" : "Nueva cita"}
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-med-ink-muted transition hover:bg-med-bg hover:text-med-ink">
            <Icon className="h-4 w-4">
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </Icon>
          </button>
        </div>

        {mode === "view" ? (
          <div className="space-y-5 px-6 py-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <DetailField label="Paciente" value={selectedAppointment?.patient || "--"} emphasis />
              <DetailField label="Medico" value={selectedAppointment?.doctor ? `Dr. ${selectedAppointment.doctor}` : "--"} emphasis />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <DetailField label="Especialidad" value={selectedAppointment?.specialty || "--"} />
              <div>
                <div className="mb-1 text-xs font-semibold uppercase tracking-[0.08em] text-med-ink-muted">Estado</div>
                <span className={getStatusBadgeClass(selectedAppointment?.status)}>{humanizeAppointmentStatus(selectedAppointment?.status)}</span>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <DetailField label="Fecha" value={selectedAppointment?.appointment_date || "--"} />
              <DetailField label="Hora" value={selectedAppointment?.appointment_time || "--"} />
            </div>
            {selectedAppointment?.status !== "cancelled" ? (
              <div className="rounded-2xl border border-med-border bg-med-bg px-4 py-4">
                <div className="mb-3 text-xs font-semibold uppercase tracking-[0.08em] text-med-ink-muted">Cambiar estado rapido</div>
                <div className="flex flex-wrap gap-2">
                  {["confirmed", "completed", "no_show"].map((status) => (
                    <button
                      key={status}
                      type="button"
                      disabled={saving || selectedAppointment?.status === status}
                      className="app-btn-ghost px-3 py-2 text-xs disabled:cursor-not-allowed disabled:opacity-60"
                      onClick={() => onQuickStatusChange(status)}
                    >
                      {selectedAppointment?.status === status ? `${humanizeAppointmentStatus(status)} actual` : humanizeAppointmentStatus(status)}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            <DetailField label="Notas" value={selectedAppointment?.notes || selectedAppointment?.reason || "Sin notas."} />
            {selectedAppointment?.virtual_link ? (
              <div>
                <div className="mb-1 text-xs font-semibold uppercase tracking-[0.08em] text-med-ink-muted">Enlace virtual</div>
                <a
                  href={selectedAppointment.virtual_link}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 text-sm font-medium text-med-violet transition hover:opacity-75"
                >
                  <Icon className="h-4 w-4">
                    <path d="M15 10l4.553-2.069A1 1 0 0 1 21 8.87v6.26a1 1 0 0 1-1.447.894L15 14" />
                    <rect x="3" y="8" width="12" height="10" rx="2" />
                  </Icon>
                  Unirse a la videollamada
                </a>
              </div>
            ) : null}
            {selectedAppointment?.status !== "cancelled" ? (
              <FormField label="Motivo de cancelacion">
                <textarea
                  className="med-input min-h-[96px] resize-y px-4 py-3"
                  value={cancellationReason}
                  placeholder="Describe por que se cancela esta cita..."
                  onChange={(event) => onCancellationReasonChange(event.target.value)}
                />
                <div className="mt-2 text-xs text-med-ink-muted">Este motivo quedara registrado en el historial de la cita.</div>
              </FormField>
            ) : selectedAppointment?.cancellation_reason ? (
              <DetailField label="Motivo de cancelacion" value={selectedAppointment.cancellation_reason} />
            ) : null}
          </div>
        ) : (
          <div className="grid gap-4 px-6 py-6 sm:grid-cols-2">
            <FormField label="Paciente" className="sm:col-span-2">
              <select
                className="med-input px-4 py-3"
                value={form.patient_id}
                disabled={readOnlyPatient}
                onChange={(event) => onChange((current) => ({ ...current, patient_id: event.target.value }))}
              >
                <option value="">Seleccionar paciente</option>
                {patients.map((patient) => (
                  <option key={patient.id} value={patient.id}>
                    {patient.full_name}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Medico" className="sm:col-span-2">
              <select
                className="med-input px-4 py-3"
                value={form.doctor_id}
                disabled={readOnlyDoctor}
                onChange={(event) => onChange((current) => ({ ...current, doctor_id: event.target.value }))}
              >
                <option value="">Seleccionar medico</option>
                {doctors.map((doctor) => (
                  <option key={doctor.id} value={doctor.id}>
                    Dr. {doctor.full_name} - {doctor.specialty}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Fecha">
              <input
                className="med-input px-4 py-3"
                type="date"
                value={form.appointment_date}
                onChange={(event) => onChange((current) => ({ ...current, appointment_date: event.target.value }))}
              />
            </FormField>

            <FormField label="Hora">
              {slotsLoading ? (
                <div className="med-input flex items-center px-4 py-3 text-sm text-med-ink-muted">Buscando horarios...</div>
              ) : slots.length > 0 ? (
                <select
                  className="med-input px-4 py-3"
                  value={form.appointment_time}
                  onChange={(event) => onChange((current) => ({ ...current, appointment_time: event.target.value }))}
                >
                  <option value="">Seleccionar hora</option>
                  {slots.map((slot) => (
                    <option key={slot} value={slot}>
                      {slot}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="med-input flex items-center px-4 py-3 text-sm text-med-ink-muted">
                  No hay horarios disponibles para esa fecha.
                </div>
              )}
            </FormField>

            <FormField label="Duracion (min)">
              <select
                className="med-input px-4 py-3"
                value={form.duration_minutes}
                onChange={(event) => onChange((current) => ({ ...current, duration_minutes: event.target.value }))}
              >
                {[15, 30, 45, 60, 90].map((minutes) => (
                  <option key={minutes} value={minutes}>
                    {minutes} min
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Estado">
              <select
                className="med-input px-4 py-3"
                value={form.status}
                onChange={(event) => onChange((current) => ({ ...current, status: event.target.value }))}
              >
                {editableStatuses.map((status) => (
                  <option key={status.value} value={status.value}>
                    {status.label}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Motivo / notas" className="sm:col-span-2">
              <textarea
                className="med-input min-h-[96px] resize-y px-4 py-3"
                value={form.notes}
                placeholder="Motivo de la consulta..."
                onChange={(event) => onChange((current) => ({ ...current, notes: event.target.value }))}
              />
            </FormField>

            <FormField label="Enlace virtual (opcional)" className="sm:col-span-2">
              <input
                className="med-input px-4 py-3"
                type="url"
                value={form.virtual_link}
                placeholder="https://meet.google.com/... o https://zoom.us/j/..."
                onChange={(event) => onChange((current) => ({ ...current, virtual_link: event.target.value }))}
              />
              <div className="mt-2 text-xs text-med-ink-muted">
                Pega el enlace de Google Meet, Zoom o cualquier plataforma de videollamada para esta cita.
              </div>
            </FormField>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-med-border px-6 py-4">
          {mode === "view" ? (
            <>
              <button type="button" className="app-btn-ghost" onClick={onClose}>
                Cerrar
              </button>
              <button
                type="button"
                disabled={saving || selectedAppointment?.status === "cancelled"}
                className="app-btn border-[rgba(247,37,133,0.22)] bg-[rgba(247,37,133,0.10)] text-[#c0105e] hover:bg-[rgba(247,37,133,0.16)] disabled:cursor-not-allowed disabled:opacity-60"
                onClick={onCancelAppointment}
              >
                Cancelar cita
              </button>
              <button
                type="button"
                disabled={saving}
                className="app-btn border-med-teal bg-med-teal text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={onSwitchToEdit}
              >
                Editar
              </button>
            </>
          ) : (
            <>
              <button type="button" className="app-btn-ghost" onClick={onClose}>
                Cancelar
              </button>
              <button type="button" className="app-btn-violet" disabled={saving} onClick={onSave}>
                {saving ? "Guardando..." : mode === "edit" ? "Actualizar cita" : "Crear cita"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function DetailField({ label, value, emphasis = false }) {
  return (
    <div>
      <div className="mb-1 text-xs font-semibold uppercase tracking-[0.08em] text-med-ink-muted">{label}</div>
      <div className={emphasis ? "text-sm font-semibold text-med-ink" : "text-sm text-med-ink"}>{value}</div>
    </div>
  );
}

function FormField({ label, className = "", children }) {
  return (
    <div className={className}>
      <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.08em] text-med-ink-muted">{label}</label>
      {children}
    </div>
  );
}
