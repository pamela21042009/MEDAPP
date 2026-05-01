import { apiRequest } from "./api";

export function getSettingsBootstrap() {
  return apiRequest("/settings/api/bootstrap");
}

export function updateSettingsProfile(payload) {
  return apiRequest("/settings/api/profile", {
    method: "POST",
    body: JSON.stringify(payload),
  });
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
