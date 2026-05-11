import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import AppShell from "../components/app/AppShell";
import Icon from "../components/ui/Icon";
import { createMedication } from "../lib/catalogs";
import { createPrescription, getPrescriptionsBootstrap } from "../lib/prescriptions";

const EMPTY_ITEM = {
  medication_id: "",
  dose: "",
  frequency: "",
  duration_days: "",
  instructions: "",
};
const EMPTY_MEDICATION = { name: "", generic_name: "", category: "", unit: "", requires_rx: true, is_active: true };

export default function PrescriptionCreatePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [bootstrap, setBootstrap] = useState(null);
  const [medications, setMedications] = useState([]);
  const [patientId, setPatientId] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState([EMPTY_ITEM]);
  const [showMedicationForm, setShowMedicationForm] = useState(false);
  const [medicationForm, setMedicationForm] = useState(EMPTY_MEDICATION);
  const [savingMedication, setSavingMedication] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const appointmentId = searchParams.get("appointment_id") || "";

  useEffect(() => {
    let active = true;

    async function loadBootstrap() {
      setLoading(true);
      setError("");

      try {
        const data = await getPrescriptionsBootstrap();
        if (active) {
          setBootstrap(data);
          setMedications(data?.medications || []);
        }
      } catch (err) {
        if (active) {
          setError(err.message || "No fue posible cargar el formulario de receta.");
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

  const blocked = !loading && !bootstrap?.can_write;
  const patients = bootstrap?.patients || [];
  const submitLabel = useMemo(() => (saving ? "Guardando..." : "Guardar receta"), [saving]);

  function updateItem(index, key, value) {
    setItems((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, [key]: value } : item)));
  }

  function addItem() {
    setItems((current) => [...current, { ...EMPTY_ITEM }]);
  }

  function removeItem(index) {
    setItems((current) => (current.length > 1 ? current.filter((_, itemIndex) => itemIndex !== index) : current));
  }

  async function handleMedicationCreate(event) {
    event?.preventDefault();
    setSavingMedication(true);
    setError("");
    try {
      const payload = {
        ...medicationForm,
        name: medicationForm.name.trim(),
        generic_name: medicationForm.generic_name.trim(),
        category: medicationForm.category.trim(),
        unit: medicationForm.unit.trim(),
      };
      if (!payload.name) {
        setError("Escribe el nombre del medicamento.");
        return;
      }
      const result = await createMedication(payload);
      const created = result?.item;
      if (created?.id) {
        setMedications((current) => [...current, created]);
        setItems((current) => {
          const emptyIndex = current.findIndex((item) => !item.medication_id);
          if (emptyIndex === -1) {
            return [...current, { ...EMPTY_ITEM, medication_id: String(created.id) }];
          }
          return current.map((item, index) => (
            index === emptyIndex ? { ...item, medication_id: String(created.id) } : item
          ));
        });
      }
      setMedicationForm(EMPTY_MEDICATION);
      setShowMedicationForm(false);
    } catch (err) {
      setError(err.message || "No fue posible crear el medicamento.");
    } finally {
      setSavingMedication(false);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSaving(true);

    try {
      const payload = {
        patient_id: Number(patientId),
        appointment_id: appointmentId ? Number(appointmentId) : null,
        notes,
        items: items.map((item) => ({
          medication_id: Number(item.medication_id),
          dose: item.dose,
          frequency: item.frequency,
          duration_days: item.duration_days ? Number(item.duration_days) : null,
          instructions: item.instructions,
        })),
      };

      const result = await createPrescription(payload);
      navigate(`/prescriptions/${result.id}`, { replace: true });
    } catch (err) {
      setError(err.message || "No fue posible guardar la receta.");
      setSaving(false);
    }
  }

  return (
    <AppShell pageTitle="Nueva receta" activePage="prescriptions">
      {loading ? (
        <div className="space-y-6">
          <div className="h-20 animate-pulse rounded-3xl bg-white" />
          <div className="h-[620px] animate-pulse rounded-3xl bg-white" />
        </div>
      ) : blocked ? (
        <section className="app-surface px-6 py-8">
          <div className="rounded-2xl border border-[rgba(247,37,133,0.22)] bg-[rgba(247,37,133,0.08)] px-4 py-3 text-sm text-[#c0185a]">
            {error || "Acceso denegado."}
          </div>
          <div className="mt-5">
            <Link className="app-btn-ghost" to="/prescriptions">
              Volver
            </Link>
          </div>
        </section>
      ) : (
        <div className="mx-auto max-w-[980px]">
          <section className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h1 className="text-[1.45rem] font-bold tracking-[-0.02em] text-med-ink">Nueva receta medica</h1>
              <p className="mt-1 text-sm text-med-ink-muted">Completa los datos del paciente y los medicamentos.</p>
            </div>
            <Link className="app-btn-ghost" to="/prescriptions">
              Volver
            </Link>
          </section>

          {error ? (
            <div className="mb-6 rounded-2xl border border-[rgba(247,37,133,0.22)] bg-[rgba(247,37,133,0.08)] px-4 py-3 text-sm text-[#c0185a]">
              {error}
            </div>
          ) : null}

          <form className="space-y-6" onSubmit={handleSubmit}>
            {appointmentId ? <input type="hidden" value={appointmentId} readOnly /> : null}

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
              <section className="app-surface overflow-hidden">
                <div className="border-b border-med-border px-6 py-5">
                  <h2 className="text-[0.95rem] font-semibold text-med-ink">Datos generales</h2>
                </div>
                <div className="space-y-5 px-6 py-6">
                  <Field label="Paciente *">
                    <select
                      className="med-input px-4 py-3"
                      value={patientId}
                      onChange={(event) => setPatientId(event.target.value)}
                      required
                    >
                      <option value="">Seleccionar paciente</option>
                      {patients.map((patient) => (
                        <option key={patient.id} value={patient.id}>
                          {patient.full_name}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Notas generales">
                    <textarea
                      className="med-input min-h-[110px] resize-y px-4 py-3"
                      value={notes}
                      onChange={(event) => setNotes(event.target.value)}
                      placeholder="Instrucciones, alergias a considerar..."
                    />
                  </Field>
                </div>
              </section>

              <section className="app-surface overflow-hidden border-[rgba(94,96,206,0.18)] bg-[rgba(94,96,206,0.05)]">
                <div className="px-6 py-6">
                  <div className="text-[0.95rem] font-semibold text-med-violet">Receta valida por 30 dias</div>
                  <p className="mt-3 text-sm leading-7 text-med-ink-muted">
                    La receta se genera con tu perfil medico actual. Puedes imprimirla o compartirla con el paciente
                    despues de guardarla.
                  </p>
                  <p className="mt-4 text-sm leading-7 text-med-ink-muted">
                    Tip: agrega los medicamentos uno por uno y completa dosis, frecuencia e indicaciones.
                  </p>
                </div>
              </section>
            </div>

            <section className="app-surface overflow-hidden">
              <div className="flex items-center justify-between border-b border-med-border px-6 py-5">
                <h2 className="text-[0.95rem] font-semibold text-med-ink">Medicamentos</h2>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className="app-btn-ghost" onClick={() => setShowMedicationForm((value) => !value)}>
                    Nuevo medicamento
                  </button>
                  <button type="button" className="app-btn-outline" onClick={addItem}>
                    <Icon className="h-4 w-4">
                      <path d="M12 5v14" />
                      <path d="M5 12h14" />
                    </Icon>
                    Agregar
                  </button>
                </div>
              </div>
              <div className="space-y-4 px-6 py-6">
                {showMedicationForm ? (
                  <div className="rounded-2xl border border-[rgba(94,96,206,0.22)] bg-[rgba(94,96,206,0.05)] px-4 py-4">
                    <div className="mb-4 text-sm font-semibold text-med-ink">Registrar medicamento nuevo</div>
                    <div className="grid gap-4 md:grid-cols-4">
                      <Field label="Nombre *">
                        <input className="med-input px-4 py-3" value={medicationForm.name} onChange={(event) => setMedicationForm((current) => ({ ...current, name: event.target.value }))} />
                      </Field>
                      <Field label="Generico">
                        <input className="med-input px-4 py-3" value={medicationForm.generic_name} onChange={(event) => setMedicationForm((current) => ({ ...current, generic_name: event.target.value }))} />
                      </Field>
                      <Field label="Categoria">
                        <input className="med-input px-4 py-3" value={medicationForm.category} onChange={(event) => setMedicationForm((current) => ({ ...current, category: event.target.value }))} />
                      </Field>
                      <Field label="Unidad">
                        <input className="med-input px-4 py-3" value={medicationForm.unit} onChange={(event) => setMedicationForm((current) => ({ ...current, unit: event.target.value }))} placeholder="tableta, ml..." />
                      </Field>
                    </div>
                    <div className="mt-4 flex flex-wrap justify-end gap-2">
                      <button type="button" className="app-btn-ghost" onClick={() => setShowMedicationForm(false)} disabled={savingMedication}>Cancelar</button>
                      <button className="app-btn-violet" type="button" onClick={handleMedicationCreate} disabled={savingMedication}>{savingMedication ? "Guardando..." : "Guardar medicamento"}</button>
                    </div>
                  </div>
                ) : null}
                {items.map((item, index) => (
                  <div key={index} className="rounded-2xl border border-med-border bg-white px-4 py-4">
                    <div className="grid gap-4 md:grid-cols-[2fr_1fr_1fr_1fr_auto]">
                      <Field label="Medicamento *">
                        <select
                          className="med-input px-4 py-3"
                          value={item.medication_id}
                          onChange={(event) => updateItem(index, "medication_id", event.target.value)}
                          required
                        >
                          <option value="">Seleccionar</option>
                          {medications.map((medication) => (
                            <option key={medication.id} value={medication.id}>
                              {medication.name}
                            </option>
                          ))}
                        </select>
                      </Field>

                      <Field label="Dosis *">
                        <input
                          className="med-input px-4 py-3"
                          type="text"
                          value={item.dose}
                          onChange={(event) => updateItem(index, "dose", event.target.value)}
                          placeholder="500mg"
                          required
                        />
                      </Field>

                      <Field label="Frecuencia *">
                        <input
                          className="med-input px-4 py-3"
                          type="text"
                          value={item.frequency}
                          onChange={(event) => updateItem(index, "frequency", event.target.value)}
                          placeholder="c/8h"
                          required
                        />
                      </Field>

                      <Field label="Dias">
                        <input
                          className="med-input px-4 py-3"
                          type="number"
                          value={item.duration_days}
                          onChange={(event) => updateItem(index, "duration_days", event.target.value)}
                          placeholder="7"
                          min="1"
                        />
                      </Field>

                      <div className="flex items-end">
                        <button
                          type="button"
                          className="app-btn-ghost h-[50px] px-3"
                          onClick={() => removeItem(index)}
                          disabled={items.length === 1}
                        >
                          <RemoveIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    <div className="mt-4">
                      <Field label="Indicaciones">
                        <input
                          className="med-input px-4 py-3"
                          type="text"
                          value={item.instructions}
                          onChange={(event) => updateItem(index, "instructions", event.target.value)}
                          placeholder="Tomar despues de comer, evitar alcohol..."
                        />
                      </Field>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <div className="flex flex-wrap gap-3">
              <button className="app-btn-violet" type="submit" disabled={saving}>
                <SaveIcon className="h-4 w-4" />
                {submitLabel}
              </button>
              <Link className="app-btn-ghost" to="/prescriptions">
                Cancelar
              </Link>
            </div>
          </form>
        </div>
      )}
    </AppShell>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.08em] text-med-ink-muted">{label}</label>
      {children}
    </div>
  );
}

function RemoveIcon({ className = "" }) {
  return (
    <Icon className={className}>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </Icon>
  );
}

function SaveIcon({ className = "" }) {
  return (
    <Icon className={className}>
      <path d="M5 13l4 4L19 7" />
    </Icon>
  );
}
