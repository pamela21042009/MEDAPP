import { apiRequest } from "./api";

export function getAgendaBootstrap() {
  return apiRequest("/agenda/api/bootstrap");
}

export function getAgendaEvents(params) {
  const query = params instanceof URLSearchParams ? params.toString() : new URLSearchParams(params).toString();
  return apiRequest(`/agenda/api/events?${query}`);
}

export function createAgendaAppointment(payload) {
  return apiRequest("/agenda/api/appointments", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateAgendaAppointment(appointmentId, payload) {
  return apiRequest(`/agenda/api/appointments/${appointmentId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function cancelAgendaAppointment(appointmentId, reason) {
  return apiRequest(`/agenda/api/appointments/${appointmentId}/cancel`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

export function rescheduleAgendaAppointment(appointmentId, payload) {
  return apiRequest(`/agenda/api/appointments/${appointmentId}/reschedule`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getAgendaSlots(doctorId, date) {
  const params = new URLSearchParams({
    doctor_id: String(doctorId),
    date,
  });
  return apiRequest(`/agenda/api/slots?${params.toString()}`);
}
