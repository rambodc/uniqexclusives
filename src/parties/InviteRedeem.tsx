import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { signInWithCustomToken, signOut } from "firebase/auth";
import { FirebaseError } from "firebase/app";
import { auth, redeemInvite } from "../core/firebase";
import "../ui/lux.css";

/** /i/:partyId/:token — a personal invite link. It signs that one person in and opens the party. */
export default function InviteRedeem() {
  const { partyId = "", token = "" } = useParams();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      try {
        const { data } = await redeemInvite({ partyId, token });
        if (auth.currentUser) await signOut(auth);
        await signInWithCustomToken(auth, data.token);
        navigate(`/p/${partyId}`, { replace: true });
      } catch (e) {
        setError(e instanceof FirebaseError && e.code === "functions/permission-denied" ? e.message : "We couldn't open your invite. Check your connection and try again.");
      }
    })();
  }, [partyId, token, navigate]);
  return <main className="lux-page lux-center">
    <div className="lux-aura" aria-hidden="true" />
    <section className="lux-card">
      <img className="lux-globe" src="/brand/uex-globe.webp" alt="" width={900} height={647} />
      <p className="lux-kicker">Uniq Exclusives</p>
      {error ? <>
        <h1>This link didn't work</h1>
        <p className="lux-error" role="alert">{error}</p>
        <Link className="lux-link" to="/signin">Sign in with your email instead</Link>
      </> : <>
        <h1>Opening your invite…</h1>
        <div className="spinner" aria-label="Loading" />
      </>}
    </section>
  </main>;
}
