/** Who a person is in Uniq Exclusives. Stored on users/{uid}.role; functions/users.js and firestore.rules use the same list. */
export const ROLES = ["owner", "staff", "member"] as const;
export type Role = (typeof ROLES)[number];
export const ROLE_LABELS: Record<Role, string> = { owner: "Owner", staff: "Staff", member: "Member" };
export type UserRecord = { email: string; name: string; role: Role };

export function isRole(value: unknown): value is Role { return typeof value === "string" && (ROLES as readonly string[]).includes(value); }
/** Reads a users/{uid} record. Anything malformed means no profile: nothing is guessed or defaulted. */
export function parseUserRecord(data: unknown): UserRecord | null {
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  if (typeof d.email !== "string" || typeof d.name !== "string" || !isRole(d.role)) return null;
  return { email: d.email, name: d.name, role: d.role };
}
/** Six digits from whatever was typed or pasted ("123 456", "123-456"). */
export function codeDigits(value: string) { return value.replace(/\D/g, "").slice(0, 6); }
export function isEmail(value: string) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()); }
