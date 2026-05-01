import { apiRequest } from "./api";

export function getPrescriptionsBootstrap() {
  return apiRequest("/prescriptions/api/bootstrap");
}

export function getPrescriptions() {
  return apiRequest("/prescriptions/api/list");
}

export function getPrescriptionDetail(rxId) {
  return apiRequest(`/prescriptions/api/${rxId}`);
}

export function createPrescription(payload) {
  return apiRequest("/prescriptions/api", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function searchMedications(query) {
  const params = new URLSearchParams({ q: query });
  return apiRequest(`/prescriptions/api/medications?${params.toString()}`);
}
