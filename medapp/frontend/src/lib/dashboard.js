import { apiRequest } from "./api";

export function getDashboardData() {
  return apiRequest("/api/dashboard");
}
