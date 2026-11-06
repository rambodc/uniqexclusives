// The hourly invite sweep (scheduled function inviteSweep in index.js):
//  1. Guests still "invited" after their RSVP deadline become "expired" (Expired, not coming).
//  2. Once per party, 3 days before its RSVP deadline, every owner gets an email listing who hasn't replied (parties/{id}.summarySentAt).
// runSweep takes `now` and `send` so the emulator test can run it without emailing anyone.
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { logger } from "firebase-functions/v2";
import { db, resendApiKey } from "./app.js";
import { EMAIL_FROM, SITE, summaryEmailHtml, summaryEmailSubject, summaryEmailText } from "./email.js";
import { sendEmail } from "./mailer.js";
import { deadlineFor, formatPartyDate, formatReplyBy, summaryDue } from "./parties.js";

const realSend = (message, key) => sendEmail(resendApiKey.value(), message, { idempotencyKey: key });

export async function runSweep({ now = Date.now(), send = realSend } = {}) {
  const parties = new Map();
  const party = async (ref) => {
    if (!parties.has(ref.id)) parties.set(ref.id, await ref.get());
    return parties.get(ref.id);
  };

  let expired = 0;
  for (const g of (await db.collectionGroup("guests").where("status", "==", "invited").get()).docs) {
    const p = await party(g.ref.parent.parent);
    if (now < deadlineFor(p.get("rsvpDeadline").toMillis(), g.get("rsvpDeadline")?.toMillis())) continue;
    await g.ref.update({ status: "expired", respondedAt: Timestamp.fromMillis(now) });
    expired++;
  }

  const summaries = [];
  const upcoming = await db.collection("parties").where("rsvpDeadline", ">", Timestamp.fromMillis(now)).get();
  const due = upcoming.docs.filter((p) => p.get("published") === true && !p.get("summarySentAt") && summaryDue(p.get("rsvpDeadline").toMillis(), now));
  if (due.length) {
    const owners = (await db.collection("users").where("role", "==", "owner").get()).docs.map((o) => o.get("email"));
    for (const p of due) {
      const guests = (await p.ref.collection("guests").orderBy("name").get()).docs.map((g) => g.data());
      const waiting = guests.filter((g) => g.status === "invited");
      const deadline = p.get("rsvpDeadline").toMillis();
      const summary = {
        partyName: p.get("name"), when: formatPartyDate(p.get("startsAt").toMillis()), replyBy: formatReplyBy(deadline), link: `${SITE}/app/parties/${p.id}`,
        counts: { total: guests.length, accepted: guests.filter((g) => g.status === "accepted").length, declined: guests.filter((g) => g.status === "declined").length, waiting: waiting.length },
        waiting: waiting.map((g) => ({ name: g.name, guestOf: g.guestOf, gender: g.gender, sendCount: g.sendCount }))
      };
      if (waiting.length && owners.length) {
        await send({ from: EMAIL_FROM, to: owners, subject: summaryEmailSubject(summary), html: summaryEmailHtml(summary), text: summaryEmailText(summary) }, `summary/${p.id}/${deadline}`);
        summaries.push(summary);
      }
      await p.ref.update({ summarySentAt: FieldValue.serverTimestamp() });
    }
  }
  logger.info("Invite sweep", { expired, summaries: summaries.length });
  return { expired, summaries };
}
