// Clicking Male or Female has to pick it, in a real browser with the real styles: the bug was pure layout (the hidden Female radio
// grew page-wide under .lux-form input and swallowed clicks on Male), so a DOM-only test can't see it.
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { chromium, type Browser } from "playwright-core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import GenderPicker from "./GenderPicker";

const css = ["src/ui/lux.css", "src/ui/ui.css"].map((f) => readFileSync(f, "utf8")).join("\n");
const form = renderToStaticMarkup(<main className="lux-page"><section className="lux-panel">
  <form className="lux-form lux-add"><label>First name<input /></label><label>Last name<input /></label>
    <GenderPicker name="g" value="" onChange={() => undefined} /></form>
</section></main>);

let browser: Browser;
beforeAll(async () => { browser = await chromium.launch({ channel: "chrome" }); }, 90_000);
afterAll(async () => { await browser?.close(); });

describe("GenderPicker", () => {
  for (const width of [1280, 390]) it(`clicking each pill selects it (${width}px wide)`, async () => {
    const page = await browser.newPage({ viewport: { width, height: 800 } });
    await page.setContent(`<style>${css}</style>${form}`);
    const checked = () => page.evaluate(() => [...document.querySelectorAll<HTMLInputElement>(".uex-gender input")].filter((i) => i.checked).map((i) => i.value));
    for (const [label, value] of [["Male", "male"], ["Female", "female"], ["Male", "male"]]) {
      await page.locator(".uex-gender label", { hasText: new RegExp(`^${label}$`) }).click({ timeout: 2000 });
      expect(await checked()).toEqual([value]);
    }
    // Each radio covers only its own pill, so nothing else on the form is blocked.
    const boxes = await page.evaluate(() => [...document.querySelectorAll(".uex-gender label")].map((l) => {
      const a = l.getBoundingClientRect(), b = l.querySelector("input")!.getBoundingClientRect();
      return [a.x, a.y, a.width, a.height].every((v, i) => Math.abs(v - [b.x, b.y, b.width, b.height][i]) < 1);
    }));
    expect(boxes).toEqual([true, true]);
    await page.close();
  }, 20_000);
});
