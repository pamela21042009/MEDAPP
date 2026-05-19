import { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import AppShell from "../components/app/AppShell";
import BrandLogo from "../components/ui/BrandLogo";
import Icon from "../components/ui/Icon";
import { captureOnlinePaymentOrder, getPaymentDetail } from "../lib/payments";

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

function formatCurrency(value, currency = "USD") {
  return new Intl.NumberFormat("es-DO", {
    style: "currency",
    currency: currency || "USD",
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);
}

function statusClass(status) {
  const classes = {
    paid: "border-[#89e6a0] bg-[#e9fbef] text-[#1f7a3a]",
    pending: "border-[#ffe29a] bg-[#fff7df] text-[#8a6200]",
    refunded: "border-[#a8d9f4] bg-[#eaf7fd] text-[#236c96]",
  };

  return classes[status] || "border-med-border bg-med-bg text-med-ink-muted";
}

function statusLabel(status) {
  const labels = {
    paid: "Pagado",
    pending: "Pendiente",
    refunded: "Reembolsado",
    cancelled: "Cancelado",
  };

  return labels[status] || status || "Sin estado";
}

export default function PaymentReceiptPage() {
  const { paymentId } = useParams();
  const location = useLocation();
  const [payment, setPayment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    let active = true;

    async function loadPayment() {
      setLoading(true);
      setError("");
      setNotice(null);

      const params = new URLSearchParams(location.search);
      const sessionId = params.get("session_id");

      if (sessionId) {
        try {
          const result = await captureOnlinePaymentOrder(paymentId, { session_id: sessionId });
          if (active) {
            setNotice({
              type: "success",
              message: result?.receipt_email_sent
                ? "Pago en linea confirmado y comprobante enviado al paciente."
                : result?.message || "Pago en linea confirmado correctamente.",
            });
          }
        } catch (err) {
          if (active) {
            setError(err.message || "No fue posible confirmar el pago en linea.");
          }
        } finally {
          window.history.replaceState(window.history.state, "", location.pathname);
        }
      }

      try {
        const data = await getPaymentDetail(paymentId);
        if (active) {
          setPayment(data?.payment || null);
        }
      } catch (err) {
        if (active) {
          setError(err.message || "No fue posible cargar el recibo.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadPayment();

    return () => {
      active = false;
    };
  }, [location.pathname, location.search, paymentId]);

  return (
    <AppShell pageTitle={`Recibo #${paymentId}`} activePage="payments">
      <style>{`
        @media print {
          aside, header, .payment-actions { display: none !important; }
          main { margin-left: 0 !important; padding: 24px !important; background: #ffffff !important; }
          .receipt-shell { box-shadow: none !important; border: 1px solid #d7d9e2 !important; }
          .receipt-print-bg { background: #ffffff !important; }
        }
      `}</style>

      {loading ? (
        <div className="space-y-6">
          <div className="h-20 animate-pulse rounded-3xl bg-white" />
          <div className="h-[720px] animate-pulse rounded-3xl bg-white" />
        </div>
      ) : error ? (
        payment ? (
          <>
            <section className="mb-6 space-y-3">
              {notice ? (
                <div className="rounded-2xl border border-[rgba(128,237,153,0.35)] bg-[rgba(128,237,153,0.12)] px-4 py-3 text-sm text-[#1f7a3a]">
                  {notice.message}
                </div>
              ) : null}
              <div className="rounded-2xl border border-[rgba(247,37,133,0.22)] bg-[rgba(247,37,133,0.08)] px-4 py-3 text-sm text-[#c0185a]">
                {error}
              </div>
            </section>
            {renderReceipt(payment)}
          </>
        ) : (
          <section className="app-surface px-6 py-8">
            <div className="rounded-2xl border border-[rgba(247,37,133,0.22)] bg-[rgba(247,37,133,0.08)] px-4 py-3 text-sm text-[#c0185a]">
              {error}
            </div>
            <div className="mt-5">
              <Link className="app-btn-ghost" to="/payments">
                Volver
              </Link>
            </div>
          </section>
        )
      ) : payment ? (
        <>
          {notice ? (
            <section className="mb-6">
              <div className="rounded-2xl border border-[rgba(128,237,153,0.35)] bg-[rgba(128,237,153,0.12)] px-4 py-3 text-sm text-[#1f7a3a]">
                {notice.message}
              </div>
            </section>
          ) : null}
          {renderReceipt(payment)}
        </>
      ) : null}
    </AppShell>
  );
}

function renderReceipt(payment) {
  return (
    <>
      <section className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-[1.45rem] font-bold tracking-[-0.02em] text-med-ink">
            Recibo {payment.reference || `REC-${payment.id}`}
          </h1>
          <p className="mt-1 text-sm text-med-ink-muted">Emitido el {formatDate(payment.created_at)}</p>
        </div>
        <div className="payment-actions flex flex-wrap gap-3">
          <Link className="app-btn-ghost" to="/payments">
            Volver
          </Link>
          <button type="button" className="app-btn-violet" onClick={() => window.print()}>
            <PrintIcon className="h-4 w-4" />
            Imprimir recibo
          </button>
        </div>
      </section>

      <section className="receipt-shell receipt-print-bg mx-auto max-w-[900px] overflow-hidden rounded-[24px] border border-med-border bg-white shadow-[0_24px_70px_rgba(43,45,66,0.10)]">
        <div className="relative overflow-hidden bg-[linear-gradient(135deg,#28306b_0%,#4EA8DE_58%,#80ED99_100%)] px-8 py-8 text-white">
          <div className="absolute -right-12 -top-20 h-56 w-56 rounded-full border border-white/20" />
          <div className="absolute bottom-0 right-10 h-24 w-24 rounded-t-full bg-white/10" />
          <div className="relative flex flex-wrap items-start justify-between gap-6">
            <BrandLogo
              subtitle="Sistema de Gestion Medica"
              imageClassName="h-12 w-12 rounded-xl bg-white object-contain p-1"
              nameClassName="text-[1.25rem] font-bold text-white"
              subtitleClassName="text-sm text-white/75"
              fallbackClassName="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20 text-white"
            />
            <div className="text-right">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-white/70">Comprobante de pago</div>
              <div className="mt-2 font-mono text-[1.1rem] font-bold text-white">
                {payment.reference || `REC-${payment.id}`}
              </div>
              <div className="mt-3 inline-flex rounded-full border border-white/25 bg-white/15 px-3 py-1 text-xs font-semibold text-white backdrop-blur">
                ID {payment.id}
              </div>
            </div>
          </div>
        </div>

        <div className="px-8 py-8">
          <div className="mb-8 grid gap-4 md:grid-cols-[1.2fr_0.8fr_0.8fr]">
            <div className="rounded-2xl border border-med-border bg-med-bg px-5 py-4">
              <div className="text-xs font-semibold uppercase tracking-[0.08em] text-med-ink-muted">Estado</div>
              <span className={`mt-3 inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-bold ${statusClass(payment.status)}`}>
                <span className="h-2 w-2 rounded-full bg-current" />
                {statusLabel(payment.status)}
              </span>
            </div>
            <ReceiptMetaCard label="Emitido" value={formatDate(payment.created_at)} />
            <ReceiptMetaCard label="Pagado" value={payment.paid_at ? formatDate(payment.paid_at) : "--"} />
          </div>

          <div className="mb-8 rounded-2xl border border-med-border bg-white p-5 shadow-[0_12px_28px_rgba(43,45,66,0.04)]">
            <div className="grid gap-5 md:grid-cols-2">
              <InfoPanel
                eyebrow="Paciente"
                title={payment.patients?.full_name || "--"}
                lines={[payment.patients?.email, payment.patients?.phone].filter(Boolean)}
                icon={<PatientIcon />}
              />
              <InfoPanel
                eyebrow="Datos de la cita"
                title={payment.appointments ? formatDate(payment.appointments.appointment_date) : "Sin cita asociada"}
                lines={payment.appointments
                  ? [
                    String(payment.appointments.appointment_time || "--").slice(0, 5),
                    payment.appointments.reason,
                  ].filter(Boolean)
                  : []}
                icon={<CalendarIcon />}
              />
            </div>
          </div>

          <div className="mb-8 overflow-hidden rounded-2xl border border-med-border">
            <table className="min-w-full border-separate border-spacing-0">
              <thead>
                <tr className="bg-[#f3f7fb]">
                  <th className="border-b border-med-border px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-med-ink-muted">
                    Descripcion
                  </th>
                  <th className="border-b border-med-border px-5 py-3 text-center text-[11px] font-semibold uppercase tracking-[0.08em] text-med-ink-muted">
                    Metodo
                  </th>
                  <th className="border-b border-med-border px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.08em] text-med-ink-muted">
                    Monto
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border-b border-med-border px-5 py-4">
                    <div className="font-semibold text-med-ink">Consulta medica</div>
                    {payment.appointments?.reason ? (
                      <div className="mt-1 text-sm text-med-ink-muted">{payment.appointments.reason}</div>
                    ) : null}
                  </td>
                  <td className="border-b border-med-border px-5 py-4 text-center">
                    <span className="inline-flex rounded-full bg-[#eef7fc] px-3 py-1 text-xs font-semibold text-[#236c96]">
                      {payment.method || "No especificado"}
                    </span>
                  </td>
                  <td className="border-b border-med-border px-5 py-4 text-right text-base font-bold text-med-ink">
                    {formatCurrency(payment.amount, payment.currency)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1fr_340px] lg:items-start">
            <div className="rounded-2xl border border-dashed border-med-border bg-med-bg px-5 py-4 text-sm leading-6 text-med-ink-muted">
              Este comprobante fue generado por MedApp como constancia del pago registrado. Conserva este documento para tus registros.
            </div>

            <div className="rounded-2xl border border-med-border bg-[#fbfcfe] p-5">
              <TotalRow label="Subtotal" value={formatCurrency(payment.amount, payment.currency)} />
              {Number(payment.received_amount || 0) > 0 ? (
                <TotalRow label="Monto recibido" value={formatCurrency(payment.received_amount, payment.currency)} />
              ) : null}
              {Number(payment.returned_amount || 0) > 0 ? (
                <TotalRow label="Cambio devuelto" value={formatCurrency(payment.returned_amount, payment.currency)} tone="teal" />
              ) : null}
              <TotalRow label="Impuestos" value={formatCurrency(0, payment.currency)} />
              <div className="mt-4 rounded-2xl bg-[linear-gradient(135deg,#28306b,#4EA8DE)] px-5 py-4 text-white">
                <div className="text-xs font-semibold uppercase tracking-[0.12em] text-white/70">Total {payment.currency || "USD"}</div>
                <div className="mt-1 text-right text-[2rem] font-bold tracking-[-0.03em]">
                  {formatCurrency(payment.amount, payment.currency)}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-10 flex flex-wrap items-end justify-between gap-6 border-t border-med-border pt-6">
            <div className="h-12 w-40 border-b border-med-border text-center text-xs text-med-ink-muted">
              <div className="pt-14">Firma autorizada</div>
            </div>
            <div className="text-right font-mono text-xs text-med-ink-muted">
              <div>ID: {payment.id}</div>
              <div>REF: {payment.reference || "--"}</div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

function ReceiptMetaCard({ label, value }) {
  return (
    <div className="rounded-2xl border border-med-border bg-white px-5 py-4 shadow-[0_10px_24px_rgba(43,45,66,0.04)]">
      <div className="text-xs font-semibold uppercase tracking-[0.08em] text-med-ink-muted">{label}</div>
      <div className="mt-2 text-base font-bold text-med-ink">{value}</div>
    </div>
  );
}

function InfoPanel({ eyebrow, title, lines, icon }) {
  return (
    <div className="flex gap-4 rounded-2xl bg-med-bg p-4">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-med-teal shadow-sm">
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-xs font-semibold uppercase tracking-[0.08em] text-med-ink-muted">{eyebrow}</div>
        <div className="mt-1 break-words text-base font-bold text-med-ink">{title}</div>
        {lines.length ? (
          <div className="mt-2 space-y-1 text-sm text-med-ink-muted">
            {lines.map((line) => (
              <div key={line} className="break-words">{line}</div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function TotalRow({ label, value, tone = "default" }) {
  return (
    <div className={`flex justify-between gap-4 py-2 text-sm ${tone === "teal" ? "text-[#236c96]" : "text-med-ink-muted"}`}>
      <span>{label}</span>
      <span className="font-semibold text-med-ink">{value}</span>
    </div>
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

function PatientIcon() {
  return (
    <Icon className="h-5 w-5">
      <path d="M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z" />
      <path d="M12 14a7 7 0 0 0-7 7h14a7 7 0 0 0-7-7Z" />
    </Icon>
  );
}

function CalendarIcon() {
  return (
    <Icon className="h-5 w-5">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M8 2v4" />
      <path d="M16 2v4" />
      <path d="M3 10h18" />
    </Icon>
  );
}
