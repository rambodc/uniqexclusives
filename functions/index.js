// Uniq Exclusives Cloud Functions (2nd gen, us-central1).
//  Sign-in (invite only, no passwords): requestCode emails a 6-digit code only to people who already have a users record (others get not-found);
//  verifyCode checks it and returns a Firebase custom token. Codes live in loginCodes/{sha256(email)}, which clients can never read.
//  Users (owners only): createUser, removeUser. Removing someone also takes them off every party list. Listing is a plain Firestore read that firestore.rules allows owners.
//  Parties and invites: see parties-api.js.
import { FieldValue } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { logger } from "firebase-functions/v2";
import { CODE_TTL_MS, checkCode, cleanCode, codeDocId, hashCode, newCode, newSalt, normalizeEmail, sendWindow } from "./codes.js";
import { EMAIL_FROM, REPLY_TO, codeEmailHtml, codeEmailSubject, codeEmailText } from "./email.js";
import { sendEmail } from "./mailer.js";
import { removeGuestPlace } from "./parties-api.js";
import { cleanName, isRole } from "./users.js";
import { TOKEN_SIGNER, auth, base, db, ensureAuthUser, findUserByEmail, requireOwner, resendApiKey } from "./app.js";

export * from "./parties-api.js";
const BAD_CODE = "That code isn't right or has expired. Request a new one.";
const NO_ACCOUNT = "There's no account for that email. UEX is invite-only.";

export const requestCode = onCall({ ...base, secrets: [resendApiKey], timeoutSeconds: 30 }, async (request) => {
  const email = normalizeEmail(request.data?.email);
  if (!email) throw new HttpsError("invalid-argument", "Enter a valid email address.");
  const user = await findUserByEmail(email);
  if (!user) throw new HttpsError("not-found", NO_ACCOUNT);
  const ref = db.collection("loginCodes").doc(codeDocId(email));
  const code = newCode(), salt = newSalt(), now = Date.now();
  const allowed = await db.runTransaction(async (tx) => {
    const window = sendWindow((await tx.get(ref)).data()?.sends, now);
    if (!window.allowed) return false;
    tx.set(ref, { hash: hashCode(code, salt), salt, expiresAt: now + CODE_TTL_MS, attempts: 0, sends: [...window.recent, now], uid: user.id, createdAt: FieldValue.serverTimestamp() });
    return true;
  });
  if (!allowed) {
    logger.warn("Sign-in code rate limited", { uid: user.id });
    return { ok: true };
  }
  try {
    const name = typeof user.get("name") === "string" ? user.get("name").split(" ")[0] : "";
    const id = await sendEmail(resendApiKey.value(), {
      from: EMAIL_FROM, to: [email], reply_to: REPLY_TO, subject: codeEmailSubject(code),
      html: codeEmailHtml(code, name), text: codeEmailText(code, name)
    }, { idempotencyKey: `login-code/${codeDocId(email)}/${now}` });
    logger.info("Sign-in code sent", { uid: user.id, resendId: id });
  } catch (error) {
    logger.error("requestCode failed", { message: error instanceof Error ? error.message : String(error) });
    throw new HttpsError("internal", "We couldn't send the code. Please try again.");
  }
  return { ok: true };
});

export const verifyCode = onCall({ ...base, timeoutSeconds: 20, serviceAccount: TOKEN_SIGNER }, async (request) => {
  const email = normalizeEmail(request.data?.email), code = cleanCode(request.data?.code);
  if (!email || !code) throw new HttpsError("invalid-argument", BAD_CODE);
  const ref = db.collection("loginCodes").doc(codeDocId(email));
  const result = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref), record = snap.data();
    const outcome = checkCode(record, code, Date.now());
    if (outcome === "ok") tx.update(ref, { hash: FieldValue.delete(), salt: FieldValue.delete(), expiresAt: 0, attempts: 0 });   // one use; keep send history for the rate limit
    else if (outcome === "wrong") tx.update(ref, { attempts: FieldValue.increment(1) });
    return outcome;
  });
  if (result !== "ok") throw new HttpsError("permission-denied", BAD_CODE);
  const user = await findUserByEmail(email);
  if (!user) throw new HttpsError("permission-denied", BAD_CODE);
  const name = typeof user.get("name") === "string" ? user.get("name") : undefined;
  await ensureAuthUser(user.id, email, name);
  return { token: await auth.createCustomToken(user.id) };
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
