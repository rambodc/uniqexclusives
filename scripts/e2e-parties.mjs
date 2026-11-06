// End-to-end test of parties and invites against the emulators (no email leaves the box: the mailer only logs in the emulator).
//   firebase emulators:exec --project demo-uex --only auth,firestore,functions,storage "node scripts/e2e-parties.mjs"
import { initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth, signInWithCustomToken, signOut } from "firebase/auth";
import { collection, connectFirestoreEmulator, doc, getDoc, getDocs, getFirestore } from "firebase/firestore";
import { connectFunctionsEmulator, getFunctions, httpsCallable } from "firebase/functions";
import { createHash, createHmac } from "node:crypto";
import { writeFileSync } from "node:fs";
import { runSweep } from "../functions/sweep.js";

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
const patch = async (path, fields) => {
  const mask = Object.keys(fields).map((f) => `updateMask.fieldPaths=${f}`).join("&");
  const r = await fetch(`${FS}/${path}?${mask}`, { method: "PATCH", headers: admin, body: JSON.stringify({ fields }) });
  if (!r.ok) throw new Error(`patch ${path}: ${r.status}`);
};
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
await fetch(`${FS}/users?documentId=OWNERUID`, { method: "POST", headers: admin, body: JSON.stringify({ fields: { email: { stringValue: OWNER }, firstName: { stringValue: "Owner" }, lastName: { stringValue: "One" }, role: { stringValue: "owner" }, gender: { stringValue: "male" }, staffPartyId: { nullValue: null } } }) });
await signInAs(OWNER);

const PID = "e2ePartyId001", start = Date.now() + 14 * 86_400_000;
const party = { id: PID, name: "Test Night", description: "A test", photoPath: null, startsAt: start, endsAt: null, location: "Secret Hall, 1 Main St", locationRevealed: false, dressCode: "Black tie", guestLimit: null, published: false, pageSlug: null };
ok((await call("saveParty", party)).id === PID, "owner creates a party");
ok((await fails(call("saveParty", { ...party, name: "" }))) === "functions/invalid-argument", "a party needs a name");
ok((await raw(`parties/${PID}`)).location.nullValue === null, "hidden location is not on the party doc");
ok((await raw(`parties/${PID}/private/details`)).location.stringValue === party.location, "location kept in private/details");

const ann = await call("inviteGuest", { partyId: PID, firstName: "Ann", lastName: "Guest", email: "Ann@Example.com", gender: "female", guestOf: "Uniquem team", canInvite: true, inviteLimit: 2 });
ok(ann.emailed === true && /^http.*\/i\/e2ePartyId001\/[A-Za-z0-9_-]{43}$/.test(ann.link), "invite creates a link and (emulated) email");
ok((await raw(`users/${ann.uid}`)).role.stringValue === "member", "inviting creates a member account");
const annGuest = await raw(`parties/${PID}/guests/${ann.uid}`);
ok(annGuest.status.stringValue === "invited" && annGuest.guestOf.stringValue === "Uniquem team" && annGuest.email.stringValue === "ann@example.com", "guest record: invited, group, email");
ok(annGuest.firstName.stringValue === "Ann" && annGuest.lastName.stringValue === "Guest" && !("name" in annGuest), "guest record: first and last name, no single name");
ok((await fails(call("inviteGuest", { partyId: PID, firstName: "Solo", email: "solo@example.com", gender: "female", canInvite: false }))) === "functions/invalid-argument", "inviting needs a last name");
ok(!JSON.stringify(await list(`parties/${PID}/tokens`)).includes(ann.link.split("/").pop()), "only the token hash is stored");
ok((await fails(call("inviteGuest", { partyId: PID, firstName: "Ann", lastName: "Test", email: "ann@example.com", gender: "female", canInvite: false }))) === "functions/already-exists", "no double invite");

