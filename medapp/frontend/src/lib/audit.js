import { apiRequest } from "./api";

export function getAuditBootstrap() {
  return apiRequest("/audit/api/bootstrap");
}
