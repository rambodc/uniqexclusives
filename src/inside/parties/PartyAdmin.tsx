import { useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { collection, doc, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { getDownloadURL, ref } from "firebase/storage";
import { FirebaseError } from "firebase/app";
import { db, decideRequest, inviteGuest, inviteLinkFor, reinviteGuest, remindAll, removeGuest, resendInvite, setStaffParty, updateGuest } from "../../core/firebase";
import { storage } from "../../core/storage";
import { GENDER_LABELS, isEmail, parseUserRecord, type Gender, type UserRecord } from "../../auth/roles";
import {
  STATUS_LABELS, formatReplyBy, formatWhen, fromLocalInput, guestCounts, guestDeadline, parseGuest, parseParty, parseRequest, shownStatus, timeLeft, toLocalInput,
  type Guest, type InviteRequest, type Party
} from "../../parties/model";
import { hasPage } from "../../parties/registry";
import { useConfirm } from "../../ui/Confirm";
import GenderPicker from "../../ui/GenderPicker";
import { Busy, GlobeLoader } from "../../ui/Loader";

const say = (e: unknown) => e instanceof FirebaseError && e.message && !e.message.startsWith("internal") ? e.message : "Something went wrong. Please try again.";
type Status = { ok: boolean; text: string; link?: string } | null;
type Act = (key: string, run: () => Promise<Status>) => Promise<void>;
const initials = (name: string) => name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
const at = (d: Date) => `${formatReplyBy(d)}, ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
const left = (d: Date, now: number) => { const t = timeLeft(d, now); return t.over ? "passed" : t.days ? `${t.days} day${t.days === 1 ? "" : "s"} left` : `${t.hours}h ${t.minutes}m left`; };

async function copy(text: string) { try { await navigator.clipboard.writeText(text); return true; } catch { return false; } }

/**
 * One party's guest list, invites, and the invites guests asked for. Owners also edit the party and assign staff; staff (owner=false)
 * get every guest action but not the party's details, its hidden location, or People.
 */
export default function PartyAdmin({ owner, partyId: assigned }: { owner: boolean; partyId?: string }) {
  const params = useParams(), partyId = assigned ?? params.partyId ?? "";
  const confirm = useConfirm();
  const [party, setParty] = useState<Party | null | "none">(null), [location, setLocation] = useState("");
  const [guests, setGuests] = useState<Guest[]>([]), [requests, setRequests] = useState<InviteRequest[]>([]);
  const [staff, setStaff] = useState<(UserRecord & { uid: string })[]>([]);
  const [photo, setPhoto] = useState<string | null>(null), [now, setNow] = useState(() => Date.now());
  const [status, setStatus] = useState<Status>(null), [busy, setBusy] = useState("");
  const [editing, setEditing] = useState<string | null>(null), [allow, setAllow] = useState({ can: false, n: "2" });

  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 30_000); return () => clearInterval(id); }, []);
  useEffect(() => onSnapshot(doc(db, "parties", partyId), (s) => setParty(parseParty(s.id, s.data()) ?? "none"), () => setParty("none")), [partyId]);
  useEffect(() => owner ? onSnapshot(doc(db, "parties", partyId, "private", "details"), (s) => setLocation((s.get("location") as string | undefined) ?? ""), () => undefined) : undefined, [partyId, owner]);
  useEffect(() => owner ? onSnapshot(query(collection(db, "users"), where("role", "==", "staff")), (s) => setStaff(s.docs.flatMap((d) => { const r = parseUserRecord(d.data()); return r ? [{ ...r, uid: d.id }] : []; })), () => undefined) : undefined, [owner]);
  useEffect(() => onSnapshot(query(collection(db, "parties", partyId, "guests"), orderBy("name")), (s) => setGuests(s.docs.flatMap((d) => parseGuest(d.id, d.data()) ?? [])), () => undefined), [partyId]);
  useEffect(() => onSnapshot(query(collection(db, "parties", partyId, "requests"), orderBy("createdAt", "desc")), (s) => setRequests(s.docs.flatMap((d) => parseRequest(d.id, d.data()) ?? [])), () => undefined), [partyId]);
  const photoPath = party && party !== "none" ? party.photoPath : null;
  useEffect(() => { if (photoPath) getDownloadURL(ref(storage, photoPath)).then(setPhoto, () => undefined); }, [photoPath]);

  const act: Act = async (key, run) => {
    setBusy(key); setStatus(null);
    try { setStatus(await run()); } catch (e) { setStatus({ ok: false, text: say(e) }); } finally { setBusy(""); }
  };
  const sentText = (who: string, emailed: boolean, link: string, n?: number): Status => emailed
    ? { ok: true, text: `Invite emailed to ${who}${n ? ` (Invitation ${n})` : ""}.` }
    : { ok: false, text: `The email to ${who} didn't go out. Copy their link and send it yourself:`, link };

  if (party === null) return <div className="lux-loading"><GlobeLoader label="Loading the party…" /></div>;
  if (party === "none") return <section className="lux-panel"><p className="lux-error">That party doesn't exist anymore.</p>{owner && <Link to="/app" className="lux-link">Back to parties</Link>}</section>;
  const p = party;
  const counts = guestCounts(guests, requests, p, now);
  const pending = requests.filter((r) => r.status === "pending" || r.status === "approving");
  const over = now >= (p.endsAt ?? new Date(p.startsAt.getTime() + 86_400_000)).getTime(), started = now >= p.startsAt.getTime();
  const waiting = guests.filter((g) => shownStatus(g.status, guestDeadline(p, g), now) === "invited");
  const onParty = staff.filter((s) => s.staffPartyId === p.id), free = staff.filter((s) => s.staffPartyId !== p.id);

  async function remind() {
    if (!(await confirm({ title: `Remind ${waiting.length} ${waiting.length === 1 ? "guest" : "guests"}?`, body: <p>Everyone who hasn't replied gets their invite again, with the next Invitation number and their deadline.</p>, confirm: "Remind all" }))) return;
    await act("remind", async () => { const r = (await remindAll({ partyId: p.id })).data; return r.failed.length ? { ok: false, text: `Reminded ${r.sent}. These didn't go out: ${r.failed.join(", ")}.` } : { ok: true, text: `Reminded ${r.sent} ${r.sent === 1 ? "guest" : "guests"}.` }; });
  }
  async function reinvite(g: Guest) {
    const start = p.startsAt.getTime(), base = new Date(Math.min(Date.now() + 7 * 86_400_000, start));
    const answer = await confirm({
      title: `Re-invite ${g.name}?`, confirm: "Re-invite",
      body: <p>They get a fresh invite (Invitation {g.sendCount + 1}) and a new deadline, and go back to Invited.</p>,
      field: { label: "New RSVP deadline", type: "datetime-local", value: toLocalInput(base), min: toLocalInput(new Date()), max: toLocalInput(p.startsAt), hint: `A week from now by default, never after the start (${formatWhen(p.startsAt)}).` }
    });
    if (!answer) return;
    const deadline = fromLocalInput(answer.value);
    if (deadline === null) { setStatus({ ok: false, text: "Pick a valid date and time." }); return; }
    await act(`i${g.uid}`, async () => { const r = (await reinviteGuest({ partyId: p.id, uid: g.uid, rsvpDeadline: deadline })).data; return sentText(g.name, r.emailed, r.link, r.sendCount); });
  }
  async function resend(g: Guest) {
    if (!(await confirm({ title: `Resend ${g.name}'s invite?`, body: <p>They get the invite again as <strong>Invitation {g.sendCount + 1}</strong>, with a new link. Their deadline stays {at(guestDeadline(p, g))}.</p>, confirm: "Resend" }))) return;
    await act(`r${g.uid}`, async () => { const r = (await resendInvite({ partyId: p.id, uid: g.uid })).data; return sentText(g.name, r.emailed, r.link, r.sendCount); });
  }
  async function copyLink(g: Guest) {
    if (!(await confirm({ title: `Make a link for ${g.name}?`, body: <p>This creates a new personal link (their older links keep working) and copies it. Nothing is emailed. Only send it to {g.name}.</p>, confirm: "Create and copy" }))) return;
    await act(`c${g.uid}`, async () => { const { link } = (await inviteLinkFor({ partyId: p.id, uid: g.uid })).data; return await copy(link) ? { ok: true, text: `${g.name}'s invite link is copied.` } : { ok: true, text: `${g.name}'s invite link:`, link }; });
  }
  async function remove(g: Guest) {
    if (!(await confirm({ title: `Remove ${g.name}?`, body: <p>They come off {p.name}'s list and their invite links stop working. Their account stays.</p>, confirm: "Remove", danger: true }))) return;
    await act(`x${g.uid}`, async () => { await removeGuest({ partyId: p.id, uid: g.uid }); return { ok: true, text: `${g.name} was removed from the list.` }; });
  }
  async function decide(r: InviteRequest, approve: boolean) {
    if (!(await confirm(approve
      ? { title: `Approve ${r.name}?`, body: <p>{r.name} ({r.email}) gets their own account if they're new, and their invite is emailed now. Guest of {r.byName}.</p>, confirm: "Approve and invite" }
      : { title: `Reject ${r.name}?`, body: <p>{r.name} won't be invited, and {r.byName} gets that invite back.</p>, confirm: "Reject", danger: true }))) return;
    await act(r.id, async () => {
      if (!approve) { await decideRequest({ partyId: p.id, requestId: r.id, approve: false }); return { ok: true, text: `${r.name} wasn't invited.` }; }
      const res = (await decideRequest({ partyId: p.id, requestId: r.id, approve: true })).data;
      return sentText(r.name, !!res.emailed, res.link ?? "", 1);
    });
  }
  async function saveAllowance(g: Guest) {
    const can = allow.can, n = Number(allow.n);
    if (can && !(n >= 1)) { setStatus({ ok: false, text: "How many people can they invite?" }); return; }
    if (!(await confirm({ title: can ? `Let ${g.name} invite ${n}?` : `Stop ${g.name} inviting?`, body: <p>{can ? "Each person they invite waits for your approval." : "Requests they already sent stay as they are."}</p>, confirm: "Save" }))) return;
    await act(`a${g.uid}`, async () => { await updateGuest({ partyId: p.id, uid: g.uid, canInvite: can, inviteLimit: can ? n : 0 }); setEditing(null); return { ok: true, text: can ? `${g.name} can invite ${n}.` : `${g.name} can't invite anyone now.` }; });
  }
  async function assignStaff(uid: string, on: boolean) {
    const who = staff.find((s) => s.uid === uid);
    if (!who) return;
    const elsewhere = on && who.staffPartyId ? " They'll come off their current party (staff run one party at a time)." : "";
    if (!(await confirm({ title: on ? `Assign ${who.name} to ${p.name}?` : `Take ${who.name} off ${p.name}?`, body: <p>{on ? `They'll see this guest list and can invite, resend, re-invite and approve. They can't edit the party.${elsewhere}` : "They won't see this party anymore."}</p>, confirm: on ? "Assign" : "Unassign", danger: !on }))) return;
    await act(`s${uid}`, async () => { await setStaffParty({ uid, partyId: on ? p.id : null }); return { ok: true, text: on ? `${who.name} now runs ${p.name}.` : `${who.name} is off ${p.name}.` }; });
  }

  return <div className="lux-admin">
    <section className="lux-panel party-hero">
      {owner ? <Link to="/app" className="lux-crumb">← Parties</Link> : <p className="lux-kicker party-staff-kicker">Staff · your party</p>}
      <div className="party-hero-row">
        {photo ? <img src={photo} alt="" className="party-hero-photo" /> : <span className="party-hero-photo party-photo-empty">No photo</span>}
        <div className="party-hero-text">
          <h1>{p.name}</h1>
          <p className="lux-note">{formatWhen(p.startsAt)}{p.dressCode ? ` · ${p.dressCode}` : ""}</p>
          {owner ? <p className="lux-note">{location || "No location yet"} · <em>{p.locationRevealed ? "shown to guests" : "hidden from guests"}</em></p>
            : <p className="lux-note">{p.location ?? <em>Location not revealed yet</em>}</p>}
          <p className="lux-note party-deadline">RSVP by <strong>{at(p.rsvpDeadline)}</strong> · {left(p.rsvpDeadline, now)}</p>
          <div className="party-chips">
            <span className={`lux-chip${p.published ? " st-accepted" : ""}`}>{p.published ? "Published" : "Draft"}</span>
            <span className={`lux-chip${hasPage(p.pageSlug) ? " st-accepted" : ""}`}>{hasPage(p.pageSlug) ? `Page: ${p.pageSlug}` : "No custom page yet"}</span>
          </div>
        </div>
      </div>
      <div className="party-actions">
        {owner && <Link to={`/app/parties/${p.id}/edit`} className="lux-ghost as-link">Edit</Link>}
        <Link to={`/p/${p.id}`} className="lux-ghost as-link">Preview</Link>
        {!over && waiting.length > 0 && <button className="lux-button small" disabled={!!busy} onClick={() => void remind()}>{busy === "remind" ? <Busy>Reminding…</Busy> : `Remind all (${waiting.length})`}</button>}
      </div>
      <dl className="party-counts">
        <div><dt>Guests</dt><dd>{counts.total}{p.guestLimit ? <small> / {p.guestLimit}</small> : null}</dd></div>
        <div><dt>Accepted</dt><dd>{counts.accepted}</dd></div>
        <div><dt>No reply</dt><dd>{counts.invited}</dd></div>
        <div><dt>Declined</dt><dd>{counts.declined}</dd></div>
        <div><dt>Expired</dt><dd>{counts.expired}</dd></div>
        <div><dt>Pending</dt><dd>{counts.pending}</dd></div>
        <div className="is-gender"><dt>Male</dt><dd>{counts.male}</dd></div>
        <div className="is-gender"><dt>Female</dt><dd>{counts.female}</dd></div>
      </dl>
    </section>

    {status && <p className={status.ok ? "lux-ok party-status" : "lux-error party-status"} role="status">{status.text}{status.link && <><br /><code className="party-link">{status.link}</code></>}</p>}

    {pending.length > 0 && <section className="lux-panel">
      <h2>Waiting for approval</h2>
      <p className="lux-note">Invites your guests asked for. Approving creates their account and emails them their own invite.</p>
      <ul className="lux-users party-guests">{pending.map((r) => <li key={r.id}>
        <span className="lux-avatar" aria-hidden="true">{initials(r.name)}</span>
        <span className="lux-who"><strong>{r.name}</strong><small>{r.email} · {GENDER_LABELS[r.gender]}</small><small>Guest of {r.byName}{r.note ? ` · “${r.note}”` : ""}</small></span>
        <span className="party-row-actions">
          <button className="lux-button small" disabled={!!busy || over} onClick={() => void decide(r, true)}>{busy === r.id ? <Busy>Inviting…</Busy> : "Approve"}</button>
          <button className="lux-ghost small" disabled={!!busy} onClick={() => void decide(r, false)}>Reject</button>
        </span>
      </li>)}</ul>
    </section>}

    <section className="lux-panel">
      <h2>Guest list</h2>
      {!guests.length ? <p className="lux-note">Nobody yet. Invite your first guest below.</p>
        : <ul className="lux-users party-guests">{guests.map((g) => {
          const deadline = guestDeadline(p, g), st = shownStatus(g.status, deadline, now), unanswered = st === "invited" || st === "expired";
          return <li key={g.uid}>
            <span className={`lux-avatar g-${g.gender}`} aria-hidden="true">{initials(g.name)}</span>
            <span className="lux-who">
              <strong>{g.name} <span className={`party-gender g-${g.gender}`}>{GENDER_LABELS[g.gender]}</span></strong><small>{g.email}</small>
              <small>{g.guestOf ? `Guest of ${g.guestOf}` : "No group"} · {g.canInvite ? `Can invite ${g.invitesUsed}/${g.inviteLimit}` : "Can't invite"}</small>
              <small>Invitation {g.sendCount}{st === "invited" ? ` · reply by ${at(deadline)} (${left(deadline, now)})` : st === "expired" ? ` · expired ${formatReplyBy(deadline)}` : ""}</small>
            </span>
            <span className={`lux-chip st-${st}`}>{STATUS_LABELS[st]}</span>
            <span className="party-row-actions">
              <button className="lux-ghost small" disabled={!!busy || over} onClick={() => void copyLink(g)}>{busy === `c${g.uid}` ? <Busy>Copying…</Busy> : "Copy link"}</button>
              {st !== "expired" && <button className="lux-ghost small" disabled={!!busy || over} onClick={() => void resend(g)}>{busy === `r${g.uid}` ? <Busy>Sending…</Busy> : "Resend"}</button>}
              {unanswered && <button className={st === "expired" ? "lux-button small" : "lux-ghost small"} disabled={!!busy || started} onClick={() => void reinvite(g)}>{busy === `i${g.uid}` ? <Busy>Sending…</Busy> : "Re-invite"}</button>}
              <button className="lux-ghost small" disabled={!!busy} onClick={() => { setEditing(editing === g.uid ? null : g.uid); setAllow({ can: g.canInvite, n: String(g.inviteLimit || 2) }); }}>Invites</button>
              <button className="lux-ghost small danger" disabled={!!busy} onClick={() => void remove(g)}>{busy === `x${g.uid}` ? <Busy>Removing…</Busy> : "Remove"}</button>
            </span>
            {editing === g.uid && <form className="party-allow" onSubmit={(e) => { e.preventDefault(); void saveAllowance(g); }}>
              <label className="lux-toggle"><input type="checkbox" checked={allow.can} onChange={(e) => setAllow({ ...allow, can: e.target.checked })} /><span>Can invite others</span></label>
              {allow.can && <label>How many<input inputMode="numeric" value={allow.n} onChange={(e) => setAllow({ ...allow, n: e.target.value.replace(/\D/g, "").slice(0, 2) })} /></label>}
              <button className="lux-button small" disabled={!!busy}>{busy === `a${g.uid}` ? <Busy>Saving…</Busy> : "Save"}</button>
            </form>}
          </li>;
        })}</ul>}
    </section>

    {!over && <InviteForm partyId={p.id} busy={busy} act={act} sentText={sentText} />}

    {owner && <section className="lux-panel">
      <h2>Staff</h2>
      <p className="lux-note">Staff run one party at a time: the full guest list and every guest button, but not the party's details.</p>
      {onParty.length > 0 && <ul className="lux-users party-guests">{onParty.map((s) => <li key={s.uid}>
        <span className="lux-avatar" aria-hidden="true">{initials(s.name)}</span>
        <span className="lux-who"><strong>{s.name}</strong><small>{s.email}</small></span>
        <span className="lux-chip role-staff">Staff</span>
        <span className="party-row-actions"><button className="lux-ghost small danger" disabled={!!busy} onClick={() => void assignStaff(s.uid, false)}>{busy === `s${s.uid}` ? <Busy>Saving…</Busy> : "Unassign"}</button></span>
      </li>)}</ul>}
      {free.length > 0 ? <form className="lux-form party-staff-add" onSubmit={(e) => { e.preventDefault(); const v = new FormData(e.currentTarget).get("staff"); if (typeof v === "string" && v) void assignStaff(v, true); }}>
        <label>Assign a staff member<select name="staff" defaultValue="">{[<option key="" value="">Pick someone</option>, ...free.map((s) => <option key={s.uid} value={s.uid}>{s.name}{s.staffPartyId ? " (on another party)" : ""}</option>)]}</select></label>
        <button className="lux-button small" disabled={!!busy}>Assign</button>
      </form> : !onParty.length && <p className="lux-note">No staff yet. Add someone with the Staff role on People.</p>}
    </section>}

    {requests.some((r) => r.status === "approved" || r.status === "rejected") && <section className="lux-panel">
      <h2>Handled requests</h2>
      <ul className="party-history">{requests.filter((r) => r.status === "approved" || r.status === "rejected").map((r) => <li key={r.id}>
        <span>{r.name} <small>({r.email}) · asked by {r.byName}</small></span><span className={`lux-chip${r.status === "approved" ? " st-accepted" : " st-declined"}`}>{r.status === "approved" ? "Approved" : "Rejected"}</span>
      </li>)}</ul>
    </section>}
  </div>;
}

function InviteForm({ partyId, busy, act, sentText }: { partyId: string; busy: string; act: Act; sentText: (who: string, emailed: boolean, link: string, n?: number) => Status }) {
  const [f, setF] = useState<{ name: string; email: string; gender: Gender | ""; guestOf: string; canInvite: boolean; n: string }>({ name: "", email: "", gender: "", guestOf: "", canInvite: false, n: "2" });
  const [error, setError] = useState("");
  function submit(e: FormEvent) {
    e.preventDefault(); setError("");
    if (!f.name.trim()) { setError("Enter their name."); return; }
    if (!isEmail(f.email)) { setError("Enter a valid email address."); return; }
    if (!f.gender) { setError("Pick male or female."); return; }
    if (f.canInvite && !(Number(f.n) >= 1)) { setError("How many people can they invite?"); return; }
    const gender = f.gender;
    void act("invite", async () => {
      const res = (await inviteGuest({ partyId, name: f.name.trim(), email: f.email.trim().toLowerCase(), gender, guestOf: f.guestOf.trim(), canInvite: f.canInvite, inviteLimit: f.canInvite ? Number(f.n) : 0 })).data;
      const who = f.name.trim();
      setF({ name: "", email: "", gender: "", guestOf: f.guestOf, canInvite: false, n: "2" });
      return sentText(who, res.emailed, res.link, 1);
    });
  }
  return <section className="lux-panel">
    <h2>Invite someone</h2>
    <p className="lux-note">One person per invite, no plus-ones. If they're new, their member account is created and they get a personal link. Opening it emails them a 6-digit code to sign in.</p>
    <form className="lux-form party-invite" onSubmit={submit} noValidate>
      <label>Name<input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} maxLength={80} autoComplete="off" placeholder="First Last" /></label>
      <label>Email<input type="email" inputMode="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} autoComplete="off" placeholder="guest@company.com" /></label>
      <GenderPicker name="invite-gender" value={f.gender} onChange={(gender) => setF({ ...f, gender })} />
      <label>Group / Guest of<input value={f.guestOf} onChange={(e) => setF({ ...f, guestOf: e.target.value })} maxLength={80} autoComplete="off" placeholder="e.g. Uniquem team, Rambod" /></label>
      <div className="party-invite-allow">
        <label className="lux-toggle"><input type="checkbox" checked={f.canInvite} onChange={(e) => setF({ ...f, canInvite: e.target.checked })} /><span>Can invite others</span></label>
        {f.canInvite && <label>How many<input inputMode="numeric" value={f.n} onChange={(e) => setF({ ...f, n: e.target.value.replace(/\D/g, "").slice(0, 2) })} /></label>}
      </div>
      {error && <p className="lux-error" role="alert">{error}</p>}
      <button className="lux-button" disabled={busy === "invite"}>{busy === "invite" ? <Busy>Sending invite…</Busy> : "Send invite"}</button>
    </form>
  </section>;
}
