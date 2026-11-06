// The parties mini app's Cloud Functions. Every write to parties/** happens here; firestore.rules lets the browser only read.
//  Owners: saveParty, deleteParty, inviteGuest, updateGuest, resendInvite, inviteLink, removeGuest, decideRequest.
//  Guests: openInvite (personal link -> emails a sign-in code), enterInvite (that code -> custom token), rsvp, requestInvite (ask to bring someone; an owner approves).
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { logger } from "firebase-functions/v2";
import { TOKEN_SIGNER, base, db, findOrCreateMember, requireOwner, resendApiKey, storage } from "./app.js";
import { cleanCode, normalizeEmail } from "./codes.js";
import { sendLoginCode, tokenFor, useLoginCode } from "./login.js";
import { EMAIL_FROM, REPLY_TO, SITE, inviteEmailHtml, inviteEmailSubject, inviteEmailText } from "./email.js";
import { sendEmail } from "./mailer.js";
import {
  cleanAllowance, cleanGuestInput, cleanPartyInput, cleanRequestInput, formatPartyDate, inviteLink, isInviteToken, isPartyId, maskEmail,
  newInviteToken, partyEndMs, tokenHash
} from "./parties.js";

const BAD_LINK = "This invite link isn't valid anymore. Ask your host for a new one.";
const partyRef = (id) => db.collection("parties").doc(id);
const message = (error) => error instanceof Error ? error.message : String(error);

async function loadParty(partyId) {
  if (!isPartyId(partyId)) throw new HttpsError("invalid-argument", "Pick a party.");
  const snap = await partyRef(partyId).get();
  if (!snap.exists) throw new HttpsError("not-found", "That party doesn't exist anymore.");
  const d = snap.data(), startsAt = d.startsAt.toMillis(), endsAt = d.endsAt ? d.endsAt.toMillis() : null;
  return { id: snap.id, ref: snap.ref, data: d, startsAt, endsAt, endMs: partyEndMs(startsAt, endsAt) };
}
function requireNotOver(party) {
  if (Date.now() >= party.endMs) throw new HttpsError("failed-precondition", "This party is over.");
}
async function requireRoom(party) {
  if (!party.data.guestLimit) return;
  const count = (await party.ref.collection("guests").count().get()).data().count;
  if (count >= party.data.guestLimit) throw new HttpsError("resource-exhausted", `The guest list is full (${party.data.guestLimit}). Raise the guest limit first.`);
}

/** A fresh personal link for one guest. Links are reusable until the party ends; only the hash is stored. */
async function issueLink(partyId, uid) {
  const token = newInviteToken();
  await partyRef(partyId).collection("tokens").doc(tokenHash(token)).set({ uid, createdAt: FieldValue.serverTimestamp() });
  return inviteLink(SITE, partyId, token);
}

/** Emails the invitation. Returns true when Resend took it; a failure is logged and reported to the owner, never thrown. */
async function emailInvite(party, guest, link) {
  const invite = {
    guestName: guest.name, partyName: party.data.name, when: formatPartyDate(party.startsAt), dressCode: party.data.dressCode ?? "",
    location: party.data.locationRevealed ? party.data.location : null, link, invitedBy: guest.invitedByName ?? null, note: guest.note ?? ""
  };
  try {
    const id = await sendEmail(resendApiKey.value(), {
      from: EMAIL_FROM, to: [guest.email], reply_to: REPLY_TO, subject: inviteEmailSubject(invite),
      html: inviteEmailHtml(invite), text: inviteEmailText(invite)
    }, { idempotencyKey: `invite/${party.id}/${guest.uid}/${Date.now()}` });
    logger.info("Invite sent", { partyId: party.id, uid: guest.uid, resendId: id });
    return true;
  } catch (error) {
    logger.error("Invite email failed", { partyId: party.id, uid: guest.uid, message: message(error) });
    return false;
  }
}

