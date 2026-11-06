// Uniq Exclusives Cloud Functions (2nd gen, us-central1).
//  Sign-in (invite only, no passwords): requestCode emails a 6-digit code only to people who already have a users record (others get not-found);
//  verifyCode checks it and returns a Firebase custom token (helpers in login.js). Codes live in loginCodes/{sha256(email)}, which clients can never read.
//  Users (owners only): createUser, removeUser. Removing someone also takes them off every party list. Listing is a plain Firestore read that firestore.rules allows owners.
//  Parties and invites: see parties-api.js.
import { FieldValue } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { cleanCode, codeDocId, normalizeEmail } from "./codes.js";
import { sendLoginCode, tokenFor, useLoginCode } from "./login.js";
import { removeGuestPlace } from "./parties-api.js";
import { cleanName, isRole } from "./users.js";
import { TOKEN_SIGNER, auth, base, db, findUserByEmail, requireOwner, resendApiKey } from "./app.js";

export * from "./parties-api.js";
const BAD_CODE = "That code isn't right or has expired. Request a new one.";
const NO_ACCOUNT = "There's no account for that email. UEX is invite-only.";

export const requestCode = onCall({ ...base, secrets: [resendApiKey], timeoutSeconds: 30 }, async (request) => {
  const email = normalizeEmail(request.data?.email);
  if (!email) throw new HttpsError("invalid-argument", "Enter a valid email address.");
  const user = await findUserByEmail(email);
  if (!user) throw new HttpsError("not-found", NO_ACCOUNT);
  await sendLoginCode(user, email);   // a rate-limited address gets the same answer; its latest code still works
  return { ok: true };
});

export const verifyCode = onCall({ ...base, timeoutSeconds: 20, serviceAccount: TOKEN_SIGNER }, async (request) => {
  const email = normalizeEmail(request.data?.email), code = cleanCode(request.data?.code);
  if (!email || !code || !(await useLoginCode(email, code))) throw new HttpsError("permission-denied", BAD_CODE);
  const user = await findUserByEmail(email);
  if (!user) throw new HttpsError("permission-denied", BAD_CODE);
  return { token: await tokenFor(user.id, email, user.get("name")) };
});

export const createUser = onCall({ ...base, timeoutSeconds: 20 }, async (request) => {
  const by = await requireOwner(request);
  const email = normalizeEmail(request.data?.email), name = cleanName(request.data?.name), role = request.data?.role;
  if (!email) throw new HttpsError("invalid-argument", "Enter a valid email address.");
  if (!name) throw new HttpsError("invalid-argument", "Enter a name.");
  if (!isRole(role)) throw new HttpsError("invalid-argument", "Pick a role.");
  if (await findUserByEmail(email)) throw new HttpsError("already-exists", "That email is already on the list.");
  let uid;
  try { uid = (await auth.getUserByEmail(email)).uid; }
  catch (error) { if (error?.code !== "auth/user-not-found") throw error; uid = (await auth.createUser({ email, emailVerified: true, displayName: name })).uid; }
  await db.collection("users").doc(uid).set({ email, name, role, createdAt: FieldValue.serverTimestamp(), createdBy: by, updatedAt: FieldValue.serverTimestamp() });
  return { uid };
});

export const removeUser = onCall({ ...base, timeoutSeconds: 20 }, async (request) => {
  const by = await requireOwner(request);
  const uid = typeof request.data?.uid === "string" ? request.data.uid : "";
  if (!uid) throw new HttpsError("invalid-argument", "Pick a user.");
  if (uid === by) throw new HttpsError("failed-precondition", "You can't remove yourself.");
  const ref = db.collection("users").doc(uid), snap = await ref.get();
  if (!snap.exists) throw new HttpsError("not-found", "That user is already gone.");
  const email = snap.get("email");
  await ref.delete();
  // Their place on every guest list goes too (invite links stop working with it).
  const places = await db.collectionGroup("guests").where("uid", "==", uid).get();
  for (const place of places.docs) await removeGuestPlace(place.ref.parent.parent.id, uid);
  if (typeof email === "string") await db.collection("loginCodes").doc(codeDocId(email)).delete();
  await auth.deleteUser(uid).catch((error) => { if (error?.code !== "auth/user-not-found") throw error; });
  return { ok: true };
});
