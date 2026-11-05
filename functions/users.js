// The users mini app: users/{Firebase Auth uid} = { email, name, role, createdAt, createdBy, updatedAt }.
export const ROLES = ["owner", "staff", "member"];
export function cleanName(value) {
  if (typeof value !== "string") return null;
  const name = value.replace(/\s+/g, " ").trim();
  return name && name.length <= 80 ? name : null;
}
export function isRole(value) { return ROLES.includes(value); }
