import { describe, expect, it } from "vitest";
import { fromLocalInput, guestCounts, parseGuest, parseParty, parseRequest, partyEnd, rsvpOpen, toLocalInput } from "./model";
import { PAGE_SLUGS, hasPage } from "./registry";

const ts = (d: Date) => ({ toDate: () => d });
const start = new Date(2026, 11, 12, 20, 0);

describe("party model", () => {
  it("reads a party and never invents a location", () => {
    const p = parseParty("abc", { name: "UEX 2", startsAt: ts(start), location: null, published: true, pageSlug: "uex-2", guestLimit: 100 })!;
    expect(p).toMatchObject({ id: "abc", name: "UEX 2", location: null, locationRevealed: false, published: true, pageSlug: "uex-2", guestLimit: 100, endsAt: null });
    expect(parseParty("x", { name: "No date" })).toBeNull();
  });
  it("ends a day after the start when there's no end time; RSVP closes at the start", () => {
    expect(partyEnd({ startsAt: start, endsAt: null }).getTime()).toBe(start.getTime() + 86_400_000);
    expect(rsvpOpen({ startsAt: start }, start.getTime() - 1)).toBe(true);
    expect(rsvpOpen({ startsAt: start }, start.getTime())).toBe(false);
  });
  it("counts guests by status and pending requests", () => {
    const g = (uid: string, status: string) => parseGuest(uid, { name: uid, status })!;
    const r = (id: string, status: string) => parseRequest(id, { name: id, email: `${id}@x.co`, status })!;
    expect(guestCounts([g("a", "accepted"), g("b", "invited"), g("c", "declined"), g("d", "accepted")], [r("p", "pending"), r("q", "rejected")]))
      .toEqual({ total: 4, invited: 1, accepted: 2, declined: 1, pending: 1 });
    expect(parseGuest("z", { name: "Z", status: "maybe" })).toBeNull();
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
