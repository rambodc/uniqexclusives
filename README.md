# Uniq Exclusives

Website and app for Uniq Exclusives (uniqexclusives.com): the Uniq Group's home (Uniquem, UniqEnergy Solutions, Kemko, Al Chem), the UEX event series, and invite-only sign-in with a 6-digit email code (no passwords, no public sign-up). Vite + React + TypeScript, Firebase Hosting, Firestore, Cloud Functions (2nd gen) and Firebase Authentication (custom tokens). Firebase project: `uniqexclusives`.

## Branches and deploys
`production` is the default branch. Work happens on a branch and lands through a pull request, which runs lint, build and tests (`pull-request.yml`). Merging to `production` deploys:
- **Hosting** (`firebase-hosting.yml`) when app files change.
- **Firestore rules and indexes** (`firebase-rules.yml`) when `firestore.rules`, `firestore.indexes.json` or `firebase.json` change. Auth providers (`auth` in `firebase.json`; every provider is off, sign-in is by custom token) are deployed by hand with `firebase deploy --only auth`.
- **Cloud Functions** (`firebase-functions.yml`) when `functions/**` changes.

## CI identity
GitHub Actions signs in to Google Cloud with Workload Identity Federation, so there is no key file. The `Prod` environment holds:
- `GCP_WIF_PROVIDER`: the `github-actions` pool's `github-uniqexclusives` provider, which only trusts `rambodc/uniqexclusives`.
- `GCP_SERVICE_ACCOUNT_EMAIL`: `github-deployer@uniqexclusives.iam.gserviceaccount.com` (`roles/firebase.admin`, `roles/iam.serviceAccountUser`, plus `roles/cloudfunctions.developer`, `roles/run.admin`, `roles/artifactregistry.writer`, `roles/secretmanager.viewer`, and permission to act as both function runtime service accounts).
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
- Owners see the list on `/app`; everyone else sees a simple welcome for now.

Firestore keeps one top-level collection per mini app (`users`, and `loginCodes` for sign-in, which clients can never read); everything else is closed in `firestore.rules`.

## Brand
- Favicon and app icons (`public/favicon.ico`, `public/icons/`) are the Uniq globe, the same `uniquem-mark` the Uniquem site uses.
- Company logos: `brand-src/originals` are the files as supplied; `python3 brand-src/make_logos.py` writes transparent masters (`brand-src/masters`) and the site files (`public/brand/companies`, 1x and 2x): `<id>.png` is the untouched artwork on transparent, `<id>-dark.png` turns only the black and grey parts white for the dark page. Uniquem always comes first.

## Local development
```
npm ci
npm run dev
```
`VITE_USE_EMULATORS=true VITE_FIREBASE_PROJECT_ID=demo-uex npm run dev` uses the Firebase emulators (`firebase emulators:start --project demo-uex --only auth,firestore,functions`) instead of production; `node scripts/e2e-emulator.mjs` runs the end-to-end sign-in and admin test against them.
