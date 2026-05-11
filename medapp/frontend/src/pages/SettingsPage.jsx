import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import AppShell from "../components/app/AppShell";
import ProfileAvatar from "../components/ui/ProfileAvatar";
import { useAuth } from "../context/AuthContext";
import {
  changeSettingsPassword,
  getSettingsBootstrap,
  updateSettingsProfile,
  uploadSettingsAvatar,
  updateSystemSettings,
} from "../lib/settings";

const SYSTEM_FIELDS = [
  { key: "clinic_name", label: "Nombre de la clinica", placeholder: "MedApp Clinica" },
  { key: "clinic_phone", label: "Telefono principal", placeholder: "+1 (809) 000-0000" },
  { key: "clinic_address", label: "Direccion", placeholder: "Calle principal #123" },
  { key: "default_slot_minutes", label: "Duracion de cita (minutos)", placeholder: "30" },
  { key: "currency", label: "Moneda", placeholder: "USD" },
  { key: "reminder_hours", label: "Recordatorio (horas antes)", placeholder: "24" },
  { key: "tax_rate", label: "Tasa de impuesto", placeholder: "0.18" },
  { key: "timezone", label: "Zona horaria", placeholder: "America/Santo_Domingo" },
];

export default function SettingsPage() {
  const navigate = useNavigate();
  const { user, setUser, signOut } = useAuth();
  const [role, setRole] = useState("staff");
  const [profile, setProfile] = useState({ first_name: "", last_name: "", phone: "", email: "", avatar_url: "" });
  const [passwords, setPasswords] = useState({ current_password: "", new_password: "", confirm_password: "" });
  const [systemConfig, setSystemConfig] = useState({});
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarNotice, setAvatarNotice] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [savingSystem, setSavingSystem] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  useEffect(() => {
    let active = true;

    async function loadSettings() {
      setLoading(true);
      setError("");

      try {
        const payload = await getSettingsBootstrap();
        if (!active) {
          return;
        }

        setRole(payload?.role || "staff");
        setProfile({
          first_name: payload?.profile?.first_name || "",
          last_name: payload?.profile?.last_name || "",
          phone: payload?.profile?.phone || "",
          email: payload?.profile?.email || "",
          avatar_url: payload?.profile?.avatar_url || "",
        });
        setSystemConfig(payload?.cfg || {});
      } catch (err) {
        if (active) {
          setError(err.message || "No fue posible cargar la configuracion.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadSettings();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!toast) {
      return undefined;
    }
    const timeoutId = window.setTimeout(() => setToast(""), 3200);
    return () => window.clearTimeout(timeoutId);
  }, [toast]);

  async function handleProfileSubmit(event) {
    event.preventDefault();
    setSavingProfile(true);
    setError("");

    try {
      const result = await updateSettingsProfile(profile);
      if (result?.user) {
        setUser(result.user);
      }
      setToast(result?.message || "Perfil actualizado.");
    } catch (err) {
      setError(err.message || "No fue posible actualizar el perfil.");
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleAvatarFile(event) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    if (!file.type.startsWith("image/")) {
      setError("Selecciona una imagen PNG, JPG, JPEG o WEBP.");
      event.target.value = "";
      return;
    }

    setUploadingAvatar(true);
    setAvatarNotice("");
    setError("");
    try {
      const result = await uploadSettingsAvatar(file);
      setProfile((current) => ({ ...current, avatar_url: result.avatar_url || "" }));
      if (result?.user) {
        setUser(result.user);
      }
      setAvatarNotice("Foto actualizada correctamente.");
      setToast(result?.message || "Foto actualizada.");
    } catch (err) {
      setError(err.message || "No fue posible subir la imagen.");
    } finally {
      setUploadingAvatar(false);
      event.target.value = "";
    }
  }

  async function handlePasswordSubmit(event) {
    event.preventDefault();
    setSavingPassword(true);
    setError("");

    try {
      const result = await changeSettingsPassword(passwords);
      setPasswords({ current_password: "", new_password: "", confirm_password: "" });
      setToast(result?.message || "Contrasena actualizada.");
    } catch (err) {
      setError(err.message || "No fue posible actualizar la contrasena.");
    } finally {
      setSavingPassword(false);
    }
  }

  async function handleSystemSubmit(event) {
    event.preventDefault();
    setSavingSystem(true);
    setError("");

    try {
      const result = await updateSystemSettings(systemConfig);
      setSystemConfig(result?.cfg || systemConfig);
      setToast(result?.message || "Configuracion guardada.");
    } catch (err) {
      setError(err.message || "No fue posible guardar la configuracion del sistema.");
    } finally {
      setSavingSystem(false);
    }
  }

  async function handleLogout() {
    await signOut();
    navigate("/auth/login", { replace: true });
  }

  return (
    <AppShell pageTitle="Configuracion" activePage="settings">
      <section className="mb-8">
        <h1 className="text-[1.45rem] font-bold tracking-[-0.02em] text-med-ink">Configuracion</h1>
        <p className="mt-1 text-sm text-med-ink-muted">Administra tu perfil y las preferencias del sistema.</p>
      </section>

      {error ? (
        <div className="mb-6 rounded-2xl border border-[rgba(247,37,133,0.22)] bg-[rgba(247,37,133,0.08)] px-4 py-3 text-sm text-[#c0185a]">
          {error}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <div className="space-y-6">
          <Card title="Mi perfil" badge={role}>
            <form className="space-y-4" onSubmit={handleProfileSubmit}>
              <div className="flex items-center gap-4 rounded-2xl bg-med-bg px-4 py-4">
                <ProfileAvatar
                  src={profile.avatar_url}
                  name={`${profile.first_name} ${profile.last_name}`.trim()}
                  fallback="US"
                  className="h-16 w-16 rounded-2xl"
                  textClassName="text-lg text-med-violet"
                  backgroundClassName="bg-[rgba(94,96,206,0.14)] text-med-violet"
                />
                <div className="min-w-0">
                  <div className="font-semibold text-med-ink">Vista previa</div>
                  <div className="text-sm text-med-ink-muted">Selecciona una imagen desde tu equipo para usarla como foto de perfil.</div>
                  <div className="mt-3">
                    <input
                      className="block w-full text-sm text-med-ink-muted file:mr-3 file:rounded-lg file:border-0 file:bg-med-violet file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white"
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={handleAvatarFile}
                      disabled={uploadingAvatar || loading}
                    />
                    {uploadingAvatar ? <div className="mt-2 text-xs text-med-violet">Subiendo imagen...</div> : null}
                    {avatarNotice ? <div className="mt-2 text-xs text-[#1f7a3a]">{avatarNotice}</div> : null}
                  </div>
                </div>
              </div>
              <Field label="Nombre">
                <input className="med-input px-4 py-3" value={profile.first_name} onChange={(event) => setProfile((current) => ({ ...current, first_name: event.target.value }))} required />
              </Field>
              <Field label="Apellido">
                <input className="med-input px-4 py-3" value={profile.last_name} onChange={(event) => setProfile((current) => ({ ...current, last_name: event.target.value }))} required />
              </Field>
              <Field label="Telefono">
                <input className="med-input px-4 py-3" value={profile.phone} onChange={(event) => setProfile((current) => ({ ...current, phone: event.target.value }))} />
              </Field>
              <Field label="Correo electronico">
                <input className="med-input cursor-not-allowed bg-med-bg px-4 py-3 text-med-ink-muted" value={profile.email} disabled />
              </Field>
              <button type="submit" className="app-btn-violet w-full justify-center" disabled={savingProfile || loading}>
                {savingProfile ? "Guardando..." : "Guardar cambios"}
              </button>
            </form>
          </Card>

          <Card title="Cambiar contrasena">
            <form className="space-y-4" onSubmit={handlePasswordSubmit}>
              <Field label="Contrasena actual">
                <input className="med-input px-4 py-3" type="password" value={passwords.current_password} onChange={(event) => setPasswords((current) => ({ ...current, current_password: event.target.value }))} required />
              </Field>
              <Field label="Nueva contrasena">
                <input className="med-input px-4 py-3" type="password" value={passwords.new_password} onChange={(event) => setPasswords((current) => ({ ...current, new_password: event.target.value }))} required />
              </Field>
              <Field label="Confirmar nueva contrasena">
                <input className="med-input px-4 py-3" type="password" value={passwords.confirm_password} onChange={(event) => setPasswords((current) => ({ ...current, confirm_password: event.target.value }))} required />
              </Field>
              <button type="submit" className="app-btn-outline w-full justify-center" disabled={savingPassword || loading}>
                {savingPassword ? "Actualizando..." : "Cambiar contrasena"}
              </button>
            </form>
          </Card>
        </div>

        {role === "admin" ? (
          <Card title="Configuracion del sistema" badge="Solo admin">
            <form className="space-y-4" onSubmit={handleSystemSubmit}>
              <div className="grid gap-4 md:grid-cols-2">
                {SYSTEM_FIELDS.map((field) => (
                  <Field key={field.key} label={field.label} className={field.key === "clinic_address" ? "md:col-span-2" : ""}>
                    <input
                      className="med-input px-4 py-3"
                      value={systemConfig[field.key] || ""}
                      onChange={(event) => setSystemConfig((current) => ({ ...current, [field.key]: event.target.value }))}
                      placeholder={field.placeholder}
                    />
                  </Field>
                ))}
              </div>
              <button type="submit" className="app-btn-violet w-full justify-center" disabled={savingSystem || loading}>
                {savingSystem ? "Guardando..." : "Guardar configuracion"}
              </button>
            </form>
          </Card>
        ) : (
          <Card title="Acciones rapidas">
            <div className="flex flex-col gap-3">
              <Link className="app-btn-outline justify-center" to="/agenda">Ver agenda</Link>
              <Link className="app-btn-ghost justify-center" to="/patients">Lista de pacientes</Link>
              {["doctor", "admin", "staff"].includes(user?.role) ? (
                <Link className="app-btn-ghost justify-center" to="/prescriptions">Mis recetas</Link>
              ) : null}
              <button type="button" className="app-btn justify-center border-[rgba(247,37,133,0.2)] bg-[rgba(247,37,133,0.08)] text-[#c0105e]" onClick={handleLogout}>
                Cerrar sesion
              </button>
            </div>
          </Card>
        )}
      </div>

      {toast ? (
        <div className="pointer-events-none fixed bottom-6 right-6 z-[100]">
          <div className="rounded-xl border border-[rgba(128,237,153,0.35)] bg-white px-4 py-3 text-sm font-medium text-[#1f7a3a] shadow-lg">
            {toast}
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}

function Card({ title, badge, children }) {
  return (
    <section className="app-surface overflow-hidden">
      <div className="flex items-center justify-between gap-4 border-b border-med-border px-6 py-5">
        <h2 className="text-[0.95rem] font-semibold text-med-ink">{title}</h2>
        {badge ? <span className="rounded-full bg-[rgba(94,96,206,0.08)] px-3 py-1 text-xs font-semibold capitalize text-med-violet">{badge}</span> : null}
      </div>
      <div className="px-6 py-6">{children}</div>
    </section>
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
