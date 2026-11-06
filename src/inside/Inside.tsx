import { Link, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { ROLE_LABELS } from "../auth/roles";
import MemberHome from "./MemberHome";
import People from "./People";
import PartyAdmin from "./parties/PartyAdmin";
import PartyForm from "./parties/PartyForm";
import PartyList from "./parties/PartyList";
import "../ui/lux.css";

/**
 * Signed-in area (/app/*). Owners run every party and People. Staff run the guest list of the one party they're assigned to
 * (they land on it). Members see their invitations.
 */
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
        <Route path="parties/:partyId" element={<PartyAdmin owner />} />
        <Route path="parties/:partyId/edit" element={<PartyForm />} />
        <Route path="*" element={<Navigate to="/app" replace />} />
      </Routes>
      : record.role === "staff" ? record.staffPartyId ? <Routes>
        <Route path={`parties/${record.staffPartyId}`} element={<PartyAdmin owner={false} partyId={record.staffPartyId} />} />
        <Route path="*" element={<Navigate to={`/app/parties/${record.staffPartyId}`} replace />} />
      </Routes>
        : <section className="lux-panel lux-welcome">
          <p className="lux-kicker">Staff</p>
          <h1>No party assigned yet</h1>
          <p>Once the owner assigns you to a party, its guest list opens here.</p>
        </section>
      : <Routes>
        <Route index element={<MemberHome name={record.name} />} />
        <Route path="*" element={<Navigate to="/app" replace />} />
      </Routes>}
  </main>;
}
