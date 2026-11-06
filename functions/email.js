// The sign-in code email: dark, emerald glow, built with tables and inline styles so Gmail, Apple Mail and Outlook agree.
export const SITE = "https://uniqexclusives.com";
export const ASSET_BASE = "https://uniqexclusives.web.app";
export const EMAIL_FROM = "Uniq Exclusives <website@uniquem.ca>";
export const REPLY_TO = "rambodr@uniquem.ca";
/** The Uniq Group, Uniquem always first. */
export const COMPANIES = [
  { name: "Uniquem", url: "https://uniquem.ca/" },
  { name: "UniqEnergy", url: "https://uniqenergy.com/" },
  { name: "Kemko", url: "https://www.kemko.ca/" },
  { name: "Al Chem", url: "https://alchem.ca/" }
];
/** Six digits as 123-456 so it is easy to read and remember. */
export const dashedCode = (code) => `${code.slice(0, 3)}-${code.slice(3)}`;
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

export function codeEmailSubject(code) { return `${dashedCode(code)} is your Uniq Exclusives code`; }

export function codeEmailText(code, name) {
  return [
    `${name ? `${name}, y` : "Y"}our Uniq Exclusives sign-in code is:`,
    "",
    `    ${dashedCode(code)}`,
    "",
    "It expires in 10 minutes and works once.",
    "If you didn't ask for it, ignore this email. Nobody can sign in without the code.",
    "",
    "UEX | Uniq Exclusives",
    SITE,
    "",
    `The Uniq Group: ${COMPANIES.map((c) => c.name).join(" · ")}`
  ].join("\n");
}

const SANS = "-apple-system,BlinkMacSystemFont,'Segoe UI','Helvetica Neue',Helvetica,Arial,sans-serif";
const SERIF = "'Cormorant Garamond',Georgia,'Times New Roman',serif";

/** The shared dark-emerald frame: globe, UEX, divider, then `inner` rows, then The Uniq Group footer (Uniquem first). */
function frame({ title, preheader, inner }) {
  const companies = COMPANIES.map((c) => `<a href="${c.url}" target="_blank" style="color:#8fd8b2;text-decoration:none;">${c.name}</a>`).join('<span style="color:#2d5a43;">&nbsp;&nbsp;·&nbsp;&nbsp;</span>');
  return `<!doctype html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="color-scheme" content="dark"><meta name="supported-color-schemes" content="dark">
<title>${esc(title)}</title>
<!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
<style>
@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@500&family=Cormorant+Garamond:ital@0;1&display=swap');
:root{color-scheme:dark;supported-color-schemes:dark}
body{margin:0;padding:0;background:#010604}
a{color:#8fd8b2}
@media (max-width:520px){.card{padding:36px 18px 30px!important}.uex{font-size:58px!important;letter-spacing:12px!important}.code{font-size:40px!important;letter-spacing:.28em!important}.party{font-size:34px!important}.when{font-size:24px!important}.btn a{padding:18px 30px!important;font-size:15px!important}}
</style>
</head>
<body style="margin:0;padding:0;background:#010604;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#010604;font-size:1px;line-height:1px;">${esc(preheader)}&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#010604" style="background:#010604;background-image:radial-gradient(ellipse at 50% 0%,#0b3b25 0%,#03130c 38%,#010604 70%);">
<tr><td align="center" style="padding:40px 12px;">
  <!--[if mso]><table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
    <tr><td class="card" align="center" bgcolor="#03110b" style="padding:44px 36px 36px;background:#03110b;background-image:radial-gradient(circle at 50% 18%,#0d4a2d 0%,#05180f 42%,#020a06 100%);border:1px solid #145c3a;border-radius:22px;box-shadow:0 0 60px rgba(31,211,138,.18);">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr><td align="center" style="padding:0 0 4px;">
          <img src="${ASSET_BASE}/brand/email/uex-globe@2x.png" width="150" height="108" alt="Uniq" style="display:block;width:150px;height:108px;border:0;outline:none;text-decoration:none;">
        </td></tr>
        <tr><td class="uex" align="center" style="font-family:Cinzel,'Trajan Pro',Georgia,'Times New Roman',serif;font-size:72px;line-height:1;letter-spacing:16px;padding-left:16px;color:#c9f7df;font-weight:500;text-shadow:0 0 24px rgba(60,255,160,.55),0 0 2px rgba(200,255,225,.6);">UEX</td></tr>
        <tr><td align="center" style="padding:14px 0 0;font-family:Cinzel,Georgia,'Times New Roman',serif;font-size:12px;line-height:1;letter-spacing:7px;padding-left:7px;color:#9fdcbc;text-transform:uppercase;">Uniq Exclusives</td></tr>
        <tr><td align="center" style="padding:30px 0 0;"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="120"><tr><td height="1" bgcolor="#2bd48a" style="height:1px;line-height:1px;font-size:0;background:#2bd48a;background-image:linear-gradient(90deg,rgba(43,212,138,0),#3dffa8,rgba(43,212,138,0));">&nbsp;</td></tr></table></td></tr>
${inner}
      </table>
    </td></tr>
    <tr><td align="center" style="padding:26px 10px 0;font-family:Cinzel,Georgia,'Times New Roman',serif;font-size:10px;letter-spacing:4px;color:#4f7d65;text-transform:uppercase;">The Uniq Group</td></tr>
    <tr><td align="center" style="padding:10px 10px 0;font-family:${SANS};font-size:13px;line-height:1.6;">${companies}</td></tr>
    <tr><td align="center" style="padding:14px 10px 0;font-family:${SANS};font-size:11px;line-height:1.6;color:#45705a;">Sent by Uniq Exclusives · <a href="${SITE}" target="_blank" style="color:#6fb894;text-decoration:none;">uniqexclusives.com</a></td></tr>
  </table>
  <!--[if mso]></td></tr></table><![endif]-->
</td></tr>
</table>
</body>
</html>`;
}

