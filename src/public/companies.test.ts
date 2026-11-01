import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { COMPANIES } from "./companies";
describe("companies", () => {
  it("lists the four group companies", () => { expect(COMPANIES.map((c) => c.name)).toEqual(["Uniquem", "UniqEnergy Solutions", "Kemko", "Al Chem"]); });
  it("only points at logo files that exist", () => { for (const c of COMPANIES) if (c.logo) expect(existsSync(`public${c.logo.src}`)).toBe(true); });
});
