import { describe, it, expect } from "vitest";
import {
  projectReservationDetails,
  effectiveSignedAmountInCents,
} from "./reservation-detail";
import type {
  Reservation,
  ReservationFinancialDetails,
} from "../sdk/types.gen";
export const reservation = {
  id: "r",
  status: "Confirmed",
  pricing: {
    totals: { finalInCents: 10000 },
    stayPricing: {
      dailyBreakdown: { d: { pricing: { baseInCents: 12000 } } },
      promotionApplications: {
        once: [{ promotionId: 1, amountInCents: 1000 }],
        dailyByDate: { d: [{ promotionId: 1, amountInCents: 1000 }] },
      },
      promotionCatalog: { 1: { name: "Promotion" } },
      feeApplications: { once: [], dailyByDate: {} },
      feeCatalog: {},
    },
  },
} as unknown as Reservation;
export const financial = {
  summary: {
    reservationValueInCents: 10000,
    totalWithLocalFeesInCents: 11000,
    paidInCents: 6000,
    grossPaidInCents: 6000,
    refundedInCents: 0,
    overpaidInCents: 0,
    openBalanceInCents: 4000,
    toCollectAtPropertyInCents: 1000,
  },
  statement: { lines: [] },
} as unknown as ReservationFinancialDetails;
const empty = { preview: null, result: null };
describe("reservation display projections", () => {
  it("keeps backend totals and aggregates display lines without repricing", () => {
    const p = projectReservationDetails(reservation, financial, empty);
    expect(p.displayedOpenBalanceInCents).toBe(4000);
    expect(p.displayedFinalBalanceInCents).toBe(5000);
    expect(p.priceTotalInCents).toBe(11000);
    expect(p.promotionLines).toEqual([
      {
        id: "1",
        name: "Promotion",
        description: undefined,
        amountInCents: 2000,
      },
    ]);
    expect(p.dailyBaseInCents).toBe(12000);
  });
  it("uses folio balances after check-in", () => {
    const p = projectReservationDetails(
      { ...reservation, status: "CheckedIn" },
      {
        ...financial,
        summary: {
          ...financial.summary,
          openBalanceInCents: 3500,
          overpaidInCents: 12,
        },
      },
      empty,
    );
    expect(p.displayedOpenBalanceInCents).toBe(3500);
    expect(p.displayedFinalBalanceInCents).toBe(3500);
    expect(p.displayedOverpaidInCents).toBe(12);
  });
  it("projects cancellation response amounts and paid credit centrally", () => {
    const result = {
      reservationId: "r",
      status: "Cancelled" as const,
      penaltyInCents: 2000,
      refundAmountInCents: 4000,
      isPenaltyApplied: true,
      totalPaidInCents: 6000,
    };
    const p = projectReservationDetails(
      { ...reservation, status: "Cancelled" },
      financial,
      { preview: result, result },
    );
    expect(p.displayedAccountTotalInCents).toBe(2000);
    expect(p.displayedOverpaidInCents).toBe(4000);
    expect(p.cancellationPreview?.balanceDueInCents).toBe(0);
    expect(p.paymentStatus).toEqual({ kind: "credit", amountInCents: 4000 });
  });
  it("adjusts only voided statement display amounts", () => {
    expect(
      effectiveSignedAmountInCents({
        signedAmountInCents: 500,
        state: { kind: "partially_voided", amountInCents: 200 },
      } as any),
    ).toBe(300);
    expect(
      effectiveSignedAmountInCents({
        signedAmountInCents: -500,
        state: { kind: "voided", amountInCents: 200 },
      } as any),
    ).toBe(-300);
  });
});
