import { test } from "node:test";
import assert from "node:assert/strict";
import { DAY_MS, cleanGuestInput, cleanPartyInput, cleanRequestInput, formatPartyDate, inviteLink, isInviteToken, maskEmail, newInviteToken, partyEndMs, tokenHash } from "../parties.js";
import { inviteEmailHtml, inviteEmailSubject, inviteEmailText } from "../email.js";

const start = Date.UTC(2026, 11, 13, 3, 0);
test("party input is cleaned and checked", () => {
  const { party } = cleanPartyInput({ name: "  UEX   2 ", description: "Night\r\n", startsAt: start, location: "Secret", dressCode: "Black tie", guestLimit: 120, published: true, locationRevealed: "yes", pageSlug: "uex-2", photoPath: "parties/abcdefgh12/photo-1.jpg" });
  assert.deepEqual(party, { name: "UEX 2", description: "Night", startsAt: start, endsAt: null, location: "Secret", dressCode: "Black tie", guestLimit: 120, pageSlug: "uex-2", photoPath: "parties/abcdefgh12/photo-1.jpg", locationRevealed: false, published: true });
  assert.match(cleanPartyInput({ startsAt: start }).error, /name/);
  assert.match(cleanPartyInput({ name: "x" }).error, /date/);
  assert.match(cleanPartyInput({ name: "x", startsAt: start, endsAt: start - 1 }).error, /end time/);
  assert.match(cleanPartyInput({ name: "x", startsAt: start, guestLimit: 0 }).error, /guest limit/);
  assert.match(cleanPartyInput({ name: "x", startsAt: start, pageSlug: "../evil" }).error, /custom page/);
  assert.match(cleanPartyInput({ name: "x", startsAt: start, photoPath: "users/x" }).error, /photo/);
});
test("links last until the end time, or a day after the start", () => {
  assert.equal(partyEndMs(start, null), start + DAY_MS);
  assert.equal(partyEndMs(start, start + 5000), start + 5000);
});
test("guest and request input", () => {
  assert.deepEqual(cleanGuestInput({ name: "Ann Lee", guestOf: " Rambod ", canInvite: true, inviteLimit: 2 }).guest, { name: "Ann Lee", guestOf: "Rambod", canInvite: true, inviteLimit: 2 });
  assert.deepEqual(cleanGuestInput({ name: "Ann", canInvite: false, inviteLimit: 9 }).guest, { name: "Ann", guestOf: "", canInvite: false, inviteLimit: 0 });
  assert.match(cleanGuestInput({ name: "Ann", canInvite: true, inviteLimit: 0 }).error, /between/);
  assert.match(cleanRequestInput({ name: "" }).error, /name/);
  assert.equal(cleanRequestInput({ name: "Bo", note: "x".repeat(601) }).error, "Keep the note under 600 characters.");
});
test("invite tokens are long, url-safe and stored only as a hash", () => {
  const t = newInviteToken();
  assert.ok(isInviteToken(t));
  assert.notEqual(newInviteToken(), t);
  assert.match(tokenHash(t), /^[0-9a-f]{64}$/);
  assert.equal(inviteLink("https://uniqexclusives.com", "abcdefgh12", t), `https://uniqexclusives.com/i/abcdefgh12/${t}`);
  assert.ok(!isInviteToken("short"));
});
test("invite page shows only a masked email", () => {
  assert.equal(maskEmail("annabel@example.com"), "an•••@example.com");
  assert.equal(maskEmail("bo@x.io"), "b•••@x.io");
});
test("dates read in Calgary time", () => { assert.equal(formatPartyDate(Date.UTC(2026, 6, 12, 2, 0)), "Saturday, July 11, 2026 · 8:00 PM"); });

const invite = { guestName: "Ann Lee", partyName: "UEX 2", when: "Saturday, December 12, 2026 · 8:00 PM", dressCode: "Black tie", location: null, link: "https://uniqexclusives.com/i/abc/tok", invitedBy: null, note: "" };
test("invite email: party, date, dress code, button, and no location until revealed", () => {
  const html = inviteEmailHtml(invite);
  assert.equal(inviteEmailSubject(invite), "You're invited: UEX 2");
  for (const s of ["Ann, you're invited", "UEX 2", "December 12, 2026", "Black tie", "Open my invite", 'href="https://uniqexclusives.com/i/abc/tok"', "Revealed closer to the night"]) assert.ok(html.includes(s), s);
  assert.ok(!html.includes("asked us to invite you"));
  assert.ok(html.indexOf("Uniquem") < html.indexOf("UniqEnergy"));
  const revealed = inviteEmailHtml({ ...invite, location: "The Glasshouse, 1 Main St" });
  assert.ok(revealed.includes("The Glasshouse") && !revealed.includes("Revealed closer"));
  assert.match(inviteEmailText(invite), /Location: revealed closer/);
  assert.ok(html.includes("6-digit code") && !html.includes("signs you straight in"), "the link sends a code; it never signs in by itself");
  assert.match(inviteEmailText(invite), /6-digit code/);
});
test("a guest's invite shows who asked and their note, escaped", () => {
  const html = inviteEmailHtml({ ...invite, invitedBy: "Sam <b>", note: "Come!\n<script>" });
  assert.ok(html.includes("Sam &lt;b&gt;</strong> asked us to invite you"));
  assert.ok(html.includes("Come!<br>&lt;script&gt;"));
  assert.match(inviteEmailText({ ...invite, invitedBy: "Sam", note: "Come!" }), /Sam asked us to invite you\.\n"Come!" — Sam/);
});