/** Puts someone on a party's list (creating their member account if needed), then emails their personal link. */
async function addGuest(party, { email, name, guestOf, canInvite, inviteLimit, invitedBy = null, invitedByName = null, note = "" }, by) {
  await requireRoom(party);
  const member = await findOrCreateMember(email, name, by);
  const guest = {
    uid: member.uid, name, email, guestOf, status: "invited", canInvite, inviteLimit, invitesUsed: 0,
    invitedBy, invitedByName, note, addedBy: by, invitedAt: FieldValue.serverTimestamp(), respondedAt: null
  };
  try { await party.ref.collection("guests").doc(member.uid).create(guest); }
  catch (error) {
    if (error?.code === 6) throw new HttpsError("already-exists", `${email} is already on this party's list.`);
    throw error;
  }
  const link = await issueLink(party.id, member.uid);
  const emailed = await emailInvite(party, guest, link);
  return { uid: member.uid, link, emailed };
}

/** Removes one person from one party's list and kills their invite links. Their account stays. */
export async function removeGuestPlace(partyId, uid) {
  const ref = partyRef(partyId);
  const tokens = await ref.collection("tokens").where("uid", "==", uid).get();
  const batch = db.batch();
  tokens.docs.forEach((t) => batch.delete(t.ref));
  batch.delete(ref.collection("guests").doc(uid));
  await batch.commit();
}

export const saveParty = onCall({ ...base, timeoutSeconds: 20 }, async (request) => {
  const by = await requireOwner(request);
  const id = request.data?.id;
  if (!isPartyId(id)) throw new HttpsError("invalid-argument", "Missing party id.");
  const { party, error } = cleanPartyInput(request.data);
  if (error) throw new HttpsError("invalid-argument", error);
  if (party.photoPath && !party.photoPath.startsWith(`parties/${id}/`)) throw new HttpsError("invalid-argument", "That photo isn't valid.");
  const ref = partyRef(id);
  const previous = await ref.get();
  const { location, startsAt, endsAt, ...rest } = party;
  const batch = db.batch();
  batch.set(ref, {
    ...rest, startsAt: Timestamp.fromMillis(startsAt), endsAt: endsAt === null ? null : Timestamp.fromMillis(endsAt),
    location: party.locationRevealed ? location : null, updatedAt: FieldValue.serverTimestamp(),
    ...(previous.exists ? {} : { createdAt: FieldValue.serverTimestamp(), createdBy: by })
  }, { merge: true });
  batch.set(ref.collection("private").doc("details"), { location });
  await batch.commit();
  const oldPhoto = previous.get("photoPath");
  if (oldPhoto && oldPhoto !== party.photoPath) await storage.bucket().file(oldPhoto).delete().catch(() => undefined);
  return { id };
});

export const deleteParty = onCall({ ...base, timeoutSeconds: 60 }, async (request) => {
  await requireOwner(request);
  const party = await loadParty(request.data?.id);
  await db.recursiveDelete(party.ref);
  await storage.bucket().deleteFiles({ prefix: `parties/${party.id}/` }).catch((error) => logger.warn("Photo cleanup failed", { message: message(error) }));
  return { ok: true };
});

export const inviteGuest = onCall({ ...base, secrets: [resendApiKey], timeoutSeconds: 30 }, async (request) => {
  const by = await requireOwner(request);
  const party = await loadParty(request.data?.partyId);
  requireNotOver(party);
  const email = normalizeEmail(request.data?.email);
  if (!email) throw new HttpsError("invalid-argument", "Enter a valid email address.");
  const { guest, error } = cleanGuestInput(request.data);
  if (error) throw new HttpsError("invalid-argument", error);
  return addGuest(party, { email, ...guest }, by);
});

export const updateGuest = onCall({ ...base, timeoutSeconds: 20 }, async (request) => {
  await requireOwner(request);
  const party = await loadParty(request.data?.partyId);
  const uid = request.data?.uid;
  if (typeof uid !== "string" || !uid) throw new HttpsError("invalid-argument", "Pick a guest.");
  const allowance = cleanAllowance(request.data);
  if (allowance.error) throw new HttpsError("invalid-argument", allowance.error);
  const ref = party.ref.collection("guests").doc(uid);
  if (!(await ref.get()).exists) throw new HttpsError("not-found", "That guest isn't on the list anymore.");
  await ref.update(allowance);
  return { ok: true };
});

