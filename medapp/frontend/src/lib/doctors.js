import { apiRequest, toBackendUrl } from "./api";

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
  return apiRequest(`/doctors/api/list${suffix}`).then((payload) => payload?.items || []);
}

export function getDoctorDetail(doctorId) {
  return apiRequest(`/doctors/api/${doctorId}`);
}

export function createDoctor(payload) {
  return apiRequest("/auth/api/admin/doctors/invite", {
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

export async function uploadDoctorAvatar(doctorId, file) {
  const formData = new FormData();
  formData.append("avatar", file);
  const response = await fetch(toBackendUrl(`/doctors/api/${doctorId}/avatar`), {
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
