import { apiRequest } from "./api";

export function login(payload) {
  return apiRequest("/auth/api/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function me() {
  return apiRequest("/auth/api/me");
}

export function logout() {
  return apiRequest("/auth/api/logout", {
    method: "POST",
  });
}

export function registerUser(payload) {
  return apiRequest("/auth/api/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getRegistrationSpecialties() {
  return apiRequest("/auth/api/specialties");
}

export function requestPasswordReset(payload) {
  return apiRequest("/auth/api/forgot-password", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getResetContext() {
  return apiRequest("/auth/api/reset-context");
}

export function verifyResetCode(payload) {
  return apiRequest("/auth/api/verify-code", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateForgottenPassword(payload) {
  return apiRequest("/auth/api/new-password", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
