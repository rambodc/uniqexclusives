import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "../../core/firebase";
import { formatWhen, parseParty, type Party } from "../../parties/model";
import { hasPage } from "../../parties/registry";
import { GlobeLoader } from "../../ui/Loader";

/** Owners: every party, newest date first. */
export default function PartyList() {
  const [parties, setParties] = useState<Party[] | null>(null), [error, setError] = useState("");
  useEffect(() => onSnapshot(query(collection(db, "parties"), orderBy("startsAt", "desc")),
    (s) => setParties(s.docs.flatMap((d) => parseParty(d.id, d.data()) ?? [])), () => setError("Couldn't load the parties.")), []);
  return <section className="lux-panel">
    <div className="party-head">
      <div><p className="lux-kicker">Owner</p><h1>Parties</h1></div>
      <Link to="/app/parties/new" className="lux-button as-link">New party</Link>
    </div>
    {error && <p className="lux-error">{error}</p>}
    {!parties ? <div className="lux-loading"><GlobeLoader label="Loading parties…" /></div>
      : !parties.length ? <p className="lux-note">No parties yet. Create the first one.</p>
      : <ul className="party-cards">{parties.map((p) => <li key={p.id}>
        <Link to={`/app/parties/${p.id}`} className="party-card">
          <span className="party-card-text"><strong>{p.name}</strong><small>{formatWhen(p.startsAt)}</small></span>
          <span className="party-chips">
            <span className={`lux-chip${p.published ? " st-accepted" : ""}`}>{p.published ? "Published" : "Draft"}</span>
            <span className={`lux-chip${hasPage(p.pageSlug) ? " st-accepted" : ""}`}>{hasPage(p.pageSlug) ? "Page ready" : "No page yet"}</span>
          </span>
        </Link>
      </li>)}</ul>}
  </section>;
}
