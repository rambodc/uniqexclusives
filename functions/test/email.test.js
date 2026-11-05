import { test } from "node:test";
import assert from "node:assert/strict";
import { COMPANIES, codeEmailHtml, codeEmailSubject, codeEmailText, dashedCode } from "../email.js";

test("email shows the dashed code without digit boxes, the expiry and the logo from an absolute https URL", () => {
  const html = codeEmailHtml("042917", "Rambod");
  assert.equal(dashedCode("042917"), "042-917");
  assert.match(html, />042-917</);
  assert.ok(!html.includes("border:1px solid #2bd48a"));
  assert.ok(!html.includes("width:46px;height:62px"));
  assert.match(html, /10 minutes/);
  assert.match(html, /src="https:\/\/uniqexclusives\.web\.app\/brand\/email\/uex-globe@2x\.png"/);
  assert.equal(codeEmailSubject("042917"), "042-917 is your Uniq Exclusives code");
  assert.match(codeEmailText("042917", ""), /042-917/);
});
test("companies list Uniquem first", () => {
  assert.equal(COMPANIES[0].name, "Uniquem");
  const html = codeEmailHtml("111111", "");
  assert.ok(html.indexOf("Uniquem") < html.indexOf("UniqEnergy") && html.indexOf("Kemko") < html.indexOf("Al Chem"));
});
test("names are escaped", () => { assert.ok(!codeEmailHtml("111111", "<b>x</b>").includes("<b>x</b>")); });
