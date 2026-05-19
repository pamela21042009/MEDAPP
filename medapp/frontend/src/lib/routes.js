export const APP_ROUTE_PREFIXES = [
  "/dashboard",
  "/agenda",
  "/doctors",
  "/patients",
  "/prescriptions",
  "/payments",
  "/reports",
  "/schedule",
  "/settings",
  "/notifications",
  "/audit",
  "/catalogs",
];

export function getLandingPath(role) {
  const destinations = {
    admin: "/dashboard",
    doctor: "/dashboard",
    paciente: "/dashboard",
    secretaria: "/agenda",
  };

  return destinations[role] || "/dashboard";
}

export function normalizeAppRoute(pathname = "/") {
  const pathOnly = String(pathname || "/").trim().replace(/^https?:\/\/[^/]+/i, "");
  const normalized = pathOnly.replace(/\/+$/, "");
  return normalized || "/";
}

export function isReactAppRoute(pathname) {
  const normalized = normalizeAppRoute(pathname);

  return APP_ROUTE_PREFIXES.some(
    (prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`),
  );
}
