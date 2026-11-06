// The users mini app: users/{Firebase Auth uid} = { email, firstName, lastName, gender, role, staffPartyId, createdAt, createdBy, updatedAt }.
export const ROLES = ["owner", "staff", "member"];
const part = (value) => {
  if (typeof value !== "string") return null;
  const t = value.replace(/\s+/g, " ").trim();
  return t && t.length <= 60 ? t : null;
};
/** First and last name, both required. Returns { firstName, lastName } or { error } for the form. */
export function cleanNames(d) {
  const firstName = part(d?.firstName), lastName = part(d?.lastName);
  if (!firstName) return { error: "Enter their first name." };
  if (!lastName) return { error: "Enter their last name." };
  return { firstName, lastName };
}
export const fullName = (p) => `${p.firstName} ${p.lastName}`;
export function isRole(value) { return ROLES.includes(value); }
