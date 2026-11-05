// Reading parties/** documents in the browser. Malformed data is skipped, never guessed.
export type GuestStatus = "invited" | "accepted" | "declined";
export type Party = {
  id: string; name: string; description: string; photoPath: string | null; startsAt: Date; endsAt: Date | null;
  /** Only filled in once the owner reveals it (guests never see the hidden one). */
  location: string | null; locationRevealed: boolean; dressCode: string; guestLimit: number | null; published: boolean; pageSlug: string | null;
};
export type Guest = {
  uid: string; name: string; email: string; guestOf: string; status: GuestStatus; canInvite: boolean; inviteLimit: number; invitesUsed: number;
  invitedByName: string | null; note: string;
};
export type InviteRequest = { id: string; by: string; byName: string; name: string; email: string; note: string; status: "pending" | "approving" | "approved" | "rejected"; createdAt: Date | null };

type Data = Record<string, unknown>;
type Ts = { toDate: () => Date };
const isTs = (v: unknown): v is Ts => !!v && typeof (v as Ts).toDate === "function";
const str = (v: unknown) => typeof v === "string" ? v : "";
const num = (v: unknown) => typeof v === "number" && Number.isFinite(v) ? v : 0;

export function parseParty(id: string, data: unknown): Party | null {
  if (!data || typeof data !== "object") return null;
  const d = data as Data;
  if (typeof d.name !== "string" || !isTs(d.startsAt)) return null;
  return {
    id, name: d.name, description: str(d.description), photoPath: typeof d.photoPath === "string" ? d.photoPath : null,
    startsAt: d.startsAt.toDate(), endsAt: isTs(d.endsAt) ? d.endsAt.toDate() : null,
    location: typeof d.location === "string" && d.location ? d.location : null, locationRevealed: d.locationRevealed === true,
    dressCode: str(d.dressCode), guestLimit: typeof d.guestLimit === "number" ? d.guestLimit : null, published: d.published === true,
    pageSlug: typeof d.pageSlug === "string" && d.pageSlug ? d.pageSlug : null
  };
}
const STATUSES: GuestStatus[] = ["invited", "accepted", "declined"];
export function parseGuest(uid: string, data: unknown): Guest | null {
  if (!data || typeof data !== "object") return null;
  const d = data as Data;
  if (typeof d.name !== "string" || !STATUSES.includes(d.status as GuestStatus)) return null;
  return {
    uid, name: d.name, email: str(d.email), guestOf: str(d.guestOf), status: d.status as GuestStatus, canInvite: d.canInvite === true,
    inviteLimit: num(d.inviteLimit), invitesUsed: num(d.invitesUsed), invitedByName: typeof d.invitedByName === "string" ? d.invitedByName : null, note: str(d.note)
  };
}
export function parseRequest(id: string, data: unknown): InviteRequest | null {
  if (!data || typeof data !== "object") return null;
  const d = data as Data;
  if (typeof d.name !== "string" || typeof d.email !== "string" || !["pending", "approving", "approved", "rejected"].includes(d.status as string)) return null;
  return { id, by: str(d.by), byName: str(d.byName), name: d.name, email: d.email, note: str(d.note), status: d.status as InviteRequest["status"], createdAt: isTs(d.createdAt) ? d.createdAt.toDate() : null };
}

/** When invite links close: the end time, or a day after the start. */
export function partyEnd(party: Pick<Party, "startsAt" | "endsAt">) { return party.endsAt ?? new Date(party.startsAt.getTime() + 86_400_000); }
export function rsvpOpen(party: Pick<Party, "startsAt">, now = Date.now()) { return now < party.startsAt.getTime(); }

export function guestCounts(guests: Guest[], requests: InviteRequest[]) {
  const c = { total: guests.length, invited: 0, accepted: 0, declined: 0, pending: requests.filter((r) => r.status === "pending").length };
  for (const g of guests) c[g.status]++;
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
export const STATUS_LABELS: Record<GuestStatus, string> = { invited: "Invited", accepted: "Accepted", declined: "Declined" };
