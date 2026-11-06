# Uniq Exclusives

Website and app for Uniq Exclusives (uniqexclusives.com): the Uniq Group's home (Uniquem, UniqEnergy Solutions, Kemko, Al Chem), the UEX event series, and invite-only sign-in with a 6-digit email code (no passwords, no public sign-up). Vite + React + TypeScript, Firebase Hosting, Firestore, Cloud Functions (2nd gen) and Firebase Authentication (custom tokens). Firebase project: `uniqexclusives`.

## Branches and deploys
`production` is the default branch. Work happens on a branch and lands through a pull request, which runs lint, build and tests (`pull-request.yml`). Merging to `production` deploys:
- **Hosting** (`firebase-hosting.yml`) when app files change.
- **Firestore rules and indexes, and Storage rules** (`firebase-rules.yml`) when `firestore.rules`, `firestore.indexes.json`, `storage.rules` or `firebase.json` change. Auth providers (`auth` in `firebase.json`; every provider is off, sign-in is by custom token) are deployed by hand with `firebase deploy --only auth`.
- **Cloud Functions** (`firebase-functions.yml`) when `functions/**` changes.

## CI identity
GitHub Actions signs in to Google Cloud with Workload Identity Federation, so there is no key file. The `Prod` environment holds:
- `GCP_WIF_PROVIDER`: the `github-actions` pool's `github-uniqexclusives` provider, which only trusts `rambodc/uniqexclusives`.
- `GCP_SERVICE_ACCOUNT_EMAIL`: `github-deployer@uniqexclusives.iam.gserviceaccount.com`, with these roles: `roles/firebase.admin`, `roles/iam.serviceAccountUser`, `roles/cloudfunctions.developer`, `roles/run.admin`, `roles/artifactregistry.writer` and `roles/secretmanager.viewer`. It can act as both function runtime service accounts.
- The Storage service agent (`service-574297729040@gcp-sa-firebasestorage`) has `roles/firebaserules.firestoreServiceAgent`, so `storage.rules` can check Firestore.
- `VITE_FIREBASE_*`: the public web app config (same values as `.env.example`).

## Sign-in (invite only)
1. `/signin`: the person types their email and the `requestCode` function runs. If no `users` record has that email, it returns `not-found` and the page says *"There's no account for that email. UEX is invite-only."* — no email is sent. If they are on the list, it makes a 6-digit code, stores its salted HMAC, expiry (10 min) and attempt count in `loginCodes/{sha256(email)}`, and emails it through Resend from `Uniq Exclusives <website@uniquem.ca>` (max 5 code emails per address per hour).
2. The person types the code (shown as `123-456` in the email and on the page; paste with or without the dash works); `verifyCode` checks the six digits (5 wrong tries burn it, it works once), makes sure the Auth account exists with the `users` record's uid, and returns a custom token; the browser signs in with `signInWithCustomToken`. `verifyCode` runs as `firebase-adminsdk-fbsvc@`, which can sign tokens.

The email is `functions/email.js` (tables and inline styles for Gmail, Apple Mail and Outlook; the globe is `public/brand/email/uex-globe@2x.png`). The code is large plain text with a dash between the first 3 and last 3 digits — no boxes around each digit.

**Secret:** `RESEND_API_KEY` in Secret Manager (a sending-only key for the `uniquem.ca` domain). Set it with `firebase functions:secrets:set RESEND_API_KEY --project uniqexclusives`, then redeploy functions (run the *Production - Firebase Functions* workflow) so they pick up the new version. Never commit it or put it in a GitHub secret.

## Users and roles
One record per person at `users/{Firebase Auth uid}`: `email`, `name`, `role` (`owner`, `staff` or `member`), `createdAt`, `createdBy`, `updatedAt`.
- There is no public sign-up. Owners add and remove people on `/app` (the `createUser` and `removeUser` functions, which also create or delete the Auth account).
- People can read only their own record; owners can list everyone. Nobody writes `users` from the browser.
- Owners manage the list on `/app/people`. Members and staff see their invitations on `/app`.

