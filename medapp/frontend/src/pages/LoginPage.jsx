import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import BrandLogo from "../components/ui/BrandLogo";
import Icon from "../components/ui/Icon";
import { useAuth } from "../context/AuthContext";
import { login } from "../lib/auth";
import { toBackendUrl } from "../lib/api";
import { getLandingPath, isReactAppRoute, normalizeAppRoute } from "../lib/routes";

export default function LoginPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, loading, setUser } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const notice = location.state?.notice || "";

  useEffect(() => {
    if (loading || !user) {
      return;
    }

    const destination = normalizeAppRoute(getLandingPath(user.role));

    if (isReactAppRoute(destination)) {
      navigate(destination, { replace: true });
      return;
    }

    window.location.href = toBackendUrl(destination);
  }, [loading, navigate, user]);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const result = await login({ email, password, remember });
      setUser(result?.user || null);

      const rawDestination = result?.redirect_to || "/dashboard";
      const destination = normalizeAppRoute(rawDestination);

      if (isReactAppRoute(destination)) {
        navigate(destination, { replace: true });
      } else {
        window.location.href = toBackendUrl(rawDestination);
      }
    } catch (err) {
      setError(err.message || "No fue posible iniciar sesion.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-shell flex min-h-screen items-center justify-center px-5 py-8">
      <div className="grid w-full max-w-[860px] overflow-hidden rounded-[24px] bg-white shadow-auth-card lg:grid-cols-[1.05fr_1fr]">
        <section className="animate-slide-left bg-white px-6 py-10 sm:px-10 lg:px-12">
          <BrandLogo containerClassName="mb-8" />

          <header className="mb-7">
            <h1 className="font-display text-[2rem] font-bold leading-none tracking-[-0.04em] text-med-ink sm:text-[2.1rem]">
              Bienvenido de vuelta
            </h1>
            <p className="mt-3 max-w-md text-sm font-light leading-6 text-med-ink-muted">
              Ingresa tus credenciales para acceder al sistema con la misma logica actual de Flask y Supabase.
            </p>
          </header>

          {error ? (
            <div className="mb-5 rounded-2xl border border-[rgba(247,37,133,0.22)] bg-[rgba(247,37,133,0.08)] px-4 py-3 text-sm text-[#c0185a]">
              {error}
            </div>
          ) : null}

          {!error && notice ? (
            <div className="mb-5 rounded-2xl border border-[rgba(128,237,153,0.35)] bg-white px-4 py-3 text-sm text-[#1f7a3a] shadow-sm">
              {notice}
            </div>
          ) : null}

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="field-group relative animate-fade-up">
              <Icon className="input-icon">
                <path d="M4 7h16" />
                <rect x="3" y="5" width="18" height="14" rx="2" />
                <path d="m4 7 8 6 8-6" />
              </Icon>
              <input
                className="med-input"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="correo@ejemplo.com"
                autoComplete="email"
                required
              />
            </div>

            <div className="field-group relative animate-fade-up [animation-delay:120ms]">
              <Icon className="input-icon">
                <rect x="5" y="11" width="14" height="10" rx="2" />
                <path d="M8 11V8a4 4 0 1 1 8 0v3" />
              </Icon>
              <input
                className="med-input pr-12"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Contrasena"
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-med-ink-subtle transition hover:text-med-violet"
                aria-label={showPassword ? "Ocultar contrasena" : "Mostrar contrasena"}
              >
                {showPassword ? (
                  <Icon className="h-5 w-5">
                    <path d="M3 3l18 18" />
                    <path d="M10.58 10.58a2 2 0 0 0 2.83 2.83" />
                    <path d="M9.88 5.09A10.94 10.94 0 0 1 12 5c5 0 9.27 3.11 11 7-1 2.23-2.66 4.08-4.72 5.19" />
                    <path d="M6.61 6.61C4.62 7.8 3 9.68 2 12c1.73 3.89 6 7 10 7a11.2 11.2 0 0 0 4.36-.88" />
                  </Icon>
                ) : (
                  <Icon className="h-5 w-5">
                    <path d="M2 12s3.64-7 10-7 10 7 10 7-3.64 7-10 7-10-7-10-7Z" />
                    <circle cx="12" cy="12" r="3" />
                  </Icon>
                )}
              </button>
            </div>

            <div className="flex items-center justify-between gap-4 pt-1 text-sm text-med-ink-muted">
              <label className="inline-flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(event) => setRemember(event.target.checked)}
                  className="h-4 w-4 rounded border-med-border text-med-violet focus:ring-med-violet"
                />
                <span>Recordarme</span>
              </label>
              <Link className="font-medium text-med-violet transition hover:opacity-75" to="/auth/forgot-password">
                Olvidaste tu contrasena?
              </Link>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(105deg,#5E60CE_0%,#4EA8DE_100%)] px-5 py-3.5 font-display text-[0.95rem] font-semibold text-white shadow-auth-btn transition hover:-translate-y-0.5 hover:shadow-[0_14px_36px_rgba(94,96,206,0.46)] disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:translate-y-0"
            >
              <span>{submitting ? "Ingresando..." : "Iniciar sesion"}</span>
              <Icon className="h-4 w-4">
                <path d="M5 12h14" />
                <path d="m13 6 6 6-6 6" />
              </Icon>
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-med-ink-muted">
            No tienes cuenta?{" "}
            <Link className="font-semibold text-med-violet transition hover:opacity-75" to="/auth/register">
              Crear cuenta
            </Link>
          </p>

          <p className="mt-6 text-center text-xs text-med-ink-subtle">
            © 2025 MedApp - Sistema de Gestion de Citas
          </p>
        </section>

        <aside className="relative hidden overflow-hidden bg-[linear-gradient(148deg,#3A3BA0_0%,#5E60CE_30%,#4EA8DE_66%,#A0EDCE_100%)] px-8 py-10 text-white lg:flex lg:flex-col lg:justify-end lg:animate-slide-right">
          <div className="absolute -right-24 -top-24 h-[340px] w-[340px] rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.13)_0%,transparent_68%)]" />
          <div className="absolute -left-10 top-16 h-[190px] w-[190px] animate-float-soft rounded-full bg-[radial-gradient(circle,rgba(255,209,102,0.22)_0%,transparent_65%)]" />
          <div className="absolute -right-16 bottom-20 h-[250px] w-[250px] animate-float-soft rounded-full bg-[radial-gradient(circle,rgba(247,37,133,0.15)_0%,transparent_62%)] [animation-delay:2.2s]" />
          <div className="absolute left-[52%] top-[42%] h-[100px] w-[100px] animate-float-soft bg-[rgba(128,237,153,0.16)] [border-radius:38%_62%_63%_37%/41%_44%_56%_59%] [animation-delay:1.3s]" />
          <div className="absolute -right-40 -top-44 h-[480px] w-[480px] rounded-full border border-white/10" />
          <div className="absolute -right-16 -top-20 h-[310px] w-[310px] rounded-full border border-white/10" />

          <div className="relative z-10">
            <div className="mb-7 flex flex-wrap gap-2">
              <span className="pill-chip">
                <span className="h-2 w-2 rounded-full bg-med-mint" />
                Agenda en tiempo real
              </span>
              <span className="pill-chip">
                <span className="h-2 w-2 rounded-full bg-med-amber" />
                Historial clinico
              </span>
              <span className="pill-chip">
                <span className="h-2 w-2 rounded-full bg-med-rose" />
                Acceso por rol
              </span>
            </div>

            <h2 className="font-display text-[2.3rem] font-extrabold leading-[1.05] tracking-[-0.04em] text-white">
              Gestion medica
              <br />
              inteligente.
            </h2>

            <p className="mt-4 max-w-[280px] text-[0.95rem] font-light leading-7 text-white/70">
              Citas, pacientes y equipo medico desde un unico panel visual. React se encarga de la vista; Flask sigue mandando la logica.
            </p>
          </div>
        </aside>
      </div>
    </main>
  );
}
