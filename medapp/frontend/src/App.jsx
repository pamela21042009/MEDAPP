import { Navigate, Route, Routes } from "react-router-dom";
import ProtectedRoute from "./components/app/ProtectedRoute";
import { AuthProvider } from "./context/AuthContext";
import AcceptInvitationPage from "./pages/AcceptInvitationPage";
import AgendaPage from "./pages/AgendaPage";
import AuditPage from "./pages/AuditPage";
import CatalogsPage from "./pages/CatalogsPage";
import DashboardPage from "./pages/DashboardPage";
import DoctorDetailPage from "./pages/DoctorDetailPage";
import DoctorFormPage from "./pages/DoctorFormPage";
import DoctorsPage from "./pages/DoctorsPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import LoginPage from "./pages/LoginPage";
import NewPasswordPage from "./pages/NewPasswordPage";
import NotificationsPage from "./pages/NotificationsPage";
import PatientDetailPage from "./pages/PatientDetailPage";
import PatientFormPage from "./pages/PatientFormPage";
import PatientsPage from "./pages/PatientsPage";
import PaymentReceiptPage from "./pages/PaymentReceiptPage";
import PaymentsPage from "./pages/PaymentsPage";
import PrescriptionCreatePage from "./pages/PrescriptionCreatePage";
import PrescriptionDetailPage from "./pages/PrescriptionDetailPage";
import PrescriptionsPage from "./pages/PrescriptionsPage";
import RegisterPage from "./pages/RegisterPage";
import ReportsPage from "./pages/ReportsPage";
import SchedulePage from "./pages/SchedulePage";
import SettingsPage from "./pages/SettingsPage";
import VerifyCodePage from "./pages/VerifyCodePage";

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/auth" element={<Navigate to="/auth/login" replace />} />
        <Route path="/auth/login" element={<LoginPage />} />
        <Route path="/auth/register" element={<RegisterPage />} />
        <Route path="/auth/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/auth/verify-code" element={<VerifyCodePage />} />
        <Route path="/auth/new-password" element={<NewPasswordPage />} />
        <Route path="/auth/accept-invitation" element={<AcceptInvitationPage />} />
        <Route path="/verify" element={<AcceptInvitationPage />} />
        <Route
          path="/agenda"
          element={(
            <ProtectedRoute roles={["admin", "doctor", "paciente", "secretaria"]}>
              <AgendaPage />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/doctors"
          element={(
            <ProtectedRoute roles={["admin", "doctor"]}>
              <DoctorsPage />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/doctors/new"
          element={(
            <ProtectedRoute roles={["admin"]}>
              <DoctorFormPage />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/doctors/:doctorId/edit"
          element={(
            <ProtectedRoute roles={["admin", "doctor"]}>
              <DoctorFormPage />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/doctors/:doctorId"
          element={(
            <ProtectedRoute roles={["admin", "doctor"]}>
              <DoctorDetailPage />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/patients"
          element={(
            <ProtectedRoute roles={["admin", "doctor", "paciente"]}>
              <PatientsPage />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/patients/new"
          element={(
            <ProtectedRoute roles={["admin"]}>
              <PatientFormPage />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/patients/:patientId/edit"
          element={(
            <ProtectedRoute roles={["admin", "doctor"]}>
              <PatientFormPage />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/patients/:patientId"
          element={(
            <ProtectedRoute roles={["admin", "doctor", "paciente"]}>
              <PatientDetailPage />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/prescriptions"
          element={(
            <ProtectedRoute roles={["admin", "doctor", "paciente"]}>
              <PrescriptionsPage />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/prescriptions/create"
          element={(
            <ProtectedRoute roles={["admin", "doctor"]}>
              <PrescriptionCreatePage />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/prescriptions/:rxId"
          element={(
            <ProtectedRoute roles={["admin", "doctor", "paciente"]}>
              <PrescriptionDetailPage />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/payments"
          element={(
            <ProtectedRoute roles={["admin", "doctor", "paciente", "secretaria"]}>
              <PaymentsPage />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/payments/:paymentId/receipt"
          element={(
            <ProtectedRoute roles={["admin", "doctor", "paciente", "secretaria"]}>
              <PaymentReceiptPage />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/reports"
          element={(
            <ProtectedRoute roles={["admin", "doctor", "paciente"]}>
              <ReportsPage />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/schedule"
          element={(
            <ProtectedRoute roles={["admin", "doctor"]}>
              <SchedulePage />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/dashboard"
          element={(
            <ProtectedRoute roles={["admin", "doctor", "paciente"]}>
              <DashboardPage />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/settings"
          element={(
            <ProtectedRoute roles={["admin", "doctor", "paciente"]}>
              <SettingsPage />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/notifications"
          element={(
            <ProtectedRoute roles={["admin", "doctor", "paciente"]}>
              <NotificationsPage />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/audit"
          element={(
            <ProtectedRoute roles={["admin"]}>
              <AuditPage />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/catalogs"
          element={(
            <ProtectedRoute roles={["admin"]}>
              <CatalogsPage />
            </ProtectedRoute>
          )}
        />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </AuthProvider>
  );
}
