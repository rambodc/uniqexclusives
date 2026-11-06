import { describe, expect, it } from "vitest";
import { fromLocalInput, guestCounts, guestDeadline, parseGuest, parseParty, parseRequest, partyEnd, rsvpOpen, shownStatus, timeLeft, toLocalInput } from "./model";
import { PAGE_SLUGS, hasPage } from "./registry";

const ts = (d: Date) => ({ toDate: () => d });
const start = new Date(2026, 11, 12, 20, 0), deadline = new Date(2026, 11, 5, 20, 0);

describe("party model", () => {
  it("reads a party and never invents a location", () => {
    const p = parseParty("abc", { name: "UEX 2", startsAt: ts(start), rsvpDeadline: ts(deadline), location: null, published: true, pageSlug: "uex-2", guestLimit: 100 })!;
    expect(p).toMatchObject({ id: "abc", name: "UEX 2", location: null, locationRevealed: false, published: true, pageSlug: "uex-2", guestLimit: 100, endsAt: null });
    expect(p.rsvpDeadline).toEqual(deadline);
    expect(parseParty("x", { name: "No date" })).toBeNull();
    expect(parseParty("x", { name: "No deadline", startsAt: ts(start) })).toBeNull();
  });
  it("ends a day after the start when there's no end time; RSVP closes at the deadline", () => {
    expect(partyEnd({ startsAt: start, endsAt: null }).getTime()).toBe(start.getTime() + 86_400_000);
    expect(rsvpOpen(deadline, deadline.getTime() - 1)).toBe(true);
    expect(rsvpOpen(deadline, deadline.getTime())).toBe(false);
  });
  it("a re-invite's own deadline wins; unanswered past the deadline shows as expired", () => {
    const own = new Date(2026, 11, 9);
    expect(guestDeadline({ rsvpDeadline: deadline }, { rsvpDeadline: null })).toBe(deadline);
    expect(guestDeadline({ rsvpDeadline: deadline }, { rsvpDeadline: own })).toBe(own);
    expect(shownStatus("invited", deadline, deadline.getTime())).toBe("expired");
    expect(shownStatus("invited", deadline, deadline.getTime() - 1)).toBe("invited");
    expect(shownStatus("accepted", deadline, deadline.getTime() + 1)).toBe("accepted");
  });
  it("splits the time left and turns urgent in the last 3 days", () => {
    const at = deadline.getTime();
    expect(timeLeft(deadline, at - 13 * 86_400_000)).toMatchObject({ days: 13, hours: 0, urgent: false, over: false });
    expect(timeLeft(deadline, at - (2 * 86_400_000 + 3 * 3_600_000 + 4 * 60_000 + 5_000))).toMatchObject({ days: 2, hours: 3, minutes: 4, seconds: 5, urgent: true });
    expect(timeLeft(deadline, at + 1)).toMatchObject({ ms: 0, urgent: false, over: true });
  });
  it("counts guests by status, gender and pending requests", () => {
    const g = (uid: string, status: string, gender = "male") => parseGuest(uid, { name: uid, status, gender })!;
    const r = (id: string, status: string) => parseRequest(id, { name: id, email: `${id}@x.co`, gender: "female", status })!;
    const now = deadline.getTime() + 1;
    expect(guestCounts([g("a", "accepted"), g("b", "invited", "female"), g("c", "declined"), g("d", "accepted", "female"), g("e", "expired")], [r("p", "pending"), r("q", "rejected")], { rsvpDeadline: deadline }, now))
      .toEqual({ total: 5, invited: 0, accepted: 2, declined: 1, expired: 2, male: 3, female: 2, pending: 1 });
    expect(parseGuest("z", { name: "Z", status: "maybe", gender: "male" })).toBeNull();
    expect(parseGuest("z", { name: "Z", status: "invited" })).toBeNull();
  });
  it("round-trips datetime-local values", () => {
    expect(toLocalInput(start)).toBe("2026-12-12T20:00");
    expect(fromLocalInput("2026-12-12T20:00")).toBe(start.getTime());
    expect(fromLocalInput("")).toBeNull();
  });
  it("only registered slugs count as a ready page", () => {
    expect(hasPage(null)).toBe(false);
    expect(hasPage("not-built")).toBe(false);
    expect(hasPage("toString")).toBe(false);
    for (const s of PAGE_SLUGS) expect(hasPage(s)).toBe(true);
  });
});
