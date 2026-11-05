// Uniq Exclusives Cloud Functions (2nd gen, us-central1).
//  Sign-in (invite only, no passwords): requestCode emails a 6-digit code to people who already have a users record;
//  verifyCode checks it and returns a Firebase custom token. Codes live in loginCodes/{sha256(email)}, which clients can never read.
//  Users (owners only): createUser, removeUser. Listing is a plain Firestore read that firestore.rules allows owners.
import { getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { defineSecret } from "firebase-functions/params";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { logger } from "firebase-functions/v2";
import { CODE_TTL_MS, checkCode, cleanCode, codeDocId, hashCode, newCode, newSalt, normalizeEmail, sendWindow } from "./codes.js";
import { EMAIL_FROM, REPLY_TO, codeEmailHtml, codeEmailSubject, codeEmailText } from "./email.js";
import { sendEmail } from "./mailer.js";
import { cleanName, isRole } from "./users.js";

const app = getApps()[0] ?? initializeApp();
const db = getFirestore(app), auth = getAuth(app);
const resendApiKey = defineSecret("RESEND_API_KEY");
const ORIGINS = ["https://uniqexclusives.com", "https://www.uniqexclusives.com", "https://uniqexclusives.web.app", "https://uniqexclusives.firebaseapp.com", /^http:\/\/(localhost|127\.0\.0\.1):\d+$/];
const base = { region: "us-central1", cors: ORIGINS, maxInstances: 3, memory: "256MiB" };
const SENT = { ok: true };   // requestCode always answers exactly this, whether or not the email is on the list
const MIN_REPLY_MS = 1500;   // and always takes at least this long, so timing does not tell either
const BAD_CODE = "That code isn't right or has expired. Request a new one.";

async function findUserByEmail(email) {
  const snap = await db.collection("users").where("email", "==", email).limit(1).get();
  return snap.empty ? null : snap.docs[0];
}

export const requestCode = onCall({ ...base, secrets: [resendApiKey], timeoutSeconds: 30 }, async (request) => {
  const started = Date.now();
  const email = normalizeEmail(request.data?.email);
  if (!email) throw new HttpsError("invalid-argument", "Enter a valid email address.");
  try {
    const user = await findUserByEmail(email);
    if (user) {
      const ref = db.collection("loginCodes").doc(codeDocId(email));
      const code = newCode(), salt = newSalt(), now = Date.now();
      const allowed = await db.runTransaction(async (tx) => {
        const window = sendWindow((await tx.get(ref)).data()?.sends, now);
        if (!window.allowed) return false;
        tx.set(ref, { hash: hashCode(code, salt), salt, expiresAt: now + CODE_TTL_MS, attempts: 0, sends: [...window.recent, now], uid: user.id, createdAt: FieldValue.serverTimestamp() });
        return true;
      });
      if (allowed) {
        const name = typeof user.get("name") === "string" ? user.get("name").split(" ")[0] : "";
        const id = await sendEmail(resendApiKey.value(), {
          from: EMAIL_FROM, to: [email], reply_to: REPLY_TO, subject: codeEmailSubject(code),
          html: codeEmailHtml(code, name), text: codeEmailText(code, name)
        }, { idempotencyKey: `login-code/${codeDocId(email)}/${now}` });
        logger.info("Sign-in code sent", { uid: user.id, resendId: id });
      } else logger.warn("Sign-in code rate limited", { uid: user.id });
    }
  } catch (error) {
    logger.error("requestCode failed", { message: error instanceof Error ? error.message : String(error) });
  }
  const wait = MIN_REPLY_MS - (Date.now() - started);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  return SENT;
});

// Runs as the project's Firebase Admin SDK service account: it holds Service Account Token Creator, which signing a custom token needs
// (the default compute account does not).
const TOKEN_SIGNER = "firebase-adminsdk-fbsvc@uniqexclusives.iam.gserviceaccount.com";
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
  try {
    const existing = await auth.getUser(user.id);
    if (!existing.emailVerified || existing.email !== email) await auth.updateUser(user.id, { email, emailVerified: true });
  } catch (error) {
    if (error?.code !== "auth/user-not-found") throw error;
    await auth.createUser({ uid: user.id, email, emailVerified: true, displayName: name });
  }
  return { token: await auth.createCustomToken(user.id) };
});

async function requireOwner(request) {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Sign in first.");
  const me = await db.collection("users").doc(uid).get();
  if (me.get("role") !== "owner") throw new HttpsError("permission-denied", "Only owners can manage users.");
  return uid;
}

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
  if (typeof email === "string") await db.collection("loginCodes").doc(codeDocId(email)).delete();
  await auth.deleteUser(uid).catch((error) => { if (error?.code !== "auth/user-not-found") throw error; });
  return { ok: true };
});
