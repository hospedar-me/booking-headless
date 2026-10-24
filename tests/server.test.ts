import { describe, it, expect, vi } from "vitest";
import { createClient } from "../src/sdk";
import { createBookingOperations } from "../src/server";
import type { BookingServerContext } from "../src/server";
function context(token: string, seen: Request[]): BookingServerContext {
  return {
    clientId: token,
    locales: ["en"],
    defaultLocale: "en",
    client: createClient({
      baseUrl: "https://example.test",
      headers: { Authorization: "Bearer " + token },
      fetch: async (input, init) => {
        seen.push(new Request(input, init));
        return new Response(null, { status: 204 });
      },
    }),
    localeHeaders: () => ({ "x-locale": "en" }),
    getTranslator: async () => (k) => k,
    translate: (_l, k) => k,
    auth: {
      getSession: async () => null,
      logout: async () => {},
      start: async () => ({ authorizationUrl: "", state: "" }),
    },
  };
}
describe("server execution contexts", () => {
  it("keeps tenant credentials on the explicit generated SDK client", async () => {
    const seen: Request[] = [];
    const a = createBookingOperations(context("tenant-a", seen)),
      b = createBookingOperations(context("tenant-b", seen));
    const request = {
      checkInDate: "2027-01-02",
      checkOutDate: "2027-01-03",
      numAdults: 2,
      numChildren: 0,
      numAccommodations: 1,
    };
    await Promise.all([
      a.actionSearchBookingEngineOptions(request as any, "en"),
      b.actionSearchBookingEngineOptions(request as any, "en"),
    ]);
    expect(seen.map((r) => r.headers.get("Authorization")).sort()).toEqual([
      "Bearer tenant-a",
      "Bearer tenant-b",
    ]);
    expect(seen.every((r) => r.url.includes("/booking-engine/"))).toBe(true);
  });
});
