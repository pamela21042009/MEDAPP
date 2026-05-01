import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import AuthLayout from "../components/auth/AuthLayout";
import Icon from "../components/ui/Icon";
import { getResetContext, updateForgottenPassword } from "../lib/auth";

export default function NewPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
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
        if (!result?.email || !result?.has_verified_code) {
          navigate("/auth/forgot-password", { replace: true });
          return;
        }
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

  const checks = useMemo(() => ([
    { label: "Minimo 8 caracteres", ok: password.length >= 8 },
    { label: "Al menos una mayuscula", ok: /[A-Z]/.test(password) },
    { label: "Al menos un numero", ok: /[0-9]/.test(password) },
  ]), [password]);

  const passedChecks = checks.filter((item) => item.ok).length;
  const passwordsMatch = password.length > 0 && password === confirmPassword;

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const result = await updateForgottenPassword({
        password,
        confirm_password: confirmPassword,
      });
      navigate("/auth/login", {
        replace: true,
        state: {
          notice: result?.message || "Contrasena actualizada correctamente. Ya puedes iniciar sesion.",
        },
      });
    } catch (err) {
      setError(err.message || "No fue posible actualizar la contrasena.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout
      title="Nueva contrasena"
      subtitle="Elige una contrasena segura para proteger tu cuenta."
      visualTitle={<>Casi<br />listo.</>}
      visualText="Elige una contrasena segura que solo tu conozcas."
    >
      {error ? (
        <div className="mb-5 rounded-2xl border border-[rgba(247,37,133,0.22)] bg-[rgba(247,37,133,0.08)] px-4 py-3 text-sm text-[#c0185a]">
          {error}
        </div>
      ) : null}

      <form className="space-y-5" onSubmit={handleSubmit}>
        <PasswordField
          label="Nueva contrasena"
          value={password}
          onChange={setPassword}
          show={showPassword}
          onToggle={() => setShowPassword((value) => !value)}
        />

        <div>
          <div className="h-1 rounded-full bg-med-border">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${(passedChecks / 3) * 100}%`,
                backgroundColor: passedChecks === 1 ? "#F72585" : passedChecks === 2 ? "#FFD166" : "#52D68A",
              }}
            />
          </div>
          <div className="mt-3 space-y-2">
            {checks.map((item) => (
              <div key={item.label} className={`flex items-center gap-2 text-sm ${item.ok ? "text-[#1f7a3a]" : "text-med-ink-subtle"}`}>
                <Icon className="h-4 w-4">
                  {item.ok ? <path d="M5 13l4 4L19 7" /> : <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none" />}
                </Icon>
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        </div>

        <PasswordField
          label="Confirmar contrasena"
          value={confirmPassword}
          onChange={setConfirmPassword}
          show={showConfirm}
          onToggle={() => setShowConfirm((value) => !value)}
        />

        {!loading && confirmPassword ? (
          <div className={`text-sm ${passwordsMatch ? "text-[#1f7a3a]" : "text-[#c0185a]"}`}>
            {passwordsMatch ? "Las contrasenas coinciden." : "Las contrasenas no coinciden."}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={loading || submitting || passedChecks < 3 || !passwordsMatch}
          className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(105deg,#5E60CE_0%,#4EA8DE_100%)] px-5 py-3.5 font-display text-[0.95rem] font-semibold text-white shadow-auth-btn transition hover:-translate-y-0.5 hover:shadow-[0_14px_36px_rgba(94,96,206,0.46)] disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:translate-y-0"
        >
          {submitting ? "Actualizando..." : "Cambiar contrasena"}
        </button>
      </form>
    </AuthLayout>
  );
}

function PasswordField({ label, value, onChange, show, onToggle }) {
  return (
    <div>
      <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.08em] text-med-ink-muted">{label}</label>
      <div className="relative">
        <input
          className="med-input px-4 py-3 pr-12"
          type={show ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Minimo 8 caracteres"
          required
        />
        <button
          type="button"
          className="absolute right-4 top-1/2 -translate-y-1/2 text-med-ink-subtle transition hover:text-med-violet"
          onClick={onToggle}
        >
          <Icon className="h-5 w-5">
            {show ? (
              <>
                <path d="M3 3l18 18" />
                <path d="M10.58 10.58a2 2 0 0 0 2.83 2.83" />
                <path d="M9.88 5.09A10.94 10.94 0 0 1 12 5c5 0 9.27 3.11 11 7-1 2.23-2.66 4.08-4.72 5.19" />
                <path d="M6.61 6.61C4.62 7.8 3 9.68 2 12c1.73 3.89 6 7 10 7a11.2 11.2 0 0 0 4.36-.88" />
              </>
            ) : (
              <>
                <path d="M2 12s3.64-7 10-7 10 7 10 7-3.64 7-10 7-10-7-10-7Z" />
                <circle cx="12" cy="12" r="3" />
              </>
            )}
          </Icon>
        </button>
      </div>
    </div>
  );
}
