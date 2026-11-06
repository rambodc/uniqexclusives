// Firestore + Storage rules tests against the emulators:
//   firebase emulators:exec --project demo-uex --only firestore,storage "node --test tests/rules.test.mjs"
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { deleteApp, initializeApp } from "firebase/app";
import { collection, collectionGroup, connectFirestoreEmulator, doc, getDoc, getDocs, getFirestore, query, setDoc, where } from "firebase/firestore";
import { connectStorageEmulator, getBytes, getStorage, ref, uploadBytes, deleteObject } from "firebase/storage";

const P = "demo-uex", FS = `http://127.0.0.1:8080/v1/projects/${P}/databases/(default)/documents`;
const admin = { Authorization: "Bearer owner", "Content-Type": "application/json" };
const val = (v) => typeof v === "string" ? { stringValue: v } : typeof v === "boolean" ? { booleanValue: v } : typeof v === "number" ? { integerValue: String(v) } : v === null ? { nullValue: null } : { stringValue: String(v) };
async function seed(path, data) {
  const fields = Object.fromEntries(Object.entries(data).map(([k, v]) => [k, val(v)]));
  const r = await fetch(`${FS}/${path}`, { method: "PATCH", headers: admin, body: JSON.stringify({ fields }) });
  assert.ok(r.ok, `seed ${path}: ${r.status}`);
}
let n = 0;
function as(uid) {
  const app = initializeApp({ apiKey: "demo", projectId: P, storageBucket: `${P}.appspot.com` }, `a${n++}`);
  const db = getFirestore(app), st = getStorage(app);
  connectFirestoreEmulator(db, "127.0.0.1", 8080, uid ? { mockUserToken: { sub: uid, user_id: uid } } : undefined);
  connectStorageEmulator(st, "127.0.0.1", 9199, uid ? { mockUserToken: { sub: uid, user_id: uid } } : undefined);
  return { db, st, app };
}
const denied = async (p) => { try { await p; return false; } catch (e) { return /permission|unauthorized|denied/i.test(e.code ?? e.message); } };
const allowed = async (p) => { try { await p; return true; } catch (e) { console.log(e.code, e.message); return false; } };

before(async () => {
  await fetch(`http://127.0.0.1:8080/emulator/v1/projects/${P}/databases/(default)/documents`, { method: "DELETE" });
  await seed("users/OWNER", { email: "o@x.co", firstName: "Owner", lastName: "One", gender: "male", role: "owner", staffPartyId: null });
  await seed("users/ANN", { email: "ann@x.co", firstName: "Ann", lastName: "A", gender: "female", role: "member", staffPartyId: null });
  await seed("users/BOB", { email: "bob@x.co", firstName: "Bob", lastName: "B", gender: "male", role: "member", staffPartyId: null });
  await seed("users/STAFF", { email: "s@x.co", firstName: "Staff", lastName: "S", gender: "male", role: "staff", staffPartyId: null });
  await seed("users/RUNNER", { email: "r@x.co", firstName: "Runner", lastName: "R", gender: "female", role: "staff", staffPartyId: "live0000001" });
  await seed("users/SNEAK", { email: "m@x.co", firstName: "Sneak", lastName: "S", gender: "male", role: "member", staffPartyId: "live0000001" });
  // live: published + custom page. draft: published, no page. hidden: has a page, not published.
  await seed("parties/live0000001", { name: "Live", published: true, pageSlug: "uex-2", location: null, locationRevealed: false });
  await seed("parties/draft000001", { name: "Draft", published: true, pageSlug: null });
  await seed("parties/hidden00001", { name: "Hidden", published: false, pageSlug: "uex-2" });
  for (const p of ["live0000001", "draft000001", "hidden00001"]) {
    await seed(`parties/${p}/guests/ANN`, { uid: "ANN", firstName: "Ann", lastName: "A", email: "ann@x.co", status: "invited" });
    await seed(`parties/${p}/private/details`, { location: "Secret place" });
  }
  await seed("parties/live0000001/guests/BOB", { uid: "BOB", firstName: "Bob", lastName: "B", email: "bob@x.co", status: "accepted" });
  await seed("parties/live0000001/requests/req0000001", { by: "ANN", byName: "Ann A", firstName: "Cy", lastName: "C", email: "cy@x.co", status: "pending" });
  await seed("parties/live0000001/requests/req0000002", { by: "BOB", byName: "Bob B", firstName: "Di", lastName: "D", email: "di@x.co", status: "pending" });
  await seed("parties/live0000001/tokens/abc", { uid: "ANN" });
});

