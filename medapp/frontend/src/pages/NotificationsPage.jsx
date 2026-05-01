import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import AppShell from "../components/app/AppShell";
import Icon from "../components/ui/Icon";
import { toBackendUrl } from "../lib/api";
import { isReactAppRoute, normalizeAppRoute } from "../lib/routes";
import {
  getNotificationsBootstrap,
  markAllNotificationsRead,
  markNotificationRead,
} from "../lib/notifications";

const TYPE_META = {
  confirmation: { color: "bg-[rgba(128,237,153,0.18)] text-[#1f7a3a]", icon: CheckIcon },
  reminder: { color: "bg-[rgba(94,96,206,0.12)] text-med-violet", icon: CalendarIcon },
  payment: { color: "bg-[rgba(128,237,153,0.18)] text-[#1f7a3a]", icon: CardIcon },
  cancellation: { color: "bg-[rgba(247,37,133,0.14)] text-med-rose", icon: CloseIcon },
  system: { color: "bg-[rgba(78,168,222,0.14)] text-med-teal", icon: InfoIcon },
  prescription: { color: "bg-[rgba(255,209,102,0.22)] text-[#8a6200]", icon: FileIcon },
};

export default function NotificationsPage() {
  const [items, setItems] = useState([]);
  const [unreadBefore, setUnreadBefore] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadNotifications() {
    setLoading(true);
    setError("");

    try {
      const payload = await getNotificationsBootstrap();
      setItems(payload?.items || []);
      setUnreadBefore(payload?.unread_count_before || 0);
    } catch (err) {
      setError(err.message || "No fue posible cargar las notificaciones.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadNotifications();
  }, []);

  async function handleMarkRead(notificationId) {
    try {
      await markNotificationRead(notificationId);
      setItems((current) => current.map((item) => (
        item.id === notificationId ? { ...item, is_read: true } : item
      )));
    } catch (err) {
      setError(err.message || "No fue posible marcar la notificacion.");
    }
  }

  async function handleMarkAllRead() {
    try {
      await markAllNotificationsRead();
      setItems((current) => current.map((item) => ({ ...item, is_read: true })));
      setUnreadBefore(0);
    } catch (err) {
      setError(err.message || "No fue posible actualizar las notificaciones.");
    }
  }

  return (
    <AppShell pageTitle="Notificaciones" activePage="notifications">
      <section className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-[1.45rem] font-bold tracking-[-0.02em] text-med-ink">Notificaciones</h1>
          <p className="mt-1 text-sm text-med-ink-muted">Alertas, avisos y eventos recientes del sistema.</p>
        </div>
        <button type="button" className="app-btn-ghost" onClick={handleMarkAllRead} disabled={loading || !items.length}>
          Marcar todo como leido
        </button>
      </section>

      {error ? (
        <div className="mb-6 rounded-2xl border border-[rgba(247,37,133,0.22)] bg-[rgba(247,37,133,0.08)] px-4 py-3 text-sm text-[#c0185a]">
          {error}
        </div>
      ) : null}

      <section className="mb-6 grid gap-4 md:grid-cols-3">
        <StatCard label="Total" value={loading ? "--" : items.length} detail="notificaciones" tone="violet" icon={<BellIcon />} />
        <StatCard label="Nuevas al abrir" value={loading ? "--" : unreadBefore} detail="pendientes" tone="teal" icon={<InfoIcon />} />
        <StatCard label="Leidas" value={loading ? "--" : items.filter((item) => item.is_read).length} detail="actualizadas" tone="mint" icon={<CheckIcon />} />
      </section>

      {loading ? (
        <section className="app-surface px-6 py-6">
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="h-16 animate-pulse rounded-2xl bg-med-bg" />
            ))}
          </div>
        </section>
      ) : items.length ? (
        <div className="space-y-4">
          {items.map((item) => {
            const meta = TYPE_META[item.type] || TYPE_META.system;
            const IconComponent = meta.icon;
            return (
              <section key={item.id} className={`app-surface px-5 py-5 ${item.is_read ? "" : "ring-1 ring-[rgba(94,96,206,0.12)]"}`}>
                <div className="flex flex-col gap-4 md:flex-row md:items-start">
                  <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${meta.color}`}>
                    <IconComponent className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-3">
                      <h2 className="text-base font-semibold text-med-ink">{item.title}</h2>
                      {!item.is_read ? (
                        <span className="rounded-full bg-[rgba(94,96,206,0.10)] px-3 py-1 text-[11px] font-semibold text-med-violet">Nuevo</span>
                      ) : null}
                    </div>
                    <p className="mt-2 text-sm leading-6 text-med-ink-muted">{item.message}</p>
                    <div className="mt-3 text-xs font-medium uppercase tracking-[0.08em] text-med-ink-subtle">
                      {formatDate(item.created_at)}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 md:justify-end">
                    {!item.is_read ? (
                      <button type="button" className="app-btn-ghost px-3 py-2 text-xs" onClick={() => handleMarkRead(item.id)}>
                        Marcar leida
                      </button>
                    ) : null}
                    {item.link ? <NotificationLink link={item.link} /> : null}
                  </div>
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <section className="app-surface px-6 py-10">
          <div className="mx-auto max-w-[420px] text-center">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-med-bg text-med-ink-muted">
              <BellIcon className="h-7 w-7" />
            </div>
            <h2 className="text-lg font-semibold text-med-ink">Sin notificaciones</h2>
            <p className="mt-2 text-sm text-med-ink-muted">Estas al dia. Las alertas apareceran aqui.</p>
          </div>
        </section>
      )}
    </AppShell>
  );
}

function NotificationLink({ link }) {
  if (isReactAppRoute(link)) {
    return (
      <Link className="app-btn-violet px-3 py-2 text-xs" to={normalizeAppRoute(link)}>
        Ver
      </Link>
    );
  }

  return (
    <a className="app-btn-violet px-3 py-2 text-xs" href={toBackendUrl(link)}>
      Ver
    </a>
  );
}

function formatDate(value) {
  if (!value) {
    return "--";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value).replace("T", " ").slice(0, 16);
  }
  return new Intl.DateTimeFormat("es-DO", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function StatCard({ label, value, detail, tone, icon }) {
  const tones = {
    violet: "bg-[rgba(94,96,206,0.10)] text-med-violet",
    teal: "bg-[rgba(78,168,222,0.14)] text-med-teal",
    mint: "bg-[rgba(128,237,153,0.18)] text-[#2fa84f]",
  };

  return (
    <div className="app-card relative overflow-hidden px-6 py-6">
      <div className="absolute right-0 top-0 h-20 w-20 rounded-bl-[80px] bg-current opacity-[0.05]" />
      <div className="flex items-start gap-5">
        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${tones[tone]}`}>
          {icon}
        </div>
        <div>
          <div className="text-sm font-medium text-med-ink-muted">{label}</div>
          <div className="mt-1 text-[1.8rem] font-bold leading-none tracking-[-0.03em] text-med-ink">{value}</div>
          <div className="mt-2 text-sm text-med-ink-muted">{detail}</div>
        </div>
      </div>
    </div>
  );
}

function BellIcon({ className = "h-[22px] w-[22px]" }) {
  return (
    <Icon className={className}>
      <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0 1 18 14.158V11a6.002 6.002 0 0 0-4-5.659V5a2 2 0 1 0-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5" />
      <path d="M9 17h6" />
      <path d="M10 20a2 2 0 0 0 4 0" />
    </Icon>
  );
}

function CalendarIcon({ className = "h-[22px] w-[22px]" }) {
  return (
    <Icon className={className}>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M8 2v4" />
      <path d="M16 2v4" />
      <path d="M3 10h18" />
    </Icon>
  );
}

function CardIcon({ className = "h-[22px] w-[22px]" }) {
  return (
    <Icon className={className}>
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="M2 10h20" />
    </Icon>
  );
}

function CloseIcon({ className = "h-[22px] w-[22px]" }) {
  return (
    <Icon className={className}>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </Icon>
  );
}

function InfoIcon({ className = "h-[22px] w-[22px]" }) {
  return (
    <Icon className={className}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8v4" />
      <path d="M12 16h.01" />
    </Icon>
  );
}

function FileIcon({ className = "h-[22px] w-[22px]" }) {
  return (
    <Icon className={className}>
      <path d="M9 12h6" />
      <path d="M9 16h6" />
      <path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9Z" />
      <path d="M14 2v7h7" />
    </Icon>
  );
}

function CheckIcon({ className = "h-[22px] w-[22px]" }) {
  return (
    <Icon className={className}>
      <path d="M5 13l4 4L19 7" />
    </Icon>
  );
}
