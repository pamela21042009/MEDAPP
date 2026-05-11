import { useEffect, useState } from "react";
import AppShell from "../components/app/AppShell";
import {
  createMedication,
  createSpecialty,
  deleteMedication,
  deleteSpecialty,
  getCatalogsBootstrap,
  updateMedication,
  updateSpecialty,
} from "../lib/catalogs";

const EMPTY_SPECIALTY = { name: "", description: "", color_hex: "#4EA8DE", is_active: true };
const EMPTY_MEDICATION = { name: "", generic_name: "", category: "", unit: "", requires_rx: true, is_active: true };

export default function CatalogsPage() {
  const [activeTab, setActiveTab] = useState("specialties");
  const [specialties, setSpecialties] = useState([]);
  const [medications, setMedications] = useState([]);
  const [specialtyForm, setSpecialtyForm] = useState(EMPTY_SPECIALTY);
  const [medicationForm, setMedicationForm] = useState(EMPTY_MEDICATION);
  const [editingSpecialtyId, setEditingSpecialtyId] = useState(null);
  const [editingMedicationId, setEditingMedicationId] = useState(null);
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  async function loadCatalogs() {
    setLoading(true);
    setError("");
    try {
      const payload = await getCatalogsBootstrap();
      setCanManage(Boolean(payload?.can_manage));
      setSpecialties(payload?.specialties || []);
      setMedications(payload?.medications || []);
    } catch (err) {
      setError(err.message || "No fue posible cargar los catalogos.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCatalogs();
  }, []);

  useEffect(() => {
    if (!toast) {
      return undefined;
    }
    const timeoutId = window.setTimeout(() => setToast(""), 2800);
    return () => window.clearTimeout(timeoutId);
  }, [toast]);

  async function handleSpecialtySubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      if (editingSpecialtyId) {
        await updateSpecialty(editingSpecialtyId, specialtyForm);
      } else {
        await createSpecialty(specialtyForm);
      }
      setSpecialtyForm(EMPTY_SPECIALTY);
      setEditingSpecialtyId(null);
      setToast("Especialidad guardada correctamente.");
      await loadCatalogs();
    } catch (err) {
      setError(err.message || "No fue posible guardar la especialidad.");
    } finally {
      setSaving(false);
    }
  }

  async function handleMedicationSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      if (editingMedicationId) {
        await updateMedication(editingMedicationId, medicationForm);
      } else {
        await createMedication(medicationForm);
      }
      setMedicationForm(EMPTY_MEDICATION);
      setEditingMedicationId(null);
      setToast("Medicamento guardado correctamente.");
      await loadCatalogs();
    } catch (err) {
      setError(err.message || "No fue posible guardar el medicamento.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(type, itemId) {
    const confirmed = window.confirm("Deseas desactivar este registro?");
    if (!confirmed) {
      return;
    }
    try {
      if (type === "specialty") {
        await deleteSpecialty(itemId);
      } else {
        await deleteMedication(itemId);
      }
      setToast("Registro desactivado correctamente.");
      await loadCatalogs();
    } catch (err) {
      setError(err.message || "No fue posible desactivar el registro.");
    }
  }

  return (
    <AppShell pageTitle="Catalogos clinicos" activePage="catalogs">
      <section className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-[1.45rem] font-bold tracking-[-0.02em] text-med-ink">Catalogos clinicos</h1>
          <p className="mt-1 text-sm text-med-ink-muted">Gestiona especialidades medicas y medicamentos usados en recetas.</p>
        </div>
        <div className="inline-flex rounded-xl border border-med-border bg-white p-1">
          <TabButton active={activeTab === "specialties"} onClick={() => setActiveTab("specialties")}>Especialidades</TabButton>
          <TabButton active={activeTab === "medications"} onClick={() => setActiveTab("medications")}>Medicamentos</TabButton>
        </div>
      </section>

      {error ? <Notice tone="error">{error}</Notice> : null}
      {toast ? <Notice tone="success">{toast}</Notice> : null}
      {!error && !canManage && !loading ? <Notice tone="error">No tienes permiso para modificar catalogos.</Notice> : null}

      {loading ? (
        <section className="app-surface px-6 py-6">
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-12 animate-pulse rounded-xl bg-med-bg" />)}
          </div>
        </section>
      ) : activeTab === "specialties" ? (
        <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
          <SpecialtyForm
            canManage={canManage}
            form={specialtyForm}
            editing={Boolean(editingSpecialtyId)}
            saving={saving}
            onChange={setSpecialtyForm}
            onCancel={() => {
              setSpecialtyForm(EMPTY_SPECIALTY);
              setEditingSpecialtyId(null);
            }}
            onSubmit={handleSpecialtySubmit}
          />
          <CatalogTable
            columns={["Nombre", "Descripcion", "Color", "Estado"]}
            items={specialties}
            renderRow={(item) => [
              <strong>{item.name}</strong>,
              item.description || "--",
              <span className="inline-flex items-center gap-2"><span className="h-4 w-4 rounded-full border border-med-border" style={{ backgroundColor: item.color_hex || "#4EA8DE" }} />{item.color_hex || "--"}</span>,
              item.is_active === false ? "Inactiva" : "Activa",
            ]}
            onEdit={(item) => {
              setEditingSpecialtyId(item.id);
              setSpecialtyForm({
                name: item.name || "",
                description: item.description || "",
                color_hex: item.color_hex || "#4EA8DE",
                is_active: item.is_active !== false,
              });
            }}
            onDelete={(item) => handleDelete("specialty", item.id)}
            canManage={canManage}
          />
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
          <MedicationForm
            canManage={canManage}
            form={medicationForm}
            editing={Boolean(editingMedicationId)}
            saving={saving}
            onChange={setMedicationForm}
            onCancel={() => {
              setMedicationForm(EMPTY_MEDICATION);
              setEditingMedicationId(null);
            }}
            onSubmit={handleMedicationSubmit}
          />
          <CatalogTable
            columns={["Nombre", "Generico", "Categoria", "Unidad", "RX", "Estado"]}
            items={medications}
            renderRow={(item) => [
              <strong>{item.name}</strong>,
              item.generic_name || "--",
              item.category || "--",
              item.unit || "--",
              item.requires_rx ? "Si" : "No",
              item.is_active === false ? "Inactivo" : "Activo",
            ]}
            onEdit={(item) => {
              setEditingMedicationId(item.id);
              setMedicationForm({
                name: item.name || "",
                generic_name: item.generic_name || "",
                category: item.category || "",
                unit: item.unit || "",
                requires_rx: item.requires_rx !== false,
                is_active: item.is_active !== false,
              });
            }}
            onDelete={(item) => handleDelete("medication", item.id)}
            canManage={canManage}
          />
        </div>
      )}
    </AppShell>
  );
}