{
  const [, , token] = new URL(ann.link).pathname.split("/").slice(1);
  if (auth.currentUser) await signOut(auth);
  const teaser = await call("openInvite", { partyId: PID, token });
  ok(teaser.partyName === "Test Night" && teaser.firstName === "Ann" && teaser.email === "a•••@example.com" && teaser.sent === true && !("token" in teaser) && !auth.currentUser,
    "opening the link shows the teaser and masked email, emails a code, and signs nobody in");
  ok(teaser.when.date && teaser.when.time && teaser.location === null && teaser.dressCode === "Black tie", "the teaser has the date, the dress code, and no hidden location");
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
const r1 = await call("requestInvite", { partyId: PID, firstName: "Bob", lastName: "Plus", email: "bob@example.com", gender: "male", note: "Come with me!" });
ok(!!r1.id, "Ann asks to invite Bob");
ok((await fails(call("requestInvite", { partyId: PID, firstName: "Nolast", email: "nolast@example.com", gender: "male", note: "" }))) === "functions/invalid-argument", "a guest's request needs a last name");
ok((await fails(call("requestInvite", { partyId: PID, firstName: "Bob", lastName: "Test", email: "bob@example.com", gender: "male", note: "" }))) === "functions/already-exists", "no duplicate request");
const r2 = await call("requestInvite", { partyId: PID, firstName: "Cy", lastName: "Extra", email: "cy@example.com", gender: "male", note: "" });
ok((await fails(call("requestInvite", { partyId: PID, firstName: "Di", lastName: "Test", email: "di@example.com", gender: "male", note: "" }))) === "functions/resource-exhausted", "pending requests count against her 2");
ok((await getDoc(doc(db, "parties", PID, "guests", ann.uid))).get("invitesUsed") === 2, "Ann has used 2 of 2");
ok((await fails(call("decideRequest", { partyId: PID, requestId: r1.id, approve: true }))) === "functions/permission-denied", "guests can't approve");

await signInAs(OWNER);
const approved = await call("decideRequest", { partyId: PID, requestId: r1.id, approve: true });
ok(approved.status === "approved" && approved.emailed === true, "owner approves Bob; invite emailed");
const bobGuest = await raw(`parties/${PID}/guests/${approved.uid}`);
ok(bobGuest.firstName.stringValue === "Bob" && bobGuest.lastName.stringValue === "Plus" && (await raw(`users/${approved.uid}`)).lastName.stringValue === "Plus", "Bob keeps the first and last name Ann typed");
ok(bobGuest.guestOf.stringValue === "Ann Guest" && bobGuest.invitedByName.stringValue === "Ann Guest" && bobGuest.note.stringValue === "Come with me!" && bobGuest.canInvite.booleanValue === false, "Bob's Guest of = Ann, with her note, no invites");
ok((await fails(call("decideRequest", { partyId: PID, requestId: r1.id, approve: true }))) === "functions/failed-precondition", "a request is handled once");
ok((await call("decideRequest", { partyId: PID, requestId: r2.id, approve: false })).status === "rejected", "owner rejects Cy");
ok((await raw(`parties/${PID}/guests/${ann.uid}`)).invitesUsed.integerValue === "1", "a rejected request frees Ann's invite");

await useLink(approved.link, "bob@example.com");
ok(auth.currentUser.uid === approved.uid, "Bob's link and code sign him in");
ok((await fails(call("requestInvite", { partyId: PID, firstName: "Eve", lastName: "Test", email: "eve@example.com", gender: "male", note: "" }))) === "functions/permission-denied", "Bob can't invite yet");
await signInAs(OWNER);
await call("updateGuest", { partyId: PID, uid: approved.uid, canInvite: true, inviteLimit: 1 });
await useLink(approved.link, "bob@example.com");
ok(!!(await call("requestInvite", { partyId: PID, firstName: "Eve", lastName: "Test", email: "eve@example.com", gender: "male", note: "" })).id, "after the owner allows it, Bob can invite");

await signInAs(OWNER);
const fresh = (await call("inviteLinkFor", { partyId: PID, uid: ann.uid })).link;
ok(fresh !== ann.link, "copy link mints a fresh link");
const re = await call("resendInvite", { partyId: PID, uid: ann.uid });
ok(re.emailed === true, "resend works");
ok((await fails(call("openInvite", { partyId: PID, token: "A".repeat(43) }))) === "functions/permission-denied", "a made-up token is refused");
await call("saveParty", { ...party, published: true, pageSlug: "test-night", guestLimit: 2 });
ok((await fails(call("inviteGuest", { partyId: PID, firstName: "Full", lastName: "Test", email: "full@example.com", gender: "female", canInvite: false }))) === "functions/resource-exhausted", "guest limit is enforced");
await call("removeGuest", { partyId: PID, uid: ann.uid });
ok((await fails(useLink(ann.link, "ann@example.com"))) === "functions/permission-denied", "a removed guest's link stops working");
await signInAs(OWNER);
await call("removeUser", { uid: approved.uid });
ok(!(await raw(`parties/${PID}/guests/${approved.uid}`)), "removing a user takes them off party lists");


// v13: invitation numbers, RSVP deadlines, expiry, re-invite, remind all, gender, staff and the owners' 3-day summary.
{
  const DAY = 86_400_000, V = "e2eV13Party01", vStart = Date.now() + 10 * DAY;
  const ts = (ms) => ({ timestampValue: new Date(ms).toISOString() });
  const msOf = (f) => Date.parse(f.timestampValue);
  await signInAs(OWNER);
  const vParty = { ...party, id: V, name: "Deadline Night", startsAt: vStart, rsvpDeadline: vStart - 5 * DAY, published: true, pageSlug: "test-night", guestLimit: null };
  await call("saveParty", vParty);
  ok(msOf((await raw(`parties/${V}`)).rsvpDeadline) === vStart - 5 * DAY, "the party keeps its RSVP deadline");
  await call("saveParty", { ...vParty, id: "e2eV13Party02", rsvpDeadline: undefined });
  ok(msOf((await raw("parties/e2eV13Party02")).rsvpDeadline) === vStart - 7 * DAY, "the deadline defaults to a week before the start");
  await call("deleteParty", { id: "e2eV13Party02" });
  ok((await fails(call("saveParty", { ...vParty, rsvpDeadline: vStart + 1 }))) === "functions/invalid-argument", "the deadline can't be after the start");
  ok((await fails(call("inviteGuest", { partyId: V, firstName: "No", lastName: "Gender", email: "ng@example.com", guestOf: "", canInvite: false }))) === "functions/invalid-argument", "gender is required to invite");

  const gia = await call("inviteGuest", { partyId: V, firstName: "Gia", lastName: "Rose", email: "gia@example.com", gender: "female", guestOf: "Rambod", canInvite: false });
  const giaGuest = await raw(`parties/${V}/guests/${gia.uid}`);
  ok(giaGuest.gender.stringValue === "female" && giaGuest.sendCount.integerValue === "1" && "nullValue" in giaGuest.rsvpDeadline, "a new guest: gender, Invitation 1, the party's deadline");
  ok((await raw(`users/${gia.uid}`)).gender.stringValue === "female", "gender is on the user too");
  const again = await call("resendInvite", { partyId: V, uid: gia.uid });
  ok(again.sendCount === 2 && (await raw(`parties/${V}/guests/${gia.uid}`)).sendCount.integerValue === "2", "a resend is Invitation 2");

  // The deadline passes without an answer.
  await patch(`parties/${V}`, { rsvpDeadline: ts(Date.now() - 1000) });
  const [, , giaToken] = new URL(again.link).pathname.split("/").slice(1);
  if (auth.currentUser) await signOut(auth);
  const teaser = await call("openInvite", { partyId: V, token: giaToken });
  ok(teaser.expired === true && teaser.status === "expired" && teaser.sent === false, "an expired invite link says so and sends no code");
  ok((await fails(call("enterInvite", { partyId: V, token: giaToken, code: "123456" }))) === "functions/permission-denied", "an expired invite can't sign in from its link");
  await signInAs("gia@example.com");
  ok((await fails(call("rsvp", { partyId: V, status: "accepted" }))) === "functions/failed-precondition", "an expired guest can't RSVP");
  await signInAs(OWNER);
  ok((await fails(call("resendInvite", { partyId: V, uid: gia.uid }))) === "functions/failed-precondition", "a plain resend can't revive an expired invite");
  const swept = await runSweep({ send: async () => { throw new Error("no summary expected"); } });
  ok(swept.expired >= 1 && (await raw(`parties/${V}/guests/${gia.uid}`)).status.stringValue === "expired", "the sweep marks unanswered invites Expired");

  ok((await fails(call("reinviteGuest", { partyId: V, uid: gia.uid, rsvpDeadline: vStart + 1 }))) === "functions/invalid-argument", "a re-invite deadline can't be after the start");
  const before = Date.now();
  const re = await call("reinviteGuest", { partyId: V, uid: gia.uid });
  const giaNow = await raw(`parties/${V}/guests/${gia.uid}`);
  ok(re.sendCount === 3 && giaNow.status.stringValue === "invited" && Math.abs(msOf(giaNow.rsvpDeadline) - (before + 7 * DAY)) < 60_000, "re-invite: Invitation 3, back to invited, a week to answer");
  await signInAs("gia@example.com");
  ok((await call("rsvp", { partyId: V, status: "declined" })).status === "declined", "after a re-invite she can answer again");
  await signInAs(OWNER);
  ok((await fails(call("reinviteGuest", { partyId: V, uid: gia.uid }))) === "functions/failed-precondition", "no re-invite once they replied");

  const hal = await call("inviteGuest", { partyId: V, firstName: "Hal", lastName: "Stone", email: "hal@example.com", gender: "male", guestOf: "", canInvite: false });
  ok(Math.abs(msOf((await raw(`parties/${V}/guests/${hal.uid}`)).rsvpDeadline) - (Date.now() + 7 * DAY)) < 60_000, "invited after the party deadline: their own week");
  const ivy = await call("inviteGuest", { partyId: V, firstName: "Ivy", lastName: "Lane", email: "ivy@example.com", gender: "female", guestOf: "Uniquem team", canInvite: false });
  const reminded = await call("remindAll", { partyId: V });
  ok(reminded.sent === 2 && reminded.failed.length === 0, "remind all emails the 2 who haven't replied");
  ok((await raw(`parties/${V}/guests/${hal.uid}`)).sendCount.integerValue === "2" && (await raw(`parties/${V}/guests/${gia.uid}`)).sendCount.integerValue === "3", "reminders count up; answered guests are skipped");

  // Staff: one party, every guest action, nothing else.
  const staff = await call("createUser", { email: "sam.staff@example.com", firstName: "Sam", lastName: "Staff", gender: "male", role: "staff", staffPartyId: V });
  ok((await raw(`users/${staff.uid}`)).staffPartyId.stringValue === V, "staff created with their party");
  await signInAs("sam.staff@example.com");
  ok((await getDocs(collection(db, "parties", V, "guests"))).size === 3, "staff read their party's full guest list");
  ok((await fails(getDocs(collection(db, "parties")))) === "permission-denied", "staff can't list parties");
  ok((await fails(getDoc(doc(db, "parties", V, "private", "details")))) === "permission-denied", "staff can't read the hidden location");
  const jo = await call("inviteGuest", { partyId: V, firstName: "Jo", lastName: "Staffed", email: "jo@example.com", gender: "male", guestOf: "Sam", canInvite: false });
  ok(!!jo.uid, "staff invite to their party");
  ok((await call("resendInvite", { partyId: V, uid: jo.uid })).sendCount === 2, "staff resend");
  ok((await call("updateGuest", { partyId: V, uid: jo.uid, canInvite: true, inviteLimit: 1 })).ok, "staff toggle can-invite");
  ok((await call("remindAll", { partyId: V })).sent === 3, "staff remind all");
  ok((await call("removeGuest", { partyId: V, uid: jo.uid })).ok, "staff remove a guest");
  ok((await fails(call("inviteGuest", { partyId: PID, firstName: "Elsewhere", lastName: "Test", email: "else@example.com", gender: "male", guestOf: "", canInvite: false }))) === "functions/permission-denied", "staff can't touch another party");
  ok((await fails(call("saveParty", vParty))) === "functions/permission-denied", "staff can't edit the party");
  ok((await fails(call("deleteParty", { id: V }))) === "functions/permission-denied", "staff can't delete the party");
  ok((await fails(call("setStaffParty", { uid: staff.uid, partyId: PID }))) === "functions/permission-denied", "staff can't reassign themselves");
  ok((await fails(call("createUser", { email: "x@example.com", firstName: "X", lastName: "Test", gender: "male", role: "member", staffPartyId: null }))) === "functions/permission-denied", "staff can't manage People");
  await signInAs(OWNER);
  await call("setStaffParty", { uid: staff.uid, partyId: PID });
  await signInAs("sam.staff@example.com");
  ok((await fails(call("resendInvite", { partyId: V, uid: hal.uid }))) === "functions/permission-denied", "moved to another party: the old one is closed to them");
  await signInAs(OWNER);
  await call("setUserRole", { uid: staff.uid, role: "member", staffPartyId: null });
  ok("nullValue" in (await raw(`users/${staff.uid}`)).staffPartyId, "leaving staff clears the party");
  await call("setUserRole", { uid: staff.uid, role: "staff", staffPartyId: V });

  // The owners' summary, 3 days before the deadline, once.
  await patch(`parties/${V}`, { rsvpDeadline: ts(Date.now() + 2 * DAY), summarySentAt: { nullValue: null } });
  await patch(`parties/${V}/guests/${gia.uid}`, { status: { stringValue: "invited" }, rsvpDeadline: { nullValue: null } });
  const sent = [];
  const first = await runSweep({ send: async (message) => { sent.push(message); return "captured"; } });
  ok(first.summaries.length === 1 && sent.length === 1 && sent[0].to.join() === OWNER && /Deadline Night: 3 still haven't replied/.test(sent[0].subject) && sent[0].html.includes(`/app/parties/${V}`), "the owners get one summary of who hasn't replied, linking to the guest list");
  ok(sent[0].text.includes("- Hal Stone (M)") && sent[0].html.includes("Hal Stone"), "the summary lists first and last names");
  ok(!!(await raw(`parties/${V}`)).summarySentAt.timestampValue, "summarySentAt is set");
  ok((await runSweep({ send: async () => { throw new Error("sent twice"); } })).summaries.length === 0, "it's sent only once");
  if (process.env.E2E_OUT) writeFileSync(`${process.env.E2E_OUT}/summary-email.html`, sent[0].html);
  await call("deleteParty", { id: V });
  ok("nullValue" in (await raw(`users/${staff.uid}`)).staffPartyId, "deleting a party unassigns its staff");
  void ivy;
}

const OLD = "e2ePartyOld01";
await call("saveParty", { ...party, id: OLD, startsAt: Date.now() - 3 * 86_400_000 });
ok((await fails(call("inviteGuest", { partyId: OLD, firstName: "Late", lastName: "Test", email: "late@example.com", gender: "female", canInvite: false }))) === "functions/failed-precondition", "no invites after the party ends");
await call("deleteParty", { id: OLD });

const memberCalls = await (async () => { await signInAs("ann@example.com"); return fails(call("saveParty", party)); })();
ok(memberCalls === "functions/permission-denied", "members can't create parties");
await signInAs(OWNER);
await call("deleteParty", { id: PID });
ok(!(await raw(`parties/${PID}`)) && (await list(`parties/${PID}/guests`)).length === 0 && (await list(`parties/${PID}/tokens`)).length === 0, "delete removes the party and everything under it");
console.log(failed ? `${failed} FAILED` : "ALL PASSED");
process.exit(failed ? 1 : 0);
