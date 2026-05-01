import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { toBackendUrl } from "../../lib/api";
import BrandLogo from "../ui/BrandLogo";
import Icon from "../ui/Icon";
import ProfileAvatar from "../ui/ProfileAvatar";

const NAV_SECTIONS = [
  {
    label: "Principal",
    items: [
      { key: "dashboard", label: "Dashboard", kind: "react", to: "/dashboard", roles: ["admin", "doctor", "staff", "paciente"], icon: DashboardIcon },
      { key: "agenda", label: "Agenda", kind: "react", to: "/agenda", roles: ["admin", "doctor", "staff", "secretaria", "paciente"], icon: CalendarIcon },
    ],
  },
  {
    label: "Gestion",
    items: [
      { key: "doctors", label: "Medicos", kind: "react", to: "/doctors", roles: ["admin", "doctor", "staff", "paciente"], icon: TeamIcon },
      { key: "patients", label: "Pacientes", kind: "react", to: "/patients", roles: ["admin", "doctor", "staff", "paciente"], icon: PatientIcon },
    ],
  },
  {
    label: "Clinico",
    roles: ["doctor", "admin", "staff"],
    items: [
      { key: "prescriptions", label: "Recetas", kind: "react", to: "/prescriptions", icon: FileIcon },
      { key: "audit", label: "Auditoria", kind: "react", to: "/audit", roles: ["admin"], icon: ClipboardIcon },
    ],
  },
  {
    label: "Finanzas",
    items: [
      { key: "schedule", label: "Horarios", kind: "react", to: "/schedule", roles: ["doctor", "admin", "staff"], icon: ClockIcon },
      { key: "payments", label: "Pagos", kind: "react", to: "/payments", roles: ["admin", "staff", "secretaria", "doctor", "paciente"], icon: CardIcon },
      { key: "reports", label: "Reportes", kind: "react", to: "/reports", roles: ["admin", "staff"], icon: ReportIcon },
    ],
  },
  {
    label: "Sistema",
    items: [
      { key: "notifications", label: "Notificaciones", kind: "react", to: "/notifications", roles: ["admin", "doctor", "staff", "paciente"], icon: BellIcon },
      { key: "settings", label: "Configuracion", kind: "react", to: "/settings", roles: ["admin", "doctor", "staff", "paciente"], icon: SettingsIcon },
    ],
  },
];

const SIDEBAR_PATTERN_STYLE = {
  backgroundImage:
    "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.03'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
};

function canAccess(userRole, roles) {
  if (!roles || roles.length === 0) {
    return true;
  }

  return roles.includes(userRole);
}

function normalizePath(path = "/") {
  if (!path) {
    return "/";
  }

  const normalized = path.replace(/\/+$/, "");
  return normalized || "/";
}

function isNavItemActive(item, activePage, pathname) {
  if (item.key !== activePage) {
    return false;
  }

  const currentPath = normalizePath(pathname);
  const targetPath = normalizePath(item.kind === "react" ? item.to : item.href);
  return currentPath === targetPath || currentPath.startsWith(`${targetPath}/`);
}

function NavEntry({ item, active, onClick }) {
  const IconComponent = item.icon;

  if (item.kind === "react") {
    return (
      <Link className={`sidebar-link-react ${active ? "active" : ""}`} to={item.to} onClick={onClick}>
        <IconComponent className="h-[18px] w-[18px] shrink-0 opacity-90" />
        <span>{item.label}</span>
      </Link>
    );
  }

  return (
    <a className={`sidebar-link-react ${active ? "active" : ""}`} href={toBackendUrl(item.href)} onClick={onClick}>
      <IconComponent className="h-[18px] w-[18px] shrink-0 opacity-90" />
      <span>{item.label}</span>
    </a>
  );
}

