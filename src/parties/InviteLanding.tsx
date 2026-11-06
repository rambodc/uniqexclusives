import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { signInWithCustomToken, signOut } from "firebase/auth";
import { FirebaseError } from "firebase/app";
import { auth, enterInvite, errorText, openInvite, type InviteTeaser } from "../core/firebase";
import { codeDigits, formatCodeInput } from "../auth/roles";
import { formatWhen } from "./model";
import Countdown from "./kit/Countdown";
import { Busy, CardOverlay, GlobeLoader } from "../ui/Loader";
import "../ui/lux.css";
import "./kit/kit.css";

const RESEND_AFTER_S = 30;
const LIMITED = "We've sent several codes in the last hour. Use the newest one in your inbox, or try again a bit later.";
const message = (e: unknown, fallback: string) => e instanceof FirebaseError && e.code === "functions/permission-denied" ? errorText(e) : fallback;

/**
 * /i/:partyId/:token — a personal invite link. It never signs anyone in by itself: it shows the invitation, emails that guest a
 * 6-digit code, and signs them in once they type it here. Then it opens /p/:partyId. It shows the RSVP countdown, and an
 * expired invitation says so (no code is sent).
 */
export default function InviteLanding() {
  const { partyId = "", token = "" } = useParams();
  const navigate = useNavigate();
  const [invite, setInvite] = useState<InviteTeaser | null>(null), [linkError, setLinkError] = useState("");
  const [code, setCode] = useState(""), [busy, setBusy] = useState(false), [opening, setOpening] = useState(false), [error, setError] = useState(""), [wait, setWait] = useState(0);
  const started = useRef(false), codeInput = useRef<HTMLInputElement>(null);
  const goToParty = () => navigate(`/p/${partyId}`, { replace: true });

  async function send(first: boolean) {
    setError(""); setBusy(true);
    try {
      const { data } = await openInvite({ partyId, token });
      if (data.signedIn) { setOpening(true); goToParty(); return; }
      setInvite(data); setWait(RESEND_AFTER_S);
      if (!data.sent) setError(LIMITED);
      if (!first) setCode("");
    } catch (e) {
      if (first) setLinkError(message(e, "We couldn't open your invite. Check your connection and try again."));
      else setError(message(e, "We couldn't send a new code. Please try again."));
    } finally { setBusy(false); }
  }
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void send(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once per link
  }, []);
  useEffect(() => { if (wait <= 0) return; const id = setTimeout(() => setWait(wait - 1), 1000); return () => clearTimeout(id); }, [wait]);
  useEffect(() => { if (invite) codeInput.current?.focus(); }, [invite]);

  async function verify(value: string) {
    if (value.length !== 6 || busy) return;
    setBusy(true); setOpening(true); setError("");
    try {
      const { data } = await enterInvite({ partyId, token, code: value });
      if (auth.currentUser) await signOut(auth);
      await signInWithCustomToken(auth, data.token);
      goToParty();
    } catch (e) {
      setOpening(false);
      setError(message(e, "Something went wrong. Please try again."));
      setCode(""); setTimeout(() => codeInput.current?.focus());
    } finally { setBusy(false); }
  }

  return <main className="lux-page lux-center lux-invite">
    <div className="lux-aura" aria-hidden="true" />
    <section className="lux-card">
      {opening && <CardOverlay label="Opening the door…" />}
      <img className="lux-globe" src="/brand/uex-globe.webp" alt="" width={900} height={647} />
      <p className="lux-kicker">Uniq Exclusives</p>
      {linkError ? <>
        <h1>This link didn't work</h1>
        <p className="lux-error" role="alert">{linkError}</p>
        <Link className="lux-link" to="/signin">Sign in with your email instead</Link>
      </> : !invite ? <>
        <h1>Opening your invite…</h1>
        <GlobeLoader label="Sending your code…" />
      </> : invite.expired ? <>
        <p className="lux-invite-hi">{invite.firstName ? `${invite.firstName}, your invitation to` : "Your invitation to"}</p>
        <h1 className="lux-invite-name">{invite.partyName}</h1>
        <p className="lux-invite-when">{formatWhen(new Date(invite.startsAt))}</p>
        <Countdown deadline={new Date(invite.rsvpDeadline)} status="expired" />
        <Link className="lux-link" to="/signin">Sign in with your email</Link>
      </> : <>
        <p className="lux-invite-hi">{invite.firstName ? `${invite.firstName}, you're invited to` : "You're invited to"}</p>
        <h1 className="lux-invite-name">{invite.partyName}</h1>
        <p className="lux-invite-when">{formatWhen(new Date(invite.startsAt))}</p>
        <Countdown deadline={new Date(invite.rsvpDeadline)} status={invite.status} />
        <p className="lux-note" role="status">To open it, enter the 6-digit code we just emailed to<br /><span className="lux-email">{invite.email}</span></p>
        <form className="lux-form" onSubmit={(e: FormEvent) => { e.preventDefault(); void verify(code); }}>
          <label htmlFor="code" className="sr-only">6-digit code</label>
          <input id="code" ref={codeInput} className="lux-code" inputMode="numeric" autoComplete="one-time-code" placeholder="000-000" maxLength={7}
            value={formatCodeInput(code)} onChange={(e) => { const v = codeDigits(e.target.value); setCode(v); if (v.length === 6) void verify(v); }} disabled={busy} />
          {error && <p className="lux-error" role="alert">{error}</p>}
          <button className="lux-button" disabled={busy || code.length !== 6}>{busy ? <Busy>Opening the door…</Busy> : "Open my invite"}</button>
        </form>
        <div className="lux-links">
          <button className="lux-link" onClick={() => void send(false)} disabled={busy || wait > 0}>{busy && !opening ? <Busy>Sending a new code…</Busy> : wait > 0 ? `Send a new code in ${wait}s` : "Send a new code"}</button>
        </div>
      </>}
    </section>
    <p className="lux-fine">This invitation is just for you.</p>
  </main>;
}
