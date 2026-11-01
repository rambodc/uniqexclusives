import { describe, expect, it } from "vitest";
import { cleanName, isRole, parseUserRecord, safeNext } from "./roles";

describe("roles", () => {
  it("knows the three roles", () => { expect(["owner", "staff", "member"].every(isRole)).toBe(true); expect(isRole("admin")).toBe(false); });
  it("rejects malformed records", () => {
    expect(parseUserRecord(null)).toBeNull();
    expect(parseUserRecord({ email: "a@b.co", firstName: "A", lastName: "B", role: "boss" })).toBeNull();
    expect(parseUserRecord({ email: "a@b.co", firstName: "A", lastName: "B", role: "member", extra: 1 })).toEqual({ email: "a@b.co", firstName: "A", lastName: "B", role: "member" });
  });
  it("cleans names", () => { expect(cleanName("  Ada   Lovelace ")).toBe("Ada Lovelace"); });
  it("keeps next on this site", () => { expect(safeNext("//evil.com")).toBe("/account"); expect(safeNext("https://x")).toBe("/account"); expect(safeNext("/account")).toBe("/account"); });
});