export function codeEmailHtml(code, name) {
  const shown = dashedCode(code);
  const greeting = name ? `${esc(name)}, your private sign-in code` : "Your private sign-in code";
  return frame({
    title: codeEmailSubject(code),
    preheader: `Your code is ${shown}. It expires in 10 minutes.`,
    inner: `        <tr><td align="center" style="padding:26px 0 0;font-family:${SERIF};font-style:italic;font-size:22px;line-height:1.35;color:#dff8ea;">${greeting}</td></tr>
        <tr><td align="center" style="padding:28px 0 0;">
          <div class="code" role="text" aria-label="Your code ${shown}" style="font-family:${SANS};font-size:48px;line-height:1.1;font-weight:600;letter-spacing:.35em;padding-left:.35em;color:#f2fff8;text-shadow:0 0 28px rgba(60,255,160,.45);">${shown}</div>
        </td></tr>
        <tr><td align="center" style="padding:24px 0 0;font-family:${SANS};font-size:14px;line-height:1.6;color:#a8cfba;">Enter it on the sign-in page. It expires in <strong style="color:#eafff3;">10 minutes</strong> and works once.</td></tr>
        <tr><td align="center" style="padding:10px 0 0;font-family:${SANS};font-size:12px;line-height:1.6;color:#6f9a84;">Didn't ask for this? Ignore this email. Nobody can sign in without the code.</td></tr>`
  });
}

/**
 * The personal party invitation. `invite` = { firstName, partyName, when ({ date: "Saturday, December 5, 2026", time: "9:00 PM" }),
 * dressCode, location (null unless revealed), link, invitedBy (the guest who asked for this invite, or null), note (their message, or ""),
 * sendCount (1 for the first email, then 2, 3… for each resend or re-invite), replyBy ({ date: "Fri, Nov 27", time: "8:00 PM" }) }.
 * The party's date and place are the headline; the reply-by is one small line by the button. The subject ends in "· Invitation N"
 * so repeat invites don't bundle into one thread.
 */
