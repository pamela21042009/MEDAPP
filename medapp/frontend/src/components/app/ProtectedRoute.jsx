import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { getLandingPath } from "../../lib/routes";

function FullScreenLoader() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-med-bg px-6">
      <div className="app-surface flex items-center gap-3 px-5 py-4 text-sm text-med-ink-muted">
        <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-med-violet" />
        Cargando sesion...
      </div>
    </main>
  );
}

export default function ProtectedRoute({ children, roles = [] }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <FullScreenLoader />;
  }

  if (!user) {
    return <Navigate to="/auth/login" replace />;
  }

  if (roles.length > 0 && !roles.includes(user.role)) {
    return <Navigate to={getLandingPath(user.role)} replace />;
  }

  if (
    user.role === "secretaria" &&
    !["/agenda", "/payments", "/patients"].some((path) => location.pathname === path || location.pathname.startsWith(`${path}/`))
  ) {
    return <Navigate to={getLandingPath(user.role)} replace />;
  }

  return children;
}
