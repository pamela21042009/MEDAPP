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
    paid: "bg-[rgba(128,237,153,0.18)] text-[#1f7a3a]",
    pending: "bg-[rgba(255,209,102,0.22)] text-[#8a6200]",
    refunded: "bg-[rgba(78,168,222,0.15)] text-[#236c96]",
  };

  return classes[status] || "bg-med-bg text-med-ink-muted";
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
              message: result?.message || "Pago en linea confirmado correctamente.",
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
          main { margin-left: 0 !important; padding: 0 !important; }
          .receipt-shell { box-shadow: none !important; border: 1px solid #d7d9e2 !important; }
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

      <section className="receipt-shell mx-auto max-w-[860px] rounded-[24px] border border-med-border bg-white shadow-sm">
        <div className="px-8 py-8">
          <div className="mb-8 flex flex-wrap items-start justify-between gap-6 border-b border-med-border pb-6">
            <div className="flex items-center gap-4">
              <BrandLogo
                subtitle="Sistema de Gestion Medica"
                imageClassName="h-12 w-12 rounded-xl object-contain"
                nameClassName="text-[1.2rem] font-bold text-med-ink"
                subtitleClassName="text-sm text-med-ink-muted"
                fallbackClassName="flex h-12 w-12 items-center justify-center rounded-xl bg-[linear-gradient(135deg,#5E60CE,#4EA8DE)] text-white"
              />
            </div>
            <div className="text-right">
              <div className="font-mono text-[1rem] font-bold text-med-violet">
                {payment.reference || `REC-${payment.id}`}
              </div>
              <div className="mt-1 text-sm text-med-ink-muted">Emitido: {formatDate(payment.created_at)}</div>
              {payment.paid_at ? <div className="text-sm text-med-ink-muted">Pagado: {formatDate(payment.paid_at)}</div> : null}
            </div>
          </div>

          <div className="mb-6">
            <span className={`inline-flex rounded-full px-4 py-2 text-sm font-semibold capitalize ${statusClass(payment.status)}`}>
              {payment.status}
            </span>
          </div>

          <div className="mb-8 grid gap-6 md:grid-cols-2">
            <div>
              <div className="mb-3 text-xs font-semibold uppercase tracking-[0.08em] text-med-ink-muted">Paciente</div>
              <div className="text-base font-semibold text-med-ink">{payment.patients?.full_name || "--"}</div>
              <div className="mt-2 text-sm leading-6 text-med-ink-muted">
                {payment.patients?.email ? <div>{payment.patients.email}</div> : null}
                {payment.patients?.phone ? <div>{payment.patients.phone}</div> : null}
              </div>
            </div>
            <div>
              <div className="mb-3 text-xs font-semibold uppercase tracking-[0.08em] text-med-ink-muted">Datos de la cita</div>
              {payment.appointments ? (
                <>
                  <div className="text-base font-semibold text-med-ink">{formatDate(payment.appointments.appointment_date)}</div>
                  <div className="mt-2 text-sm leading-6 text-med-ink-muted">
                    <div>{String(payment.appointments.appointment_time || "--").slice(0, 5)}</div>
                    {payment.appointments.reason ? <div>{payment.appointments.reason}</div> : null}
                  </div>
                </>
              ) : (
                <div className="text-sm text-med-ink-muted">Sin cita asociada</div>
              )}
            </div>
          </div>

          <div className="mb-8 overflow-hidden rounded-2xl border border-med-border">
            <table className="min-w-full border-separate border-spacing-0">
              <thead>
                <tr className="bg-med-bg">
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
                    <span className="inline-flex rounded-full bg-[rgba(94,96,206,0.1)] px-3 py-1 text-xs font-semibold text-med-violet">
                      {payment.method || "No especificado"}
                    </span>
                  </td>
                  <td className="border-b border-med-border px-5 py-4 text-right font-semibold text-med-ink">
                    {formatCurrency(payment.amount, payment.currency)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="ml-auto max-w-[280px]">
            <div className="flex justify-between py-2 text-sm text-med-ink-muted">
              <span>Subtotal</span>
              <span className="text-med-ink">{formatCurrency(payment.amount, payment.currency)}</span>
            </div>
            {Number(payment.received_amount || 0) > 0 ? (
              <div className="flex justify-between py-2 text-sm text-med-ink-muted">
                <span>Monto recibido</span>
                <span className="text-med-ink">{formatCurrency(payment.received_amount, payment.currency)}</span>
              </div>
            ) : null}
            {Number(payment.returned_amount || 0) > 0 ? (
              <div className="flex justify-between py-2 text-sm text-med-teal">
                <span>Cambio devuelto</span>
                <span>{formatCurrency(payment.returned_amount, payment.currency)}</span>
              </div>
            ) : null}
            <div className="flex justify-between py-2 text-sm text-med-ink-muted">
              <span>Impuestos</span>
              <span className="text-med-ink">{formatCurrency(0, payment.currency)}</span>
            </div>
            <div className="mt-2 flex justify-between border-t-2 border-med-border pt-4 text-lg font-bold text-med-ink">
              <span>Total {payment.currency || "USD"}</span>
              <span className="text-med-violet">{formatCurrency(payment.amount, payment.currency)}</span>
            </div>
          </div>

          <div className="mt-10 flex flex-wrap items-end justify-between gap-6 border-t border-med-border pt-6">
            <div className="max-w-[420px] text-sm leading-6 text-med-ink-muted">
              Este recibo es un comprobante valido de pago emitido por MedApp. Conserva este documento para tus registros.
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

function PrintIcon({ className = "" }) {
  return (
    <Icon className={className}>
      <polyline points="6 9 6 2 18 2 18 9" />
      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
      <rect x="6" y="14" width="12" height="8" />
    </Icon>
  );
}
