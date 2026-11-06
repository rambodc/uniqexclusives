# Custom party pages

Every party gets its own page at `/p/<partyId>`, designed from Rambod's brief. Guests see it only when the party is
**published** and its **custom page** is set; owners and the party's staff can always preview (with a bar on top). Until a page exists, owners
see `kit/Placeholder.tsx`.

## Add a page
1. Make a folder named for the page, e.g. `src/parties/uex-2/`, with `Page.tsx` as its default export:
   ```tsx
   import type { PartyPageProps } from "../types";
   import RsvpControls from "../kit/RsvpControls";
   import InviteControls from "../kit/InviteControls";
   import "./uex-2.css";

   export default function Page(props: PartyPageProps) {
     const { party, guest, preview } = props;
     return <main>…{party.name}… <RsvpControls {...props} /> <InviteControls {...props} /></main>;
   }
   ```
   Keep its CSS, images and fonts inside the folder (imported from `Page.tsx`) so they load only for this party.
2. Register it in `src/parties/registry.ts`:
   ```ts
   "uex-2": definePage(() => import("./uex-2/Page")),
   ```
3. Ship it (PR to `production`). Then, on `/app` → the party → **Edit**, pick `uex-2` under **Custom page**, turn on
   **Published**, and save. Guests' `/app` lists it and their invite links open it.

## What the page gets (`types.ts`)
- `party`: `id, name, description, photoUrl, startsAt, endsAt, rsvpDeadline, dressCode, locationRevealed`, and
  `location`, which stays `null` until the owner reveals it.
- `guest`: the signed-in guest's `name`, RSVP `status` (`invited | accepted | declined | expired`), their own `rsvpDeadline`, `canRespond`
  (answers lock at the deadline; anyone still invited then is expired), and `invites` (`allowed, limit, used, left, requests`). It is `null` when an owner previews.
- `preview`: true for an owner or staff member who isn't on the list (the kit's buttons don't act).
- `rsvp(status)` and `requestInvite({ name, email, gender, note })`: call these from your own buttons, or drop in
  `kit/RsvpControls` and `kit/InviteControls`. `kit/Countdown` (`deadline`, `status`) shows the reply-by countdown;
  it turns urgent in the last 3 days and shows the expired state. Both throw an `Error` with a message ready to show.

The page never reads Firestore itself. Everything it needs comes in as props, and the rules keep the guest list, the
hidden location and other guests' data away from guests anyway.
