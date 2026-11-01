# Uniq Exclusives

Website and app for Uniq Exclusives (uniqexclusives.com): the Uniq Group's home (Uniquem, UniqEnergy Solutions, Kemko, Al Chem), the UEX event series, and sign-in for members, staff and owners. Vite + React + TypeScript, Firebase Hosting, Firestore and Firebase Authentication (email and password). Firebase project: `uniqexclusives`.

## Branches and deploys
`production` is the default branch. Work happens on a branch and lands through a pull request, which runs lint, build and tests (`pull-request.yml`). Merging to `production` deploys:
- **Hosting** (`firebase-hosting.yml`) when app files change.
- **Firestore rules and indexes** (`firebase-rules.yml`) when `firestore.rules`, `firestore.indexes.json` or `firebase.json` change. Auth providers (`auth` in `firebase.json`) are deployed by hand with `firebase deploy --only auth`, because turning on a provider can enable Google APIs, which the CI deployer is not allowed to do.

Cloud Functions are not set up yet: they need the Blaze plan. When billing is linked, add `functions/` and a `firebase-functions.yml` like Uniquem's (and grant the deployer `roles/cloudfunctions.admin` and `roles/artifactregistry.admin`).

## CI identity
GitHub Actions signs in to Google Cloud with Workload Identity Federation, so there is no key file. The `Prod` environment holds:
- `GCP_WIF_PROVIDER`: the `github-actions` pool's `github-uniqexclusives` provider, which only trusts `rambodc/uniqexclusives`.
- `GCP_SERVICE_ACCOUNT_EMAIL`: `github-deployer@uniqexclusives.iam.gserviceaccount.com` (`roles/firebase.admin`, `roles/iam.serviceAccountUser`).
- `VITE_FIREBASE_*`: the public web app config (same values as `.env.example`).

## Users and roles
One record per person at `users/{Firebase Auth uid}`: `email`, `firstName`, `lastName`, `role` (`owner`, `staff` or `member`), `createdAt`, `updatedAt`.
- Signing up creates the Auth account and the record together, always as `member`, and sends a verification email.
- People can read their own record and change only their names. Owners can read every record and change other people's roles.
- **First owner:** in the Firestore console, set `role` to `owner` on your own `users/{uid}` record.

Firestore keeps one top-level collection per mini app (today only `users`); everything else is closed in `firestore.rules`.

## Local development
```
npm ci
npm run dev
```
`VITE_USE_EMULATORS=true npm run dev` uses the Firebase emulators instead of production.
