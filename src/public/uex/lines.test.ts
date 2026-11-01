import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { LINES } from "./lines";
describe("UEX home", () => {
  it("has a short set of whisper lines", () => { expect(LINES.length).toBeGreaterThanOrEqual(4); expect(LINES.length).toBeLessThanOrEqual(6); });
  it("ships the globe logo file", () => { expect(existsSync("public/brand/uex-globe.webp")).toBe(true); });
});