test("owners read and list everything in parties, but never write from the browser", async () => {
  const { db } = as("OWNER");
  assert.equal((await getDocs(collection(db, "parties"))).size, 3);
  assert.equal((await getDocs(collection(db, "parties/live0000001/guests"))).size, 2);
  assert.equal((await getDocs(collection(db, "parties/live0000001/requests"))).size, 2);
  assert.ok(await allowed(getDoc(doc(db, "parties/hidden00001/private/details"))));
  assert.ok(await denied(getDoc(doc(db, "parties/live0000001/tokens/abc"))));
  assert.ok(await denied(setDoc(doc(db, "parties/new0000001"), { name: "x" })));
  assert.ok(await denied(setDoc(doc(db, "parties/live0000001/guests/X"), { uid: "X" })));
});

test("a guest sees only a published party with a custom page they're on", async () => {
  const { db } = as("ANN");
  assert.ok(await allowed(getDoc(doc(db, "parties/live0000001"))));
  assert.ok(await denied(getDoc(doc(db, "parties/draft000001"))));
  assert.ok(await denied(getDoc(doc(db, "parties/hidden00001"))));
  assert.ok(await denied(getDocs(collection(db, "parties"))));
  const other = as("STAFF").db;  // staff with no party assigned sees nothing
  assert.ok(await denied(getDoc(doc(other, "parties/live0000001"))));
});

test("staff read only their one party: the party, its whole guest list and requests; not the location, other parties or People", async () => {
  const { db } = as("RUNNER");
  assert.ok(await allowed(getDoc(doc(db, "parties/live0000001"))));
  assert.equal((await getDocs(collection(db, "parties/live0000001/guests"))).size, 2);
  assert.ok(await allowed(getDoc(doc(db, "parties/live0000001/guests/BOB"))));
  assert.equal((await getDocs(collection(db, "parties/live0000001/requests"))).size, 2);
  assert.ok(await denied(getDoc(doc(db, "parties/live0000001/private/details"))));
  assert.ok(await denied(getDoc(doc(db, "parties/live0000001/tokens/abc"))));
  assert.ok(await denied(getDoc(doc(db, "parties/hidden00001"))));
  assert.ok(await denied(getDocs(collection(db, "parties/hidden00001/guests"))));
  assert.ok(await denied(getDocs(collection(db, "parties"))));
  assert.ok(await denied(getDocs(collection(db, "users"))));
  assert.ok(await denied(getDoc(doc(db, "users/ANN"))));
  assert.ok(await allowed(getDoc(doc(db, "users/RUNNER"))));
  assert.ok(await denied(setDoc(doc(db, "parties/live0000001/guests/X"), { uid: "X" })));
  assert.ok(await denied(setDoc(doc(db, "users/RUNNER"), { role: "owner" })));
  // A member with a staffPartyId (a leftover, say) gets nothing from it.
  assert.ok(await denied(getDocs(collection(as("SNEAK").db, "parties/live0000001/guests"))));
});

