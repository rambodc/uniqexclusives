import { useAuth } from "../auth/AuthContext";
import { ROLE_LABELS } from "../auth/roles";
import Admin from "./Admin";
import "../ui/lux.css";

/** Signed-in area. Owners get the users admin; everyone else sees a simple welcome until the party features land. */
export default function Inside() {
  const { user, record, logout } = useAuth();
  return <main className="lux-page">
    <div className="lux-aura" aria-hidden="true" />
    <header className="lux-bar">
      <a href="/" className="lux-brand"><img src="/brand/uex-globe.webp" alt="" width={44} height={32} /><span>UEX</span></a>
      <div className="lux-bar-right">
        {record && <span className={`lux-chip role-${record.role}`}>{ROLE_LABELS[record.role]}</span>}
        <button className="lux-ghost" onClick={() => void logout()}>Sign out</button>
      </div>
    </header>
    {!record ? <section className="lux-panel lux-welcome">
      <h1>Your invitation isn't active</h1>
      <p>{user?.email} isn't on the list right now. If you think that's a mistake, contact the Uniq Exclusives team.</p>
    </section>
      : record.role === "owner" ? <Admin />
      : <section className="lux-panel lux-welcome">
        <p className="lux-kicker">Uniq Exclusives</p>
        <h1>You're in, {record.name.split(" ")[0]}.</h1>
        <p>Your invitation details will appear here soon.</p>
      </section>}
  </main>;
}
