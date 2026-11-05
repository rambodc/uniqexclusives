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

export function codeEmailHtml(code, name) {
  const shown = dashedCode(code);
  const companies = COMPANIES.map((c) => `<a href="${c.url}" target="_blank" style="color:#8fd8b2;text-decoration:none;">${c.name}</a>`).join('<span style="color:#2d5a43;">&nbsp;&nbsp;·&nbsp;&nbsp;</span>');
  const greeting = name ? `${esc(name)}, your private sign-in code` : "Your private sign-in code";
  return `<!doctype html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="color-scheme" content="dark"><meta name="supported-color-schemes" content="dark">
<title>${codeEmailSubject(code)}</title>
<!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
<style>
@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@500&family=Cormorant+Garamond:ital@1&display=swap');
:root{color-scheme:dark;supported-color-schemes:dark}
body{margin:0;padding:0;background:#010604}
a{color:#8fd8b2}
@media (max-width:520px){.card{padding:36px 18px 30px!important}.uex{font-size:58px!important;letter-spacing:12px!important}.code{font-size:40px!important;letter-spacing:.28em!important}}
</style>
</head>
<body style="margin:0;padding:0;background:#010604;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#010604;font-size:1px;line-height:1px;">Your code is ${shown}. It expires in 10 minutes.&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;</div>
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
        <tr><td align="center" style="padding:26px 0 0;font-family:'Cormorant Garamond',Georgia,'Times New Roman',serif;font-style:italic;font-size:22px;line-height:1.35;color:#dff8ea;">${greeting}</td></tr>
        <tr><td align="center" style="padding:28px 0 0;">
          <div class="code" role="text" aria-label="Your code ${shown}" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Helvetica Neue',Helvetica,Arial,sans-serif;font-size:48px;line-height:1.1;font-weight:600;letter-spacing:.35em;padding-left:.35em;color:#f2fff8;text-shadow:0 0 28px rgba(60,255,160,.45);">${shown}</div>
        </td></tr>
        <tr><td align="center" style="padding:24px 0 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:14px;line-height:1.6;color:#a8cfba;">Enter it on the sign-in page. It expires in <strong style="color:#eafff3;">10 minutes</strong> and works once.</td></tr>
        <tr><td align="center" style="padding:10px 0 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:12px;line-height:1.6;color:#6f9a84;">Didn't ask for this? Ignore this email. Nobody can sign in without the code.</td></tr>
      </table>
    </td></tr>
    <tr><td align="center" style="padding:26px 10px 0;font-family:Cinzel,Georgia,'Times New Roman',serif;font-size:10px;letter-spacing:4px;color:#4f7d65;text-transform:uppercase;">The Uniq Group</td></tr>
    <tr><td align="center" style="padding:10px 10px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:13px;line-height:1.6;">${companies}</td></tr>
    <tr><td align="center" style="padding:14px 10px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:11px;line-height:1.6;color:#45705a;">Sent by Uniq Exclusives · <a href="${SITE}" target="_blank" style="color:#6fb894;text-decoration:none;">uniqexclusives.com</a></td></tr>
  </table>
  <!--[if mso]></td></tr></table><![endif]-->
</td></tr>
</table>
</body>
</html>`;
}
