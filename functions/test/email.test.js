import { test } from "node:test";
import assert from "node:assert/strict";
import { COMPANIES, codeEmailHtml, codeEmailSubject, codeEmailText } from "../email.js";

test("email shows the code, the expiry and the logo from an absolute https URL", () => {
  const html = codeEmailHtml("042917", "Rambod");
  for (const d of "042917") assert.ok(html.includes(`>${d}</td>`));
  assert.match(html, /10 minutes/);
  assert.match(html, /src="https:\/\/uniqexclusives\.web\.app\/brand\/email\/uex-globe@2x\.png"/);
  assert.equal(codeEmailSubject("042917"), "042 917 is your Uniq Exclusives code");
  assert.match(codeEmailText("042917", ""), /042 917/);
});
test("companies list Uniquem first", () => {
  assert.equal(COMPANIES[0].name, "Uniquem");
  const html = codeEmailHtml("111111", "");
  assert.ok(html.indexOf("Uniquem") < html.indexOf("UniqEnergy") && html.indexOf("Kemko") < html.indexOf("Al Chem"));
});
test("names are escaped", () => { assert.ok(!codeEmailHtml("111111", "<b>x</b>").includes("<b>x</b>")); });
