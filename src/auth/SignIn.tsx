import { useState, type FormEvent } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { createUserWithEmailAndPassword, sendEmailVerification, sendPasswordResetEmail, signInWithEmailAndPassword, updateProfile } from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "../core/firebase";
import { useAuth } from "./AuthContext";
import { cleanName, safeNext } from "./roles";
import { authErrorMessage } from "./signInMessages";

type Mode = "signin" | "signup" | "reset";
const RESET_SENT = "If there's an account for that email, a reset link is on its way.";

export default function SignIn() {
  const { user, loading } = useAuth(), [params] = useSearchParams(), next = safeNext(params.get("next"));
  const [mode, setMode] = useState<Mode>(params.get("mode") === "signup" ? "signup" : "signin");
  const [firstName, setFirstName] = useState(""), [lastName, setLastName] = useState(""), [email, setEmail] = useState(""), [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [sent, setSent] = useState(false);
  if (!loading && user && !busy) return <Navigate to={next} replace />;
  const switchTo = (to: Mode) => { setMode(to); setError(""); setSent(false); };
  const cleanEmail = () => email.trim().toLowerCase();

  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      if (mode === "signin") await signInWithEmailAndPassword(auth, cleanEmail(), password);
      else if (mode === "signup") {
        const first = cleanName(firstName), last = cleanName(lastName);
        if (!first || !last) throw { code: "names" };
        if (password.length < 8) throw { code: "auth/weak-password" };
        const { user: created } = await createUserWithEmailAndPassword(auth, cleanEmail(), password);
        await updateProfile(created, { displayName: `${first} ${last}` });
        await setDoc(doc(db, "users", created.uid), { email: created.email, firstName: first, lastName: last, role: "member", createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
        await sendEmailVerification(created).catch(() => undefined);
      } else {
        await sendPasswordResetEmail(auth, cleanEmail()).catch(() => undefined);
        setSent(true);
      }
    } catch (cause) {
      setError(typeof cause === "object" && cause && (cause as { code?: string }).code === "names" ? "Enter your first and last name." : authErrorMessage(cause));
    } finally { setBusy(false); }
  }

  const titles: Record<Mode, [string, string]> = {
    signin: ["Welcome back.", "Sign in to your Uniq Exclusives account."],
    signup: ["Create your account.", "Join Uniq Exclusives to get your invites and updates in one place."],
    reset: ["Reset your password.", "Enter your email and we'll send you a link to choose a new password."]
  };
  return <main className="auth-page"><Link className="auth-back" to="/">← Back to Uniq Exclusives</Link>
    <form className="auth-card" onSubmit={submit}>
      <span className="eyebrow">Uniq Exclusives</span><h1>{titles[mode][0]}</h1><p>{titles[mode][1]}</p>
      {error && <div className="status error" role="alert">{error}</div>}
      {sent && <div className="status success" role="status">{RESET_SENT}</div>}
      {mode === "signup" && <div className="auth-row">
        <label>First name<input value={firstName} onChange={(e) => setFirstName(e.target.value)} required autoComplete="given-name" maxLength={60} /></label>
        <label>Last name<input value={lastName} onChange={(e) => setLastName(e.target.value)} required autoComplete="family-name" maxLength={60} /></label>
      </div>}
      <label>Email address<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" /></label>
      {mode !== "reset" && <label>Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={mode === "signup" ? 8 : undefined} autoComplete={mode === "signup" ? "new-password" : "current-password"} /></label>}
      <button className="button-primary full" disabled={busy}>{busy ? "One moment…" : mode === "signin" ? "Sign in" : mode === "signup" ? "Create account" : sent ? "Send again" : "Send reset link"}</button>
      <div className="auth-links">
        {mode !== "signin" && <button type="button" className="auth-link" onClick={() => switchTo("signin")}>Have an account? Sign in</button>}
        {mode !== "signup" && <button type="button" className="auth-link" onClick={() => switchTo("signup")}>New here? Create an account</button>}
        {mode === "signin" && <button type="button" className="auth-link" onClick={() => switchTo("reset")}>Forgot password?</button>}
      </div>
    </form>
  </main>;
}
