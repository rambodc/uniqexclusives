import { Link, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { ROLE_LABELS } from "../auth/roles";
import MemberHome from "./MemberHome";
import People from "./People";
import PartyAdmin from "./parties/PartyAdmin";
import PartyForm from "./parties/PartyForm";
import PartyList from "./parties/PartyList";
import "../ui/lux.css";

/** Signed-in area (/app/*). Owners run parties and people; everyone else (members, and staff for now) sees their invitations. */
export default function Inside() {
  const { user, record, logout } = useAuth();
  const owner = record?.role === "owner";
  const people = useLocation().pathname.startsWith("/app/people");
  return <main className="lux-page">
    <div className="lux-aura" aria-hidden="true" />
    <header className="lux-bar">
      <a href="/" className="lux-brand"><img src="/brand/uex-globe.webp" alt="" width={44} height={32} /><span>UEX</span></a>
      <div className="lux-bar-right">
        {record && <span className={`lux-chip role-${record.role}`}>{ROLE_LABELS[record.role]}</span>}
        <button className="lux-ghost" onClick={() => void logout()}>Sign out</button>
      </div>
    </header>
    {owner && <nav className="lux-tabs" aria-label="Owner">
      <Link to="/app" className={people ? "" : "on"}>Parties</Link>
      <Link to="/app/people" className={people ? "on" : ""}>People</Link>
    </nav>}
    {!record ? <section className="lux-panel lux-welcome">
      <h1>Your invitation isn't active</h1>
      <p>{user?.email} isn't on the list right now. If you think that's a mistake, contact the Uniq Exclusives team.</p>
    </section>
      : owner ? <Routes>
        <Route index element={<PartyList />} />
        <Route path="people" element={<People />} />
        <Route path="parties/new" element={<PartyForm />} />
        <Route path="parties/:partyId" element={<PartyAdmin />} />
        <Route path="parties/:partyId/edit" element={<PartyForm />} />
        <Route path="*" element={<Navigate to="/app" replace />} />
      </Routes>
      : <Routes>
        <Route index element={<MemberHome name={record.name} />} />
        <Route path="*" element={<Navigate to="/app" replace />} />
      </Routes>}
  </main>;
}
