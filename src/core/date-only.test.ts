import { describe, expect, it } from "vitest";

import {
  formatDateOnly,
  isConfirmedReservationStatus,
  parseDateOnly,
} from "./date-only";

describe("date-only helpers", () => {
  it("parses YYYY-MM-DD as a local calendar date", () => {
    const date = parseDateOnly("2026-05-22");

    expect(date?.getFullYear()).toBe(2026);
    expect(date?.getMonth()).toBe(4);
    expect(date?.getDate()).toBe(22);
  });

  it("formats date-only strings without shifting to the previous day", () => {
    expect(
      formatDateOnly("2026-05-22", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }),
    ).toBe("22/05/2026");
  });

  it("returns the original value when the date-only string is invalid", () => {
    expect(formatDateOnly("2026-02-31")).toBe("2026-02-31");
  });
});

describe("reservation modification eligibility", () => {
  it("allows only confirmed reservations", () => {
    expect(isConfirmedReservationStatus("Confirmed")).toBe(true);

    for (const status of [
      "Hold",
      "Pending",
      "CheckedIn",
      "CheckedOut",
      "Cancelled",
      "NoShow",
    ]) {
      expect(isConfirmedReservationStatus(status)).toBe(false);
    }
  });
});
