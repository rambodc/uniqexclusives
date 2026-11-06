// End-to-end test of sign-in and the users admin against the local emulators (never production):
//   firebase emulators:start --project demo-uex --only auth,firestore,functions   (needs functions/.secret.local with any RESEND_API_KEY)
//   node scripts/e2e-emulator.mjs
// Codes are only emailed, so the test reads the stored hash from the emulator and finds the code by trying all 10^6.
import { initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth, signInWithCustomToken, signOut } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore, collection, getDocs, doc, getDoc, setDoc } from "firebase/firestore";
import { connectFunctionsEmulator, getFunctions, httpsCallable } from "firebase/functions";
import { createHmac, createHash } from "node:crypto";
const P = "demo-uex", FS = `http://127.0.0.1:8080/v1/projects/${P}/databases/(default)/documents`;
const admin = { Authorization: "Bearer owner", "Content-Type": "application/json" };
const app = initializeApp({ apiKey: "demo", projectId: P, authDomain: "x" });
const auth = getAuth(app); connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
const db = getFirestore(app); connectFirestoreEmulator(db, "127.0.0.1", 8080);
const fns = getFunctions(app, "us-central1"); connectFunctionsEmulator(fns, "127.0.0.1", 5001);
const call = (n, d) => httpsCallable(fns, n)(d).then((r) => r.data);
const ok = (c, m) => { console.log(c ? "PASS" : "FAIL", m); if (!c) process.exitCode = 1; };
const fails = async (p) => { try { await p; return null; } catch (e) { return e.code || e.message; } };
const id = (e) => createHash("sha256").update(e).digest("hex");
async function codeDoc(email) { const r = await fetch(`${FS}/loginCodes/${id(email)}`, { headers: admin }); return r.ok ? (await r.json()).fields : null; }
async function crack(email) { const f = await codeDoc(email); const salt = f.salt.stringValue, hash = f.hash.stringValue; for (let i = 0; i < 1e6; i++) { const c = String(i).padStart(6, "0"); if (createHmac("sha256", salt).update(c).digest("hex") === hash) return c; } }
await fetch(`http://127.0.0.1:8080/emulator/v1/projects/${P}/databases/(default)/documents`, { method: "DELETE" });
await fetch(`http://127.0.0.1:9099/emulator/v1/projects/${P}/accounts`, { method: "DELETE" });
const OWNER = "rambodr@uniquem.ca";
await fetch(`${FS}/users?documentId=OWNERUID`, { method: "POST", headers: admin, body: JSON.stringify({ fields: { email: { stringValue: OWNER }, name: { stringValue: "Rambod Rad" }, role: { stringValue: "owner" }, gender: { stringValue: "male" }, staffPartyId: { nullValue: null } } }) });

ok((await fails(call("requestCode", { email: "stranger@example.com" }))) === "functions/not-found", "unknown email is refused with not-found");
ok(!(await codeDoc("stranger@example.com")), "no code stored for an email not on the list");
const r2 = await call("requestCode", { email: " RambodR@Uniquem.ca " });
ok(r2.ok === true, "known email gets a code");
ok(!!(await codeDoc(OWNER)), "code stored (hashed) for the owner");
const code = await crack(OWNER);
ok(/^\d{6}$/.test(code), "code is 6 digits");
const wrong = code === "000000" ? "111111" : "000000";
ok((await fails(call("verifyCode", { email: OWNER, code: wrong }))) === "functions/permission-denied", "wrong code refused");
ok((await codeDoc(OWNER)).attempts.integerValue === "1", "attempt counted");
const { token } = await call("verifyCode", { email: OWNER, code });
ok(typeof token === "string" && token.length > 50, "right code returns a custom token");
ok((await fails(call("verifyCode", { email: OWNER, code }))) === "functions/permission-denied", "code works only once");
const cred = await signInWithCustomToken(auth, token);
ok(cred.user.uid === "OWNERUID" && cred.user.email === OWNER, "signed in as the users record uid with email");
ok((await fails(getDocs(collection(db, "loginCodes")))) === "permission-denied", "client cannot read loginCodes");
ok((await getDocs(collection(db, "users"))).size === 1, "owner can list users");
ok((await fails(setDoc(doc(db, "users", "x"), { email: "x@y.z", name: "X", role: "owner" }))) === "permission-denied", "owner cannot write users directly");
const { uid } = await call("createUser", { email: "Guest@Example.com", name: "Test Guest", gender: "female", role: "member", staffPartyId: null });
ok(!!uid, "owner created a member");
ok((await fails(call("createUser", { email: "guest@example.com", name: "Again", gender: "male", role: "member", staffPartyId: null }))) === "functions/already-exists", "duplicate email refused");
ok((await fails(call("removeUser", { uid: "OWNERUID" }))) === "functions/failed-precondition", "owner cannot remove themself");
await signOut(auth);
ok((await fails(call("createUser", { email: "a@b.co", name: "A", gender: "male", role: "owner", staffPartyId: null }))) === "functions/unauthenticated", "signed-out cannot create users");
await call("requestCode", { email: "guest@example.com" });
const gcode = await crack("guest@example.com");
const g = await call("verifyCode", { email: "guest@example.com", code: gcode });
await signInWithCustomToken(auth, g.token);
ok((await getDoc(doc(db, "users", uid))).get("role") === "member", "member reads own record");
ok((await fails(getDocs(collection(db, "users")))) === "permission-denied", "member cannot list users");
ok((await fails(getDoc(doc(db, "users", "OWNERUID")))) === "permission-denied", "member cannot read others");
ok((await fails(setDoc(doc(db, "users", uid), { email: "guest@example.com", name: "Test Guest", role: "owner" }))) === "permission-denied", "member cannot promote self");
ok((await fails(call("createUser", { email: "a@b.co", name: "A", gender: "male", role: "owner", staffPartyId: null }))) === "functions/permission-denied", "member cannot create users");
await signOut(auth);
// burn attempts
await call("requestCode", { email: "guest@example.com" });
const c2 = await crack("guest@example.com"); const bad = c2 === "999999" ? "888888" : "999999";
for (let i = 0; i < 5; i++) await fails(call("verifyCode", { email: "guest@example.com", code: bad }));
ok((await fails(call("verifyCode", { email: "guest@example.com", code: c2 }))) === "functions/permission-denied", "after 5 wrong tries even the right code is refused");
// rate limit: guest has had 2 sends; 3 more allowed, then stop
for (let i = 0; i < 4; i++) await call("requestCode", { email: "guest@example.com" });
ok((await codeDoc("guest@example.com")).sends.arrayValue.values.length === 5, "max 5 code emails per hour");
// sign back in as owner and remove the guest
await fetch(`${FS}/loginCodes/${id(OWNER)}`, { method: "DELETE", headers: admin });
await call("requestCode", { email: OWNER }); const oc = await crack(OWNER);
await signInWithCustomToken(auth, (await call("verifyCode", { email: OWNER, code: oc })).token);
await call("removeUser", { uid });
ok(!(await getDoc(doc(db, "users", uid))).exists(), "owner removed the guest");
ok((await fails(call("requestCode", { email: "guest@example.com" }))) === "functions/not-found", "removed guest gets not-found");
ok(!(await codeDoc("guest@example.com")), "removed guest gets no code");
process.exit();
