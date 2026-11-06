// End-to-end test of parties and invites against the emulators (no email leaves the box: the mailer only logs in the emulator).
//   firebase emulators:exec --project demo-uex --only auth,firestore,functions,storage "node scripts/e2e-parties.mjs"
import { initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth, signInWithCustomToken, signOut } from "firebase/auth";
import { collection, connectFirestoreEmulator, doc, getDoc, getDocs, getFirestore } from "firebase/firestore";
import { connectFunctionsEmulator, getFunctions, httpsCallable } from "firebase/functions";
import { createHash, createHmac } from "node:crypto";

const P = "demo-uex", FS = `http://127.0.0.1:8080/v1/projects/${P}/databases/(default)/documents`;
const admin = { Authorization: "Bearer owner", "Content-Type": "application/json" };
const app = initializeApp({ apiKey: "demo", projectId: P, authDomain: "x" });
const auth = getAuth(app); connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
const db = getFirestore(app); connectFirestoreEmulator(db, "127.0.0.1", 8080);
const fns = getFunctions(app, "us-central1"); connectFunctionsEmulator(fns, "127.0.0.1", 5001);
const call = (n, d) => httpsCallable(fns, n)(d).then((r) => r.data);
let failed = 0;
const ok = (c, m) => { console.log(c ? "PASS" : "FAIL", m); if (!c) failed++; };
const fails = async (p) => { try { await p; return null; } catch (e) { return e.code || e.message; } };
const raw = async (path) => { const r = await fetch(`${FS}/${path}`, { headers: admin }); return r.ok ? (await r.json()).fields : null; };
const list = async (path) => { const r = await fetch(`${FS}/${path}`, { headers: admin }); return ((await r.json()).documents ?? []).map((d) => ({ id: d.name.split("/").pop(), f: d.fields })); };
const id = (e) => createHash("sha256").update(e).digest("hex");
async function signInAs(email) {
  await fetch(`${FS}/loginCodes/${id(email)}`, { method: "DELETE", headers: admin });
  await call("requestCode", { email });
  const f = await raw(`loginCodes/${id(email)}`), salt = f.salt.stringValue, hash = f.hash.stringValue;
  let code; for (let i = 0; i < 1e6; i++) { const c = String(i).padStart(6, "0"); if (createHmac("sha256", salt).update(c).digest("hex") === hash) { code = c; break; } }
  if (auth.currentUser) await signOut(auth);
  await signInWithCustomToken(auth, (await call("verifyCode", { email, code })).token);
}
const crack = async (email) => {
  const f = await raw(`loginCodes/${id(email)}`), salt = f.salt.stringValue, hash = f.hash.stringValue;
  for (let i = 0; i < 1e6; i++) { const c = String(i).padStart(6, "0"); if (createHmac("sha256", salt).update(c).digest("hex") === hash) return c; }
};
/** Opens a personal link the way the /i page does: it emails a code (read back from the emulator), which signs the guest in. */
async function useLink(link, email) {
  const [, partyId, token] = new URL(link).pathname.match(/^\/i\/([^/]+)\/([^/]+)$/);
  if (auth.currentUser) await signOut(auth);
  await fetch(`${FS}/loginCodes/${id(email)}`, { method: "DELETE", headers: admin });
  const teaser = await call("openInvite", { partyId, token });
  if (!teaser.sent || teaser.signedIn || "token" in teaser) throw new Error("openInvite should only send a code");
  const res = await call("enterInvite", { partyId, token, code: await crack(email) });
  return signInWithCustomToken(auth, res.token);
}

await fetch(`http://127.0.0.1:8080/emulator/v1/projects/${P}/databases/(default)/documents`, { method: "DELETE" });
await fetch(`http://127.0.0.1:9099/emulator/v1/projects/${P}/accounts`, { method: "DELETE" });
const OWNER = "owner@example.com";
await fetch(`${FS}/users?documentId=OWNERUID`, { method: "POST", headers: admin, body: JSON.stringify({ fields: { email: { stringValue: OWNER }, name: { stringValue: "Owner One" }, role: { stringValue: "owner" } } }) });
await signInAs(OWNER);

const PID = "e2ePartyId001", start = Date.now() + 7 * 86_400_000;
const party = { id: PID, name: "Test Night", description: "A test", photoPath: null, startsAt: start, endsAt: null, location: "Secret Hall, 1 Main St", locationRevealed: false, dressCode: "Black tie", guestLimit: null, published: false, pageSlug: null };
ok((await call("saveParty", party)).id === PID, "owner creates a party");
ok((await fails(call("saveParty", { ...party, name: "" }))) === "functions/invalid-argument", "a party needs a name");
ok((await raw(`parties/${PID}`)).location.nullValue === null, "hidden location is not on the party doc");
ok((await raw(`parties/${PID}/private/details`)).location.stringValue === party.location, "location kept in private/details");

