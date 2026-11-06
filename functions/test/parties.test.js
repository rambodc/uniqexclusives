import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DAY_MS, cleanGuestInput, cleanPartyInput, cleanRequestInput, deadlineFor, formatPartyDate, formatReplyBy, inviteLink, isExpired, isInviteToken, maskEmail,
  newGuestDeadline, newInviteToken, partyEndMs, reinviteDeadline, summaryDue, tokenHash
} from "../parties.js";
import { inviteEmailHtml, inviteEmailSubject, inviteEmailText, summaryEmailHtml, summaryEmailSubject, summaryEmailText } from "../email.js";

const start = Date.UTC(2026, 11, 13, 3, 0);
test("party input is cleaned and checked", () => {
  const { party } = cleanPartyInput({ name: "  UEX   2 ", description: "Night\r\n", startsAt: start, location: "Secret", dressCode: "Black tie", guestLimit: 120, published: true, locationRevealed: "yes", pageSlug: "uex-2", photoPath: "parties/abcdefgh12/photo-1.jpg" });
  assert.deepEqual(party, { name: "UEX 2", description: "Night", startsAt: start, endsAt: null, rsvpDeadline: start - 7 * DAY_MS, location: "Secret", dressCode: "Black tie", guestLimit: 120, pageSlug: "uex-2", photoPath: "parties/abcdefgh12/photo-1.jpg", locationRevealed: false, published: true });
  assert.match(cleanPartyInput({ startsAt: start }).error, /name/);
  assert.match(cleanPartyInput({ name: "x" }).error, /date/);
  assert.match(cleanPartyInput({ name: "x", startsAt: start, endsAt: start - 1 }).error, /end time/);
  assert.match(cleanPartyInput({ name: "x", startsAt: start, guestLimit: 0 }).error, /guest limit/);
  assert.match(cleanPartyInput({ name: "x", startsAt: start, pageSlug: "../evil" }).error, /custom page/);
  assert.match(cleanPartyInput({ name: "x", startsAt: start, photoPath: "users/x" }).error, /photo/);
  assert.equal(cleanPartyInput({ name: "x", startsAt: start, rsvpDeadline: start - DAY_MS }).party.rsvpDeadline, start - DAY_MS);
  assert.match(cleanPartyInput({ name: "x", startsAt: start, rsvpDeadline: start + 1 }).error, /RSVP deadline/);
});
test("links last until the end time, or a day after the start", () => {
  assert.equal(partyEndMs(start, null), start + DAY_MS);
  assert.equal(partyEndMs(start, start + 5000), start + 5000);
});
test("guest and request input", () => {
  assert.deepEqual(cleanGuestInput({ name: "Ann Lee", gender: "female", guestOf: " Rambod ", canInvite: true, inviteLimit: 2 }).guest, { name: "Ann Lee", gender: "female", guestOf: "Rambod", canInvite: true, inviteLimit: 2 });
  assert.deepEqual(cleanGuestInput({ name: "Ann", gender: "male", canInvite: false, inviteLimit: 9 }).guest, { name: "Ann", gender: "male", guestOf: "", canInvite: false, inviteLimit: 0 });
  assert.match(cleanGuestInput({ name: "Ann", gender: "male", canInvite: true, inviteLimit: 0 }).error, /between/);
  assert.match(cleanGuestInput({ name: "Ann" }).error, /male or female/);
  assert.match(cleanRequestInput({ name: "" }).error, /name/);
  assert.equal(cleanRequestInput({ name: "Bo", gender: "male", note: "x".repeat(601) }).error, "Keep the note under 600 characters.");
  assert.match(cleanRequestInput({ name: "Bo", note: "" }).error, /male or female/);
  assert.deepEqual(cleanRequestInput({ name: "Bo", gender: "female", note: "Hi" }).request, { name: "Bo", note: "Hi", gender: "female" });
});
test("RSVP deadlines: a re-invite's own wins, unanswered after it expires, re-invites default to a week capped at the start", () => {
  const now = start - 20 * DAY_MS, deadline = start - 7 * DAY_MS;
  assert.equal(deadlineFor(deadline, null), deadline);
  assert.equal(deadlineFor(deadline, deadline + 5), deadline + 5);
  assert.equal(isExpired("invited", deadline, deadline - 1), false);
  assert.equal(isExpired("invited", deadline, deadline), true);
  assert.equal(isExpired("accepted", deadline, deadline + 1), false);
  assert.equal(isExpired("expired", deadline, 0), true);
  assert.equal(reinviteDeadline(undefined, now, start), now + 7 * DAY_MS);
  assert.equal(reinviteDeadline(undefined, start - DAY_MS, start), start);
  assert.equal(reinviteDeadline(now + DAY_MS, now, start), now + DAY_MS);
  assert.equal(reinviteDeadline(now - 1, now, start), null);
  assert.equal(reinviteDeadline(start + 1, now, start), null);
  assert.equal(newGuestDeadline(deadline, now, start), null);
  assert.equal(newGuestDeadline(deadline, deadline + 1, start), start);
  assert.equal(summaryDue(deadline, deadline - 3 * DAY_MS - 1), false);
  assert.equal(summaryDue(deadline, deadline - 3 * DAY_MS), true);
  assert.equal(summaryDue(deadline, deadline), false);
  assert.deepEqual(formatReplyBy(Date.UTC(2026, 6, 25, 2, 0)), { date: "Fri, Jul 24", time: "8:00 PM" });
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

const invite = { guestName: "Ann Lee", partyName: "UEX 2", when: "Saturday, December 12, 2026 · 8:00 PM", dressCode: "Black tie", location: null, link: "https://uniqexclusives.com/i/abc/tok", invitedBy: null, note: "", sendCount: 1, replyBy: { date: "Fri, Nov 27", time: "8:00 PM" } };
test("invite email: party, date, dress code, reply-by, button, and no location until revealed", () => {
  const html = inviteEmailHtml(invite);
  assert.equal(inviteEmailSubject(invite), "You're invited: UEX 2 · Invitation 1");
  assert.equal(inviteEmailSubject({ ...invite, sendCount: 3 }), "You're invited: UEX 2 · Invitation 3");
  for (const s of ["Reply by", "Fri, Nov 27", "your spot goes to someone else"]) assert.ok(html.includes(s), s);
  assert.match(inviteEmailText(invite), /Reply by Fri, Nov 27 \(8:00 PM\)/);
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

test("owner summary: counts, who hasn't replied, a link to the party admin, escaped", () => {
  const summary = { partyName: "UEX 2", when: "Saturday, December 12, 2026 · 8:00 PM", replyBy: { date: "Sat, Dec 5", time: "8:00 PM" }, link: "https://uniqexclusives.com/app/parties/abc",
    counts: { total: 5, accepted: 2, declined: 1, waiting: 2 }, waiting: [{ name: "Ann <Lee>", guestOf: "Rambod", gender: "female", sendCount: 2 }, { name: "Bo", guestOf: "", gender: "male", sendCount: 1 }] };
  assert.equal(summaryEmailSubject(summary), "UEX 2: 2 still haven't replied");
  const html = summaryEmailHtml(summary);
  for (const s of ["Ann &lt;Lee&gt;", "Guest of Rambod", "Female", "Invitation 2", 'href="https://uniqexclusives.com/app/parties/abc"', "Remind all", "Sat, Dec 5"]) assert.ok(html.includes(s), s);
  assert.ok(html.indexOf("Uniquem") < html.indexOf("UniqEnergy"));
  assert.match(summaryEmailText(summary), /- Ann <Lee> \(F\), guest of Rambod · Invitation 2/);
});
