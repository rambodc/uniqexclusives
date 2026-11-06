import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext";
import RequireAuth from "./auth/RequireAuth";
import SignIn from "./auth/SignIn";
import Home from "./public/Home";
import { ConfirmProvider } from "./ui/Confirm";
import { PageLoader } from "./ui/Loader";

const Inside = lazy(() => import("./inside/Inside"));
const InviteLanding = lazy(() => import("./parties/InviteLanding"));
const PartyRoute = lazy(() => import("./parties/PartyRoute"));

export default function App() {
  return <AuthProvider><ConfirmProvider><Suspense fallback={<PageLoader />}><Routes>
    <Route path="/" element={<Home />} />
    <Route path="/signin" element={<SignIn />} />
    <Route path="/i/:partyId/:token" element={<InviteLanding />} />
    <Route path="/p/:partyId" element={<RequireAuth><PartyRoute /></RequireAuth>} />
    <Route path="/app/*" element={<RequireAuth><Inside /></RequireAuth>} />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes></Suspense></ConfirmProvider></AuthProvider>;
}
