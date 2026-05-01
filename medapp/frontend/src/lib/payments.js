import { apiRequest } from "./api";

export function getPaymentsBootstrap() {
  return apiRequest("/payments/api/bootstrap");
}

export function getPaymentDetail(paymentId) {
  return apiRequest(`/payments/api/${paymentId}`);
}

export function createPayment(payload) {
  return apiRequest("/payments/api", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function markPaymentPaid(paymentId, payload) {
  return apiRequest(`/payments/api/${paymentId}/mark-paid`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function payPaymentOnline(paymentId, payload) {
  return apiRequest(`/payments/api/${paymentId}/online-pay`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function createOnlinePaymentOrder(paymentId) {
  return apiRequest(`/payments/api/${paymentId}/online-pay/create-order`, {
    method: "POST",
  });
}

export function captureOnlinePaymentOrder(paymentId, payload) {
  return apiRequest(`/payments/api/${paymentId}/online-pay/capture`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function refundPayment(paymentId) {
  return apiRequest(`/payments/api/${paymentId}/refund`, {
    method: "POST",
  });
}

export function deletePayment(paymentId) {
  return apiRequest(`/payments/api/${paymentId}`, {
    method: "DELETE",
  });
}