export default function AppShell({ pageTitle, activePage, children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signOut } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  async function handleLogout() {
    await signOut();
    navigate("/auth/login", { replace: true });
  }

  const initials = (user?.name || "Usuario")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("") || "US";

  return (
    <div className="min-h-screen bg-med-bg text-med-ink">
      <div
        className={`fixed inset-0 z-40 bg-med-ink/20 backdrop-blur-[1px] transition lg:hidden ${sidebarOpen ? "opacity-100" : "pointer-events-none opacity-0"}`}
        onClick={() => setSidebarOpen(false)}
      />

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col overflow-hidden bg-[linear-gradient(165deg,#3a3caa_0%,#5E60CE_45%,#4EA8DE_100%)] transition duration-200 lg:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="pointer-events-none absolute inset-0" style={SIDEBAR_PATTERN_STYLE} />

        <div className="relative border-b border-white/10 px-6 py-6">
          <BrandLogo
            subtitle="v2.0 Platform"
            imageClassName="h-10 w-10 rounded-xl bg-white/15 object-contain p-1.5 backdrop-blur-md"
            nameClassName="text-[1.1rem] font-bold tracking-[-0.01em] text-white"
            subtitleClassName="text-[11px] font-medium uppercase tracking-[0.08em] text-white/60"
            fallbackClassName="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 text-white backdrop-blur-md"
          />
        </div>

        <nav className="relative flex-1 overflow-y-auto py-5">
          {NAV_SECTIONS.map((section) => {
            if (!canAccess(user?.role, section.roles)) {
              return null;
            }

            const visibleItems = section.items.filter((item) => canAccess(user?.role, item.roles));

            if (visibleItems.length === 0) {
              return null;
            }

            return (
              <div key={section.label} className="mb-2">
                <div className="px-6 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/45">
                  {section.label}
                </div>
                <div className="space-y-1 px-3">
                  {visibleItems.map((item) => {
                    const active = isNavItemActive(item, activePage, location.pathname);
                    return (
                      <NavEntry
                        key={item.key}
                        item={item}
                        active={active}
                        onClick={() => setSidebarOpen(false)}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        <div className="relative border-t border-white/10 px-6 py-4">
          <div className="flex items-center gap-3">
            <ProfileAvatar
              src={user?.avatar_url || ""}
              name={user?.name || "Usuario"}
              fallback="US"
              className="h-8 w-8 shrink-0 rounded-full"
              textClassName="text-xs text-white"
              backgroundClassName="bg-white/20 text-white"
            />
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-white">{user?.name || "Usuario"}</div>
              <div className="truncate text-xs capitalize text-white/65">{user?.role || "staff"}</div>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="ml-auto rounded-lg p-2 text-white/70 transition hover:bg-white/10 hover:text-white"
              title="Cerrar sesion"
            >
              <Icon className="h-4 w-4">
                <path d="M17 16l4-4m0 0-4-4m4 4H7" />
                <path d="M13 20v1a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3h4a3 3 0 0 1 3 3v1" />
              </Icon>
            </button>
          </div>
        </div>
      </aside>

      <header className="fixed inset-x-0 top-0 z-30 flex h-[60px] items-center justify-between border-b border-med-border bg-white px-4 shadow-sm lg:left-64 lg:px-9">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => setSidebarOpen((value) => !value)}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-med-ink-muted transition hover:bg-med-bg hover:text-med-ink lg:hidden"
          >
            <Icon className="h-[18px] w-[18px]">
              <path d="M3 6h18" />
              <path d="M3 12h18" />
              <path d="M3 18h18" />
            </Icon>
          </button>
          <div className="text-base font-semibold text-med-ink">{pageTitle}</div>
        </div>

        <div className="flex items-center gap-3">
          {user?.role !== "secretaria" ? (
            <Link
              to="/notifications"
              className="hidden h-9 w-9 items-center justify-center rounded-lg text-med-ink-muted transition hover:bg-med-bg hover:text-med-ink sm:inline-flex"
            >
              <Icon className="h-[18px] w-[18px]">
                <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0 1 18 14.158V11a6.002 6.002 0 0 0-4-5.659V5a2 2 0 1 0-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5" />
                <path d="M9 17h6" />
                <path d="M10 20a2 2 0 0 0 4 0" />
              </Icon>
            </Link>
          ) : null}
          <div className="hidden h-6 w-px bg-med-border sm:block" />
          <div className="flex items-center gap-2 text-sm">
            <ProfileAvatar
              src={user?.avatar_url || ""}
              name={user?.name || "Usuario"}
              fallback="US"
              className="h-8 w-8 rounded-full"
              textClassName="text-xs text-med-violet"
              backgroundClassName="bg-[rgba(94,96,206,0.14)] text-med-violet"
            />
            <span className="hidden font-medium text-med-ink sm:inline">{user?.name || "Usuario"}</span>
          </div>
        </div>
      </header>

      <main className="px-4 pb-8 pt-[76px] lg:ml-64 lg:px-9">
        {children}
      </main>
    </div>
  );
}

function DashboardIcon({ className }) {
  return (
    <Icon className={className}>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </Icon>
  );
}

function CalendarIcon({ className }) {
  return (
    <Icon className={className}>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M8 2v4" />
      <path d="M16 2v4" />
      <path d="M3 10h18" />
    </Icon>
  );
}

function TeamIcon({ className }) {
  return (
    <Icon className={className}>
      <path d="M17 20h5v-2a4 4 0 0 0-5-3.87" />
      <path d="M9 20H4v-2a4 4 0 0 1 5-3.87" />
      <path d="M9 16.13A4 4 0 1 0 13 8a4 4 0 0 0-4 8.13Z" />
    </Icon>
  );
}

function PatientIcon({ className }) {
  return (
    <Icon className={className}>
      <path d="M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z" />
      <path d="M12 14a7 7 0 0 0-7 7h14a7 7 0 0 0-7-7Z" />
    </Icon>
  );
}

function FileIcon({ className }) {
  return (
    <Icon className={className}>
      <path d="M9 12h6" />
      <path d="M9 16h6" />
      <path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9Z" />
      <path d="M14 2v7h7" />
    </Icon>
  );
}

function ClipboardIcon({ className }) {
  return (
    <Icon className={className}>
      <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
      <path d="M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2" />
      <path d="M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2" />
    </Icon>
  );
}

function ClockIcon({ className }) {
  return (
    <Icon className={className}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6" />
      <path d="m12 12 4 2" />
    </Icon>
  );
}

function CardIcon({ className }) {
  return (
    <Icon className={className}>
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="M2 10h20" />
    </Icon>
  );
}

function ReportIcon({ className }) {
  return (
    <Icon className={className}>
      <path d="M4 19V11a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v8" />
      <path d="M10 19V7a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v12" />
      <path d="M16 19V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v15" />
    </Icon>
  );
}

function SettingsIcon({ className }) {
  return (
    <Icon className={className}>
      <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 0 0 1.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 0 0-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 0 0-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 0 0-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 0 0-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 0 0 1.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065Z" />
      <circle cx="12" cy="12" r="3" />
    </Icon>
  );
}

function BellIcon({ className }) {
  return (
    <Icon className={className}>
      <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0 1 18 14.158V11a6.002 6.002 0 0 0-4-5.659V5a2 2 0 1 0-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5" />
      <path d="M9 17h6" />
      <path d="M10 20a2 2 0 0 0 4 0" />
    </Icon>
  );
}
