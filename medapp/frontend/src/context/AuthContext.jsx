import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { me, logout as logoutRequest } from "../lib/auth";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const mountedRef = useRef(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  async function refreshSession(options = {}) {
    const { silent = false } = options;

    if (!silent) {
      setLoading(true);
    }

    try {
      const result = await me();
      if (mountedRef.current) {
        setUser(result?.user || null);
      }
      return result?.user || null;
    } catch {
      if (mountedRef.current) {
        setUser(null);
      }
      return null;
    } finally {
      if (!silent && mountedRef.current) {
        setLoading(false);
      }
    }
  }

  async function signOut() {
    try {
      await logoutRequest();
    } finally {
      if (mountedRef.current) {
        setUser(null);
      }
    }
  }

  useEffect(() => {
    mountedRef.current = true;
    refreshSession();

    return () => {
      mountedRef.current = false;
    };
  }, []);

  const value = useMemo(() => ({
    user,
    loading,
    setUser,
    refreshSession,
    signOut,
  }), [loading, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider.");
  }

  return context;
}
