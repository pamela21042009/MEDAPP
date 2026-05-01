import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import AppShell from "../components/app/AppShell";
import BrandLogo from "../components/ui/BrandLogo";
import Icon from "../components/ui/Icon";
import { getPrescriptionDetail } from "../lib/prescriptions";

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

export default function PrescriptionDetailPage() {
  const { rxId } = useParams();
  const [prescription, setPrescription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadPrescription() {
      setLoading(true);
      setError("");

      try {
        const data = await getPrescriptionDetail(rxId);
        if (active) {
          setPrescription(data?.prescription || null);
        }
      } catch (err) {
        if (active) {
          setError(err.message || "No fue posible cargar la receta.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadPrescription();

    return () => {
      active = false;
    };
  }, [rxId]);

  return (
    <AppShell pageTitle={`Receta RX-${rxId}`} activePage="prescriptions">
      <style>{`
        @media print {
          aside, header, .rx-actions { display: none !important; }
          main { margin-left: 0 !important; padding: 0 !important; }
          .rx-print-shell { box-shadow: none !important; border: 1px solid #d7d9e2 !important; }
        }
      `}</style>

      {loading ? (
        <div className="space-y-6">
          <div className="h-20 animate-pulse rounded-3xl bg-white" />
          <div className="h-[620px] animate-pulse rounded-3xl bg-white" />
        </div>
      ) : error ? (
        <section className="app-surface px-6 py-8">
          <div className="rounded-2xl border border-[rgba(247,37,133,0.22)] bg-[rgba(247,37,133,0.08)] px-4 py-3 text-sm text-[#c0185a]">
            {error}
          </div>
          <div className="mt-5">
            <Link className="app-btn-ghost" to="/prescriptions">
              Volver
            </Link>
          </div>
        </section>
      ) : prescription ? (
        <>
          <section className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h1 className="text-[1.45rem] font-bold tracking-[-0.02em] text-med-ink">
                Receta <span className="text-med-violet">RX-{prescription.id}</span>
              </h1>
              <p className="mt-1 text-sm text-med-ink-muted">Emitida el {formatDate(prescription.issued_at)}</p>
            </div>
            <div className="rx-actions flex flex-wrap gap-3">
              <Link className="app-btn-ghost" to="/prescriptions">
                Volver
              </Link>
              <button type="button" className="app-btn-violet" onClick={() => window.print()}>
                <PrintIcon className="h-4 w-4" />
                Imprimir
              </button>
            </div>
          </section>

          <section className="rx-print-shell app-surface mx-auto max-w-[860px] overflow-hidden">
            <div className="px-8 py-8">
              <div className="mb-8 flex flex-wrap items-start justify-between gap-6">
                <BrandLogo
                  subtitle="Sistema de Gestion Medica"
                  imageClassName="h-12 w-12 rounded-xl object-contain"
                  nameClassName="text-[1.35rem] font-bold text-med-violet"
                  subtitleClassName="text-sm text-med-ink-muted"
                />
                <div className="text-right">
                  <div className="text-lg font-bold text-med-ink">RX-{prescription.id}</div>
                  <div className="text-sm text-med-ink-muted">{formatDate(prescription.issued_at)}</div>
                  <div className="mt-1 text-sm text-med-ink">
                    Valida hasta: <strong>{formatDate(prescription.valid_until)}</strong>
                  </div>
                </div>
              </div>

              <div className="grid gap-6 border-t border-b border-med-border py-6 md:grid-cols-2">
                <div>
                  <div className="mb-3 text-xs font-semibold uppercase tracking-[0.08em] text-med-ink-muted">Medico</div>
                  <div className="text-base font-semibold text-med-ink">{prescription.doctors?.full_name || "--"}</div>
                  <div className="mt-1 text-sm text-med-ink-muted">{prescription.doctors?.specialty || ""}</div>
                  <div className="mt-1 text-sm text-med-ink-muted">
                    Lic: {prescription.doctors?.license_number || "--"}
                  </div>
                </div>
                <div>
                  <div className="mb-3 text-xs font-semibold uppercase tracking-[0.08em] text-med-ink-muted">Paciente</div>
                  <div className="text-base font-semibold text-med-ink">{prescription.patients?.full_name || "--"}</div>
                  <div className="mt-1 text-sm text-med-ink-muted">
                    Nacimiento: {formatDate(prescription.patients?.birth_date)}
                  </div>
                </div>
              </div>

              <div className="py-6">
                <div className="mb-4 text-xs font-semibold uppercase tracking-[0.08em] text-med-ink-muted">Medicamentos</div>
                <div className="space-y-3">
                  {(prescription.items || []).length ? (
                    prescription.items.map((item) => (
                      <div
                        key={item.id}
                        className="rounded-2xl border border-med-border bg-white px-5 py-4"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="font-semibold text-med-ink">{item.medications?.name || "--"}</div>
                            <div className="mt-1 text-sm text-med-ink-muted">{item.medications?.generic_name || ""}</div>
                          </div>
                          <span className="inline-flex rounded-full bg-[rgba(94,96,206,0.1)] px-3 py-1 text-xs font-semibold text-med-violet">
                            {item.dose}
                          </span>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-4 text-sm text-med-ink-muted">
                          <span>
                            <strong className="text-med-ink">Frecuencia:</strong> {item.frequency}
                          </span>
                          {item.duration_days ? (
                            <span>
                              <strong className="text-med-ink">Duracion:</strong> {item.duration_days} dias
                            </span>
                          ) : null}
                        </div>
                        {item.instructions ? (
                          <div className="mt-3 text-sm italic text-med-ink-muted">{item.instructions}</div>
                        ) : null}
                      </div>
                    ))
                  ) : (
                    <div className="rounded-2xl border border-dashed border-med-border px-5 py-6 text-center text-sm text-med-ink-muted">
                      Sin medicamentos registrados.
                    </div>
                  )}
                </div>
              </div>

              {prescription.notes ? (
                <div className="rounded-2xl bg-[rgba(255,209,102,0.18)] px-5 py-4">
                  <div className="mb-1 text-xs font-semibold uppercase tracking-[0.08em] text-[#c88a0a]">Notas</div>
                  <div className="text-sm text-med-ink">{prescription.notes}</div>
                </div>
              ) : null}
            </div>
          </section>
        </>
      ) : null}
    </AppShell>
  );
}

function PrintIcon({ className = "" }) {
  return (
    <Icon className={className}>
      <polyline points="6 9 6 2 18 2 18 9" />
      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
      <rect x="6" y="14" width="12" height="8" />
    </Icon>
  );
}
