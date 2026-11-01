import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { sendEmailVerification } from "firebase/auth";
import { doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "../core/firebase";
import { useAuth } from "../auth/AuthContext";
import { ROLE_LABELS, cleanName } from "../auth/roles";

export default function Account() {
  const { user, record, logout } = useAuth();
  const [editing, setEditing] = useState(false), [firstName, setFirstName] = useState(""), [lastName, setLastName] = useState("");
  const [status, setStatus] = useState(""), [busy, setBusy] = useState(false);
  if (!user) return null;
  const startEdit = () => { setFirstName(record?.firstName ?? ""); setLastName(record?.lastName ?? ""); setEditing(true); setStatus(""); };
  async function save(event: FormEvent) {
    event.preventDefault(); if (!user) return;
    const first = cleanName(firstName), last = cleanName(lastName);
    if (!first || !last) { setStatus("Enter your first and last name."); return; }
    setBusy(true);
    try { await updateDoc(doc(db, "users", user.uid), { firstName: first, lastName: last, updatedAt: serverTimestamp() }); setEditing(false); setStatus("Saved."); }
    catch { setStatus("Couldn't save. Please try again."); } finally { setBusy(false); }
  }
  const resend = async () => { await sendEmailVerification(user).then(() => setStatus("Verification email sent."), () => setStatus("Couldn't send it right now. Try again later.")); };
  const initials = record ? `${record.firstName[0] ?? ""}${record.lastName[0] ?? ""}`.toUpperCase() : (user.email?.[0] ?? "?").toUpperCase();
  return <main className="ws-page">
    <header className="ws-bar"><Link to="/" className="ws-bar-brand">Uniq Exclusives</Link><button className="button-ghost" onClick={() => void logout()}>Sign out</button></header>
    <section className="ws-card">
      <div className="ws-me"><span className="ws-avatar">{initials}</span><div>
        <h1>{record ? `${record.firstName} ${record.lastName}` : "Your account"}</h1>
        <p>{user.email}</p>
        {record && <span className={`role-chip role-${record.role}`}>{ROLE_LABELS[record.role]}</span>}
      </div></div>
      {!user.emailVerified && <div className="status info">Please verify your email. <button className="auth-link inline" onClick={() => void resend()}>Resend the link</button></div>}
      {!record && <div className="status error">Your profile isn't set up yet. Contact the Uniq Exclusives team.</div>}
      {status && <div className="status success" role="status">{status}</div>}
      {record && (editing
        ? <form className="ws-form" onSubmit={save}>
          <label>First name<input value={firstName} onChange={(e) => setFirstName(e.target.value)} maxLength={60} required /></label>
          <label>Last name<input value={lastName} onChange={(e) => setLastName(e.target.value)} maxLength={60} required /></label>
          <div className="ws-actions"><button className="button-primary" disabled={busy}>{busy ? "Saving…" : "Save"}</button><button type="button" className="button-ghost" onClick={() => setEditing(false)}>Cancel</button></div>
        </form>
        : <button className="button-ghost" onClick={startEdit}>Edit name</button>)}
    </section>
    <section className="ws-card muted"><h2>Coming soon</h2><p>Uniq Exclusives invites, RSVPs and door check-in will live here.</p></section>
  </main>;
}
