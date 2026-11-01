import { initializeApp } from "firebase/app";
import { browserLocalPersistence, connectAuthEmulator, getAuth, setPersistence } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";

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
// Local testing only: `VITE_USE_EMULATORS=true npm run dev` talks to the Firebase emulators instead of production.
if (import.meta.env.DEV && import.meta.env.VITE_USE_EMULATORS === "true") {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
}
