import { useEffect, useState, type FormEvent } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { createUser, db, errorText as message, removeUser, setStaffParty, setUserRole } from "../core/firebase";
import { useAuth } from "../auth/AuthContext";
import { GENDER_LABELS, ROLES, ROLE_LABELS, fullName, initials, isEmail, parseUserRecord, type Gender, type Role, type UserRecord } from "../auth/roles";
import { parseParty, type Party } from "../parties/model";
import { useConfirm } from "../ui/Confirm";
import GenderPicker from "../ui/GenderPicker";
import { Busy, GlobeLoader } from "../ui/Loader";

type Row = UserRecord & { uid: string };

/** Owners only (/app/people): everyone on the list, add someone, change a role, assign staff to their one party, remove someone. */
export default function People() {
  const { user } = useAuth();
  const confirm = useConfirm();
  const [rows, setRows] = useState<Row[] | null>(null), [parties, setParties] = useState<Party[]>([]), [loadError, setLoadError] = useState("");
  const [email, setEmail] = useState(""), [firstName, setFirstName] = useState(""), [lastName, setLastName] = useState(""), [gender, setGender] = useState<Gender | "">(""), [role, setRole] = useState<Role>("member"), [staffParty, setStaffPartyPick] = useState("");
  const [busy, setBusy] = useState(""), [status, setStatus] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  useEffect(() => onSnapshot(query(collection(db, "users"), orderBy("email")), (snap) => {
    setRows(snap.docs.flatMap((d) => { const r = parseUserRecord(d.data()); return r ? [{ ...r, uid: d.id }] : []; }));
  }, () => setLoadError("Couldn't load the list.")), []);
  useEffect(() => onSnapshot(query(collection(db, "parties"), orderBy("startsAt", "desc")), (s) => setParties(s.docs.flatMap((d) => parseParty(d.id, d.data()) ?? [])), () => undefined), []);
  const partyName = (id: string | null) => parties.find((p) => p.id === id)?.name ?? "No party";

  async function run(key: string, work: () => Promise<string>) {
    setBusy(key); setStatus(null);
    try { setStatus({ kind: "ok", text: await work() }); } catch (e) { setStatus({ kind: "error", text: message(e) }); } finally { setBusy(""); }
  }
  async function add(event: FormEvent) {
    event.preventDefault(); setStatus(null);
    if (!isEmail(email)) { setStatus({ kind: "error", text: "Enter a valid email address." }); return; }
    if (!firstName.trim()) { setStatus({ kind: "error", text: "Enter their first name." }); return; }
    if (!lastName.trim()) { setStatus({ kind: "error", text: "Enter their last name." }); return; }
    if (!gender) { setStatus({ kind: "error", text: "Pick male or female." }); return; }
    const names = { firstName: firstName.trim(), lastName: lastName.trim() }, who = fullName(names), address = email.trim().toLowerCase();
    await run("add", async () => {
      await createUser({ email: address, ...names, gender, role, staffPartyId: role === "staff" && staffParty ? staffParty : null });
      setEmail(""); setFirstName(""); setLastName(""); setGender(""); setRole("member"); setStaffPartyPick("");
      return `${who} is on the list. Nothing was emailed: they can now sign in at uniqexclusives.com with a code sent to ${address}.`;
    });
  }
  async function changeRole(row: Row, next: Role) {
    if (!(await confirm({ title: `Make ${fullName(row)} ${ROLE_LABELS[next].toLowerCase()}?`, body: <p>{next === "owner" ? "Owners can see and change everything, including People." : next === "staff" ? "Staff run one party's guest list. Pick their party next." : "Members only see their own invitations."}</p>, confirm: `Make ${ROLE_LABELS[next].toLowerCase()}` }))) return;
    await run(`role${row.uid}`, async () => { await setUserRole({ uid: row.uid, role: next, staffPartyId: null }); return `${fullName(row)} is now ${ROLE_LABELS[next].toLowerCase()}.`; });
  }
  async function assign(row: Row, partyId: string) {
    const next = partyId || null;
    if (!(await confirm({ title: next ? `Assign ${fullName(row)} to ${partyName(next)}?` : `Take ${fullName(row)} off ${partyName(row.staffPartyId)}?`, body: <p>{next ? "They'll see that party's full guest list and can invite, resend, re-invite and approve. They can't edit the party itself." : "They won't see any party until you assign one."}</p>, confirm: next ? "Assign" : "Unassign" }))) return;
    await run(`party${row.uid}`, async () => { await setStaffParty({ uid: row.uid, partyId: next }); return next ? `${fullName(row)} now runs ${partyName(next)}.` : `${fullName(row)} has no party now.`; });
  }
  async function remove(row: Row) {
    if (!(await confirm({ title: `Remove ${fullName(row)}?`, body: <p>{row.email} comes off the list and every party's guest list. They won't be able to sign in.</p>, confirm: "Remove", danger: true }))) return;
    await run(row.uid, async () => { await removeUser({ uid: row.uid }); return `${fullName(row)} was removed.`; });
  }
  return <div className="lux-admin">
    <section className="lux-panel">
      <p className="lux-kicker">Owner</p>
      <h1>The list</h1>
      <p className="lux-note">Only people on this list can get a sign-in code.</p>
      {loadError && <p className="lux-error">{loadError}</p>}
      {!rows ? <div className="lux-loading"><GlobeLoader label="Loading the list…" /></div> : <ul className="lux-users people">
        {rows.map((r) => <li key={r.uid}>
          <span className="lux-avatar" aria-hidden="true">{initials(r)}</span>
          <span className="lux-who"><strong>{fullName(r)}</strong><small>{r.email} · {GENDER_LABELS[r.gender]}</small>
            {r.role === "staff" && <small>Runs {partyName(r.staffPartyId)}</small>}</span>
          {r.uid === user?.uid ? <><span className={`lux-chip role-${r.role}`}>{ROLE_LABELS[r.role]}</span><span className="lux-you">You</span></>
            : <span className="people-actions">
              <select aria-label={`${fullName(r)}'s role`} value={r.role} disabled={!!busy} onChange={(e) => void changeRole(r, e.target.value as Role)}>{ROLES.map((x) => <option key={x} value={x}>{ROLE_LABELS[x]}</option>)}</select>
              {r.role === "staff" && <select aria-label={`${fullName(r)}'s party`} value={r.staffPartyId ?? ""} disabled={!!busy} onChange={(e) => void assign(r, e.target.value)}>
                <option value="">No party</option>{parties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>}
              <button className="lux-ghost small danger" onClick={() => void remove(r)} disabled={!!busy}>{busy === r.uid ? <Busy>Removing…</Busy> : "Remove"}</button>
            </span>}
        </li>)}
      </ul>}
    </section>
    <section className="lux-panel">
      <h2>Add someone</h2>
      <form className="lux-form lux-add" onSubmit={add} noValidate>
        <label>Email<input type="email" inputMode="email" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="guest@company.com" /></label>
        <label>First name<input value={firstName} onChange={(e) => setFirstName(e.target.value)} maxLength={60} autoComplete="off" /></label>
        <label>Last name<input value={lastName} onChange={(e) => setLastName(e.target.value)} maxLength={60} autoComplete="off" /></label>
        <GenderPicker name="person-gender" value={gender} onChange={setGender} />
        <label>Role<select value={role} onChange={(e) => setRole(e.target.value as Role)}>{ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}</select></label>
        {role === "staff" && <label>Their party<select value={staffParty} onChange={(e) => setStaffPartyPick(e.target.value)}><option value="">Assign later</option>{parties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>}
        <button className="lux-button" disabled={busy === "add"}>{busy === "add" ? <Busy>Adding…</Busy> : "Add to the list"}</button>
      </form>
      {status && <p className={status.kind === "ok" ? "lux-ok" : "lux-error"} role="status">{status.text}</p>}
    </section>
  </div>;
}
