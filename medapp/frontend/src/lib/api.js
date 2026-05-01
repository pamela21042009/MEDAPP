const API_BASE = (import.meta.env.VITE_API_BASE || "http://localhost:5000").replace(/\/$/, "");
const BACKEND_ORIGIN = (
  import.meta.env.VITE_BACKEND_ORIGIN ||
  import.meta.env.VITE_API_BASE ||
  "http://localhost:5000"
).replace(/\/$/, "");

async function parseJson(response) {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

export async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  const payload = await parseJson(response);

  if (!response.ok) {
    const message = payload?.error || payload?.message || "Ocurrio un error inesperado.";
    throw new Error(message);
  }

  return payload;
}

export function toBackendUrl(path = "/") {
  if (/^https?:\/\//.test(path)) {
    return path;
  }

  return `${BACKEND_ORIGIN}${path.startsWith("/") ? path : `/${path}`}`;
}
