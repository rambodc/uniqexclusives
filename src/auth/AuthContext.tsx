import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, authReady, db } from "../core/firebase";
import { parseUserRecord, type UserRecord } from "./roles";

type AuthState = {
  user: User | null;
  /** The person's users/{uid} record, or null while loading / when there is none. */
  record: UserRecord | null;
  loading: boolean;
  logout: () => Promise<void>;
};
const Context = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null), [authLoading, setAuthLoading] = useState(true);
  const [record, setRecord] = useState<UserRecord | null>(null), [recordUid, setRecordUid] = useState<string | null>(null);
  useEffect(() => {
    let active = true, stop: (() => void) | undefined;
    void authReady.then(() => { if (active) stop = onAuthStateChanged(auth, (next) => { setUser(next); setAuthLoading(false); }); });
    return () => { active = false; stop?.(); };
  }, []);
  const uid = user?.uid;
  useEffect(() => {
    if (!uid) return;
    return onSnapshot(doc(db, "users", uid), (snap) => { setRecord(parseUserRecord(snap.data())); setRecordUid(uid); }, () => { setRecord(null); setRecordUid(uid); });
  }, [uid]);
  const loading = authLoading || (!!uid && recordUid !== uid);
  const value: AuthState = { user, record: uid && recordUid === uid ? record : null, loading, logout: () => signOut(auth) };
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useAuth() {
  const value = useContext(Context);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
