import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import AppShell from "../components/app/AppShell";
import Icon from "../components/ui/Icon";
import {
  createPayment,
  createOnlinePaymentOrder,
  deletePayment,
  getPaymentsBootstrap,
  markPaymentPaid,
  refundPayment,
} from "../lib/payments";

const EMPTY_FORM = {
  patient_id: "",
  appointment_id: "",
  amount: "",
  received_amount: "",
  currency: "USD",
  method: "",
  reference: "",
  status: "pending",
};

function formatCurrency(value, currency = "USD") {
  return new Intl.NumberFormat("es-DO", {
    style: "currency",
    currency: currency || "USD",
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);
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

function statusClass(status) {
  const classes = {
    pending: "bg-[rgba(255,209,102,0.22)] text-[#8a6200]",
    paid: "bg-[rgba(128,237,153,0.18)] text-[#1f7a3a]",
    refunded: "bg-[rgba(78,168,222,0.15)] text-[#236c96]",
  };

  return classes[status] || "bg-med-bg text-med-ink-muted";
}

export default function PaymentsPage() {
  const [bootstrap, setBootstrap] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [markPaidState, setMarkPaidState] = useState({ open: false, payment: null, method: "", received_amount: "" });
  const [onlinePayState, setOnlinePayState] = useState({
    open: false,
    payment: null,
  });
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [startingCheckout, setStartingCheckout] = useState(false);

  async function loadBootstrap() {
    setLoading(true);
    setError("");

    try {
      const data = await getPaymentsBootstrap();
      setBootstrap(data);
    } catch (err) {
      setError(err.message || "No fue posible cargar los pagos.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadBootstrap();
  }, []);

  useEffect(() => {
    if (!toast) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(timeoutId);
  }, [toast]);

  const stats = bootstrap?.stats || {
    total_revenue: 0,
    pending_revenue: 0,
    paid_count: 0,
    pending_count: 0,
    refunded_count: 0,
    total_count: 0,
  };
  const payments = bootstrap?.payments || [];
  const patients = bootstrap?.patients || [];
  const appointments = bootstrap?.appointments || [];
  const methods = bootstrap?.methods || [];
  const onlinePayment = bootstrap?.online_payment || { enabled: false, provider: "", currency: "USD", stripe: {} };
  const canManage = ["admin", "staff", "secretaria"].includes(bootstrap?.role);
  const canStartOnlinePay = bootstrap?.role === "paciente" || canManage;
  const onlinePaymentEnabled = Boolean(onlinePayment?.enabled && onlinePayment?.provider === "stripe");
  const subtitle = useMemo(() => {
    if (loading) {
      return "Cargando facturacion...";
    }

    return "Control financiero del sistema.";
  }, [loading]);

  function closeCreateModal() {
    setCreateOpen(false);
    setForm(EMPTY_FORM);
    setSaving(false);
  }

  function closeMarkPaidModal() {
    setMarkPaidState({ open: false, payment: null, method: "", received_amount: "" });
    setSaving(false);
  }

  function closeOnlinePayModal() {
    setOnlinePayState({
      open: false,
      payment: null,
    });
    setStartingCheckout(false);
  }

  async function handleCreate(event) {
    event.preventDefault();
    setSaving(true);

    const chargeAmount = Number(form.amount);
    const receivedAmount =
      form.received_amount === "" || form.received_amount === null ? null : Number(form.received_amount);

    if (form.status === "paid" && receivedAmount !== null && receivedAmount < chargeAmount) {
      setError("El monto recibido no puede ser menor que el monto a cobrar.");
      setSaving(false);
      return;
    }

    try {
      const result = await createPayment({
        patient_id: Number(form.patient_id),
        appointment_id: form.appointment_id ? Number(form.appointment_id) : null,
        amount: chargeAmount,
        received_amount: receivedAmount,
        currency: form.currency,
        method: form.method,
        reference: form.reference,
        status: form.status,
      });
      closeCreateModal();
      await loadBootstrap();
      setToast({
        type: "success",
        message:
          form.status === "paid"
            ? result?.receipt_email_sent
              ? "Pago registrado y comprobante enviado al paciente."
              : "Pago registrado. No se pudo enviar el comprobante por correo."
            : "Pago registrado correctamente.",
      });
    } catch (err) {
      setError(err.message || "No fue posible registrar el pago.");
      setSaving(false);
    }
  }

  async function handleMarkPaid(event) {
    event.preventDefault();
    if (!markPaidState.payment) {
      return;
    }

    setSaving(true);

    const expectedAmount = Number(markPaidState.payment.amount || 0);
    const receivedAmount =
      markPaidState.received_amount === "" || markPaidState.received_amount === null
        ? expectedAmount
        : Number(markPaidState.received_amount);

    if (receivedAmount < expectedAmount) {
      setError("El monto recibido no puede ser menor que el monto a cobrar.");
      setSaving(false);
      return;
    }

    try {
      const result = await markPaymentPaid(markPaidState.payment.id, {
        method: markPaidState.method,
        received_amount: receivedAmount,
      });
      closeMarkPaidModal();
      await loadBootstrap();
      setToast({
        type: "success",
        message: result?.receipt_email_sent
          ? "Pago marcado como cobrado y comprobante enviado."
          : "Pago marcado como cobrado. No se pudo enviar el comprobante por correo.",
      });
    } catch (err) {
      setError(err.message || "No fue posible actualizar el pago.");
      setSaving(false);
    }
  }

  async function handleRefund(payment) {
    const confirmed = window.confirm("Deseas procesar el reembolso de este pago?");
    if (!confirmed) {
      return;
    }

    try {
      await refundPayment(payment.id);
      await loadBootstrap();
      setToast({ type: "info", message: "Pago marcado como reembolsado." });
    } catch (err) {
      setError(err.message || "No fue posible procesar el reembolso.");
    }
  }

  async function handleDelete(payment) {
    const confirmed = window.confirm("Deseas eliminar este pago?");
    if (!confirmed) {
      return;
    }

    try {
      await deletePayment(payment.id);
      await loadBootstrap();
      setToast({ type: "info", message: "Pago eliminado." });
    } catch (err) {
      setError(err.message || "No fue posible eliminar el pago.");
    }
  }

  function openOnlinePay(payment) {
    if (!onlinePaymentEnabled) {
      setError("El pago en linea aun no esta configurado. Completa STRIPE_SECRET_KEY y activa ONLINE_PAYMENT_ENABLED.");
      return;
    }

    setOnlinePayState({
      open: true,
      payment,
    });
  }

  async function handleStartCheckout() {
    if (!onlinePayState.payment) {
      return;
    }

    setStartingCheckout(true);
    setError("");

    try {
      const response = await createOnlinePaymentOrder(onlinePayState.payment.id);
      if (!response?.checkout_url) {
        throw new Error("No fue posible abrir Stripe Checkout.");
      }
      window.location.assign(response.checkout_url);
    } catch (err) {
      setError(err.message || "No fue posible iniciar el checkout en linea.");
      setStartingCheckout(false);
    }
  }

  return (
    <AppShell pageTitle="Pagos" activePage="payments">
      <section className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-[1.45rem] font-bold tracking-[-0.02em] text-med-ink">Facturacion y pagos</h1>
          <p className="mt-1 text-sm text-med-ink-muted">{subtitle}</p>
        </div>
        {canManage ? (
          <button type="button" className="app-btn-violet justify-center" onClick={() => setCreateOpen(true)}>
            <Icon className="h-4 w-4">
              <path d="M12 5v14" />
              <path d="M5 12h14" />
            </Icon>
            Registrar pago
          </button>
        ) : null}
      </section>

      {error ? (
        <div className="mb-6 rounded-2xl border border-[rgba(247,37,133,0.22)] bg-[rgba(247,37,133,0.08)] px-4 py-3 text-sm text-[#c0185a]">
          {error}
        </div>
      ) : null}

      <section className="mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard
          label="Total cobrado"
          value={formatCurrency(stats.total_revenue)}
          tone="mint"
          icon={<CardIcon />}
        />
        <StatCard
          label="Pendiente"
          value={formatCurrency(stats.pending_revenue)}
          tone="amber"
          icon={<ClockIcon />}
        />
        <StatCard label="Cobrados" value={stats.paid_count} tone="violet" icon={<CheckIcon />} />
        <StatCard label="Pendientes" value={stats.pending_count} tone="rose" icon={<AlertIcon />} />
        <StatCard label="Reembolsos" value={stats.refunded_count} tone="teal" icon={<RefundIcon />} />
      </section>

      {loading ? (
        <section className="app-surface overflow-hidden">
          <div className="space-y-3 px-6 py-6">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="h-12 animate-pulse rounded-xl bg-med-bg" />
            ))}
          </div>
        </section>
      ) : payments.length ? (
        <section className="app-surface overflow-hidden">
          <div className="flex items-center justify-between border-b border-med-border px-6 py-5">
            <h2 className="text-[0.95rem] font-semibold text-med-ink">Historial de pagos</h2>
            <span className="text-sm text-med-ink-muted">{stats.total_count} registros</span>
          </div>
          <div className="-mx-0 overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-0">
              <thead>
                <tr className="bg-med-bg">
                  <TableHead>Referencia</TableHead>
                  <TableHead>Paciente</TableHead>
                  <TableHead>Monto</TableHead>
                  <TableHead>Metodo</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Fecha creacion</TableHead>
                  <TableHead>Fecha pago</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => (
                  <tr key={payment.id} className="transition hover:bg-[#fafafe]">
                    <TableCell>
                      <span className="font-mono text-xs text-med-ink-muted">{payment.reference || "--"}</span>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-med-ink">{payment.patients?.full_name || "--"}</div>
                      <div className="text-xs text-med-ink-muted">{payment.patients?.phone || ""}</div>
                    </TableCell>
                    <TableCell>
                      <div className="font-semibold text-med-ink">{formatCurrency(payment.amount, payment.currency)}</div>
                      <div className="text-xs text-med-ink-muted">{payment.currency || "USD"}</div>
                      {Number(payment.received_amount || 0) > 0 ? (
                        <div className="mt-1 text-xs text-med-ink-muted">
                          Recibido: {formatCurrency(payment.received_amount, payment.currency)}
                        </div>
                      ) : null}
                      {Number(payment.returned_amount || 0) > 0 ? (
                        <div className="text-xs font-medium text-med-teal">
                          Devuelto: {formatCurrency(payment.returned_amount, payment.currency)}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      {payment.method ? (
                        <span className="inline-flex rounded-full bg-[rgba(94,96,206,0.1)] px-3 py-1 text-xs font-semibold text-med-violet">
                          {payment.method}
                        </span>
                      ) : (
                        <span className="text-sm text-med-ink-subtle">--</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex rounded-full px-3 py-1 text-[11px] font-semibold capitalize ${statusClass(payment.status)}`}>
                        {payment.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-med-ink-muted">{formatDate(payment.created_at)}</TableCell>
                    <TableCell className="text-sm text-med-ink-muted">{formatDate(payment.paid_at)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-wrap justify-end gap-2">
                        <Link className="app-btn-ghost px-3 py-2 text-xs" to={`/payments/${payment.id}/receipt`}>
                          Recibo
                        </Link>
                        {payment.status === "pending" && canStartOnlinePay ? (
                          <button
                            type="button"
                            className="app-btn-violet px-3 py-2 text-xs"
                            onClick={() => openOnlinePay(payment)}
                          >
                            Pagar online
                          </button>
                        ) : null}
                        {payment.status === "pending" && canManage ? (
                          <button
                            type="button"
                            className="app-btn border-med-teal bg-med-teal px-3 py-2 text-xs text-white hover:opacity-90"
                            onClick={() =>
                              setMarkPaidState({
                                open: true,
                                payment,
                                method: "",
                                received_amount: String(payment.amount || ""),
                              })
                            }
                          >
                            Cobrar
                          </button>
                        ) : null}
                        {payment.status === "paid" && canManage ? (
                          <button
                            type="button"
                            className="app-btn-ghost px-3 py-2 text-xs"
                            onClick={() => handleRefund(payment)}
                          >
                            Reembolsar
                          </button>
                        ) : null}
                        {canManage ? (
                          <button
                            type="button"
                            className="app-btn-ghost px-3 py-2 text-xs text-med-rose hover:text-med-rose"
                            onClick={() => handleDelete(payment)}
                          >
                            Eliminar
                          </button>
                        ) : null}
                      </div>
                    </TableCell>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <section className="app-surface px-6 py-10">
          <div className="mx-auto max-w-[420px] text-center">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-med-bg text-med-ink-muted">
              <CardIcon className="h-7 w-7" />
            </div>
            <h2 className="text-lg font-semibold text-med-ink">Sin pagos registrados</h2>
            <p className="mt-2 text-sm text-med-ink-muted">Registra el primer pago usando el boton superior.</p>
          </div>
        </section>
      )}

      {createOpen && canManage ? (
        <ModalFrame title="Registrar pago" onClose={closeCreateModal}>
          <form className="space-y-5" onSubmit={handleCreate}>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Paciente">
                <select
                  className="med-input px-4 py-3"
                  value={form.patient_id}
                  onChange={(event) => setForm((current) => ({ ...current, patient_id: event.target.value }))}
                  required
                >
                  <option value="">Seleccionar paciente...</option>
                  {patients.map((patient) => (
                    <option key={patient.id} value={patient.id}>
                      {patient.full_name}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Cita (opcional)">
                <select
                  className="med-input px-4 py-3"
                  value={form.appointment_id}
                  onChange={(event) => setForm((current) => ({ ...current, appointment_id: event.target.value }))}
                >
                  <option value="">Sin cita asociada</option>
                  {appointments.map((appointment) => (
                    <option key={appointment.id} value={appointment.id}>
                      #{appointment.id} - {appointment.appointment_date} {String(appointment.appointment_time || "").slice(0, 5)}
                      {appointment.patients?.full_name ? ` · ${appointment.patients.full_name}` : ""}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Monto">
                <input
                  className="med-input px-4 py-3"
                  type="number"
                  value={form.amount}
                  onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))}
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                  required
                />
              </Field>

              {form.status === "paid" ? (
                <Field label="Monto recibido">
                  <input
                    className="med-input px-4 py-3"
                    type="number"
                    value={form.received_amount}
                    onChange={(event) => setForm((current) => ({ ...current, received_amount: event.target.value }))}
                    placeholder={form.amount || "0.00"}
                    step="0.01"
                    min="0"
                  />
                </Field>
              ) : null}

              <Field label="Moneda">
                <select
                  className="med-input px-4 py-3"
                  value={form.currency}
                  onChange={(event) => setForm((current) => ({ ...current, currency: event.target.value }))}
                >
                  <option value="USD">USD</option>
                  <option value="DOP">DOP</option>
                  <option value="EUR">EUR</option>
                </select>
              </Field>

              <Field label="Metodo de pago">
                <select
                  className="med-input px-4 py-3"
                  value={form.method}
                  onChange={(event) => setForm((current) => ({ ...current, method: event.target.value }))}
                >
                  <option value="">Sin especificar</option>
                  {methods.map((method) => (
                    <option key={method} value={method}>
                      {method}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Estado inicial">
                <select
                  className="med-input px-4 py-3"
                  value={form.status}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      status: event.target.value,
                      received_amount: event.target.value === "paid" ? current.received_amount : "",
                    }))
                  }
                >
                  <option value="pending">Pendiente</option>
                  <option value="paid">Pagado</option>
                </select>
              </Field>

              <Field label="Referencia (opcional)" className="md:col-span-2">
                <input
                  className="med-input px-4 py-3"
                  type="text"
                  value={form.reference}
                  onChange={(event) => setForm((current) => ({ ...current, reference: event.target.value }))}
                  placeholder="Se genera automaticamente si lo dejas vacio"
                />
              </Field>

              {form.status === "paid" && Number(form.received_amount || 0) > Number(form.amount || 0) ? (
                <div className="md:col-span-2 rounded-2xl bg-[rgba(78,168,222,0.12)] px-4 py-3 text-sm text-med-teal">
                  Cambio a devolver: {formatCurrency(Number(form.received_amount || 0) - Number(form.amount || 0), form.currency)}
                </div>
              ) : null}
            </div>

            <div className="flex flex-wrap justify-end gap-3 border-t border-med-border pt-5">
              <button type="button" className="app-btn-ghost" onClick={closeCreateModal}>
                Cancelar
              </button>
              <button type="submit" className="app-btn-violet" disabled={saving}>
                {saving ? "Registrando..." : "Registrar pago"}
              </button>
            </div>
          </form>
        </ModalFrame>
      ) : null}

      {markPaidState.open ? (
        <ModalFrame title="Registrar cobro" onClose={closeMarkPaidModal}>
          <form className="space-y-5" onSubmit={handleMarkPaid}>
            <p className="text-sm leading-6 text-med-ink-muted">
              Paciente: <strong className="text-med-ink">{markPaidState.payment?.patients?.full_name || "--"}</strong>
              <br />
              Monto: <strong className="text-med-ink">{formatCurrency(markPaidState.payment?.amount)}</strong>
            </p>

            <Field label="Metodo de cobro">
              <select
                className="med-input px-4 py-3"
                value={markPaidState.method}
                onChange={(event) => setMarkPaidState((current) => ({ ...current, method: event.target.value }))}
                required
              >
                <option value="">Seleccionar...</option>
                {methods.map((method) => (
                  <option key={method} value={method}>
                    {method}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Monto recibido">
              <input
                className="med-input px-4 py-3"
                type="number"
                value={markPaidState.received_amount}
                onChange={(event) => setMarkPaidState((current) => ({ ...current, received_amount: event.target.value }))}
                placeholder={String(markPaidState.payment?.amount || "")}
                step="0.01"
                min="0"
              />
            </Field>

            {Number(markPaidState.received_amount || markPaidState.payment?.amount || 0) >
            Number(markPaidState.payment?.amount || 0) ? (
              <div className="rounded-2xl bg-[rgba(78,168,222,0.12)] px-4 py-3 text-sm text-med-teal">
                Cambio a devolver:{" "}
                {formatCurrency(
                  Number(markPaidState.received_amount || markPaidState.payment?.amount || 0) -
                    Number(markPaidState.payment?.amount || 0),
                  markPaidState.payment?.currency || "USD",
                )}
              </div>
            ) : null}

            <div className="flex flex-wrap justify-end gap-3 border-t border-med-border pt-5">
              <button type="button" className="app-btn-ghost" onClick={closeMarkPaidModal}>
                Cancelar
              </button>
              <button type="submit" className="app-btn border-med-teal bg-med-teal text-white hover:opacity-90" disabled={saving}>
                {saving ? "Confirmando..." : "Confirmar cobro"}
              </button>
            </div>
          </form>
        </ModalFrame>
      ) : null}

      {onlinePayState.open ? (
        <ModalFrame title="Pago en linea" onClose={closeOnlinePayModal}>
          <div className="space-y-5">
            <div className="rounded-2xl bg-med-bg px-4 py-4 text-sm leading-6 text-med-ink-muted">
              Paciente: <strong className="text-med-ink">{onlinePayState.payment?.patients?.full_name || "--"}</strong>
              <br />
              Monto a pagar:{" "}
              <strong className="text-med-ink">
                {formatCurrency(onlinePayState.payment?.amount, onlinePayState.payment?.currency)}
              </strong>
            </div>

            <div className="grid gap-4">
              <div className="rounded-2xl bg-[rgba(94,96,206,0.08)] px-4 py-4 text-sm leading-6 text-med-ink-muted">
                El pago se procesa mediante checkout seguro de {onlinePayment?.display_name || "la pasarela"}.
                <br />
                Seras redirigido a una pagina hospedada por Stripe para completar el pago con tarjeta sin que tu servidor
                almacene los datos sensibles.
              </div>

              <div className="rounded-2xl border border-med-border bg-white px-5 py-5">
                <div className="space-y-3 text-sm text-med-ink-muted">
                  <p>
                    Cuando Stripe confirme el cobro, volveras automaticamente al recibo y el sistema marcara el pago
                    como completado.
                  </p>
                  <button
                    type="button"
                    className="app-btn-violet w-full justify-center"
                    onClick={handleStartCheckout}
                    disabled={startingCheckout}
                  >
                    {startingCheckout ? "Redirigiendo a Stripe..." : `Continuar con ${onlinePayment?.display_name || "Stripe"}`}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap justify-end gap-3 border-t border-med-border pt-5">
              <button type="button" className="app-btn-ghost" onClick={closeOnlinePayModal}>
                Cancelar
              </button>
              {startingCheckout ? <span className="text-sm text-med-ink-muted">Preparando checkout...</span> : null}
            </div>
          </div>
        </ModalFrame>
      ) : null}

      {toast ? (
        <div className="pointer-events-none fixed bottom-6 right-6 z-[100]">
          <div
            className={`rounded-xl border px-4 py-3 text-sm font-medium shadow-lg ${
              toast.type === "success"
                ? "border-[rgba(128,237,153,0.35)] bg-white text-[#1f7a3a]"
                : "border-[rgba(78,168,222,0.3)] bg-white text-med-teal"
            }`}
          >
            {toast.message}
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}

function StatCard({ label, value, tone, icon }) {
  const tones = {
    mint: "bg-[rgba(128,237,153,0.18)] text-[#2fa84f]",
    amber: "bg-[rgba(255,209,102,0.22)] text-[#b7860b]",
    violet: "bg-[rgba(94,96,206,0.10)] text-med-violet",
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
          <div className="mt-1 text-[1.6rem] font-bold leading-none tracking-[-0.03em] text-med-ink">{value}</div>
        </div>
      </div>
    </div>
  );
}

function ModalFrame({ title, children, onClose }) {
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-med-ink/35 px-4 py-8" onClick={onClose}>
      <div
        className="w-full max-w-[560px] rounded-[20px] bg-white shadow-[0_24px_64px_rgba(0,0,0,0.18)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-med-border px-6 py-5">
          <div className="text-lg font-semibold text-med-ink">{title}</div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-med-ink-muted transition hover:bg-med-bg hover:text-med-ink">
            <Icon className="h-4 w-4">
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </Icon>
          </button>
        </div>
        <div className="px-6 py-6">{children}</div>
      </div>
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

function TableHead({ children, className = "" }) {
  return (
    <th className={`whitespace-nowrap border-b border-med-border px-6 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-med-ink-muted ${className}`}>
      {children}
    </th>
  );
}

function TableCell({ children, className = "" }) {
  return <td className={`border-b border-med-border px-6 py-4 align-middle ${className}`}>{children}</td>;
}

function CardIcon({ className = "h-[22px] w-[22px]" }) {
  return (
    <Icon className={className}>
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="M2 10h20" />
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

function CheckIcon() {
  return (
    <Icon className="h-[22px] w-[22px]">
      <path d="M9 12l2 2 4-4" />
      <circle cx="12" cy="12" r="9" />
    </Icon>
  );
}

function AlertIcon() {
  return (
    <Icon className="h-[22px] w-[22px]">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8v4" />
      <path d="M12 16h.01" />
    </Icon>
  );
}

function RefundIcon() {
  return (
    <Icon className="h-[22px] w-[22px]">
      <path d="M3 10h10a8 8 0 0 1 8 8v2" />
      <path d="m3 10 6 6" />
      <path d="M3 10 9 4" />
    </Icon>
  );
}
