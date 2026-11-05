import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext";
import RequireAuth from "./auth/RequireAuth";
import SignIn from "./auth/SignIn";
import Inside from "./inside/Inside";
import Home from "./public/Home";

export default function App() {
  return <AuthProvider><Routes>
    <Route path="/" element={<Home />} />
    <Route path="/signin" element={<SignIn />} />
    <Route path="/app" element={<RequireAuth><Inside /></RequireAuth>} />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes></AuthProvider>;
}
