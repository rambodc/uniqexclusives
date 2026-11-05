// Pure helpers for the 6-digit email sign-in codes (no Firebase imports, so they are unit-tested directly).
import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

export const CODE_TTL_MS = 10 * 60 * 1000;   // a code works for 10 minutes
export const MAX_ATTEMPTS = 5;               // wrong guesses before the code is burned
export const MAX_SENDS_PER_HOUR = 5;         // codes emailed to one address per rolling hour
export const HOUR_MS = 60 * 60 * 1000;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** Lower-cased, trimmed email, or null when it is not a plausible address. */
export function normalizeEmail(value) {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  return email.length <= 200 && EMAIL_RE.test(email) ? email : null;
}
/** Six digits, leading zeros kept. */
export function newCode() { return String(randomInt(0, 1_000_000)).padStart(6, "0"); }
export function newSalt() { return randomBytes(16).toString("hex"); }
export function hashCode(code, salt) { return createHmac("sha256", salt).update(code).digest("hex"); }
/** Document id in loginCodes for an email (the address itself is not used as an id). */
export function codeDocId(email) { return createHash("sha256").update(email).digest("hex"); }
/** Only six digits; spaces and dashes people type are dropped. */
export function cleanCode(value) {
  if (typeof value !== "string") return null;
  const code = value.replace(/[\s-]/g, "");
  return /^\d{6}$/.test(code) ? code : null;
}
/** Send times (ms) from the last hour, and whether one more send is allowed. */
export function sendWindow(previous, now) {
  const recent = (Array.isArray(previous) ? previous : []).filter((t) => typeof t === "number" && now - t < HOUR_MS);
  return { recent, allowed: recent.length < MAX_SENDS_PER_HOUR };
}
/**
 * Checks a typed code against the stored record { hash, salt, expiresAt, attempts }.
 * Returns "ok", "wrong" (counts as an attempt) or "dead" (missing, expired or out of attempts).
 */
export function checkCode(record, code, now) {
  if (!record || typeof record.hash !== "string" || typeof record.salt !== "string") return "dead";
  if (typeof record.expiresAt !== "number" || now >= record.expiresAt) return "dead";
  if ((record.attempts ?? 0) >= MAX_ATTEMPTS) return "dead";
  const a = Buffer.from(hashCode(code, record.salt), "hex"), b = Buffer.from(record.hash, "hex");
  return a.length === b.length && timingSafeEqual(a, b) ? "ok" : "wrong";
}
