import { apiRequest, toBackendUrl } from "./api";

export function getSettingsBootstrap() {
  return apiRequest("/settings/api/bootstrap");
}

export function updateSettingsProfile(payload) {
  return apiRequest("/settings/api/profile", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function uploadSettingsAvatar(file) {
  const formData = new FormData();
  formData.append("avatar", file);
  const response = await fetch(toBackendUrl("/settings/api/profile/avatar"), {
    method: "POST",
    credentials: "include",
    body: formData,
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.error || payload?.message || "No fue posible subir la imagen.");
  }
  return payload;
}

export function changeSettingsPassword(payload) {
  return apiRequest("/settings/api/password", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateSystemSettings(payload) {
  return apiRequest("/settings/api/system", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
