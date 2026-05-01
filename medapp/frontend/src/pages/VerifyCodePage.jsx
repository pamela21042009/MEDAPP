import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import AuthLayout from "../components/auth/AuthLayout";
import { getResetContext, verifyResetCode } from "../lib/auth";
import { normalizeAppRoute } from "../lib/routes";

export default function VerifyCodePage() {
  const navigate = useNavigate();
  const inputRefs = useRef([]);
  const [email, setEmail] = useState("");
  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
  const [secondsLeft, setSecondsLeft] = useState(600);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadContext() {
      try {
        const result = await getResetContext();
        if (!active) {
          return;
        }
        if (!result?.email) {
          navigate("/auth/forgot-password", { replace: true });
          return;
        }
        setEmail(result.email);
      } catch {
        if (active) {
          navigate("/auth/forgot-password", { replace: true });
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadContext();

    return () => {
      active = false;
    };
  }, [navigate]);

  useEffect(() => {
    if (loading || secondsLeft <= 0) {
      return undefined;
    }
    const timeoutId = window.setTimeout(() => setSecondsLeft((value) => value - 1), 1000);
    return () => window.clearTimeout(timeoutId);
  }, [loading, secondsLeft]);

  function updateDigit(index, rawValue) {
    const value = rawValue.replace(/\D/g, "").slice(-1);
    setDigits((current) => {
      const next = [...current];
      next[index] = value;
      return next;
    });

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  }

  function handleKeyDown(index, event) {
    if (event.key === "Backspace" && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  function handlePaste(event) {
    event.preventDefault();
    const value = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!value) {
      return;
    }
    const next = ["", "", "", "", "", ""];
    value.split("").forEach((digit, index) => {
      next[index] = digit;
    });
    setDigits(next);
    inputRefs.current[Math.min(value.length, 5)]?.focus();
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const code = digits.join("");
    if (code.length < 6) {
      setError("Ingresa el codigo completo de 6 digitos.");
      return;
    }

    setError("");
    setSubmitting(true);

    try {
      const result = await verifyResetCode({ code });
      navigate(normalizeAppRoute(result?.next_step || "/auth/new-password"), { replace: true });
    } catch (err) {
      setError(err.message || "No fue posible verificar el codigo.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout
      title="Verificar codigo"
      subtitle={email ? `Ingresa el codigo de 6 digitos enviado a ${email}.` : "Verificando contexto..."}
      visualTitle={<>Codigo<br />seguro.</>}
      visualText="El codigo expira en 10 minutos por tu seguridad."
    >
      {error ? (
        <div className="mb-5 rounded-2xl border border-[rgba(247,37,133,0.22)] bg-[rgba(247,37,133,0.08)] px-4 py-3 text-sm text-[#c0185a]">
          {error}
        </div>
      ) : null}

      <form className="space-y-5" onSubmit={handleSubmit}>
        <div className="flex justify-center gap-3" onPaste={handlePaste}>
          {digits.map((digit, index) => (
            <input
              key={index}
              ref={(node) => { inputRefs.current[index] = node; }}
              className={`h-14 w-12 rounded-2xl border-2 text-center text-xl font-bold text-med-ink outline-none transition ${
                digit ? "border-med-violet bg-[rgba(94,96,206,0.08)]" : "border-med-border bg-med-input"
              } focus:border-med-violet focus:bg-white focus:ring-4 focus:ring-[rgba(94,96,206,0.10)]`}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(event) => updateDigit(index, event.target.value)}
              onKeyDown={(event) => handleKeyDown(index, event)}
              disabled={loading || submitting || secondsLeft <= 0}
            />
          ))}
        </div>

        <div className="text-center text-sm text-med-ink-muted">
          Expira en <span className="font-bold text-med-violet">{formatCountdown(secondsLeft)}</span>
        </div>

        <button
          type="submit"
          disabled={loading || submitting || digits.join("").length < 6 || secondsLeft <= 0}
          className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(105deg,#5E60CE_0%,#4EA8DE_100%)] px-5 py-3.5 font-display text-[0.95rem] font-semibold text-white shadow-auth-btn transition hover:-translate-y-0.5 hover:shadow-[0_14px_36px_rgba(94,96,206,0.46)] disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:translate-y-0"
        >
          {submitting ? "Verificando..." : "Verificar codigo"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-med-ink-muted">
        <Link className="font-medium text-med-violet transition hover:opacity-75" to="/auth/forgot-password">
          Volver e intentar con otro correo
        </Link>
      </p>
    </AuthLayout>
  );
}

function formatCountdown(seconds) {
  if (seconds <= 0) {
    return "Expirado";
  }
  const minutes = Math.floor(seconds / 60).toString().padStart(2, "0");
  const remainingSeconds = (seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${remainingSeconds}`;
}
