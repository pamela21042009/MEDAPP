import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import AppShell from "../components/app/AppShell";
import Icon from "../components/ui/Icon";
import ProfileAvatar from "../components/ui/ProfileAvatar";
import { toBackendUrl } from "../lib/api";
import {
  addPatientClinicalHistory,
  addPatientDocument,
  addPatientVitals,
  getPatientDetail,
  getPatientsBootstrap,
  updatePatientClinicalNote,
} from "../lib/patients";

const EMPTY_CLINICAL_FORM = {
  diagnosis: "",
  treatment: "",
  notes: "",
  visit_date: "",
};

const EMPTY_VITALS_FORM = {
  appointment_id: "",
  weight_kg: "",
  height_cm: "",
  blood_pressure: "",
  heart_rate: "",
  temperature_c: "",
  oxygen_saturation: "",
};

const EMPTY_DOCUMENT_FORM = {
  document_type: "lab",
  title: "",
  file_url: "",
  file_size_kb: "",
};

const STATUS_CLASSES = {
  pending: "bg-[rgba(255,209,102,0.22)] text-[#8a6200]",
  confirmed: "bg-[rgba(128,237,153,0.18)] text-[#1f7a3a]",
  cancelled: "bg-[rgba(247,37,133,0.12)] text-med-rose",
  completed: "bg-[rgba(78,168,222,0.14)] text-med-teal",
  no_show: "bg-[rgba(173,181,189,0.16)] text-med-ink-muted",
  rescheduled: "bg-[rgba(94,96,206,0.10)] text-med-violet",
};

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

