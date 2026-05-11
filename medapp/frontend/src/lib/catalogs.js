import { apiRequest } from "./api";

export function getCatalogsBootstrap() {
  return apiRequest("/catalogs/api/bootstrap");
}

export function createSpecialty(payload) {
  return apiRequest("/catalogs/api/specialties", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateSpecialty(itemId, payload) {
  return apiRequest(`/catalogs/api/specialties/${itemId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function deleteSpecialty(itemId) {
  return apiRequest(`/catalogs/api/specialties/${itemId}`, {
    method: "DELETE",
  });
}

export function createMedication(payload) {
  return apiRequest("/catalogs/api/medications", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateMedication(itemId, payload) {
  return apiRequest(`/catalogs/api/medications/${itemId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function deleteMedication(itemId) {
  return apiRequest(`/catalogs/api/medications/${itemId}`, {
    method: "DELETE",
  });
}
