import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";

export function Loading() { return <main className="ws-page ws-center"><div className="spinner" aria-label="Loading" /></main>; }
export default function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth(), location = useLocation();
  if (loading) return <Loading />;
  if (!user) return <Navigate to={`/signin?next=${encodeURIComponent(location.pathname)}`} replace />;
  return <>{children}</>;
}