const ann = await call("inviteGuest", { partyId: PID, name: "Ann Guest", email: "Ann@Example.com", guestOf: "Uniquem team", canInvite: true, inviteLimit: 2 });
ok(ann.emailed === true && /^http.*\/i\/e2ePartyId001\/[A-Za-z0-9_-]{43}$/.test(ann.link), "invite creates a link and (emulated) email");
ok((await raw(`users/${ann.uid}`)).role.stringValue === "member", "inviting creates a member account");
const annGuest = await raw(`parties/${PID}/guests/${ann.uid}`);
ok(annGuest.status.stringValue === "invited" && annGuest.guestOf.stringValue === "Uniquem team" && annGuest.email.stringValue === "ann@example.com", "guest record: invited, group, email");
ok(!JSON.stringify(await list(`parties/${PID}/tokens`)).includes(ann.link.split("/").pop()), "only the token hash is stored");
ok((await fails(call("inviteGuest", { partyId: PID, name: "Ann", email: "ann@example.com", canInvite: false }))) === "functions/already-exists", "no double invite");

{
  const [, , token] = new URL(ann.link).pathname.split("/").slice(1);
  if (auth.currentUser) await signOut(auth);
  const teaser = await call("openInvite", { partyId: PID, token });
  ok(teaser.partyName === "Test Night" && teaser.firstName === "Ann" && teaser.email === "a•••@example.com" && teaser.sent === true && !("token" in teaser) && !auth.currentUser,
    "opening the link shows the teaser and masked email, emails a code, and signs nobody in");
  ok((await fails(call("enterInvite", { partyId: PID, token, code: "000000" === (await crack("ann@example.com")) ? "111111" : "000000" }))) === "functions/permission-denied", "a wrong code is refused");
  ok((await fails(call("enterInvite", { partyId: PID, token: "A".repeat(43), code: await crack("ann@example.com") }))) === "functions/permission-denied", "the right code with a made-up link is refused");
  ok((await fails(call("redeemInvite", { partyId: PID, token }))) !== null, "the old direct sign-in is gone");
}
await useLink(ann.link, "ann@example.com");
ok(auth.currentUser.uid === ann.uid, "the emailed code signs Ann in from her link");
{
  const [, , token] = new URL(ann.link).pathname.split("/").slice(1);
  const again = await call("openInvite", { partyId: PID, token });
  ok(again.signedIn === true && again.sent === false, "already signed in as Ann: the link skips the code");
}
ok((await fails(getDoc(doc(db, "parties", PID)))) === "permission-denied", "unpublished party is hidden from guests");
ok((await fails(call("rsvp", { partyId: PID, status: "accepted" }))) === "functions/permission-denied", "no RSVP before it's published");
await useLink(ann.link, "ann@example.com");
ok(auth.currentUser.uid === ann.uid, "the link can be reused");

await signInAs(OWNER);
await call("saveParty", { ...party, published: true });
await signInAs("ann@example.com");
ok((await fails(getDoc(doc(db, "parties", PID)))) === "permission-denied", "published but no custom page: still hidden");
await signInAs(OWNER);
await call("saveParty", { ...party, published: true, pageSlug: "test-night" });
const preview = await getDoc(doc(db, "parties", PID));
ok(preview.exists(), "owner can always read (preview)");

await useLink(ann.link, "ann@example.com");
const seen = await getDoc(doc(db, "parties", PID));
ok(seen.get("name") === "Test Night" && seen.get("location") === null, "guest sees the party without the hidden location");
ok((await fails(getDoc(doc(db, "parties", PID, "private", "details")))) === "permission-denied", "guest can't read private details");
ok((await fails(getDocs(collection(db, "parties", PID, "guests")))) === "permission-denied", "guest can't list the guest list");
ok((await call("rsvp", { partyId: PID, status: "accepted" })).status === "accepted", "Ann accepts");
ok((await call("rsvp", { partyId: PID, status: "declined" })).status === "declined", "Ann can change to decline");
await call("rsvp", { partyId: PID, status: "accepted" });
const r1 = await call("requestInvite", { partyId: PID, name: "Bob Plus", email: "bob@example.com", note: "Come with me!" });
ok(!!r1.id, "Ann asks to invite Bob");
ok((await fails(call("requestInvite", { partyId: PID, name: "Bob", email: "bob@example.com", note: "" }))) === "functions/already-exists", "no duplicate request");
const r2 = await call("requestInvite", { partyId: PID, name: "Cy Extra", email: "cy@example.com", note: "" });
ok((await fails(call("requestInvite", { partyId: PID, name: "Di", email: "di@example.com", note: "" }))) === "functions/resource-exhausted", "pending requests count against her 2");
ok((await getDoc(doc(db, "parties", PID, "guests", ann.uid))).get("invitesUsed") === 2, "Ann has used 2 of 2");
ok((await fails(call("decideRequest", { partyId: PID, requestId: r1.id, approve: true }))) === "functions/permission-denied", "guests can't approve");

