import { apiRequest } from "./api";

export function getDoctorsBootstrap() {
  return apiRequest("/doctors/api/bootstrap");
}

export function getDoctors(params = {}) {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") {
      return;
    }

    query.set(key, String(value));
  });

  const suffix = query.toString() ? `?${query.toString()}` : "";
  return apiRequest(`/doctors/api/list${suffix}`);
}

export function getDoctorDetail(doctorId) {
  return apiRequest(`/doctors/api/${doctorId}`);
}

export function createDoctor(payload) {
  return apiRequest("/doctors/api", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateDoctor(doctorId, payload) {
  return apiRequest(`/doctors/api/${doctorId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function deactivateDoctor(doctorId) {
  return apiRequest(`/doctors/api/${doctorId}/deactivate`, {
    method: "POST",
  });
}
