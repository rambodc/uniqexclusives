import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { collectionGroup, doc, getDoc, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../core/firebase";
import { useAuth } from "../auth/AuthContext";
import { STATUS_LABELS, formatWhen, parseGuest, parseParty, type Guest, type Party } from "../parties/model";
import { hasPage } from "../parties/registry";

type Row = { party: Party; guest: Guest };

/** A member's invitations: every published party they're on that has its page ready, soonest first. */
export default function MemberHome({ name }: { name: string }) {
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
  const first = name.split(" ")[0];
  if (!rows) return <div className="spinner" aria-label="Loading" />;
  if (!rows.length) return <section className="lux-panel lux-welcome">
    <p className="lux-kicker">Uniq Exclusives</p>
    <h1>You're in, {first}.</h1>
    <p>Your invitation details will appear here soon.</p>
  </section>;
  return <section className="lux-panel">
    <p className="lux-kicker">Your invitations</p>
    <h1>Welcome, {first}.</h1>
    <ul className="party-cards">
      {rows.map(({ party, guest }) => <li key={party.id}>
        <Link to={`/p/${party.id}`} className="party-card">
          <span className="party-card-text"><strong>{party.name}</strong><small>{formatWhen(party.startsAt)}</small></span>
          <span className={`lux-chip st-${guest.status}`}>{guest.status === "invited" ? "Reply" : STATUS_LABELS[guest.status]}</span>
        </Link>
      </li>)}
    </ul>
  </section>;
}
