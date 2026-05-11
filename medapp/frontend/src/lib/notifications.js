import { apiRequest } from "./api";

export function getNotificationsBootstrap() {
  return apiRequest("/notifications/api/bootstrap");
}

export function getUnreadNotifications() {
  return apiRequest("/notifications/api/unread");
}

export function markNotificationRead(notificationId) {
  return apiRequest(`/notifications/api/${notificationId}/read`, {
    method: "POST",
  });
}

export function markAllNotificationsRead() {
  return apiRequest("/notifications/api/read-all", {
    method: "POST",
  });
}

export function runAppointmentReminders() {
  return apiRequest("/notifications/api/reminders/run", {
    method: "POST",
  });
}
