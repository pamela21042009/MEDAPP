import { apiRequest } from "./api";

export function getReportsBootstrap() {
  return apiRequest("/reports/api/bootstrap");
}

export function getMedicalReport(params = {}) {
  const query = new URLSearchParams();

  if (params.doctorId) {
    query.set("doctor_id", String(params.doctorId));
  }
  if (params.dateFrom) {
    query.set("date_from", params.dateFrom);
  }
  if (params.dateTo) {
    query.set("date_to", params.dateTo);
  }

  const suffix = query.toString();
  return apiRequest(`/reports/api/medical-summary${suffix ? `?${suffix}` : ""}`);
}
