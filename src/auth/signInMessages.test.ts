import { describe, expect, it } from "vitest";
import { authErrorMessage } from "./signInMessages";
describe("authErrorMessage", () => {
  it("hides whether an account exists", () => { expect(authErrorMessage({ code: "auth/user-not-found" })).toBe(authErrorMessage({ code: "auth/wrong-password" })); });
  it("has a fallback", () => { expect(authErrorMessage(new Error("x"))).toMatch(/try again/); });
});
