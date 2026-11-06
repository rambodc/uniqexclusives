// Reading parties/** documents in the browser. Malformed data is skipped, never guessed.
import { isGender, type Gender } from "../auth/roles";
export type GuestStatus = "invited" | "accepted" | "declined" | "expired";
export type Party = {
  id: string; name: string; description: string; photoPath: string | null; startsAt: Date; endsAt: Date | null; rsvpDeadline: Date;
  /** Only filled in once the owner reveals it (guests never see the hidden one). */
  location: string | null; locationRevealed: boolean; dressCode: string; guestLimit: number | null; published: boolean; pageSlug: string | null;
};
export type Guest = {
  uid: string; firstName: string; lastName: string; email: string; gender: Gender; guestOf: string; status: GuestStatus; canInvite: boolean; inviteLimit: number; invitesUsed: number;
  /** How many invite emails went out (the subject says "Invitation N"). */
  sendCount: number;
  /** Their own deadline from a re-invite; null means the party's. */
  rsvpDeadline: Date | null;
  invitedByName: string | null; note: string;
};
export type InviteRequest = { id: string; by: string; byName: string; firstName: string; lastName: string; email: string; gender: Gender; note: string; status: "pending" | "approving" | "approved" | "rejected"; createdAt: Date | null };

type Data = Record<string, unknown>;
type Ts = { toDate: () => Date };
const isTs = (v: unknown): v is Ts => !!v && typeof (v as Ts).toDate === "function";
const str = (v: unknown) => typeof v === "string" ? v : "";
const num = (v: unknown) => typeof v === "number" && Number.isFinite(v) ? v : 0;

export function parseParty(id: string, data: unknown): Party | null {
  if (!data || typeof data !== "object") return null;
  const d = data as Data;
  if (typeof d.name !== "string" || !isTs(d.startsAt) || !isTs(d.rsvpDeadline)) return null;
  return {
    id, name: d.name, description: str(d.description), photoPath: typeof d.photoPath === "string" ? d.photoPath : null,
    startsAt: d.startsAt.toDate(), endsAt: isTs(d.endsAt) ? d.endsAt.toDate() : null, rsvpDeadline: d.rsvpDeadline.toDate(),
    location: typeof d.location === "string" && d.location ? d.location : null, locationRevealed: d.locationRevealed === true,
    dressCode: str(d.dressCode), guestLimit: typeof d.guestLimit === "number" ? d.guestLimit : null, published: d.published === true,
    pageSlug: typeof d.pageSlug === "string" && d.pageSlug ? d.pageSlug : null
  };
}
const STATUSES: GuestStatus[] = ["invited", "accepted", "declined", "expired"];
export function parseGuest(uid: string, data: unknown): Guest | null {
  if (!data || typeof data !== "object") return null;
  const d = data as Data;
  if (typeof d.firstName !== "string" || typeof d.lastName !== "string" || !STATUSES.includes(d.status as GuestStatus) || !isGender(d.gender)) return null;
  return {
    uid, firstName: d.firstName, lastName: d.lastName, email: str(d.email), gender: d.gender, guestOf: str(d.guestOf), status: d.status as GuestStatus, canInvite: d.canInvite === true,
    inviteLimit: num(d.inviteLimit), invitesUsed: num(d.invitesUsed), sendCount: num(d.sendCount), rsvpDeadline: isTs(d.rsvpDeadline) ? d.rsvpDeadline.toDate() : null, invitedByName: typeof d.invitedByName === "string" ? d.invitedByName : null, note: str(d.note)
  };
}
export function parseRequest(id: string, data: unknown): InviteRequest | null {
  if (!data || typeof data !== "object") return null;
  const d = data as Data;
  if (typeof d.firstName !== "string" || typeof d.lastName !== "string" || typeof d.email !== "string" || !isGender(d.gender) || !["pending", "approving", "approved", "rejected"].includes(d.status as string)) return null;
  return { id, by: str(d.by), byName: str(d.byName), firstName: d.firstName, lastName: d.lastName, email: d.email, gender: d.gender, note: str(d.note), status: d.status as InviteRequest["status"], createdAt: isTs(d.createdAt) ? d.createdAt.toDate() : null };
}

/** When invite links close: the end time, or a day after the start. */
export function partyEnd(party: Pick<Party, "startsAt" | "endsAt">) { return party.endsAt ?? new Date(party.startsAt.getTime() + 86_400_000); }
/** The deadline a guest answers by: their own (from a re-invite) or the party's. */
export function guestDeadline(party: Pick<Party, "rsvpDeadline">, guest: Pick<Guest, "rsvpDeadline">) { return guest.rsvpDeadline ?? party.rsvpDeadline; }
/** The status to show: an unanswered invite past its deadline is expired even before the hourly sweep marks it. */
export function shownStatus(status: GuestStatus, deadline: Date, now = Date.now()): GuestStatus {
  return status === "invited" && now >= deadline.getTime() ? "expired" : status;
}
/** Answers are open until the deadline (which is never after the start). */
export function rsvpOpen(deadline: Date, now = Date.now()) { return now < deadline.getTime(); }

export const URGENT_MS = 3 * 86_400_000;
/** What's left until a deadline, split for the countdown. Urgent in the last 3 days. */
export function timeLeft(deadline: Date, now = Date.now()) {
  const ms = Math.max(0, deadline.getTime() - now), s = Math.floor(ms / 1000);
  return { ms, days: Math.floor(s / 86_400), hours: Math.floor(s / 3600) % 24, minutes: Math.floor(s / 60) % 60, seconds: s % 60, urgent: ms > 0 && ms <= URGENT_MS, over: ms === 0 };
}
/** "Fri, Nov 27" */
export function formatReplyBy(date: Date) { return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }); }

export function guestCounts(guests: Guest[], requests: InviteRequest[], party: Pick<Party, "rsvpDeadline">, now = Date.now()) {
  const c = { total: guests.length, invited: 0, accepted: 0, declined: 0, expired: 0, male: 0, female: 0, pending: requests.filter((r) => r.status === "pending").length };
  for (const g of guests) { c[shownStatus(g.status, guestDeadline(party, g), now)]++; c[g.gender]++; }
  return c;
}

/** "Sat, Dec 12, 2026 · 8:00 PM" in the viewer's time zone. */
export function formatWhen(date: Date) {
  return `${date.toLocaleDateString("en-CA", { weekday: "short", month: "short", day: "numeric", year: "numeric" })} · ${date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
}
/** <input type="datetime-local"> value for a Date in local time, and back. */
export function toLocalInput(date: Date | null) {
  if (!date) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}T${p(date.getHours())}:${p(date.getMinutes())}`;
}
export function fromLocalInput(value: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
}
export const STATUS_LABELS: Record<GuestStatus, string> = { invited: "Invited", accepted: "Accepted", declined: "Declined", expired: "Expired, not coming" };