export const resendInvite = onCall({ ...base, secrets: [resendApiKey], timeoutSeconds: 30 }, async (request) => {
  await requireOwner(request);
  const party = await loadParty(request.data?.partyId);
  requireNotOver(party);
  const snap = await party.ref.collection("guests").doc(String(request.data?.uid ?? "-")).get();
  if (!snap.exists) throw new HttpsError("not-found", "That guest isn't on the list anymore.");
  const link = await issueLink(party.id, snap.id);
  return { link, emailed: await emailInvite(party, { ...snap.data(), uid: snap.id }, link) };
});

export const inviteLinkFor = onCall({ ...base, timeoutSeconds: 20 }, async (request) => {
  await requireOwner(request);
  const party = await loadParty(request.data?.partyId);
  requireNotOver(party);
  const snap = await party.ref.collection("guests").doc(String(request.data?.uid ?? "-")).get();
  if (!snap.exists) throw new HttpsError("not-found", "That guest isn't on the list anymore.");
  return { link: await issueLink(party.id, snap.id) };
});

export const removeGuest = onCall({ ...base, timeoutSeconds: 20 }, async (request) => {
  await requireOwner(request);
  const party = await loadParty(request.data?.partyId);
  const uid = request.data?.uid;
  if (typeof uid !== "string" || !uid) throw new HttpsError("invalid-argument", "Pick a guest.");
  await removeGuestPlace(party.id, uid);
  return { ok: true };
});

/** The guest a personal link points to, while the party is still on. Any problem reads as the same "bad link". */
async function resolveInvite(data) {
  const partyId = data?.partyId, token = data?.token;
  if (!isPartyId(partyId) || !isInviteToken(token)) throw new HttpsError("permission-denied", BAD_LINK);
  const tokenSnap = await partyRef(partyId).collection("tokens").doc(tokenHash(token)).get();
  if (!tokenSnap.exists) throw new HttpsError("permission-denied", BAD_LINK);
  const uid = tokenSnap.get("uid");
  const [party, guest, user] = await Promise.all([loadParty(partyId).catch(() => null), partyRef(partyId).collection("guests").doc(uid).get(), db.collection("users").doc(uid).get()]);
  if (!party || !guest.exists || !user.exists || typeof user.get("email") !== "string") throw new HttpsError("permission-denied", BAD_LINK);
  if (Date.now() >= party.endMs) throw new HttpsError("permission-denied", "This party is over, so its invite links have closed.");
  return { party, guest, user, uid, email: user.get("email") };
}

/**
 * Opening a personal link (/i/:partyId/:token): it never signs anyone in. It shows a teaser and emails that guest a fresh
 * 6-digit code (same code email and limits as the sign-in page). Calling it again resends. Someone already signed in as
 * that guest skips the code.
 */
export const openInvite = onCall({ ...base, secrets: [resendApiKey], timeoutSeconds: 30 }, async (request) => {
  const { party, guest, user, uid, email } = await resolveInvite(request.data);
  const teaser = { partyName: party.data.name, startsAt: party.startsAt, firstName: String(guest.get("name") ?? "").split(" ")[0], email: maskEmail(email) };
  if (request.auth?.uid === uid) return { ...teaser, signedIn: true, sent: false };
  return { ...teaser, signedIn: false, sent: await sendLoginCode(user, email) };
});

/** The code from that email, typed on the invite page: signs that one guest in (custom token). */
export const enterInvite = onCall({ ...base, timeoutSeconds: 20, serviceAccount: TOKEN_SIGNER }, async (request) => {
  const { user, uid, email } = await resolveInvite(request.data);
  const code = cleanCode(request.data?.code);
  if (!code || !(await useLoginCode(email, code))) throw new HttpsError("permission-denied", "That code isn't right or has expired. Send a new one.");
  return { token: await tokenFor(uid, email, user.get("name")) };
});