function SpecialtyForm({ canManage, form, editing, saving, onChange, onCancel, onSubmit }) {
  return (
    <FormShell title={editing ? "Editar especialidad" : "Nueva especialidad"} onSubmit={onSubmit}>
      <Field label="Nombre *"><input className="med-input px-4 py-3" value={form.name} onChange={(event) => onChange((current) => ({ ...current, name: event.target.value }))} required disabled={!canManage || saving} /></Field>
      <Field label="Descripcion"><textarea className="med-input min-h-[90px] px-4 py-3" value={form.description} onChange={(event) => onChange((current) => ({ ...current, description: event.target.value }))} disabled={!canManage || saving} /></Field>
      <Field label="Color"><input className="h-12 w-full rounded-xl border border-med-border bg-white px-2" type="color" value={form.color_hex} onChange={(event) => onChange((current) => ({ ...current, color_hex: event.target.value }))} disabled={!canManage || saving} /></Field>
      <Toggle label="Activa" checked={form.is_active} onChange={(value) => onChange((current) => ({ ...current, is_active: value }))} disabled={!canManage || saving} />
      <FormActions canManage={canManage} editing={editing} saving={saving} onCancel={onCancel} />
    </FormShell>
  );
}

function MedicationForm({ canManage, form, editing, saving, onChange, onCancel, onSubmit }) {
  return (
    <FormShell title={editing ? "Editar medicamento" : "Nuevo medicamento"} onSubmit={onSubmit}>
      <Field label="Nombre *"><input className="med-input px-4 py-3" value={form.name} onChange={(event) => onChange((current) => ({ ...current, name: event.target.value }))} required disabled={!canManage || saving} /></Field>
      <Field label="Generico"><input className="med-input px-4 py-3" value={form.generic_name} onChange={(event) => onChange((current) => ({ ...current, generic_name: event.target.value }))} disabled={!canManage || saving} /></Field>
      <Field label="Categoria"><input className="med-input px-4 py-3" value={form.category} onChange={(event) => onChange((current) => ({ ...current, category: event.target.value }))} disabled={!canManage || saving} /></Field>
      <Field label="Unidad"><input className="med-input px-4 py-3" value={form.unit} onChange={(event) => onChange((current) => ({ ...current, unit: event.target.value }))} placeholder="tableta, capsula, ml" disabled={!canManage || saving} /></Field>
      <Toggle label="Requiere receta" checked={form.requires_rx} onChange={(value) => onChange((current) => ({ ...current, requires_rx: value }))} disabled={!canManage || saving} />
      <Toggle label="Activo" checked={form.is_active} onChange={(value) => onChange((current) => ({ ...current, is_active: value }))} disabled={!canManage || saving} />
      <FormActions canManage={canManage} editing={editing} saving={saving} onCancel={onCancel} />
    </FormShell>
  );
}

