import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { PageLoader } from "../ui/Loader";
import { useAuth } from "./AuthContext";

export default function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/signin" replace />;
  return <>{children}</>;
}
