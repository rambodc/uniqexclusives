import type { Gender } from "../auth/roles";
import type { GuestStatus } from "./model";

/**
 * What every custom party page receives (see src/parties/README.md).
 * A guest never gets the hidden location: `location` is null until the owner reveals it.
 */
export type PartyPageProps = {
  party: {
    id: string; name: string; description: string; photoUrl: string | null; startsAt: Date; endsAt: Date | null; rsvpDeadline: Date;
    location: string | null; locationRevealed: boolean; dressCode: string;
  };
  /** The signed-in guest; null when an owner or the party's staff previews a party they aren't on. */
  guest: {
    name: string;
    /** "expired" once the deadline passed without an answer (Expired, not coming). */
    status: GuestStatus;
    /** Their RSVP deadline (a re-invite can give them their own). Show it with kit/Countdown. */
    rsvpDeadline: Date;
    /** Answers are open until the deadline. */
    canRespond: boolean;
    invites: { allowed: boolean; limit: number; used: number; left: number; requests: { name: string; email: string; status: string }[] };
  } | null;
  /** True when an owner or the party's staff is looking: buttons explain instead of acting. */
  preview: boolean;
  rsvp: (status: "accepted" | "declined") => Promise<void>;
  requestInvite: (input: { name: string; email: string; gender: Gender; note: string }) => Promise<void>;
};
