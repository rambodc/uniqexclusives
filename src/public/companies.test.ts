import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { COMPANIES } from "./companies";
const pngSize = (path: string) => { const b = readFileSync(path); return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) }; };
describe("companies", () => {
  it("lists the four group companies, Uniquem first", () => { expect(COMPANIES.map((c) => c.name)).toEqual(["Uniquem", "UniqEnergy Solutions", "Kemko", "Al Chem"]); });
  it("links each company to its own site", () => {
    expect(COMPANIES.map((c) => c.url)).toEqual(["https://uniquem.ca/", "https://uniqenergy.com/", "https://www.kemko.ca/", "https://alchem.ca/"]);
  });
  it("points at logo files that exist, with their real sizes", () => {
    for (const c of COMPANIES) {
      expect(existsSync(`public${c.logo.src}`)).toBe(true); expect(existsSync(`public${c.logo.src2x}`)).toBe(true);
      expect(pngSize(`public${c.logo.src}`)).toEqual({ width: c.logo.width, height: c.logo.height });
    }
  });
});
