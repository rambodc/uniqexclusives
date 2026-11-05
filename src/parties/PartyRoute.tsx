import { Suspense, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { collection, doc, onSnapshot, query, where } from "firebase/firestore";
import { getDownloadURL, ref } from "firebase/storage";
import { FirebaseError } from "firebase/app";
import { db, requestInvite as requestInviteFn, rsvp as rsvpFn } from "../core/firebase";
import { storage } from "../core/storage";
import { useAuth } from "../auth/AuthContext";
import { Loading } from "../auth/RequireAuth";
import { parseGuest, parseParty, parseRequest, rsvpOpen, type Guest, type InviteRequest, type Party } from "./model";
import { PARTY_PAGES, hasPage } from "./registry";
import type { PartyPageProps } from "./types";
import Placeholder from "./kit/Placeholder";
import "../ui/lux.css";
import "./kit/kit.css";

const say = (e: unknown) => e instanceof FirebaseError && e.message && !e.message.startsWith("internal") ? e.message : "Something went wrong. Please try again.";

/** /p/:partyId — a party's own page. Guests see it once it's published with a custom page; owners can always preview. */
export default function PartyRoute() {
  const { partyId = "" } = useParams();
  const { user, record } = useAuth();
  const uid = user?.uid ?? "", isOwner = record?.role === "owner";
  const [party, setParty] = useState<Party | null | "none">(null);
  const [guest, setGuest] = useState<Guest | null>(null), [requests, setRequests] = useState<InviteRequest[]>([]);
  const [photo, setPhoto] = useState<{ path: string; url: string } | null>(null);

  useEffect(() => onSnapshot(doc(db, "parties", partyId), (s) => setParty(parseParty(s.id, s.data()) ?? "none"), () => setParty("none")), [partyId]);
  useEffect(() => uid ? onSnapshot(doc(db, "parties", partyId, "guests", uid), (s) => setGuest(parseGuest(s.id, s.data())), () => setGuest(null)) : undefined, [partyId, uid]);
  useEffect(() => uid ? onSnapshot(query(collection(db, "parties", partyId, "requests"), where("by", "==", uid)),
    (s) => setRequests(s.docs.flatMap((d) => parseRequest(d.id, d.data()) ?? [])), () => setRequests([])) : undefined, [partyId, uid]);
  const photoPath = party && party !== "none" ? party.photoPath : null;
  useEffect(() => {
    if (!photoPath) return;
    let live = true;
    getDownloadURL(ref(storage, photoPath)).then((url) => { if (live) setPhoto({ path: photoPath, url }); }, () => undefined);
    return () => { live = false; };
  }, [photoPath]);

  const props = useMemo<PartyPageProps | null>(() => {
    if (!party || party === "none") return null;
    const used = guest?.invitesUsed ?? 0, limit = guest?.canInvite ? guest.inviteLimit : 0;
    return {
      party: {
        id: party.id, name: party.name, description: party.description, photoUrl: photo?.path === party.photoPath ? photo.url : null,
        startsAt: party.startsAt, endsAt: party.endsAt, location: party.locationRevealed ? party.location : null, locationRevealed: party.locationRevealed, dressCode: party.dressCode
      },
      guest: guest ? {
        name: guest.name, status: guest.status, canRespond: rsvpOpen(party),
        invites: { allowed: guest.canInvite, limit, used: used, left: Math.max(0, limit - used), requests: requests.map((r) => ({ name: r.name, email: r.email, status: r.status })) }
      } : null,
      preview: isOwner && !guest,
      rsvp: async (status) => { try { await rsvpFn({ partyId: party.id, status }); } catch (e) { throw new Error(say(e)); } },
      requestInvite: async (input) => { try { await requestInviteFn({ partyId: party.id, ...input }); } catch (e) { throw new Error(say(e)); } }
    };
  }, [party, guest, requests, photo, isOwner]);

  if (party === null) return <Loading />;
  if (party === "none" || !props) return <NotReady />;
  const Page = hasPage(party.pageSlug) ? PARTY_PAGES[party.pageSlug] : null;
  if (!isOwner && (!Page || !party.published)) return <NotReady />;
  return <div className="party-shell">
    {isOwner && <div className="party-preview-bar" role="note">
      <span><strong>Owner preview</strong> · {party.published ? "Published" : "Not published"} · {Page ? `Page: ${party.pageSlug}` : "No custom page yet, so guests can't see it"}</span>
      <Link to={`/app/parties/${party.id}`}>Back to party admin</Link>
    </div>}
    {Page ? <Suspense fallback={<Loading />}><Page {...props} /></Suspense>
      : <main className="lux-page"><div className="lux-aura" aria-hidden="true" /><Placeholder {...props} /></main>}
  </div>;
}

function NotReady() {
  return <main className="lux-page lux-center">
    <div className="lux-aura" aria-hidden="true" />
    <section className="lux-card">
      <img className="lux-globe" src="/brand/uex-globe.webp" alt="" width={900} height={647} />
      <p className="lux-kicker">Uniq Exclusives</p>
      <h1>Not open yet</h1>
      <p className="lux-note">This invitation isn't ready, or it isn't on your list. We'll email you when it opens.</p>
      <Link className="lux-link" to="/app">Go to my invitations</Link>
    </section>
  </main>;
}