## Parties and invites
Owners run parties on `/app` (Parties tab; People is the user list). Members (and staff, for now) see their invitations on `/app`.
- **A party** has a name, description, photo (Storage `parties/{partyId}/…`, owners upload), start and optional end, location, a *reveal location* switch (off by default), dress code, guest limit, *published*, and a custom page (`pageSlug`). Guests see a party only when it is published **and** its custom page exists (`src/parties/README.md` explains how to add one). Owners can preview any party at `/p/{partyId}`.
- **Invites**: one account per person, no plus-ones. An owner invites by name, email, free-text *Group / Guest of*, and whether they can invite others (and how many). Inviting creates the member account if needed and the guest record (status `invited`), and emails a personal link (`/i/{partyId}/{token}`). Opening the link never signs anyone in by itself: the page shows the party name and date and the guest's masked email, emails them a fresh 6-digit sign-in code (`openInvite`, same code email and 5-per-hour limit as the sign-in page, with a resend button), and signs them in once they type it (`enterInvite`, custom token), then opens `/p/{partyId}`. Someone already signed in as that guest skips the code. The link can be reused until the party ends (the end time, or a day after the start). Only a SHA-256 of the token is stored. Owners can copy a fresh link, resend the email, change someone's invite allowance, or remove them (their links stop working).
- **RSVP**: guests accept or decline, and can change it until the party starts.
- **Guest invites**: a guest who's allowed can ask to invite up to N people (name, email, optional note). Requests wait for an owner's approval. *Guest of* is set to the guest who asked, and pending and approved requests both count against N. Approving sends the invite, with the note and who asked. Rejecting frees the slot.

Data (`functions/parties.js` has the full list):
- `parties/{partyId}` is the party. `location` is filled in only once revealed.
- `parties/{partyId}/private/details` holds `location`, owners only.
- `parties/{partyId}/guests/{uid}` holds `name, email, guestOf, status, canInvite, inviteLimit, invitesUsed, invitedBy, invitedByName, note`.
- `parties/{partyId}/requests/{id}` holds `by, byName, name, email, note, status` (`pending | approved | rejected`).
- `parties/{partyId}/tokens/{sha256}` is touched by functions only.

Every write goes through the functions in `functions/parties-api.js`. Guests can read only their own guest record and requests, plus the party once it's visible. Removing a user (People) also takes them off every party list.

Firestore keeps one top-level collection per mini app: `users`, `loginCodes` for sign-in (clients can never read it), and `parties`. Everything else is closed in `firestore.rules`. Storage is closed except party photos (`storage.rules`).

## Tests
- `npm test` (frontend) and `npm test --prefix functions` (pure helpers and email templates) run in CI.
- `npm run test:rules` runs the Firestore and Storage rules tests against the emulators.
- `npm run test:e2e` runs sign-in and parties end to end on the emulators. In the emulator, emails are only logged.

## Brand
- Favicon and app icons (`public/favicon.ico`, `public/icons/`) are the Uniq globe, the same `uniquem-mark` the Uniquem site uses.
- Company logos: `brand-src/originals` are the files as supplied; `python3 brand-src/make_logos.py` writes transparent masters (`brand-src/masters`) and the site files (`public/brand/companies`, 1x and 2x): `<id>.png` is the untouched artwork on transparent, `<id>-dark.png` turns only the black and grey parts white for the dark page. Uniquem always comes first.

## Local development
```
npm ci
npm run dev
```
`VITE_USE_EMULATORS=true VITE_FIREBASE_PROJECT_ID=demo-uex VITE_FIREBASE_STORAGE_BUCKET=demo-uex.appspot.com npm run dev` uses the Firebase emulators (`firebase emulators:start --project demo-uex --only auth,firestore,functions,storage`) instead of production; `npm run test:e2e` runs the end-to-end tests against them.
