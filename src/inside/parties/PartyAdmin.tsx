import { useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { collection, doc, onSnapshot, orderBy, query } from "firebase/firestore";
import { getDownloadURL, ref } from "firebase/storage";
import { FirebaseError } from "firebase/app";
import { db, decideRequest, inviteGuest, inviteLinkFor, removeGuest, resendInvite, updateGuest } from "../../core/firebase";
import { storage } from "../../core/storage";
import { isEmail } from "../../auth/roles";
import { STATUS_LABELS, formatWhen, guestCounts, parseGuest, parseParty, parseRequest, type Guest, type InviteRequest, type Party } from "../../parties/model";
import { hasPage } from "../../parties/registry";

const say = (e: unknown) => e instanceof FirebaseError && e.message && !e.message.startsWith("internal") ? e.message : "Something went wrong. Please try again.";
type Status = { ok: boolean; text: string; link?: string } | null;
const initials = (name: string) => name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();

async function copy(text: string) { try { await navigator.clipboard.writeText(text); return true; } catch { return false; } }

/** Owners: one party's guest list, invites, and the invites guests asked for. */
export default function PartyAdmin() {
  const { partyId = "" } = useParams();
  const [party, setParty] = useState<Party | null | "none">(null), [location, setLocation] = useState("");
  const [guests, setGuests] = useState<Guest[]>([]), [requests, setRequests] = useState<InviteRequest[]>([]);
  const [photo, setPhoto] = useState<string | null>(null), [now] = useState(() => Date.now());
  const [status, setStatus] = useState<Status>(null), [busy, setBusy] = useState("");
  const [editing, setEditing] = useState<string | null>(null), [allow, setAllow] = useState({ can: false, n: "2" });

  useEffect(() => onSnapshot(doc(db, "parties", partyId), (s) => setParty(parseParty(s.id, s.data()) ?? "none"), () => setParty("none")), [partyId]);
  useEffect(() => onSnapshot(doc(db, "parties", partyId, "private", "details"), (s) => setLocation((s.get("location") as string | undefined) ?? ""), () => undefined), [partyId]);
  useEffect(() => onSnapshot(query(collection(db, "parties", partyId, "guests"), orderBy("name")), (s) => setGuests(s.docs.flatMap((d) => parseGuest(d.id, d.data()) ?? [])), () => undefined), [partyId]);
  useEffect(() => onSnapshot(query(collection(db, "parties", partyId, "requests"), orderBy("createdAt", "desc")), (s) => setRequests(s.docs.flatMap((d) => parseRequest(d.id, d.data()) ?? [])), () => undefined), [partyId]);
  const photoPath = party && party !== "none" ? party.photoPath : null;
  useEffect(() => { if (photoPath) getDownloadURL(ref(storage, photoPath)).then(setPhoto, () => undefined); }, [photoPath]);

  async function act(key: string, run: () => Promise<Status>) {
    setBusy(key); setStatus(null);
    try { setStatus(await run()); } catch (e) { setStatus({ ok: false, text: say(e) }); } finally { setBusy(""); }
  }
  const sentText = (who: string, emailed: boolean, link: string): Status => emailed
    ? { ok: true, text: `Invite emailed to ${who}.` }
    : { ok: false, text: `The email to ${who} didn't go out. Copy their link and send it yourself:`, link };

  if (party === null) return <div className="spinner" aria-label="Loading" />;
  if (party === "none") return <section className="lux-panel"><p className="lux-error">That party doesn't exist anymore.</p><Link to="/app" className="lux-link">Back to parties</Link></section>;
  const counts = guestCounts(guests, requests);
  const pending = requests.filter((r) => r.status === "pending" || r.status === "approving");
  const over = now >= (party.endsAt ?? new Date(party.startsAt.getTime() + 86_400_000)).getTime();

  return <div className="lux-admin">
    <section className="lux-panel party-hero">
      <Link to="/app" className="lux-crumb">← Parties</Link>
      <div className="party-hero-row">
        {photo ? <img src={photo} alt="" className="party-hero-photo" /> : <span className="party-hero-photo party-photo-empty">No photo</span>}
        <div className="party-hero-text">
          <h1>{party.name}</h1>
          <p className="lux-note">{formatWhen(party.startsAt)}{party.dressCode ? ` · ${party.dressCode}` : ""}</p>
          <p className="lux-note">{location || "No location yet"} · <em>{party.locationRevealed ? "shown to guests" : "hidden from guests"}</em></p>
          <div className="party-chips">
            <span className={`lux-chip${party.published ? " st-accepted" : ""}`}>{party.published ? "Published" : "Draft"}</span>
            <span className={`lux-chip${hasPage(party.pageSlug) ? " st-accepted" : ""}`}>{hasPage(party.pageSlug) ? `Page: ${party.pageSlug}` : "No custom page yet"}</span>
          </div>
        </div>
      </div>
      <div className="party-actions">
        <Link to={`/app/parties/${party.id}/edit`} className="lux-ghost as-link">Edit</Link>
        <Link to={`/p/${party.id}`} className="lux-ghost as-link">Preview</Link>
      </div>
      <dl className="party-counts">
        <div><dt>Guests</dt><dd>{counts.total}{party.guestLimit ? <small> / {party.guestLimit}</small> : null}</dd></div>
        <div><dt>Accepted</dt><dd>{counts.accepted}</dd></div>
        <div><dt>Invited</dt><dd>{counts.invited}</dd></div>
        <div><dt>Declined</dt><dd>{counts.declined}</dd></div>
        <div><dt>Pending</dt><dd>{counts.pending}</dd></div>
      </dl>
    </section>

    {status && <p className={status.ok ? "lux-ok party-status" : "lux-error party-status"} role="status">{status.text}{status.link && <><br /><code className="party-link">{status.link}</code></>}</p>}

    {pending.length > 0 && <section className="lux-panel">
      <h2>Waiting for approval</h2>
      <p className="lux-note">Invites your guests asked for. Approving creates their account and emails them their own invite.</p>
      <ul className="lux-users party-guests">{pending.map((r) => <li key={r.id}>
        <span className="lux-avatar" aria-hidden="true">{initials(r.name)}</span>
        <span className="lux-who"><strong>{r.name}</strong><small>{r.email}</small><small>Guest of {r.byName}{r.note ? ` · “${r.note}”` : ""}</small></span>
        <span className="party-row-actions">
          <button className="lux-button small" disabled={!!busy || over} onClick={() => void act(r.id, async () => { const res = await decideRequest({ partyId, requestId: r.id, approve: true }).then((x) => x.data); return sentText(r.name, !!res.emailed, res.link ?? ""); })}>{busy === r.id ? "…" : "Approve"}</button>
          <button className="lux-ghost small" disabled={!!busy} onClick={() => void act(r.id, async () => { await decideRequest({ partyId, requestId: r.id, approve: false }); return { ok: true, text: `${r.name} wasn't invited.` }; })}>Reject</button>
        </span>
      </li>)}</ul>
    </section>}

    <section className="lux-panel">
      <h2>Guest list</h2>
      {!guests.length ? <p className="lux-note">Nobody yet. Invite your first guest below.</p>
        : <ul className="lux-users party-guests">{guests.map((g) => <li key={g.uid}>
          <span className="lux-avatar" aria-hidden="true">{initials(g.name)}</span>
          <span className="lux-who">
            <strong>{g.name}</strong><small>{g.email}</small>
            <small>{g.guestOf ? `Guest of ${g.guestOf}` : "No group"} · {g.canInvite ? `Can invite ${g.invitesUsed}/${g.inviteLimit}` : "Can't invite"}</small>
          </span>
          <span className={`lux-chip st-${g.status}`}>{STATUS_LABELS[g.status]}</span>
          <span className="party-row-actions">
            <button className="lux-ghost small" disabled={!!busy || over} onClick={() => void act(`c${g.uid}`, async () => { const { link } = (await inviteLinkFor({ partyId, uid: g.uid })).data; return await copy(link) ? { ok: true, text: `${g.name}'s invite link is copied.` } : { ok: true, text: `${g.name}'s invite link:`, link }; })}>{busy === `c${g.uid}` ? "…" : "Copy link"}</button>
            <button className="lux-ghost small" disabled={!!busy || over} onClick={() => void act(`r${g.uid}`, async () => { const res = (await resendInvite({ partyId, uid: g.uid })).data; return sentText(g.name, res.emailed, res.link); })}>{busy === `r${g.uid}` ? "…" : "Resend"}</button>
            <button className="lux-ghost small" disabled={!!busy} onClick={() => { setEditing(editing === g.uid ? null : g.uid); setAllow({ can: g.canInvite, n: String(g.inviteLimit || 2) }); }}>Invites</button>
            <button className="lux-ghost small danger" disabled={!!busy} onClick={() => { if (window.confirm(`Remove ${g.name} from ${party.name}? Their invite link stops working.`)) void act(`x${g.uid}`, async () => { await removeGuest({ partyId, uid: g.uid }); return { ok: true, text: `${g.name} was removed from the list.` }; }); }}>Remove</button>
          </span>
          {editing === g.uid && <form className="party-allow" onSubmit={(e) => { e.preventDefault(); void act(`a${g.uid}`, async () => { await updateGuest({ partyId, uid: g.uid, canInvite: allow.can, inviteLimit: allow.can ? Number(allow.n) : 0 }); setEditing(null); return { ok: true, text: allow.can ? `${g.name} can invite ${allow.n}.` : `${g.name} can't invite anyone now.` }; }); }}>
            <label className="lux-toggle"><input type="checkbox" checked={allow.can} onChange={(e) => setAllow({ ...allow, can: e.target.checked })} /><span>Can invite others</span></label>
            {allow.can && <label>How many<input inputMode="numeric" value={allow.n} onChange={(e) => setAllow({ ...allow, n: e.target.value.replace(/\D/g, "").slice(0, 2) })} /></label>}
            <button className="lux-button small" disabled={!!busy}>Save</button>
          </form>}
        </li>)}</ul>}
    </section>

    {!over && <InviteForm partyId={partyId} busy={busy} act={act} sentText={sentText} />}

    {requests.some((r) => r.status === "approved" || r.status === "rejected") && <section className="lux-panel">
      <h2>Handled requests</h2>
      <ul className="party-history">{requests.filter((r) => r.status === "approved" || r.status === "rejected").map((r) => <li key={r.id}>
        <span>{r.name} <small>({r.email}) · asked by {r.byName}</small></span><span className={`lux-chip${r.status === "approved" ? " st-accepted" : " st-declined"}`}>{r.status === "approved" ? "Approved" : "Rejected"}</span>
      </li>)}</ul>
    </section>}
  </div>;
}

function InviteForm({ partyId, busy, act, sentText }: { partyId: string; busy: string; act: (k: string, run: () => Promise<Status>) => Promise<void>; sentText: (who: string, emailed: boolean, link: string) => Status }) {
  const [f, setF] = useState({ name: "", email: "", guestOf: "", canInvite: false, n: "2" });
  const [error, setError] = useState("");
  function submit(e: FormEvent) {
    e.preventDefault(); setError("");
    if (!f.name.trim()) { setError("Enter their name."); return; }
    if (!isEmail(f.email)) { setError("Enter a valid email address."); return; }
    if (f.canInvite && !(Number(f.n) >= 1)) { setError("How many people can they invite?"); return; }
    void act("invite", async () => {
      const res = (await inviteGuest({ partyId, name: f.name.trim(), email: f.email.trim().toLowerCase(), guestOf: f.guestOf.trim(), canInvite: f.canInvite, inviteLimit: f.canInvite ? Number(f.n) : 0 })).data;
      const who = f.name.trim();
      setF({ name: "", email: "", guestOf: f.guestOf, canInvite: false, n: "2" });
      return sentText(who, res.emailed, res.link);
    });
  }
  return <section className="lux-panel">
    <h2>Invite someone</h2>
    <p className="lux-note">One person per invite, no plus-ones. If they're new, their member account is created and they get a personal link that signs them in.</p>
    <form className="lux-form party-invite" onSubmit={submit} noValidate>
      <label>Name<input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} maxLength={80} autoComplete="off" placeholder="First Last" /></label>
      <label>Email<input type="email" inputMode="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} autoComplete="off" placeholder="guest@company.com" /></label>
      <label>Group / Guest of<input value={f.guestOf} onChange={(e) => setF({ ...f, guestOf: e.target.value })} maxLength={80} autoComplete="off" placeholder="e.g. Uniquem team, Rambod" /></label>
      <div className="party-invite-allow">
        <label className="lux-toggle"><input type="checkbox" checked={f.canInvite} onChange={(e) => setF({ ...f, canInvite: e.target.checked })} /><span>Can invite others</span></label>
        {f.canInvite && <label>How many<input inputMode="numeric" value={f.n} onChange={(e) => setF({ ...f, n: e.target.value.replace(/\D/g, "").slice(0, 2) })} /></label>}
      </div>
      {error && <p className="lux-error" role="alert">{error}</p>}
      <button className="lux-button" disabled={busy === "invite"}>{busy === "invite" ? "Inviting…" : "Send invite"}</button>
    </form>
  </section>;
}