export function inviteEmailSubject({ partyName, sendCount }) { return `You're invited: ${partyName} · Invitation ${sendCount}`; }
const replyLine = ({ replyBy }) => `Please reply by ${replyBy.date}, ${replyBy.time}. Unanswered invitations expire.`;

export function inviteEmailText(invite) {
  return [
    `${invite.firstName}, you're invited.`,
    "",
    invite.invitedBy ? `${invite.invitedBy} asked us to invite you.` : null,
    invite.note ? `"${invite.note}" — ${invite.invitedBy}` : null,
    invite.invitedBy ? "" : null,
    invite.partyName.toUpperCase(),
    `${invite.when.date} · ${invite.when.time}`,
    invite.location ?? "Location revealed closer to the night",
    invite.dressCode ? `Dress code: ${invite.dressCode}` : null,
    "",
    "Open my invite:",
    invite.link,
    replyLine(invite),
    "",
    "Open it and we'll email you a 6-digit code to sign in. The link is just for you, so please don't forward it.",
    "",
    "UEX | Uniq Exclusives",
    SITE,
    "",
    `The Uniq Group: ${COMPANIES.map((c) => c.name).join(" · ")}`
  ].filter((line) => line !== null).join("\n");
}

export function inviteEmailHtml(invite) {
  const from = invite.invitedBy ? `
        <tr><td align="center" style="padding:16px 0 0;font-family:${SANS};font-size:14px;line-height:1.6;color:#a8cfba;"><strong style="color:#eafff3;">${esc(invite.invitedBy)}</strong> asked us to invite you.</td></tr>${invite.note ? `
        <tr><td align="center" style="padding:14px 8px 0;"><table role="presentation" cellpadding="0" cellspacing="0" border="0" style="max-width:420px;"><tr><td style="padding:14px 18px;border-left:2px solid #2bd48a;background:#041a10;border-radius:0 12px 12px 0;font-family:${SERIF};font-style:italic;font-size:18px;line-height:1.45;color:#dff8ea;text-align:left;">“${esc(invite.note).replace(/\n/g, "<br>")}”<br><span style="font-family:${SANS};font-style:normal;font-size:12px;color:#6fb894;">— ${esc(invite.invitedBy)}</span></td></tr></table></td></tr>` : ""}` : "";
  const where = invite.location
    ? `<span style="color:#e6fff1;">${esc(invite.location).replace(/\n/g, "<br>")}</span>`
    : '<em style="color:#8fb9a3;">Location revealed closer to the night</em>';
  return frame({
    title: inviteEmailSubject(invite),
    preheader: `${invite.partyName} · ${invite.when.date} at ${invite.when.time}. Your personal invitation is inside.`,
    inner: `        <tr><td align="center" style="padding:26px 0 0;font-family:${SERIF};font-style:italic;font-size:22px;line-height:1.35;color:#dff8ea;">${esc(invite.firstName)}, you're invited</td></tr>${from}
        <tr><td class="party" align="center" style="padding:20px 0 0;font-family:${SERIF};font-size:40px;line-height:1.1;color:#f2fff8;text-shadow:0 0 26px rgba(60,255,160,.4);">${esc(invite.partyName)}</td></tr>
        <tr><td class="when" align="center" style="padding:22px 0 0;font-family:${SERIF};font-size:28px;line-height:1.2;color:#f2fff8;">${esc(invite.when.date)}</td></tr>
        <tr><td align="center" style="padding:6px 0 0;font-family:Cinzel,Georgia,serif;font-size:16px;line-height:1.3;letter-spacing:4px;padding-left:4px;color:#9fe8c2;text-transform:uppercase;">${esc(invite.when.time)}</td></tr>
        <tr><td align="center" style="padding:18px 0 0;"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="60"><tr><td height="1" bgcolor="#1d6b45" style="height:1px;line-height:1px;font-size:0;background:#1d6b45;">&nbsp;</td></tr></table></td></tr>
        <tr><td class="where" align="center" style="padding:16px 0 0;font-family:${SANS};font-size:18px;line-height:1.45;color:#e6fff1;">${where}</td></tr>
        ${invite.dressCode ? `<tr><td align="center" style="padding:14px 0 0;font-family:${SANS};font-size:13px;line-height:1.5;color:#a8cfba;"><span style="font-family:Cinzel,Georgia,serif;font-size:10px;letter-spacing:3px;color:#6fb894;text-transform:uppercase;">Dress code</span>&nbsp;&nbsp;${esc(invite.dressCode)}</td></tr>` : ""}
        <tr><td class="btn" align="center" style="padding:32px 0 0;">
          <!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" href="${invite.link}" style="height:60px;v-text-anchor:middle;width:300px;" arcsize="20%" strokecolor="#3dffa8" fillcolor="#0b5434"><w:anchorlock/><center style="color:#f2fff8;font-family:Georgia,serif;font-size:17px;letter-spacing:3px;">OPEN MY INVITE</center></v:roundrect><![endif]-->
          <!--[if !mso]><!--><a href="${invite.link}" target="_blank" style="display:inline-block;padding:20px 44px;border:1px solid #3dffa8;border-radius:14px;background:#0b5434;background-image:linear-gradient(180deg,#167a4c,#06301d);color:#f2fff8;font-family:Cinzel,Georgia,'Times New Roman',serif;font-size:17px;line-height:1;letter-spacing:4px;text-transform:uppercase;text-decoration:none;box-shadow:0 0 30px rgba(40,240,150,.35);">Open my invite</a><!--<![endif]-->
        </td></tr>
        <tr><td class="replyby" align="center" style="padding:12px 0 0;font-family:${SANS};font-size:12px;line-height:1.5;color:#ff9d8a;">${esc(replyLine(invite))}</td></tr>
        <tr><td align="center" style="padding:20px 0 0;font-family:${SANS};font-size:13px;line-height:1.6;color:#a8cfba;">Open it and we'll email you a 6-digit code to sign in. Accept or decline inside. This link is just for you, so please don't forward it.</td></tr>
        <tr><td align="center" style="padding:10px 0 0;font-family:${SANS};font-size:11px;line-height:1.6;color:#6f9a84;word-break:break-all;">Button not working? <a href="${invite.link}" style="color:#6fb894;">${invite.link}</a></td></tr>`
  });
}