async function requireGuest(request) {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Sign in first.");
  const party = await loadParty(request.data?.partyId);
  const guest = await party.ref.collection("guests").doc(uid).get();
  if (!guest.exists || party.data.published !== true || !party.data.pageSlug) throw new HttpsError("permission-denied", "You're not on this party's list.");
  return { uid, party, guest };
}

export const rsvp = onCall({ ...base, timeoutSeconds: 20 }, async (request) => {
  const { party, guest } = await requireGuest(request);
  const status = request.data?.status;
  if (status !== "accepted" && status !== "declined") throw new HttpsError("invalid-argument", "Accept or decline.");
  if (Date.now() >= party.startsAt) throw new HttpsError("failed-precondition", "The party has started, so RSVPs are closed.");
  await guest.ref.update({ status, respondedAt: FieldValue.serverTimestamp() });
  return { status };
});

export const requestInvite = onCall({ ...base, timeoutSeconds: 20 }, async (request) => {
  const { uid, party, guest } = await requireGuest(request);
  requireNotOver(party);
  const email = normalizeEmail(request.data?.email);
  if (!email) throw new HttpsError("invalid-argument", "Enter a valid email address.");
  const { request: wanted, error } = cleanRequestInput(request.data);
  if (error) throw new HttpsError("invalid-argument", error);
  if (email === guest.get("email")) throw new HttpsError("invalid-argument", "That's your own email.");
  const requests = party.ref.collection("requests");
  return db.runTransaction(async (tx) => {
    const me = await tx.get(guest.ref);
    const { canInvite, inviteLimit = 0, invitesUsed = 0, name } = me.data();
    if (!canInvite) throw new HttpsError("permission-denied", "Your invitation doesn't include inviting others.");
    if (invitesUsed >= inviteLimit) throw new HttpsError("resource-exhausted", `You've used all ${inviteLimit} of your invites.`);
    const [onList, pending] = await Promise.all([
      tx.get(party.ref.collection("guests").where("email", "==", email).limit(1)),
      tx.get(requests.where("email", "==", email).where("status", "==", "pending").limit(1))
    ]);
    if (!onList.empty || !pending.empty) throw new HttpsError("already-exists", "That person is already invited or waiting for approval.");
    const ref = requests.doc();
    tx.create(ref, { by: uid, byName: name, name: wanted.name, email, note: wanted.note, status: "pending", createdAt: FieldValue.serverTimestamp(), decidedAt: null, decidedBy: null, guestUid: null });
    tx.update(guest.ref, { invitesUsed: FieldValue.increment(1) });
    return { id: ref.id };
  });
});

export const decideRequest = onCall({ ...base, secrets: [resendApiKey], timeoutSeconds: 30 }, async (request) => {
  const by = await requireOwner(request);
  const party = await loadParty(request.data?.partyId);
  const approve = request.data?.approve === true;
  const id = request.data?.requestId;
  if (typeof id !== "string" || !/^[A-Za-z0-9]{8,40}$/.test(id)) throw new HttpsError("invalid-argument", "Pick a request.");
  const ref = party.ref.collection("requests").doc(id);
  // Claim it first so two clicks can't both act on it.
  const req = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists || snap.get("status") !== "pending") throw new HttpsError("failed-precondition", "That request was already handled.");
    const inviter = party.ref.collection("guests").doc(snap.get("by"));
    const inviterSnap = approve ? null : await tx.get(inviter);
    tx.update(ref, { status: approve ? "approving" : "rejected", decidedAt: FieldValue.serverTimestamp(), decidedBy: by });
    if (inviterSnap?.exists) tx.update(inviter, { invitesUsed: FieldValue.increment(-1) });
    return snap.data();
  });
  if (!approve) return { status: "rejected" };
  try {
    requireNotOver(party);
    const result = await addGuest(party, {
      email: req.email, name: req.name, guestOf: req.byName, canInvite: false, inviteLimit: 0, invitedBy: req.by, invitedByName: req.byName, note: req.note ?? ""
    }, by);
    await ref.update({ status: "approved", guestUid: result.uid });
    return { status: "approved", ...result };
  } catch (error) {
    await ref.update({ status: "pending", decidedAt: null, decidedBy: null });
    throw error;
  }
});
