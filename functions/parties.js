// The parties mini app: pure helpers (no Firebase imports, so they are unit-tested directly).
//  parties/{partyId}                 name, description, photoPath, startsAt, endsAt, rsvpDeadline, dressCode, guestLimit, published, pageSlug,
//                                    locationRevealed, location (only when revealed, else null), summarySentAt, createdAt/By, updatedAt
//  parties/{partyId}/private/details location (always; owners only)
//  parties/{partyId}/guests/{uid}    one per invited person (no plus-ones): gender, status, sendCount, rsvpDeadline (a re-invite's own deadline, else null)
//  parties/{partyId}/requests/{id}   invites a guest asked for, waiting on an owner
//  parties/{partyId}/tokens/{sha256} personal invite links (hash only; functions only)
import { createHash, randomBytes } from "node:crypto";

export const DAY_MS = 24 * 60 * 60 * 1000;
export const TIME_ZONE = "America/Edmonton";
export const GUEST_STATUSES = ["invited", "accepted", "declined", "expired"];
export const GENDERS = ["male", "female"];
export const SUMMARY_LEAD_MS = 3 * DAY_MS;     // the owners' "still waiting on" email goes out 3 days before the RSVP deadline
export const REINVITE_MS = 7 * DAY_MS;         // a re-invite (or a late invite) gives a week to answer, never past the start
export const MAX_INVITES_PER_GUEST = 20;
const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,47}$/;
const ID_RE = /^[A-Za-z0-9]{8,40}$/;

const text = (value, max) => {
  if (typeof value !== "string") return "";
  const t = value.replace(/\r\n/g, "\n").trim();
  return t.length <= max ? t : null;
};
const oneLine = (value, max) => { const t = text(value, max); return t === null ? null : t.replace(/\s+/g, " "); };
const whole = (value, min, max) => Number.isInteger(value) && value >= min && value <= max;

export function isPartyId(value) { return typeof value === "string" && ID_RE.test(value); }

/**
 * Checks what an owner typed for a party. Returns { party } with clean fields, or { error } with a message for the form.
 * startsAt / endsAt are epoch ms; endsAt is optional and must be after startsAt.
 */
export function cleanPartyInput(input) {
  const d = input && typeof input === "object" ? input : {};
  const name = oneLine(d.name, 120);
  if (!name) return { error: "Give the party a name." };
  const description = text(d.description, 4000);
  if (description === null) return { error: "Keep the description under 4,000 characters." };
  if (!whole(d.startsAt, Date.UTC(2020, 0, 1), Date.UTC(2100, 0, 1))) return { error: "Pick the date and time." };
  let endsAt = null;
  if (d.endsAt !== null && d.endsAt !== undefined && d.endsAt !== "") {
    if (!whole(d.endsAt, d.startsAt + 1, d.startsAt + 14 * DAY_MS)) return { error: "The end time has to be after the start (within two weeks)." };
    endsAt = d.endsAt;
  }
  const location = text(d.location, 400), dressCode = oneLine(d.dressCode, 120);
  if (location === null) return { error: "Keep the location under 400 characters." };
  if (dressCode === null) return { error: "Keep the dress code under 120 characters." };
  let rsvpDeadline = d.startsAt - 7 * DAY_MS;
  if (d.rsvpDeadline !== null && d.rsvpDeadline !== undefined && d.rsvpDeadline !== "") {
    if (!whole(d.rsvpDeadline, Date.UTC(2020, 0, 1), d.startsAt)) return { error: "The RSVP deadline has to be before the party starts." };
    rsvpDeadline = d.rsvpDeadline;
  }
  let guestLimit = null;
  if (d.guestLimit !== null && d.guestLimit !== undefined && d.guestLimit !== "") {
    if (!whole(d.guestLimit, 1, 5000)) return { error: "The guest limit is a whole number from 1 to 5,000." };
    guestLimit = d.guestLimit;
  }
  let pageSlug = null;
  if (d.pageSlug) {
    if (typeof d.pageSlug !== "string" || !SLUG_RE.test(d.pageSlug)) return { error: "That custom page name isn't valid." };
    pageSlug = d.pageSlug;
  }
  let photoPath = null;
  if (d.photoPath) {
    if (typeof d.photoPath !== "string" || !/^parties\/[A-Za-z0-9]{8,40}\/[A-Za-z0-9._-]{1,80}$/.test(d.photoPath)) return { error: "That photo isn't valid." };
    photoPath = d.photoPath;
  }
  return { party: { name, description, startsAt: d.startsAt, endsAt, rsvpDeadline, location, dressCode, guestLimit, pageSlug, photoPath, locationRevealed: d.locationRevealed === true, published: d.published === true } };
}

