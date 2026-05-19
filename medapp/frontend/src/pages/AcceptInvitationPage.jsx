import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import AuthLayout from "../components/auth/AuthLayout";
import Icon from "../components/ui/Icon";
import { useAuth } from "../context/AuthContext";
import { acceptDoctorInvitation, verifyDoctorInvitation } from "../lib/auth";
import { getLandingPath } from "../lib/routes";

export default function AcceptInvitationPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const token = searchParams.get("token") || "";
  const [invitation, setInvitation] = useState(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    let active = true;

    async function validateToken() {
      setLoading(true);
      setError("");
      try {
        if (!token) {
          throw new Error("Token requerido.");
        }
        const result = await verifyDoctorInvitation(token);
        if (active) {
          setInvitation(result?.invitation || null);
        }
      } catch (err) {
        if (active) {
          setError(err.message || "La invitacion no es valida.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    validateToken();

    return () => {
      active = false;
    };
  }, [token]);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const result = await acceptDoctorInvitation({
        token,
        password,
        confirm_password: confirmPassword,
      });
      const user = result?.user || null;
      setUser(user);
      navigate(getLandingPath(user?.role), { replace: true });
    } catch (err) {
      setError(err.message || "No fue posible activar la cuenta.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout
      title="Activar cuenta medica"
      subtitle="Valida tu invitacion y crea una contrasena segura para entrar al sistema."
      visualTitle={<>Acceso<br />verificado.</>}
      visualText="La invitacion expira en 24 horas y solo puede usarse una vez."
      chips={[
        { label: "JWT seguro", color: "#80ED99" },
        { label: "Email verificado", color: "#FFD166" },
        { label: "Rol doctor", color: "#F72585" },
      ]}
      footer={(
        <p className="text-center text-sm text-med-ink-muted">
          Ya tienes cuenta?{" "}
          <Link className="font-semibold text-med-violet transition hover:opacity-75" to="/auth/login">
            Iniciar sesion
          </Link>
        </p>
      )}
    >
      {loading ? (
        <div className="rounded-2xl border border-med-border bg-med-bg px-4 py-4 text-sm text-med-ink-muted">
          Validando invitacion...
        </div>
      ) : error && !invitation ? (
        <div className="rounded-2xl border border-[rgba(247,37,133,0.22)] bg-[rgba(247,37,133,0.08)] px-4 py-3 text-sm text-[#c0185a]">
          {error}
        </div>
      ) : (
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="rounded-2xl border border-med-border bg-med-bg px-4 py-4 text-sm text-med-ink-muted">
            <div className="font-semibold text-med-ink">{invitation?.full_name || "Doctor invitado"}</div>
            <div className="mt-1">{invitation?.email}</div>
          </div>

          {error ? (
            <div className="rounded-2xl border border-[rgba(247,37,133,0.22)] bg-[rgba(247,37,133,0.08)] px-4 py-3 text-sm text-[#c0185a]">
              {error}
            </div>
          ) : null}

          <PasswordField
            label="Contrasena"
            value={password}
            show={showPassword}
            onToggle={() => setShowPassword((value) => !value)}
            onChange={setPassword}
          />

          <PasswordField
            label="Confirmar contrasena"
            value={confirmPassword}
            show={showPassword}
            onToggle={() => setShowPassword((value) => !value)}
            onChange={setConfirmPassword}
          />

          <button
            type="submit"
            disabled={submitting}
            className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[linear-gradient(105deg,#5E60CE_0%,#4EA8DE_100%)] px-5 py-3 font-display text-[0.95rem] font-semibold text-white shadow-auth-btn transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:translate-y-0"
          >
            <span>{submitting ? "Activando..." : "Activar cuenta"}</span>
            <Icon className="h-4 w-4">
              <path d="M5 12h14" />
              <path d="m13 6 6 6-6 6" />
            </Icon>
          </button>
        </form>
      )}
    </AuthLayout>
  );
}

function PasswordField({ label, value, show, onChange, onToggle }) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.08em] text-med-ink-muted">{label}</span>
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
          onClick={onToggle}
          className="absolute right-4 top-1/2 -translate-y-1/2 text-med-ink-subtle transition hover:text-med-violet"
          aria-label={show ? "Ocultar contrasena" : "Mostrar contrasena"}
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
    </label>
  );
}
