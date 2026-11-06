import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { collectionGroup, doc, getDoc, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../core/firebase";
import { useAuth } from "../auth/AuthContext";
import { STATUS_LABELS, formatWhen, guestDeadline, parseGuest, parseParty, shownStatus, type Guest, type Party } from "../parties/model";
import { GlobeLoader } from "../ui/Loader";
import { hasPage } from "../parties/registry";

type Row = { party: Party; guest: Guest };

/** A member's invitations: every published party they're on that has its page ready, soonest first. */
export default function MemberHome({ firstName }: { firstName: string }) {
  const { user } = useAuth();
  const uid = user?.uid ?? "";
  const [rows, setRows] = useState<Row[] | null>(null);
  useEffect(() => {
    if (!uid) return;
    let live = true;
    const stop = onSnapshot(query(collectionGroup(db, "guests"), where("uid", "==", uid)), async (snap) => {
      const found = await Promise.all(snap.docs.map(async (g) => {
        const guest = parseGuest(g.id, g.data()), partyId = g.ref.parent.parent?.id;
        if (!guest || !partyId) return null;
        try {
          const p = await getDoc(doc(db, "parties", partyId));
          const party = parseParty(p.id, p.data());
          return party && party.published && hasPage(party.pageSlug) ? { party, guest } : null;
        } catch { return null; }   // not published yet: the rules keep it hidden
      }));
      if (live) setRows(found.filter((r): r is Row => !!r).sort((a, b) => a.party.startsAt.getTime() - b.party.startsAt.getTime()));
    }, () => { if (live) setRows([]); });
    return () => { live = false; stop(); };
  }, [uid]);
  if (!rows) return <div className="lux-loading"><GlobeLoader label="Finding your invitations…" /></div>;
  if (!rows.length) return <section className="lux-panel lux-welcome">
    <p className="lux-kicker">Uniq Exclusives</p>
    <h1>You're in, {firstName}.</h1>
    <p>Your invitation details will appear here soon.</p>
  </section>;
  return <section className="lux-panel">
    <p className="lux-kicker">Your invitations</p>
    <h1>Welcome, {firstName}.</h1>
    <ul className="party-cards">
      {rows.map(({ party, guest }) => { const status = shownStatus(guest.status, guestDeadline(party, guest)); return <li key={party.id}>
        <Link to={`/p/${party.id}`} className="party-card">
          <span className="party-card-text"><strong>{party.name}</strong><small>{formatWhen(party.startsAt)}</small></span>
          <span className={`lux-chip st-${status}`}>{status === "invited" ? "Reply" : STATUS_LABELS[status]}</span>
        </Link>
      </li>; })}
    </ul>
  </section>;
}
