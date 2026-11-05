import { describe, expect, it } from "vitest";
import { codeDigits, isEmail, isRole, parseUserRecord } from "./roles";

describe("roles", () => {
  it("knows the three roles", () => { expect(["owner", "staff", "member"].every(isRole)).toBe(true); expect(isRole("admin")).toBe(false); });
  it("rejects malformed records", () => {
    expect(parseUserRecord(null)).toBeNull();
    expect(parseUserRecord({ email: "a@b.co", name: "A B", role: "boss" })).toBeNull();
    expect(parseUserRecord({ email: "a@b.co", name: "A B", role: "member", extra: 1 })).toEqual({ email: "a@b.co", name: "A B", role: "member" });
  });
  it("reads codes however they are typed", () => { expect(codeDigits("123 456")).toBe("123456"); expect(codeDigits("12-34-567")).toBe("123456"); });
  it("checks email shape", () => { expect(isEmail(" a@b.co ")).toBe(true); expect(isEmail("a@b")).toBe(false); });
});
