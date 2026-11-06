import { useState, type FormEvent } from "react";
import { isEmail, type Gender } from "../../auth/roles";
import GenderPicker from "../../ui/GenderPicker";
import { Busy } from "../../ui/Loader";
import type { PartyPageProps } from "../types";

const LABEL: Record<string, string> = { pending: "Waiting for approval", approving: "Waiting for approval", approved: "Invited", rejected: "Not approved" };

/** "Invite someone": only for guests the host allowed. Each request waits for an owner's approval before the invite goes out. */
export default function InviteControls({ guest, preview, requestInvite }: Pick<PartyPageProps, "guest" | "preview" | "requestInvite">) {
  const [name, setName] = useState(""), [email, setEmail] = useState(""), [note, setNote] = useState(""), [gender, setGender] = useState<Gender | "">("");
  const [busy, setBusy] = useState(false), [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  if (!guest?.invites.allowed) return preview && !guest ? <p className="kit-note">Guests the host allows to invite others see an invite form here.</p> : null;
  const { left, limit, requests } = guest.invites;
  async function send(e: FormEvent) {
    e.preventDefault(); setStatus(null);
    if (!name.trim()) { setStatus({ ok: false, text: "Enter their name." }); return; }
    if (!isEmail(email)) { setStatus({ ok: false, text: "Enter a valid email address." }); return; }
    if (!gender) { setStatus({ ok: false, text: "Pick male or female." }); return; }
    setBusy(true);
    try { await requestInvite({ name: name.trim(), email: email.trim().toLowerCase(), gender, note: note.trim() }); setStatus({ ok: true, text: `Thanks. ${name.trim()} will get their own invite once the host approves.` }); setName(""); setEmail(""); setNote(""); setGender(""); }
    catch (err) { setStatus({ ok: false, text: err instanceof Error ? err.message : "Couldn't send that. Try again." }); } finally { setBusy(false); }
  }
  return <div className="kit-invite">
    <h3>Invite someone</h3>
    <p className="kit-note">You can invite {limit} {limit === 1 ? "person" : "people"} · {left} left. Everyone gets their own invite, and the host approves each one.</p>
    {requests.length > 0 && <ul className="kit-requests">{requests.map((r) => <li key={r.email}><span>{r.name}</span><small>{LABEL[r.status] ?? r.status}</small></li>)}</ul>}
    {left > 0 && <form className="lux-form" onSubmit={send} noValidate>
      <label>Their name<input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoComplete="off" /></label>
      <label>Their email<input type="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" /></label>
      <GenderPicker name="request-gender" value={gender} onChange={setGender} />
      <label>A note for them (optional)<textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={600} rows={3} /></label>
      <button className="lux-button" disabled={busy || preview}>{busy ? <Busy>Sending…</Busy> : "Send for approval"}</button>
    </form>}
    {status && <p className={status.ok ? "lux-ok" : "lux-error"} role="status">{status.text}</p>}
  </div>;
}