function formatDateTime(value) {
  if (!value) {
    return "--";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return new Intl.DateTimeFormat("es-DO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatAppointmentTime(value) {
  if (!value) {
    return "--";
  }

  return String(value).slice(0, 5);
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

function humanizeDocumentType(type) {
  const labels = {
    lab: "Laboratorio",
    imagen: "Imagen",
    receta: "Receta",
    otro: "Otro",
  };

  return labels[type] || type || "--";
}

function safeNumber(value, digits = 0) {
  if (value === null || value === undefined || value === "") {
    return "--";
  }

  return Number(value).toFixed(digits);
}

function computeAge(birthDate) {
  if (!birthDate) {
    return "--";
  }

  const birth = new Date(birthDate);
  if (Number.isNaN(birth.getTime())) {
    return "--";
  }

  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age -= 1;
  }

  return age >= 0 ? `${age} anos` : "--";
}

export default function PatientDetailPage() {
  const { patientId } = useParams();
  const [bootstrap, setBootstrap] = useState(null);
  const [patient, setPatient] = useState(null);
  const [history, setHistory] = useState([]);
  const [clinicalHistory, setClinicalHistory] = useState([]);
  const [vitalSigns, setVitalSigns] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [permissions, setPermissions] = useState({ can_edit: false });
  const [noteDrafts, setNoteDrafts] = useState({});
  const [clinicalForm, setClinicalForm] = useState(EMPTY_CLINICAL_FORM);
  const [vitalsForm, setVitalsForm] = useState(EMPTY_VITALS_FORM);
  const [documentForm, setDocumentForm] = useState(EMPTY_DOCUMENT_FORM);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [workingKey, setWorkingKey] = useState("");

  const canManage = Boolean(bootstrap?.can_manage);
  const latestVitals = vitalSigns[0] || null;
  const patientMetrics = useMemo(
    () => [
      { label: "Citas registradas", value: history.length },
      { label: "Notas medicas", value: clinicalHistory.length },
      { label: "Documentos", value: documents.length },
      { label: "Signos vitales", value: vitalSigns.length },
    ],
    [clinicalHistory.length, documents.length, history.length, vitalSigns.length],
  );

  async function loadDetail(showLoader = true) {
    if (showLoader) {
      setLoading(true);
    }
    setError("");

    try {
      const [bootstrapData, detailData] = await Promise.all([
        getPatientsBootstrap(),
        getPatientDetail(patientId),
      ]);

      setBootstrap(bootstrapData);
      setPatient(detailData?.patient || null);
      setHistory(Array.isArray(detailData?.history) ? detailData.history : []);
      setClinicalHistory(Array.isArray(detailData?.clinical_history) ? detailData.clinical_history : []);
      setVitalSigns(Array.isArray(detailData?.vital_signs) ? detailData.vital_signs : []);
      setDocuments(Array.isArray(detailData?.documents) ? detailData.documents : []);
      setPermissions(detailData?.permissions || { can_edit: false });
    } catch (err) {
      setError(err.message || "No fue posible cargar el expediente del paciente.");
    } finally {
      if (showLoader) {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    let active = true;

    async function runLoad() {
      setLoading(true);
      setError("");

      try {
        const [bootstrapData, detailData] = await Promise.all([
          getPatientsBootstrap(),
          getPatientDetail(patientId),
        ]);

        if (!active) {
          return;
        }

        setBootstrap(bootstrapData);
        setPatient(detailData?.patient || null);
        setHistory(Array.isArray(detailData?.history) ? detailData.history : []);
        setClinicalHistory(Array.isArray(detailData?.clinical_history) ? detailData.clinical_history : []);
        setVitalSigns(Array.isArray(detailData?.vital_signs) ? detailData.vital_signs : []);
        setDocuments(Array.isArray(detailData?.documents) ? detailData.documents : []);
        setPermissions(detailData?.permissions || { can_edit: false });
      } catch (err) {
        if (active) {
          setError(err.message || "No fue posible cargar el expediente del paciente.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    runLoad();

    return () => {
      active = false;
    };
  }, [patientId]);

  useEffect(() => {
    setNoteDrafts(
      Object.fromEntries(
        history.map((appointment) => [appointment.id, appointment.notes || ""]),
      ),
    );
  }, [history]);

  useEffect(() => {
    if (!notice) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => setNotice(""), 3200);
    return () => window.clearTimeout(timeoutId);
  }, [notice]);

  async function handleSaveNote(appointmentId) {
    setWorkingKey(`note-${appointmentId}`);
    setError("");

    try {
      const result = await updatePatientClinicalNote(patientId, appointmentId, {
        notes: noteDrafts[appointmentId] || "",
      });

      setHistory((current) =>
        current.map((appointment) =>
          appointment.id === appointmentId ? (result?.appointment || appointment) : appointment,
        ),
      );
      setNotice(result?.message || "Nota clinica guardada correctamente.");
    } catch (err) {
      setError(err.message || "No fue posible guardar la nota clinica.");
    } finally {
      setWorkingKey("");
    }
  }

  async function handleCreateClinicalHistory(event) {
    event.preventDefault();
    setWorkingKey("clinical");
    setError("");

    try {
      await addPatientClinicalHistory(patientId, clinicalForm);
      setClinicalForm(EMPTY_CLINICAL_FORM);
      await loadDetail(false);
      setNotice("Historial medico guardado correctamente.");
    } catch (err) {
      setError(err.message || "No fue posible guardar el historial medico.");
    } finally {
      setWorkingKey("");
    }
  }

  async function handleCreateVitals(event) {
    event.preventDefault();
    setWorkingKey("vitals");
    setError("");

    try {
      await addPatientVitals(patientId, {
        ...vitalsForm,
        appointment_id: vitalsForm.appointment_id ? Number(vitalsForm.appointment_id) : null,
      });
      setVitalsForm(EMPTY_VITALS_FORM);
      await loadDetail(false);
      setNotice("Signos vitales guardados correctamente.");
    } catch (err) {
      setError(err.message || "No fue posible guardar los signos vitales.");
    } finally {
      setWorkingKey("");
    }
  }

  async function handleCreateDocument(event) {
    event.preventDefault();
    setWorkingKey("document");
    setError("");

    try {
      await addPatientDocument(patientId, {
        ...documentForm,
        file_size_kb: documentForm.file_size_kb ? Number(documentForm.file_size_kb) : null,
      });
      setDocumentForm(EMPTY_DOCUMENT_FORM);
      await loadDetail(false);
      setNotice("Documento guardado correctamente.");
    } catch (err) {
      setError(err.message || "No fue posible guardar el documento.");
    } finally {
      setWorkingKey("");
    }
  }

  return (
    <AppShell pageTitle="Expediente del paciente" activePage="patients">
      {loading ? (
        <div className="space-y-6">
          <div className="h-24 animate-pulse rounded-3xl bg-white" />
          <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
            <div className="h-[420px] animate-pulse rounded-3xl bg-white" />
            <div className="space-y-6">
              <div className="h-[160px] animate-pulse rounded-3xl bg-white" />
              <div className="h-[360px] animate-pulse rounded-3xl bg-white" />
            </div>
          </div>
        </div>
      ) : error && !patient ? (
        <section className="app-surface px-6 py-8">
          <div className="rounded-2xl border border-[rgba(247,37,133,0.22)] bg-[rgba(247,37,133,0.08)] px-4 py-3 text-sm text-[#c0185a]">
            {error}
          </div>
          <div className="mt-5">
            <Link className="app-btn-ghost" to="/patients">
              Volver
            </Link>
          </div>
        </section>
      ) : patient ? (
        <>
          <section className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h1 className="text-[1.45rem] font-bold tracking-[-0.02em] text-med-ink">{patient.full_name}</h1>
              <p className="mt-1 text-sm text-med-ink-muted">
                Expediente completo con citas, historial medico, signos vitales y documentos.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              {permissions.can_edit ? (
                <Link className="app-btn-outline" to={`/patients/${patient.id}/edit`}>
                  Editar perfil
                </Link>
              ) : null}
              <Link className="app-btn-ghost" to="/patients">
                Volver
              </Link>
            </div>
          </section>

          {error ? (
            <div className="mb-6 rounded-2xl border border-[rgba(247,37,133,0.22)] bg-[rgba(247,37,133,0.08)] px-4 py-3 text-sm text-[#c0185a]">
              {error}
            </div>
          ) : null}

          {notice ? (
            <div className="mb-6 rounded-2xl border border-[rgba(128,237,153,0.35)] bg-white px-4 py-3 text-sm text-[#1f7a3a] shadow-sm">
              {notice}
            </div>
          ) : null}

          <section className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {patientMetrics.map((metric) => (
              <MiniMetric key={metric.label} label={metric.label} value={metric.value} />
            ))}
          </section>

          <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
            <div className="space-y-6">
              <section className="app-surface overflow-hidden">
                <div className="px-6 py-7 text-center">
                  <ProfileAvatar
                    src={patient.avatar_url}
                    name={patient.full_name}
                    fallback="PA"
                    className="mx-auto h-[84px] w-[84px] rounded-[24px]"
                    textClassName="text-[1.5rem] text-med-rose"
                    backgroundClassName="bg-[rgba(247,37,133,0.12)] text-med-rose"
                  />
                  <div className="mt-4 text-[1.15rem] font-bold tracking-[-0.02em] text-med-ink">{patient.full_name}</div>
                  <div className="mt-3 flex flex-wrap justify-center gap-2">
                    {patient.blood_type ? (
                      <span className="inline-flex rounded-full bg-[rgba(247,37,133,0.12)] px-3 py-1 text-xs font-semibold text-med-rose">
                        {patient.blood_type}
                      </span>
                    ) : null}
                    {patient.gender ? (
                      <span className="inline-flex rounded-full bg-[rgba(94,96,206,0.08)] px-3 py-1 text-xs font-semibold text-med-violet">
                        {patient.gender}
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="border-t border-med-border px-6 py-6">
                  <div className="space-y-4 text-sm text-med-ink-muted">
                    {patient.email ? <MetaRow icon={<MailIcon />} value={patient.email} /> : null}
                    {patient.phone ? <MetaRow icon={<PhoneIcon />} value={patient.phone} /> : null}
                    {patient.address ? <MetaRow icon={<LocationIcon />} value={patient.address} /> : null}
                    {patient.avatar_url ? <MetaRow icon={<DocumentIcon />} value="Foto de perfil registrada" /> : null}
                    {patient.birth_date ? (
                      <MetaRow
                        icon={<CalendarIcon />}
                        value={`${formatDate(patient.birth_date)} · ${computeAge(patient.birth_date)}`}
                      />
                    ) : null}
                  </div>
                </div>
              </section>

              <InfoCard title="Resumen del expediente">
                <InfoField label="Seguro" value={patient.insurance_number || "--"} />
                <InfoField label="Alergias" value={patient.allergies || "Sin alergias registradas."} className="mt-5" />
                <InfoField
                  label="Ultima atencion"
                  value={
                    history[0]
                      ? `${formatDate(history[0].appointment_date)} · ${humanizeStatus(history[0].status)}`
                      : "Sin citas registradas."
                  }
                  className="mt-5"
                />
              </InfoCard>

              <InfoCard title="Ultimos signos vitales">
                {latestVitals ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <InfoField label="Peso" value={latestVitals.weight_kg ? `${safeNumber(latestVitals.weight_kg, 2)} kg` : "--"} />
                    <InfoField label="Estatura" value={latestVitals.height_cm ? `${safeNumber(latestVitals.height_cm, 2)} cm` : "--"} />
                    <InfoField label="Presion" value={latestVitals.blood_pressure || "--"} />
                    <InfoField label="Pulso" value={latestVitals.heart_rate ? `${latestVitals.heart_rate} ppm` : "--"} />
                    <InfoField label="Temperatura" value={latestVitals.temperature_c ? `${safeNumber(latestVitals.temperature_c, 1)} C` : "--"} />
                    <InfoField label="Oxigeno" value={latestVitals.oxygen_saturation ? `${latestVitals.oxygen_saturation}%` : "--"} />
                  </div>
                ) : (
                  <SectionEmptyState
                    icon={<PulseIcon className="h-6 w-6" />}
                    title="Sin signos vitales registrados"
                    description="Cuando el equipo medico registre valores, apareceran aqui."
                    compact
                  />
                )}
              </InfoCard>
            </div>
            <div className="space-y-6">
              <InfoCard title="Historial de citas">
                {history.length ? (
                  <div className="-mx-6 overflow-x-auto">
                    <table className="min-w-full border-separate border-spacing-0">
                      <thead>
                        <tr className="bg-med-bg">
                          <TableHead>Fecha</TableHead>
                          <TableHead>Medico</TableHead>
                          <TableHead>Motivo</TableHead>
                          <TableHead>Estado</TableHead>
                          <TableHead>Notas clinicas</TableHead>
                        </tr>
                      </thead>
                      <tbody>
                        {history.map((appointment) => (
                          <tr key={appointment.id} className="align-top transition hover:bg-[#fafafe]">
                            <TableCell>
                              <div className="font-medium text-med-ink">{formatDate(appointment.appointment_date)}</div>
                              <div className="text-xs text-med-ink-muted">{formatAppointmentTime(appointment.appointment_time)}</div>
                            </TableCell>
                            <TableCell>
                              <div className="font-medium text-med-ink">{appointment.doctors?.full_name || "--"}</div>
                              <div className="text-xs text-med-ink-muted">{appointment.doctors?.specialty || "--"}</div>
                            </TableCell>
                            <TableCell>
                              <div className="text-sm text-med-ink">{appointment.reason || "--"}</div>
                              {appointment.virtual_link ? (
                                <a
                                  className="mt-2 inline-flex text-xs font-semibold text-med-violet hover:underline"
                                  href={appointment.virtual_link}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  Abrir enlace virtual
                                </a>
                              ) : null}
                              {appointment.cancellation_reason ? (
                                <div className="mt-2 text-xs text-med-rose">
                                  Motivo cancelacion: {appointment.cancellation_reason}
                                </div>
                              ) : null}
                            </TableCell>
                            <TableCell>
                              <span className={`inline-flex rounded-full px-3 py-1 text-[11px] font-semibold ${STATUS_CLASSES[appointment.status] || "bg-med-bg text-med-ink-muted"}`}>
                                {humanizeStatus(appointment.status)}
                              </span>
                            </TableCell>
                            <TableCell className="min-w-[280px]">
                              {canManage ? (
                                <div className="space-y-2">
                                  <textarea
                                    className="med-input min-h-[110px] px-4 py-3"
                                    value={noteDrafts[appointment.id] || ""}
                                    onChange={(event) =>
                                      setNoteDrafts((current) => ({
                                        ...current,
                                        [appointment.id]: event.target.value,
                                      }))
                                    }
                                    placeholder="Registrar observaciones de la cita..."
                                  />
                                  <button
                                    type="button"
                                    className="app-btn-violet px-3 py-2 text-xs"
                                    onClick={() => handleSaveNote(appointment.id)}
                                    disabled={workingKey === `note-${appointment.id}`}
                                  >
                                    {workingKey === `note-${appointment.id}` ? "Guardando..." : "Guardar nota"}
                                  </button>
                                </div>
                              ) : (
                                <div className="text-sm leading-6 text-med-ink-muted">
                                  {appointment.notes || "Sin notas clinicas registradas."}
                                </div>
                              )}
                            </TableCell>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <SectionEmptyState
                    icon={<CalendarIcon className="h-6 w-6" />}
                    title="Sin historial de citas"
                    description="Las citas pasadas y futuras del paciente apareceran aqui."
                  />
                )}
              </InfoCard>

              <InfoCard title="Historial medico">
                {canManage ? (
                  <form className="mb-6 grid gap-4 rounded-[24px] bg-med-bg px-4 py-4 md:grid-cols-2" onSubmit={handleCreateClinicalHistory}>
                    <Field label="Diagnostico *" className="md:col-span-2">
                      <input
                        className="med-input px-4 py-3"
                        type="text"
                        value={clinicalForm.diagnosis}
                        onChange={(event) => setClinicalForm((current) => ({ ...current, diagnosis: event.target.value }))}
                        required
                      />
                    </Field>
                    <Field label="Tratamiento">
                      <input
                        className="med-input px-4 py-3"
                        type="text"
                        value={clinicalForm.treatment}
                        onChange={(event) => setClinicalForm((current) => ({ ...current, treatment: event.target.value }))}
                      />
                    </Field>
                    <Field label="Fecha de visita">
                      <input
                        className="med-input px-4 py-3"
                        type="date"
                        value={clinicalForm.visit_date}
                        onChange={(event) => setClinicalForm((current) => ({ ...current, visit_date: event.target.value }))}
                      />
                    </Field>
                    <Field label="Notas" className="md:col-span-2">
                      <textarea
                        className="med-input min-h-[110px] px-4 py-3"
                        value={clinicalForm.notes}
                        onChange={(event) => setClinicalForm((current) => ({ ...current, notes: event.target.value }))}
                        placeholder="Indicaciones, antecedentes o evolucion..."
                      />
                    </Field>
                    <div className="md:col-span-2">
                      <button className="app-btn-violet" type="submit" disabled={workingKey === "clinical"}>
                        {workingKey === "clinical" ? "Guardando..." : "Agregar registro clinico"}
                      </button>
                    </div>
                  </form>
                ) : null}

                {clinicalHistory.length ? (
                  <div className="space-y-4">
                    {clinicalHistory.map((entry) => (
                      <div key={entry.id} className="rounded-[22px] border border-med-border px-5 py-5">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <div className="text-sm font-semibold text-med-ink">{entry.diagnosis}</div>
                            <div className="mt-1 text-xs text-med-ink-muted">
                              {formatDate(entry.visit_date)} - {entry.doctors?.full_name || "Profesional no especificado"}
                            </div>
                          </div>
                          <span className="inline-flex rounded-full bg-[rgba(94,96,206,0.08)] px-3 py-1 text-xs font-semibold text-med-violet">
                            Historial
                          </span>
                        </div>
                        <div className="mt-4 grid gap-4 md:grid-cols-2">
                          <InfoField label="Tratamiento" value={entry.treatment || "--"} />
                          <InfoField label="Registrado" value={formatDateTime(entry.created_at)} />
                        </div>
                        <InfoField label="Notas" value={entry.notes || "Sin notas adicionales."} className="mt-4" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <SectionEmptyState
                    icon={<HistoryIcon className="h-6 w-6" />}
                    title="Sin historial medico"
                    description="Aqui apareceran los diagnosticos, tratamientos y anotaciones clinicas del paciente."
                  />
                )}
              </InfoCard>

              <InfoCard title="Signos vitales">
                {canManage ? (
                  <form className="mb-6 grid gap-4 rounded-[24px] bg-med-bg px-4 py-4 md:grid-cols-2 xl:grid-cols-3" onSubmit={handleCreateVitals}>
                    <Field label="Cita asociada">
                      <select
                        className="med-input px-4 py-3"
                        value={vitalsForm.appointment_id}
                        onChange={(event) => setVitalsForm((current) => ({ ...current, appointment_id: event.target.value }))}
                      >
                        <option value="">Sin cita asociada</option>
                        {history.map((appointment) => (
                          <option key={appointment.id} value={appointment.id}>
                            #{appointment.id} - {formatDate(appointment.appointment_date)} - {formatAppointmentTime(appointment.appointment_time)}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <VitalInput
                      label="Peso (kg)"
                      value={vitalsForm.weight_kg}
                      onChange={(value) => setVitalsForm((current) => ({ ...current, weight_kg: value }))}
                    />
                    <VitalInput
                      label="Estatura (cm)"
                      value={vitalsForm.height_cm}
                      onChange={(value) => setVitalsForm((current) => ({ ...current, height_cm: value }))}
                    />
                    <Field label="Presion arterial">
                      <input
                        className="med-input px-4 py-3"
                        type="text"
                        value={vitalsForm.blood_pressure}
                        onChange={(event) => setVitalsForm((current) => ({ ...current, blood_pressure: event.target.value }))}
                        placeholder="120/80 mmHg"
                      />
                    </Field>
                    <VitalInput
                      label="Frecuencia cardiaca"
                      value={vitalsForm.heart_rate}
                      onChange={(value) => setVitalsForm((current) => ({ ...current, heart_rate: value }))}
                    />
                    <VitalInput
                      label="Temperatura (C)"
                      value={vitalsForm.temperature_c}
                      onChange={(value) => setVitalsForm((current) => ({ ...current, temperature_c: value }))}
                      step="0.1"
                    />
                    <VitalInput
                      label="Oxigeno (%)"
                      value={vitalsForm.oxygen_saturation}
                      onChange={(value) => setVitalsForm((current) => ({ ...current, oxygen_saturation: value }))}
                    />
                    <div className="md:col-span-2 xl:col-span-3">
                      <button className="app-btn-violet" type="submit" disabled={workingKey === "vitals"}>
                        {workingKey === "vitals" ? "Guardando..." : "Registrar signos vitales"}
                      </button>
                    </div>
                  </form>
                ) : null}

                {vitalSigns.length ? (
                  <div className="-mx-6 overflow-x-auto">
                    <table className="min-w-full border-separate border-spacing-0">
                      <thead>
                        <tr className="bg-med-bg">
                          <TableHead>Fecha</TableHead>
                          <TableHead>Peso</TableHead>
                          <TableHead>Estatura</TableHead>
                          <TableHead>Presion</TableHead>
                          <TableHead>Pulso</TableHead>
                          <TableHead>Temperatura</TableHead>
                          <TableHead>Oxigeno</TableHead>
                        </tr>
                      </thead>
                      <tbody>
                        {vitalSigns.map((entry) => (
                          <tr key={entry.id} className="transition hover:bg-[#fafafe]">
                            <TableCell>{formatDateTime(entry.recorded_at)}</TableCell>
                            <TableCell>{entry.weight_kg ? `${safeNumber(entry.weight_kg, 2)} kg` : "--"}</TableCell>
                            <TableCell>{entry.height_cm ? `${safeNumber(entry.height_cm, 2)} cm` : "--"}</TableCell>
                            <TableCell>{entry.blood_pressure || "--"}</TableCell>
                            <TableCell>{entry.heart_rate ? `${entry.heart_rate} ppm` : "--"}</TableCell>
                            <TableCell>{entry.temperature_c ? `${safeNumber(entry.temperature_c, 1)} C` : "--"}</TableCell>
                            <TableCell>{entry.oxygen_saturation ? `${entry.oxygen_saturation}%` : "--"}</TableCell>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <SectionEmptyState
                    icon={<PulseIcon className="h-6 w-6" />}
                    title="Sin signos vitales"
                    description="Los registros clinicos de presion, temperatura y demas constantes apareceran aqui."
                  />
                )}
              </InfoCard>

              <InfoCard title="Documentos del paciente">
                {canManage ? (
                  <form className="mb-6 grid gap-4 rounded-[24px] bg-med-bg px-4 py-4 md:grid-cols-2" onSubmit={handleCreateDocument}>
                    <Field label="Tipo de documento">
                      <select
                        className="med-input px-4 py-3"
                        value={documentForm.document_type}
                        onChange={(event) => setDocumentForm((current) => ({ ...current, document_type: event.target.value }))}
                      >
                        <option value="lab">Laboratorio</option>
                        <option value="imagen">Imagen</option>
                        <option value="receta">Receta</option>
                        <option value="otro">Otro</option>
                      </select>
                    </Field>
                    <Field label="Tamano (KB)">
                      <input
                        className="med-input px-4 py-3"
                        type="number"
                        min="0"
                        value={documentForm.file_size_kb}
                        onChange={(event) => setDocumentForm((current) => ({ ...current, file_size_kb: event.target.value }))}
                      />
                    </Field>
                    <Field label="Titulo" className="md:col-span-2">
                      <input
                        className="med-input px-4 py-3"
                        type="text"
                        value={documentForm.title}
                        onChange={(event) => setDocumentForm((current) => ({ ...current, title: event.target.value }))}
                        required
                      />
                    </Field>
                    <Field label="URL del archivo" className="md:col-span-2">
                      <input
                        className="med-input px-4 py-3"
                        type="text"
                        value={documentForm.file_url}
                        onChange={(event) => setDocumentForm((current) => ({ ...current, file_url: event.target.value }))}
                        placeholder="https://... o /uploads/..."
                        required
                      />
                    </Field>
                    <div className="md:col-span-2">
                      <button className="app-btn-violet" type="submit" disabled={workingKey === "document"}>
                        {workingKey === "document" ? "Guardando..." : "Agregar documento"}
                      </button>
                    </div>
                  </form>
                ) : null}

                {documents.length ? (
                  <div className="space-y-4">
                    {documents.map((document) => (
                      <div key={document.id} className="flex flex-col gap-4 rounded-[22px] border border-med-border px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <div className="flex items-center gap-3">
                            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[rgba(94,96,206,0.08)] text-med-violet">
                              <DocumentIcon className="h-5 w-5" />
                            </span>
                            <div className="min-w-0">
                              <div className="truncate font-semibold text-med-ink">{document.title}</div>
                              <div className="mt-1 text-xs text-med-ink-muted">
                                {humanizeDocumentType(document.document_type)} - {document.file_size_kb ? `${document.file_size_kb} KB` : "Tamano no especificado"} - {formatDateTime(document.created_at)}
                              </div>
                            </div>
                          </div>
                        </div>
                        <a
                          className="app-btn-ghost shrink-0"
                          href={toBackendUrl(document.file_url)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Abrir documento
                        </a>
                      </div>
                    ))}
                  </div>
                ) : (
                  <SectionEmptyState
                    icon={<DocumentIcon className="h-6 w-6" />}
                    title="Sin documentos asociados"
                    description="Resultados, imagenes y otros archivos del paciente apareceran aqui."
                  />
                )}
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

function InfoField({ label, value, className = "" }) {
  return (
    <div className={className}>
      <div className="mb-1 text-xs font-semibold uppercase tracking-[0.08em] text-med-ink-muted">{label}</div>
      <div className="text-sm leading-6 text-med-ink">{value}</div>
    </div>
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

function VitalInput({ label, value, onChange, step = "0.01" }) {
  return (
    <Field label={label}>
      <input
        className="med-input px-4 py-3"
        type="number"
        step={step}
        min="0"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </Field>
  );
}

function MetaRow({ icon, value }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-med-bg text-med-ink-muted">
        {icon}
      </span>
      <span className="text-sm">{value}</span>
    </div>
  );
}

function MiniMetric({ label, value }) {
  return (
    <div className="app-card px-5 py-5">
      <div className="text-xs font-semibold uppercase tracking-[0.08em] text-med-ink-muted">{label}</div>
      <div className="mt-2 text-[1.55rem] font-bold tracking-[-0.03em] text-med-ink">{value}</div>
    </div>
  );
}

function SectionEmptyState({ icon, title, description, compact = false }) {
  return (
    <div className={`text-center text-med-ink-muted ${compact ? "py-2" : "py-6"}`}>
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-med-bg text-med-ink-muted">
        {icon}
      </div>
      <div className="text-base font-semibold text-med-ink">{title}</div>
      <div className="mt-1 text-sm leading-6">{description}</div>
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
  return <td className={`border-b border-med-border px-6 py-4 align-top text-sm text-med-ink ${className}`}>{children}</td>;
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

function LocationIcon() {
  return (
    <Icon className="h-4 w-4">
      <path d="M12 21s7-4.35 7-11a7 7 0 1 0-14 0c0 6.65 7 11 7 11Z" />
      <circle cx="12" cy="10" r="2.5" />
    </Icon>
  );
}

function CalendarIcon({ className = "h-4 w-4" }) {
  return (
    <Icon className={className}>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M8 2v4" />
      <path d="M16 2v4" />
      <path d="M3 10h18" />
    </Icon>
  );
}

function HistoryIcon({ className = "h-4 w-4" }) {
  return (
    <Icon className={className}>
      <path d="M3 12a9 9 0 1 0 3-6.708" />
      <path d="M3 3v6h6" />
      <path d="M12 7v5l3 2" />
    </Icon>
  );
}

function PulseIcon({ className = "h-4 w-4" }) {
  return (
    <Icon className={className}>
      <path d="M3 12h4l2-4 4 8 2-4h6" />
    </Icon>
  );
}

function DocumentIcon({ className = "h-4 w-4" }) {
  return (
    <Icon className={className}>
      <path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9Z" />
      <path d="M14 2v7h7" />
      <path d="M9 13h6" />
      <path d="M9 17h6" />
    </Icon>
  );
}
