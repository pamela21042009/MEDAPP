import { apiRequest } from "./api";

export function getScheduleBootstrap(doctorId = "") {
  const params = new URLSearchParams();
  if (doctorId) {
    params.set("doctor_id", doctorId);
  }

  const query = params.toString();
  return apiRequest(`/schedule/api/bootstrap${query ? `?${query}` : ""}`);
}

export function saveSchedule({ doctorId = "", days = [], holidays = [] }) {
  const payload = { days, holidays };
  if (doctorId) {
    payload.doctor_id = Number(doctorId);
  }

  return apiRequest("/schedule/api", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
