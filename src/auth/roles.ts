/** Who a person is in Uniq Group. Stored on users/{uid}.role; firestore.rules enforces the same list. */
export const ROLES = ["owner", "staff", "member"] as const;
export type Role = (typeof ROLES)[number];
export const ROLE_LABELS: Record<Role, string> = { owner: "Owner", staff: "Staff", member: "Member" };
export type UserRecord = { email: string; firstName: string; lastName: string; role: Role };

export function isRole(value: unknown): value is Role { return typeof value === "string" && (ROLES as readonly string[]).includes(value); }
/** Reads a users/{uid} record. Anything malformed means no profile: nothing is guessed or defaulted. */
export function parseUserRecord(data: unknown): UserRecord | null {
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  if (typeof d.email !== "string" || typeof d.firstName !== "string" || typeof d.lastName !== "string" || !isRole(d.role)) return null;
  return { email: d.email, firstName: d.firstName, lastName: d.lastName, role: d.role };
}
export function cleanName(value: string) { return value.replace(/\s+/g, " ").trim().slice(0, 60); }
/** Only lets a ?next= value send people to a page on this site. */
export function safeNext(next: string | null) { return next && next.startsWith("/") && !next.startsWith("//") ? next : "/account"; }