function CatalogTable({ columns, items, renderRow, onEdit, onDelete, canManage }) {
  return (
    <section className="app-surface overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full border-separate border-spacing-0">
          <thead><tr className="bg-med-bg">{columns.map((column) => <TableHead key={column}>{column}</TableHead>)}<TableHead>Acciones</TableHead></tr></thead>
          <tbody>
            {items.length ? items.map((item) => (
              <tr key={item.id} className="transition hover:bg-[#fafafe]">
                {renderRow(item).map((value, index) => <TableCell key={index}>{value}</TableCell>)}
                <TableCell>
                  <div className="flex gap-2">
                    <button type="button" className="app-btn-ghost px-3 py-2 text-xs" onClick={() => onEdit(item)} disabled={!canManage}>Editar</button>
                    <button type="button" className="app-btn border-[rgba(247,37,133,0.2)] bg-[rgba(247,37,133,0.08)] px-3 py-2 text-xs text-[#c0105e]" onClick={() => onDelete(item)} disabled={!canManage}>Desactivar</button>
                  </div>
                </TableCell>
              </tr>
            )) : (
              <tr><td colSpan={columns.length + 1} className="px-6 py-10 text-center text-sm text-med-ink-muted">Sin registros.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function FormShell({ title, children, onSubmit }) {
  return <form className="app-surface space-y-5 px-6 py-6" onSubmit={onSubmit}><h2 className="text-base font-semibold text-med-ink">{title}</h2>{children}</form>;
}

function Field({ label, children }) {
  return <label className="block"><span className="mb-2 block text-xs font-semibold uppercase tracking-[0.08em] text-med-ink-muted">{label}</span>{children}</label>;
}

function Toggle({ label, checked, onChange, disabled }) {
  return (
    <label className="flex items-center justify-between rounded-xl border border-med-border px-4 py-3 text-sm font-medium text-med-ink">
      {label}
      <input className="h-4 w-4 rounded border-med-border text-med-violet focus:ring-med-violet" type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} disabled={disabled} />
    </label>
  );
}

function FormActions({ canManage, editing, saving, onCancel }) {
  return (
    <div className="flex flex-wrap justify-end gap-2">
      {editing ? <button type="button" className="app-btn-ghost" onClick={onCancel}>Cancelar</button> : null}
      <button className="app-btn-violet" type="submit" disabled={!canManage || saving}>{saving ? "Guardando..." : "Guardar"}</button>
    </div>
  );
}

function TabButton({ active, onClick, children }) {
  return <button type="button" className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${active ? "bg-med-violet text-white" : "text-med-ink-muted hover:bg-med-bg"}`} onClick={onClick}>{children}</button>;
}

function Notice({ tone, children }) {
  const styles = tone === "error" ? "border-[rgba(247,37,133,0.22)] bg-[rgba(247,37,133,0.08)] text-[#c0185a]" : "border-[rgba(128,237,153,0.35)] bg-[rgba(128,237,153,0.14)] text-[#1f7a3a]";
  return <div className={`mb-6 rounded-2xl border px-4 py-3 text-sm ${styles}`}>{children}</div>;
}

function TableHead({ children }) {
  return <th className="whitespace-nowrap border-b border-med-border px-6 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-med-ink-muted">{children}</th>;
}

function TableCell({ children }) {
  return <td className="border-b border-med-border px-6 py-4 align-middle text-sm text-med-ink-muted">{children}</td>;
}
