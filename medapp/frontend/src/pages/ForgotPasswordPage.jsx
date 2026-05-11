import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import AuthLayout from "../components/auth/AuthLayout";
import { requestPasswordReset } from "../lib/auth";
import { normalizeAppRoute } from "../lib/routes";

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setNotice("");
    setSubmitting(true);

    try {
      const result = await requestPasswordReset({ email });
      const debugSuffix = result?.debug_code ? ` Codigo de prueba: ${result.debug_code}` : "";
      setNotice(`${result?.message || "Si el correo existe recibiras un codigo en minutos."}${debugSuffix}`);
      if (result?.sent && result?.next_step) {
        navigate(normalizeAppRoute(result.next_step), { replace: true });
      }
    } catch (err) {
      setError(err.message || "No fue posible iniciar la recuperacion.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout
      title="Recuperar acceso"
      subtitle="Te enviaremos un codigo temporal al correo asociado a tu cuenta."
      visualTitle={<>Sin acceso,<br />sin problema.</>}
      visualText="Recupera tu cuenta de forma segura en pocos pasos."
    >
      {error ? (
        <div className="mb-5 rounded-2xl border border-[rgba(247,37,133,0.22)] bg-[rgba(247,37,133,0.08)] px-4 py-3 text-sm text-[#c0185a]">
          {error}
        </div>
      ) : null}

      {notice ? (
        <div className="mb-5 rounded-2xl border border-[rgba(128,237,153,0.35)] bg-white px-4 py-3 text-sm text-[#1f7a3a] shadow-sm">
          {notice}
        </div>
      ) : null}

      <form className="space-y-4" onSubmit={handleSubmit}>
        <div>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.08em] text-med-ink-muted">
            Correo electronico
          </label>
          <input
            className="med-input px-4 py-3"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="correo@ejemplo.com"
            required
          />
        </div>
        <button
          type="submit"
          disabled={submitting}
          className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(105deg,#5E60CE_0%,#4EA8DE_100%)] px-5 py-3.5 font-display text-[0.95rem] font-semibold text-white shadow-auth-btn transition hover:-translate-y-0.5 hover:shadow-[0_14px_36px_rgba(94,96,206,0.46)] disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:translate-y-0"
        >
          {submitting ? "Enviando..." : "Enviar codigo"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-med-ink-muted">
        <Link className="font-medium text-med-violet transition hover:opacity-75" to="/auth/login">
          Volver al inicio de sesion
        </Link>
      </p>
    </AuthLayout>
  );
}