/**
 * The owners' heads-up 3 days before a party's RSVP deadline. `summary` = { partyName, when, replyBy ({ date, time }), link (the
 * party's admin view), counts ({ total, accepted, declined, waiting }), waiting ([{ firstName, lastName, guestOf, gender, sendCount }]) }.
 */
export function summaryEmailSubject({ partyName, counts }) { return `${partyName}: ${counts.waiting} still haven't replied`; }

export function summaryEmailText(summary) {
  return [
    `${summary.partyName}: RSVPs close ${summary.replyBy.date} at ${summary.replyBy.time}.`,
    `${summary.counts.accepted} accepted · ${summary.counts.declined} declined · ${summary.counts.waiting} haven't replied (of ${summary.counts.total}).`,
    "",
    "Still waiting on:",
    ...summary.waiting.map((g) => `- ${g.firstName} ${g.lastName} (${g.gender === "female" ? "F" : "M"})${g.guestOf ? `, guest of ${g.guestOf}` : ""} · Invitation ${g.sendCount}`),
    "",
    "Remind them all, or re-invite anyone, from the guest list:",
    summary.link,
    "",
    "UEX | Uniq Exclusives"
  ].join("\n");
}

export function summaryEmailHtml(summary) {
  const { counts } = summary;
  const stat = (label, value) => `<td align="center" width="33%" style="padding:12px 4px;border:1px solid #145c3a;border-radius:12px;background:#041a10;"><span style="font-family:${SERIF};font-size:30px;line-height:1;color:#f2fff8;">${value}</span><br><span style="font-family:Cinzel,Georgia,serif;font-size:9px;letter-spacing:3px;color:#6fb894;text-transform:uppercase;">${label}</span></td>`;
  const rows = summary.waiting.map((g) => `<tr><td style="padding:11px 14px;border-top:1px solid #0f3d28;font-family:${SANS};font-size:14px;line-height:1.4;color:#eafff3;text-align:left;">${esc(g.firstName)} ${esc(g.lastName)}<br><span style="font-size:12px;color:#8fb9a3;">${g.guestOf ? `Guest of ${esc(g.guestOf)} · ` : ""}${g.gender === "female" ? "Female" : "Male"}</span></td><td align="right" style="padding:11px 14px;border-top:1px solid #0f3d28;font-family:${SANS};font-size:12px;color:#6fb894;white-space:nowrap;">Invitation ${g.sendCount}</td></tr>`).join("");
  return frame({
    title: summaryEmailSubject(summary),
    preheader: `${counts.waiting} guests haven't replied. RSVPs close ${summary.replyBy.date}.`,
    inner: `        <tr><td align="center" style="padding:26px 0 0;font-family:${SERIF};font-style:italic;font-size:22px;line-height:1.35;color:#dff8ea;">Three days until RSVPs close</td></tr>
        <tr><td class="party" align="center" style="padding:16px 0 0;font-family:${SERIF};font-size:38px;line-height:1.1;color:#f2fff8;text-shadow:0 0 26px rgba(60,255,160,.4);">${esc(summary.partyName)}</td></tr>
        <tr><td align="center" style="padding:10px 0 0;font-family:${SANS};font-size:14px;line-height:1.5;color:#a8cfba;">${esc(summary.when)}<br>Reply by <strong style="color:#eafff3;">${esc(summary.replyBy.date)}, ${esc(summary.replyBy.time)}</strong></td></tr>
        <tr><td style="padding:24px 0 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="6" border="0"><tr>${stat("Accepted", counts.accepted)}${stat("Declined", counts.declined)}${stat("No reply", counts.waiting)}</tr></table></td></tr>
        <tr><td style="padding:22px 0 0;font-family:Cinzel,Georgia,serif;font-size:10px;letter-spacing:4px;color:#6fb894;text-transform:uppercase;text-align:left;">Still waiting on</td></tr>
        <tr><td style="padding:8px 0 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #145c3a;border-radius:14px;background:#03140c;">${rows}</table></td></tr>
        <tr><td class="btn" align="center" style="padding:30px 0 0;">
          <!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" href="${summary.link}" style="height:56px;v-text-anchor:middle;width:300px;" arcsize="20%" strokecolor="#3dffa8" fillcolor="#0b5434"><w:anchorlock/><center style="color:#f2fff8;font-family:Georgia,serif;font-size:15px;letter-spacing:3px;">OPEN THE GUEST LIST</center></v:roundrect><![endif]-->
          <!--[if !mso]><!--><a href="${summary.link}" target="_blank" style="display:inline-block;padding:18px 36px;border:1px solid #3dffa8;border-radius:14px;background:#0b5434;background-image:linear-gradient(180deg,#167a4c,#06301d);color:#f2fff8;font-family:Cinzel,Georgia,'Times New Roman',serif;font-size:15px;line-height:1;letter-spacing:4px;text-transform:uppercase;text-decoration:none;box-shadow:0 0 30px rgba(40,240,150,.35);">Open the guest list</a><!--<![endif]-->
        </td></tr>
        <tr><td align="center" style="padding:18px 0 0;font-family:${SANS};font-size:13px;line-height:1.6;color:#a8cfba;">Use <strong style="color:#eafff3;">Remind all</strong> to nudge everyone at once, or <strong style="color:#eafff3;">Re-invite</strong> anyone with a fresh deadline. Anyone who hasn't replied by the deadline is marked Expired, not coming.</td></tr>`
  });
}
