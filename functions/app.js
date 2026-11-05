// Shared Firebase Admin handles and helpers for every function.
import { getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { defineSecret } from "firebase-functions/params";
import { HttpsError } from "firebase-functions/v2/https";

const app = getApps()[0] ?? initializeApp();
export const db = getFirestore(app), auth = getAuth(app), storage = getStorage(app);
export const resendApiKey = defineSecret("RESEND_API_KEY");
const ORIGINS = ["https://uniqexclusives.com", "https://www.uniqexclusives.com", "https://uniqexclusives.web.app", "https://uniqexclusives.firebaseapp.com", /^http:\/\/(localhost|127\.0\.0\.1):\d+$/];
export const base = { region: "us-central1", cors: ORIGINS, maxInstances: 3, memory: "256MiB" };
// Runs as the project's Firebase Admin SDK service account: it holds Service Account Token Creator, which signing a custom token needs
// (the default compute account does not).
export const TOKEN_SIGNER = "firebase-adminsdk-fbsvc@uniqexclusives.iam.gserviceaccount.com";

export async function findUserByEmail(email) {
  const snap = await db.collection("users").where("email", "==", email).limit(1).get();
  return snap.empty ? null : snap.docs[0];
}

/** The caller's uid when they are an owner; otherwise an error. */
export async function requireOwner(request) {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Sign in first.");
  const me = await db.collection("users").doc(uid).get();
  if (me.get("role") !== "owner") throw new HttpsError("permission-denied", "Only owners can do that.");
  return uid;
}

/** Makes sure the Firebase Auth account for a users record exists, verified, with its email. */
export async function ensureAuthUser(uid, email, name) {
  try {
    const existing = await auth.getUser(uid);
    if (!existing.emailVerified || existing.email !== email) await auth.updateUser(uid, { email, emailVerified: true });
  } catch (error) {
    if (error?.code !== "auth/user-not-found") throw error;
    await auth.createUser({ uid, email, emailVerified: true, displayName: name });
  }
}

/**
 * The users record for an email, created as a member when missing (with its Auth account). Returns { uid, name, created }.
 * `by` is the uid recorded as createdBy.
 */
export async function findOrCreateMember(email, name, by) {
  const existing = await findUserByEmail(email);
  if (existing) return { uid: existing.id, name: existing.get("name") ?? name, created: false };
  let uid;
  try { uid = (await auth.getUserByEmail(email)).uid; }
  catch (error) { if (error?.code !== "auth/user-not-found") throw error; uid = (await auth.createUser({ email, emailVerified: true, displayName: name })).uid; }
  await db.collection("users").doc(uid).set({ email, name, role: "member", createdAt: FieldValue.serverTimestamp(), createdBy: by, updatedAt: FieldValue.serverTimestamp() });
  return { uid, name, created: true };
}
