import type { GuestStatus } from "./model";

/**
 * What every custom party page receives (see src/parties/README.md).
 * A guest never gets the hidden location: `location` is null until the owner reveals it.
 */
export type PartyPageProps = {
  party: {
    id: string; name: string; description: string; photoUrl: string | null; startsAt: Date; endsAt: Date | null;
    location: string | null; locationRevealed: boolean; dressCode: string;
  };
  /** The signed-in guest; null when an owner previews a party they aren't on. */
  guest: {
    name: string; status: GuestStatus;
    /** RSVP closes when the party starts. */
    canRespond: boolean;
    invites: { allowed: boolean; limit: number; used: number; left: number; requests: { name: string; email: string; status: string }[] };
  } | null;
  /** True when an owner is looking: buttons explain instead of acting. */
  preview: boolean;
  rsvp: (status: "accepted" | "declined") => Promise<void>;
  requestInvite: (input: { name: string; email: string; note: string }) => Promise<void>;
};
