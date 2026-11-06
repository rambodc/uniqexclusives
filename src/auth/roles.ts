/** Who a person is in Uniq Exclusives. Stored on users/{uid}.role; functions/users.js and firestore.rules use the same list. */
export const ROLES = ["owner", "staff", "member"] as const;
export type Role = (typeof ROLES)[number];
export const ROLE_LABELS: Record<Role, string> = { owner: "Owner", staff: "Staff", member: "Member" };
export type Gender = "male" | "female";
export const GENDER_LABELS: Record<Gender, string> = { male: "Male", female: "Female" };
/** staffPartyId: the one party a staff member runs (null for everyone else, or staff not assigned yet). */
export type UserRecord = { email: string; name: string; gender: Gender; role: Role; staffPartyId: string | null };

export function isRole(value: unknown): value is Role { return typeof value === "string" && (ROLES as readonly string[]).includes(value); }
export function isGender(value: unknown): value is Gender { return value === "male" || value === "female"; }
/** Reads a users/{uid} record. Anything malformed means no profile: nothing is guessed or defaulted. */
export function parseUserRecord(data: unknown): UserRecord | null {
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  if (typeof d.email !== "string" || typeof d.name !== "string" || !isRole(d.role) || !isGender(d.gender)) return null;
  return { email: d.email, name: d.name, gender: d.gender, role: d.role, staffPartyId: typeof d.staffPartyId === "string" ? d.staffPartyId : null };
}
/** Six digits from whatever was typed or pasted ("123 456", "123-456"). */
export function codeDigits(value: string) { return value.replace(/\D/g, "").slice(0, 6); }
/** Display form with a dash between the first 3 and last 3 digits. */
export function formatCodeInput(digits: string) {
  const d = digits.slice(0, 6);
  return d.length <= 3 ? d : `${d.slice(0, 3)}-${d.slice(3)}`;
}
export function isEmail(value: string) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()); }
