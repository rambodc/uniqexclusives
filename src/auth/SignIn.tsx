import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, Navigate } from "react-router-dom";
import { signInWithCustomToken } from "firebase/auth";
import { FirebaseError } from "firebase/app";
import { auth, requestCode, verifyCode } from "../core/firebase";
import { useAuth } from "./AuthContext";
import { codeDigits, formatCodeInput, isEmail } from "./roles";
import { Busy, CardOverlay } from "../ui/Loader";
import "../ui/lux.css";

const SENT = "Your code is on its way.";
const NO_ACCOUNT = "There's no account for that email. UEX is invite-only.";
const RESEND_AFTER_S = 30;

/** Invite-only sign-in: email, then the 6-digit code we email (only to people already on the list). No passwords, no sign-up. */
export default function SignIn() {
  const { user, loading } = useAuth();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState(""), [code, setCode] = useState("");
  const [busy, setBusy] = useState(false), [opening, setOpening] = useState(false), [error, setError] = useState(""), [wait, setWait] = useState(0);
  const codeInput = useRef<HTMLInputElement>(null);
  useEffect(() => { if (wait <= 0) return; const id = setTimeout(() => setWait(wait - 1), 1000); return () => clearTimeout(id); }, [wait]);
  useEffect(() => { if (step === "code") codeInput.current?.focus(); }, [step]);
  if (!loading && user && !busy) return <Navigate to="/app" replace />;
  // After the 6th digit: "Opening the door…" covers the card until the signed-in area loads (it has the same globe loader).

  async function send(event?: FormEvent) {
    event?.preventDefault(); setError("");
    if (!isEmail(email)) { setError("Enter a valid email address."); return; }
    setBusy(true);
    try {
      await requestCode({ email: email.trim().toLowerCase() });
      setStep("code"); setCode(""); setWait(RESEND_AFTER_S);
    } catch (e) {
      if (e instanceof FirebaseError && e.code === "functions/not-found") setError(NO_ACCOUNT);
      else setError("We couldn't reach the door. Check your connection and try again.");
    } finally { setBusy(false); }
  }
  async function verify(value: string) {
    if (value.length !== 6 || busy) return;
    setBusy(true); setOpening(true); setError("");
    try {
      const { data } = await verifyCode({ email: email.trim().toLowerCase(), code: value });
      await signInWithCustomToken(auth, data.token);
    } catch (e) {
      setOpening(false);
      setError(e instanceof FirebaseError && (e.code === "functions/permission-denied" || e.code === "functions/invalid-argument")
        ? "That code isn't right or has expired. Request a new one." : "Something went wrong. Please try again.");
      setCode(""); setTimeout(() => codeInput.current?.focus());
    } finally { setBusy(false); }
  }
  return <main className="lux-page lux-center lux-signin">
    <div className="lux-aura" aria-hidden="true" />
    <Link to="/" className="lux-back">← UEX</Link>
    <section className="lux-card">
      {opening && <CardOverlay label="Opening the door…" />}
      <img className="lux-globe" src="/brand/uex-globe.webp" alt="" width={900} height={647} />
      <p className="lux-kicker">Uniq Exclusives</p>
      {step === "email" ? <>
        <h1>Are you on the list?</h1>
        <p className="lux-note">Enter your email. If you're invited, we'll send you a 6-digit code.</p>
        <form className="lux-form" onSubmit={send} noValidate>
          <label htmlFor="email" className="sr-only">Email</label>
          <input id="email" type="email" inputMode="email" autoComplete="email" placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus required />
          {error && <p className="lux-error" role="alert">{error}</p>}
          <button className="lux-button" disabled={busy}>{busy ? <Busy>Sending your code…</Busy> : "Send my code"}</button>
        </form>
      </> : <>
        <h1>Check your email</h1>
        <p className="lux-note" role="status">{SENT}<br /><span className="lux-email">{email.trim().toLowerCase()}</span></p>
        <form className="lux-form" onSubmit={(e) => { e.preventDefault(); void verify(code); }}>
          <label htmlFor="code" className="sr-only">6-digit code</label>
          <input id="code" ref={codeInput} className="lux-code" inputMode="numeric" autoComplete="one-time-code" placeholder="000-000" maxLength={7}
            value={formatCodeInput(code)} onChange={(e) => { const v = codeDigits(e.target.value); setCode(v); if (v.length === 6) void verify(v); }} disabled={busy} />
          {error && <p className="lux-error" role="alert">{error}</p>}
          <button className="lux-button" disabled={busy || code.length !== 6}>{busy ? <Busy>Opening the door…</Busy> : "Enter"}</button>
        </form>
        <div className="lux-links">
          <button className="lux-link" onClick={() => void send()} disabled={busy || wait > 0}>{busy && !opening ? <Busy>Sending a new code…</Busy> : wait > 0 ? `Send a new code in ${wait}s` : "Send a new code"}</button>
          <button className="lux-link" onClick={() => { setStep("email"); setError(""); }}>Use a different email</button>
        </div>
      </>}
    </section>
    <p className="lux-fine">By invitation only.</p>
  </main>;
}
