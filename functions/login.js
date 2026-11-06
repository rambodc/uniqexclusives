// Emailing and checking the 6-digit sign-in codes, shared by the sign-in page (index.js) and invite links (parties-api.js).
import { FieldValue } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import { logger } from "firebase-functions/v2";
import { CODE_TTL_MS, checkCode, codeDocId, hashCode, newCode, newSalt, sendWindow } from "./codes.js";
import { EMAIL_FROM, REPLY_TO, codeEmailHtml, codeEmailSubject, codeEmailText } from "./email.js";
import { sendEmail } from "./mailer.js";
import { auth, db, ensureAuthUser, resendApiKey } from "./app.js";
import { fullName } from "./users.js";

/**
 * Emails a fresh code to a users record (`user` is its snapshot). Max five per address per rolling hour.
 * Returns false when the address hit that limit (nothing is sent). The function using this must list resendApiKey in `secrets`.
 */
export async function sendLoginCode(user, email) {
  const ref = db.collection("loginCodes").doc(codeDocId(email));
  const code = newCode(), salt = newSalt(), now = Date.now();
  const allowed = await db.runTransaction(async (tx) => {
    const window = sendWindow((await tx.get(ref)).data()?.sends, now);
    if (!window.allowed) return false;
    tx.set(ref, { hash: hashCode(code, salt), salt, expiresAt: now + CODE_TTL_MS, attempts: 0, sends: [...window.recent, now], uid: user.id, createdAt: FieldValue.serverTimestamp() });
    return true;
  });
  if (!allowed) {
    logger.warn("Sign-in code rate limited", { uid: user.id });
    return false;
  }
  try {
    const name = user.get("firstName");
    const id = await sendEmail(resendApiKey.value(), {
      from: EMAIL_FROM, to: [email], reply_to: REPLY_TO, subject: codeEmailSubject(code),
      html: codeEmailHtml(code, name), text: codeEmailText(code, name)
    }, { idempotencyKey: `login-code/${codeDocId(email)}/${now}` });
    logger.info("Sign-in code sent", { uid: user.id, resendId: id });
  } catch (error) {
    logger.error("Sign-in code email failed", { message: error instanceof Error ? error.message : String(error) });
    throw new HttpsError("internal", "We couldn't send the code. Please try again.");
  }
  return true;
}

/** Checks a typed code for an email (one use, five tries). True when it was right. */
export async function useLoginCode(email, code) {
  const ref = db.collection("loginCodes").doc(codeDocId(email));
  const outcome = await db.runTransaction(async (tx) => {
    const result = checkCode((await tx.get(ref)).data(), code, Date.now());
    if (result === "ok") tx.update(ref, { hash: FieldValue.delete(), salt: FieldValue.delete(), expiresAt: 0, attempts: 0 });   // keep send history for the rate limit
    else if (result === "wrong") tx.update(ref, { attempts: FieldValue.increment(1) });
    return result;
  });
  return outcome === "ok";
}

/** A custom token for a users record (its snapshot), making sure its Auth account exists. The calling function must run as TOKEN_SIGNER. */
export async function tokenFor(user, email) {
  await ensureAuthUser(user.id, email, fullName(user.data()));
  return auth.createCustomToken(user.id);
}