/** When invite links stop working and RSVPs close for good: the end time, or a day after the start when there is none. */
export function partyEndMs(startsAt, endsAt) { return typeof endsAt === "number" ? endsAt : startsAt + DAY_MS; }

/** The deadline a guest answers by: their own (from a re-invite) or the party's. */
export function deadlineFor(partyDeadline, guestDeadline) { return typeof guestDeadline === "number" ? guestDeadline : partyDeadline; }
/** Still unanswered when the deadline passed (or already marked so). */
export function isExpired(status, deadline, now) { return status === "expired" || (status === "invited" && now >= deadline); }
/** A re-invite's deadline: the one picked (after now, by the start), or a week from now capped at the start. */
export function reinviteDeadline(picked, now, startsAt) {
  if (picked === undefined || picked === null || picked === "") return Math.min(now + REINVITE_MS, startsAt);
  return whole(picked, now + 1, startsAt) ? picked : null;
}
/** A new guest keeps the party's deadline, unless it already passed: then they get a week (capped at the start). */
export function newGuestDeadline(partyDeadline, now, startsAt) { return now < partyDeadline ? null : Math.min(now + REINVITE_MS, startsAt); }
/** Time for the owners' summary: within 3 days of a deadline that hasn't passed. */
export function summaryDue(deadline, now) { return now < deadline && deadline - now <= SUMMARY_LEAD_MS; }
export function isGender(value) { return GENDERS.includes(value); }

/** Who an owner or staff member is inviting. */
export function cleanGuestInput(input) {
  const d = input && typeof input === "object" ? input : {};
  const name = oneLine(d.name, 80);
  if (!name) return { error: "Enter their name." };
  const guestOf = oneLine(d.guestOf, 80);
  if (guestOf === null) return { error: "Keep Group / Guest of under 80 characters." };
  if (!isGender(d.gender)) return { error: "Pick male or female." };
  const allowance = cleanAllowance(d);
  if (allowance.error) return allowance;
  return { guest: { name, guestOf, gender: d.gender, ...allowance } };
}
export function cleanAllowance(d) {
  const canInvite = d?.canInvite === true;
  if (!canInvite) return { canInvite: false, inviteLimit: 0 };
  if (!whole(d.inviteLimit, 1, MAX_INVITES_PER_GUEST)) return { error: `Let them invite between 1 and ${MAX_INVITES_PER_GUEST} people.` };
  return { canInvite: true, inviteLimit: d.inviteLimit };
}
/** Someone a guest wants to bring (they need their own account, so name and email). */
export function cleanRequestInput(input) {
  const d = input && typeof input === "object" ? input : {};
  const name = oneLine(d.name, 80);
  if (!name) return { error: "Enter their name." };
  const note = text(d.note, 600);
  if (note === null) return { error: "Keep the note under 600 characters." };
  if (!isGender(d.gender)) return { error: "Pick male or female." };
  return { request: { name, note, gender: d.gender } };
}

/** A personal invite link token: 32 random bytes, base64url. Only its SHA-256 is stored. */
export function newInviteToken() { return randomBytes(32).toString("base64url"); }
export function tokenHash(token) { return createHash("sha256").update(token).digest("hex"); }
export function isInviteToken(value) { return typeof value === "string" && /^[A-Za-z0-9_-]{43}$/.test(value); }
export function inviteLink(site, partyId, token) { return `${site}/i/${partyId}/${token}`; }

/** "an•••@example.com": enough for a guest to recognise their own address on the invite page. */
export function maskEmail(email) {
  const at = email.lastIndexOf("@");
  const local = email.slice(0, at);
  return `${local.slice(0, local.length > 3 ? 2 : 1)}•••${email.slice(at)}`;
}

/** "Saturday, December 12, 2026 · 8:00 PM" in Calgary time. */
export function formatPartyDate(ms) {
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, weekday: "long", month: "long", day: "numeric", year: "numeric" }).format(ms);
  const time = new Intl.DateTimeFormat("en-US", { timeZone: TIME_ZONE, hour: "numeric", minute: "2-digit" }).format(ms);
  return `${date} · ${time}`;
}

/** "Fri, Nov 27" and "8:00 PM" in Calgary time, for "Reply by …". */
export function formatReplyBy(ms) {
  return {
    date: new Intl.DateTimeFormat("en-US", { timeZone: TIME_ZONE, weekday: "short", month: "short", day: "numeric" }).format(ms),
    time: new Intl.DateTimeFormat("en-US", { timeZone: TIME_ZONE, hour: "numeric", minute: "2-digit" }).format(ms)
  };
}
