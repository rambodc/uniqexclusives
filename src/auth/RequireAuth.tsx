import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "./AuthContext";

export function Loading() { return <main className="lux-page lux-center"><div className="spinner" aria-label="Loading" /></main>; }
export default function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <Loading />;
  if (!user) return <Navigate to="/signin" replace />;
  return <>{children}</>;
}