test("a guest reads only their own guest record and requests, never the list, location or tokens", async () => {
  const { db } = as("ANN");
  assert.ok(await allowed(getDoc(doc(db, "parties/live0000001/guests/ANN"))));
  assert.ok(await denied(getDoc(doc(db, "parties/live0000001/guests/BOB"))));
  assert.ok(await denied(getDocs(collection(db, "parties/live0000001/guests"))));
  assert.ok(await denied(getDoc(doc(db, "parties/live0000001/private/details"))));
  assert.ok(await denied(getDoc(doc(db, "parties/live0000001/tokens/abc"))));
  const mine = await getDocs(query(collection(db, "parties/live0000001/requests"), where("by", "==", "ANN")));
  assert.equal(mine.size, 1);
  assert.ok(await denied(getDocs(collection(db, "parties/live0000001/requests"))));
  assert.ok(await denied(getDoc(doc(db, "parties/live0000001/requests/req0000002"))));
  assert.ok(await denied(setDoc(doc(db, "parties/live0000001/guests/ANN"), { uid: "ANN", status: "accepted" })));
  assert.ok(await denied(setDoc(doc(db, "parties/live0000001/requests/x"), { by: "ANN" })));
});

test("'my parties' collection-group query works only for my own uid", async () => {
  const { db } = as("ANN");
  assert.equal((await getDocs(query(collectionGroup(db, "guests"), where("uid", "==", "ANN")))).size, 3);
  assert.ok(await denied(getDocs(query(collectionGroup(db, "guests"), where("uid", "==", "BOB")))));
  assert.ok(await denied(getDocs(collectionGroup(db, "guests"))));
});

test("signed out reads nothing; users and loginCodes unchanged", async () => {
  const { db } = as(null);
  assert.ok(await denied(getDoc(doc(db, "parties/live0000001"))));
  const ann = as("ANN").db;
  assert.ok(await allowed(getDoc(doc(ann, "users/ANN"))));
  assert.ok(await denied(getDoc(doc(ann, "users/BOB"))));
  assert.ok(await denied(getDocs(collection(ann, "loginCodes"))));
});

test("storage: owners upload images, guests of a published party can see them, nobody else", async () => {
  const img = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
  const owner = as("OWNER").st;
  assert.ok(await allowed(uploadBytes(ref(owner, "parties/live0000001/photo-1.jpg"), img, { contentType: "image/jpeg" })));
  assert.ok(await allowed(uploadBytes(ref(owner, "parties/hidden00001/photo-1.jpg"), img, { contentType: "image/jpeg" })));
  assert.ok(await denied(uploadBytes(ref(owner, "parties/live0000001/x.html"), img, { contentType: "text/html" })));
  assert.ok(await denied(uploadBytes(ref(owner, "elsewhere/x.jpg"), img, { contentType: "image/jpeg" })));
  const ann = as("ANN").st;
  assert.ok(await allowed(getBytes(ref(ann, "parties/live0000001/photo-1.jpg"))));
  assert.ok(await denied(getBytes(ref(ann, "parties/hidden00001/photo-1.jpg"))));
  assert.ok(await denied(uploadBytes(ref(ann, "parties/live0000001/photo-2.jpg"), img, { contentType: "image/jpeg" })));
  assert.ok(await denied(deleteObject(ref(ann, "parties/live0000001/photo-1.jpg"))));
  assert.ok(await denied(getBytes(ref(as("STAFF").st, "parties/live0000001/photo-1.jpg"))));
  assert.ok(await allowed(getBytes(ref(as("RUNNER").st, "parties/live0000001/photo-1.jpg"))));
  assert.ok(await denied(getBytes(ref(as("RUNNER").st, "parties/hidden00001/photo-1.jpg"))));
  assert.ok(await denied(uploadBytes(ref(as("RUNNER").st, "parties/live0000001/photo-3.jpg"), img, { contentType: "image/jpeg" })));
  assert.ok(await denied(getBytes(ref(as(null).st, "parties/live0000001/photo-1.jpg"))));
  assert.ok(await allowed(deleteObject(ref(owner, "parties/hidden00001/photo-1.jpg"))));
});
