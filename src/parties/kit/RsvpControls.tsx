import { useState } from "react";
import type { PartyPageProps } from "../types";

/** Accept / Decline, ready to drop into any custom party page. Guests can change their answer until the party starts. */
export default function RsvpControls({ guest, preview, rsvp }: Pick<PartyPageProps, "guest" | "preview" | "rsvp">) {
  const [busy, setBusy] = useState<"" | "accepted" | "declined">(""), [error, setError] = useState("");
  if (!guest) return <div className="kit-rsvp"><p className="kit-note">{preview ? "Guests accept or decline here." : ""}</p>
    <div className="kit-row"><button className="lux-button" disabled>Accept</button><button className="lux-ghost" disabled>Decline</button></div></div>;
  async function answer(status: "accepted" | "declined") {
    setBusy(status); setError("");
    try { await rsvp(status); } catch (e) { setError(e instanceof Error ? e.message : "Couldn't save that. Try again."); } finally { setBusy(""); }
  }
  const s = guest.status;
  return <div className="kit-rsvp">
    <p className="kit-note">{s === "accepted" ? "You're coming. We can't wait." : s === "declined" ? "You've declined. You can change your mind until the night." : "Will you join us?"}</p>
    {guest.canRespond ? <div className="kit-row">
      <button className={`lux-button${s === "accepted" ? " is-on" : ""}`} onClick={() => void answer("accepted")} disabled={!!busy || s === "accepted"} aria-pressed={s === "accepted"}>{busy === "accepted" ? "Saving…" : s === "accepted" ? "Accepted ✓" : "Accept"}</button>
      <button className={`lux-ghost${s === "declined" ? " is-on" : ""}`} onClick={() => void answer("declined")} disabled={!!busy || s === "declined"} aria-pressed={s === "declined"}>{busy === "declined" ? "Saving…" : s === "declined" ? "Declined" : "Decline"}</button>
    </div> : <p className="kit-note">RSVPs are closed.</p>}
    {error && <p className="lux-error" role="alert">{error}</p>}
  </div>;
}
