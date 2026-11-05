import { connectStorageEmulator, getStorage } from "firebase/storage";
import { app } from "./firebase";

// Party photos. Kept out of core/firebase so the public home page doesn't load the Storage SDK.
export const storage = getStorage(app);
if (import.meta.env.DEV && import.meta.env.VITE_USE_EMULATORS === "true") connectStorageEmulator(storage, "127.0.0.1", 9199);
