import { useEffect, useState, type FormEvent } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { FirebaseError } from "firebase/app";
import { createUser, db, removeUser } from "../core/firebase";
import { useAuth } from "../auth/AuthContext";
import { ROLES, ROLE_LABELS, isEmail, parseUserRecord, type Role, type UserRecord } from "../auth/roles";

type Row = UserRecord & { uid: string };
const message = (e: unknown) => e instanceof FirebaseError && e.message && !e.message.startsWith("internal") ? e.message : "Something went wrong. Please try again.";

/** Owners only: everyone on the list, add someone (they can then sign in with an email code), remove someone. */
export default function Admin() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[] | null>(null), [loadError, setLoadError] = useState("");
  const [email, setEmail] = useState(""), [name, setName] = useState(""), [role, setRole] = useState<Role>("member");
  const [busy, setBusy] = useState(""), [status, setStatus] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  useEffect(() => onSnapshot(query(collection(db, "users"), orderBy("email")), (snap) => {
    setRows(snap.docs.flatMap((d) => { const r = parseUserRecord(d.data()); return r ? [{ ...r, uid: d.id }] : []; }));
  }, () => setLoadError("Couldn't load the list.")), []);

  async function add(event: FormEvent) {
    event.preventDefault(); setStatus(null);
    if (!isEmail(email)) { setStatus({ kind: "error", text: "Enter a valid email address." }); return; }
    if (!name.trim()) { setStatus({ kind: "error", text: "Enter a name." }); return; }
    setBusy("add");
    try { await createUser({ email: email.trim().toLowerCase(), name: name.trim(), role }); setStatus({ kind: "ok", text: `${name.trim()} is on the list. They can sign in with a code sent to ${email.trim().toLowerCase()}.` }); setEmail(""); setName(""); setRole("member"); }
    catch (e) { setStatus({ kind: "error", text: message(e) }); } finally { setBusy(""); }
  }
  async function remove(row: Row) {
    if (!window.confirm(`Remove ${row.name} (${row.email}) from the list? They won't be able to sign in.`)) return;
    setBusy(row.uid); setStatus(null);
    try { await removeUser({ uid: row.uid }); setStatus({ kind: "ok", text: `${row.name} was removed.` }); }
    catch (e) { setStatus({ kind: "error", text: message(e) }); } finally { setBusy(""); }
  }
  return <div className="lux-admin">
    <section className="lux-panel">
      <p className="lux-kicker">Owner</p>
      <h1>The list</h1>
      <p className="lux-note">Only people on this list can get a sign-in code.</p>
      {loadError && <p className="lux-error">{loadError}</p>}
      {!rows ? <div className="spinner" aria-label="Loading" /> : <ul className="lux-users">
        {rows.map((r) => <li key={r.uid}>
          <span className="lux-avatar" aria-hidden="true">{r.name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase()}</span>
          <span className="lux-who"><strong>{r.name}</strong><small>{r.email}</small></span>
          <span className={`lux-chip role-${r.role}`}>{ROLE_LABELS[r.role]}</span>
          {r.uid === user?.uid ? <span className="lux-you">You</span>
            : <button className="lux-ghost small" onClick={() => void remove(r)} disabled={!!busy}>{busy === r.uid ? "Removing…" : "Remove"}</button>}
        </li>)}
      </ul>}
    </section>
    <section className="lux-panel">
      <h2>Add someone</h2>
      <form className="lux-form lux-add" onSubmit={add} noValidate>
        <label>Email<input type="email" inputMode="email" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="guest@company.com" /></label>
        <label>Name<input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="First Last" autoComplete="off" /></label>
        <label>Role<select value={role} onChange={(e) => setRole(e.target.value as Role)}>{ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}</select></label>
        <button className="lux-button" disabled={busy === "add"}>{busy === "add" ? "Adding…" : "Add to the list"}</button>
      </form>
      {status && <p className={status.kind === "ok" ? "lux-ok" : "lux-error"} role="status">{status.text}</p>}
    </section>
  </div>;
}