await signInAs(OWNER);
const approved = await call("decideRequest", { partyId: PID, requestId: r1.id, approve: true });
ok(approved.status === "approved" && approved.emailed === true, "owner approves Bob; invite emailed");
const bobGuest = await raw(`parties/${PID}/guests/${approved.uid}`);
ok(bobGuest.guestOf.stringValue === "Ann Guest" && bobGuest.invitedByName.stringValue === "Ann Guest" && bobGuest.note.stringValue === "Come with me!" && bobGuest.canInvite.booleanValue === false, "Bob's Guest of = Ann, with her note, no invites");
ok((await fails(call("decideRequest", { partyId: PID, requestId: r1.id, approve: true }))) === "functions/failed-precondition", "a request is handled once");
ok((await call("decideRequest", { partyId: PID, requestId: r2.id, approve: false })).status === "rejected", "owner rejects Cy");
ok((await raw(`parties/${PID}/guests/${ann.uid}`)).invitesUsed.integerValue === "1", "a rejected request frees Ann's invite");

await useLink(approved.link, "bob@example.com");
ok(auth.currentUser.uid === approved.uid, "Bob's link and code sign him in");
ok((await fails(call("requestInvite", { partyId: PID, name: "Eve", email: "eve@example.com", note: "" }))) === "functions/permission-denied", "Bob can't invite yet");
await signInAs(OWNER);
await call("updateGuest", { partyId: PID, uid: approved.uid, canInvite: true, inviteLimit: 1 });
await useLink(approved.link, "bob@example.com");
ok(!!(await call("requestInvite", { partyId: PID, name: "Eve", email: "eve@example.com", note: "" })).id, "after the owner allows it, Bob can invite");

await signInAs(OWNER);
const fresh = (await call("inviteLinkFor", { partyId: PID, uid: ann.uid })).link;
ok(fresh !== ann.link, "copy link mints a fresh link");
const re = await call("resendInvite", { partyId: PID, uid: ann.uid });
ok(re.emailed === true, "resend works");
ok((await fails(call("openInvite", { partyId: PID, token: "A".repeat(43) }))) === "functions/permission-denied", "a made-up token is refused");
await call("saveParty", { ...party, published: true, pageSlug: "test-night", guestLimit: 2 });
ok((await fails(call("inviteGuest", { partyId: PID, name: "Full", email: "full@example.com", canInvite: false }))) === "functions/resource-exhausted", "guest limit is enforced");
await call("removeGuest", { partyId: PID, uid: ann.uid });
ok((await fails(useLink(ann.link, "ann@example.com"))) === "functions/permission-denied", "a removed guest's link stops working");
await signInAs(OWNER);
await call("removeUser", { uid: approved.uid });
ok(!(await raw(`parties/${PID}/guests/${approved.uid}`)), "removing a user takes them off party lists");

const OLD = "e2ePartyOld01";
await call("saveParty", { ...party, id: OLD, startsAt: Date.now() - 3 * 86_400_000 });
ok((await fails(call("inviteGuest", { partyId: OLD, name: "Late", email: "late@example.com", canInvite: false }))) === "functions/failed-precondition", "no invites after the party ends");
await call("deleteParty", { id: OLD });

const memberCalls = await (async () => { await signInAs("ann@example.com"); return fails(call("saveParty", party)); })();
ok(memberCalls === "functions/permission-denied", "members can't create parties");
await signInAs(OWNER);
await call("deleteParty", { id: PID });
ok(!(await raw(`parties/${PID}`)) && (await list(`parties/${PID}/guests`)).length === 0 && (await list(`parties/${PID}/tokens`)).length === 0, "delete removes the party and everything under it");
console.log(failed ? `${failed} FAILED` : "ALL PASSED");
process.exit(failed ? 1 : 0);
