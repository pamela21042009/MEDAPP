import { apiRequest, toBackendUrl } from "./api";

export function getPatientsBootstrap() {
  return apiRequest("/patients/api/bootstrap");
}

export function getPatients(params = {}) {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") {
      return;
    }

    query.set(key, String(value));
  });

  const suffix = query.toString() ? `?${query.toString()}` : "";
  return apiRequest(`/patients/api/list${suffix}`);
}

export function getPatientDetail(patientId) {
  return apiRequest(`/patients/api/${patientId}`);
}

export function createPatient(payload) {
  return apiRequest("/patients/api", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updatePatient(patientId, payload) {
  return apiRequest(`/patients/api/${patientId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function uploadPatientAvatar(patientId, file) {
  const formData = new FormData();
  formData.append("avatar", file);
  const response = await fetch(toBackendUrl(`/patients/api/${patientId}/avatar`), {
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

export function updatePatientClinicalNote(patientId, appointmentId, payload) {
  return apiRequest(`/patients/api/${patientId}/appointments/${appointmentId}/notes`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function addPatientClinicalHistory(patientId, payload) {
  return apiRequest(`/patients/api/${patientId}/clinical-history`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function addPatientVitals(patientId, payload) {
  return apiRequest(`/patients/api/${patientId}/vitals`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function addPatientDocument(patientId, payload) {
  return apiRequest(`/patients/api/${patientId}/documents`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
