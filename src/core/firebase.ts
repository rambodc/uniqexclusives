import { FirebaseError, initializeApp } from "firebase/app";
import { browserLocalPersistence, connectAuthEmulator, getAuth, setPersistence } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";
import { connectFunctionsEmulator, getFunctions, httpsCallable } from "firebase/functions";

// Web config for the uniqexclusives Firebase project. These values are public by design (Firebase web config);
// CI passes the same values as VITE_FIREBASE_* secrets, and these are the fallbacks for local builds.
const app = initializeApp({
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyD7s4Ql39z2IS4CJrwtrcYXB9DQedmnDZk",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "uniqexclusives.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "uniqexclusives",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "uniqexclusives.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "574297729040",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:574297729040:web:e820d67610d38f77334295"
});
export const auth = getAuth(app);
export const authReady = setPersistence(auth, browserLocalPersistence).catch(() => undefined);
export const db = getFirestore(app);
export { app };
const functions = getFunctions(app, "us-central1");
// Local testing only: `VITE_USE_EMULATORS=true npm run dev` talks to the Firebase emulators instead of production.
if (import.meta.env.DEV && import.meta.env.VITE_USE_EMULATORS === "true") {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
  connectFunctionsEmulator(functions, "127.0.0.1", 5001);
}
export const requestCode = httpsCallable<{ email: string }, { ok: true }>(functions, "requestCode");
export const verifyCode = httpsCallable<{ email: string; code: string }, { token: string }>(functions, "verifyCode");
export type Gender = "male" | "female";
export const createUser = httpsCallable<{ email: string; name: string; gender: Gender; role: string; staffPartyId: string | null }, { uid: string }>(functions, "createUser");
export const removeUser = httpsCallable<{ uid: string }, { ok: true }>(functions, "removeUser");
export const setUserRole = httpsCallable<{ uid: string; role: string; staffPartyId: string | null }, { ok: true }>(functions, "setUserRole");
export const setStaffParty = httpsCallable<{ uid: string; partyId: string | null }, { ok: true }>(functions, "setStaffParty");

// Parties and invites (functions/parties-api.js).
export type PartyInput = {
  id: string; name: string; description: string; photoPath: string | null; startsAt: number; endsAt: number | null; rsvpDeadline: number; location: string;
  locationRevealed: boolean; dressCode: string; guestLimit: number | null; published: boolean; pageSlug: string | null;
};
export type GuestInput = { partyId: string; name: string; email: string; gender: Gender; guestOf: string; canInvite: boolean; inviteLimit: number };
type Sent = { link: string; emailed: boolean };
type Resent = Sent & { sendCount: number };
export const saveParty = httpsCallable<PartyInput, { id: string }>(functions, "saveParty");
export const deleteParty = httpsCallable<{ id: string }, { ok: true }>(functions, "deleteParty");
export const inviteGuest = httpsCallable<GuestInput, Sent & { uid: string }>(functions, "inviteGuest");
export const updateGuest = httpsCallable<{ partyId: string; uid: string; canInvite: boolean; inviteLimit: number }, { ok: true }>(functions, "updateGuest");
export const resendInvite = httpsCallable<{ partyId: string; uid: string }, Resent>(functions, "resendInvite");
export const reinviteGuest = httpsCallable<{ partyId: string; uid: string; rsvpDeadline: number }, Resent>(functions, "reinviteGuest");
export const remindAll = httpsCallable<{ partyId: string }, { sent: number; failed: string[] }>(functions, "remindAll");
export const inviteLinkFor = httpsCallable<{ partyId: string; uid: string }, { link: string }>(functions, "inviteLinkFor");
export const removeGuest = httpsCallable<{ partyId: string; uid: string }, { ok: true }>(functions, "removeGuest");
export const decideRequest = httpsCallable<{ partyId: string; requestId: string; approve: boolean }, { status: string } & Partial<Sent>>(functions, "decideRequest");
export type InviteTeaser = {
  partyName: string; startsAt: number; firstName: string; email: string; rsvpDeadline: number; status: "invited" | "accepted" | "declined" | "expired";
  expired: boolean; signedIn: boolean; sent: boolean;
};
export const openInvite = httpsCallable<{ partyId: string; token: string }, InviteTeaser>(functions, "openInvite");
export const enterInvite = httpsCallable<{ partyId: string; token: string; code: string }, { token: string }>(functions, "enterInvite");
export const rsvp = httpsCallable<{ partyId: string; status: "accepted" | "declined" }, { status: string }>(functions, "rsvp");
export const requestInvite = httpsCallable<{ partyId: string; name: string; email: string; gender: Gender; note: string }, { id: string }>(functions, "requestInvite");

/** A callable's message for people: the SDK's " [403]" suffix dropped, internal errors replaced. */
export const errorText = (e: unknown, fallback = "Something went wrong. Please try again.") =>
  e instanceof FirebaseError && !e.message.startsWith("internal") ? e.message.replace(/ \[\d+\]$/, "") : fallback;
