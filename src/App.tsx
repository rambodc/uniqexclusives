import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext";
import RequireAuth, { Loading } from "./auth/RequireAuth";
import SignIn from "./auth/SignIn";
import Home from "./public/Home";

const Inside = lazy(() => import("./inside/Inside"));
const InviteRedeem = lazy(() => import("./parties/InviteRedeem"));
const PartyRoute = lazy(() => import("./parties/PartyRoute"));

export default function App() {
  return <AuthProvider><Suspense fallback={<Loading />}><Routes>
    <Route path="/" element={<Home />} />
    <Route path="/signin" element={<SignIn />} />
    <Route path="/i/:partyId/:token" element={<InviteRedeem />} />
    <Route path="/p/:partyId" element={<RequireAuth><PartyRoute /></RequireAuth>} />
    <Route path="/app/*" element={<RequireAuth><Inside /></RequireAuth>} />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes></Suspense></AuthProvider>;
}
