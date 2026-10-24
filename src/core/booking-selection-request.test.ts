vi.mock("@/actions/booking-results", () => ({
  actionSearchBookingResults: vi.fn(),
}));
import { describe, expect, it, vi } from "vitest";
import {
  buildBookingCheckoutUrl,
  buildPreReservationRequest,
  parseBookingCheckoutState,
  type BookingCheckoutState,
} from "./booking-checkout";
import {
  toBookingEngineRequest,
  type BookingSearchParams,
} from "./booking-results";
import type { SelectedPlanSummary } from "./booking-results-adapter";
import {
  buildSelectionPreviewPayload,
  toGuestDistribution,
} from "./booking-selection-request";

const distribution: NonNullable<BookingSearchParams["distribution"]> = [
  {
    adults: 2,
    childAges: [8],
    pets: [{ petType: "dog", weightInGrams: 8_000 }],
  },
  {
    adults: 1,
    childAges: [3, 6],
    pets: [{ petType: "cat", weightInGrams: 4_500 }],
  },
];

const criteria = (): BookingSearchParams => ({
  checkIn: "2026-11-20",
  checkOut: "2026-11-22",
  adults: 3,
  children: 3,
  childAges: [8, 3, 6],
  rooms: 2,
  distribution,
  pets: [
    { petType: "dog", weightInGrams: 8_000 },
    { petType: "cat", weightInGrams: 4_500 },
  ],
});

const selectedItem = (
  roomCategoryId: number,
  quantity: number,
): SelectedPlanSummary => ({
  quoteKey: `${roomCategoryId}-20-0`,
  roomCategoryId,
  roomName: `Suíte ${roomCategoryId}`,
  ratePlanId: 20,
  ratePlanName: "Flexível",
  quantity,
  unitTotal: 10_000,
  subtotal: 10_000 * quantity,
});

const checkoutState = (): BookingCheckoutState => ({
  criteria: criteria(),
  hasMixedPlans: false,
  items: [selectedItem(10, 2)],
  recommendedCombination: [
    {
      accommodationCategoryId: 99,
      ratePlanId: 20,
      quantity: 2,
      allocations: [
        {
          numAdults: 3,
          numChildren: 0,
          childAges: [],
          numPets: 0,
          pets: [],
        },
        {
          numAdults: 0,
          numChildren: 2,
          childAges: [1, 2],
          numPets: 0,
          pets: [],
        },
      ],
    },
  ],
  summary: {
    selectedCount: 2,
    totalCapacity: 6,
    totalValue: 20_000,
  },
});

const expectedGuestDistribution = [
  {
    numAdults: 2,
    numChildren: 1,
    childAges: [8],
    numPets: 1,
    pets: [{ petType: "dog", weightInGrams: 8_000 }],
  },
  {
    numAdults: 1,
    numChildren: 2,
    childAges: [3, 6],
    numPets: 1,
    pets: [{ petType: "cat", weightInGrams: 4_500 }],
  },
];

describe("manual guest distribution", () => {
  it("converts criteria distribution exactly to the API DTO", () => {
    expect(toGuestDistribution(distribution)).toEqual(
      expectedGuestDistribution,
    );
  });

  it("keeps guest distribution undefined when no explicit distribution exists", () => {
    expect(toGuestDistribution()).toBeUndefined();
    expect(toGuestDistribution([])).toBeUndefined();

    const withoutDistribution = { ...criteria(), distribution: undefined };
    expect(
      buildSelectionPreviewPayload(
        withoutDistribution,
        [selectedItem(10, 1)],
        20,
      ).guestDistribution,
    ).toBeUndefined();
    expect(
      toBookingEngineRequest(withoutDistribution).guestDistribution,
    ).toBeUndefined();
  });

  it("uses the same conversion for the initial booking search request", () => {
    expect(toBookingEngineRequest(criteria()).guestDistribution).toEqual(
      expectedGuestDistribution,
    );
  });

  it("preserves distribution in the results selection preview", () => {
    const payload = buildSelectionPreviewPayload(
      criteria(),
      [selectedItem(10, 2)],
      20,
    );

    expect(payload).not.toHaveProperty("financialResponsibility");
    expect(payload.accommodations).toEqual([
      { accommodationCategoryId: 10 },
      { accommodationCategoryId: 10 },
    ]);
    expect(payload).not.toHaveProperty("financialResponsibility");
    expect(payload.guestDistribution).toEqual(expectedGuestDistribution);
  });

  it("keeps the original distribution after the user changes the selection", () => {
    const payload = buildSelectionPreviewPayload(
      criteria(),
      [selectedItem(42, 1)],
      20,
    );

    expect(payload.accommodations).toEqual([{ accommodationCategoryId: 42 }]);
    expect(payload).not.toHaveProperty("financialResponsibility");
    expect(payload.guestDistribution).toEqual(expectedGuestDistribution);
  });

  it("preserves criteria distribution through the checkout URL round-trip", () => {
    const state = checkoutState();
    const url = buildBookingCheckoutUrl("pt", state);

    expect(url).not.toBeNull();

    const parsed = parseBookingCheckoutState(
      new URL(url!, "https://example.com").searchParams,
    );

    expect(parsed?.criteria.distribution).toEqual(distribution);
  });

  it("preserves criteria distribution in the checkout preview payload", () => {
    const state = checkoutState();
    const payload = buildSelectionPreviewPayload(
      state.criteria,
      state.items,
      state.items[0].ratePlanId,
    );

    expect(payload).not.toHaveProperty("financialResponsibility");
    expect(payload.guestDistribution).toEqual(expectedGuestDistribution);
  });

  it("builds pre-reservation guest distribution from criteria, never recommendation allocations", () => {
    const payload = buildPreReservationRequest(checkoutState(), {
      email: "guest@example.com",
      fullName: "Guest Test",
      notes: "",
      phone: "+55 22 99999-9999",
    });

    expect(payload.accommodations).toEqual([
      { accommodationCategoryId: 10 },
      { accommodationCategoryId: 10 },
    ]);
    expect(payload).not.toHaveProperty("financialResponsibility");
    expect(payload.guestDistribution).toEqual(expectedGuestDistribution);
    expect(payload.guestDistribution).not.toEqual(
      checkoutState().recommendedCombination?.[0]?.allocations,
    );
  });

  it("does not invent pre-reservation distribution when criteria has none", () => {
    const state = checkoutState();
    state.criteria = { ...state.criteria, distribution: undefined };

    const payload = buildPreReservationRequest(state, {
      email: "guest@example.com",
      fullName: "Guest Test",
      notes: "",
      phone: "+55 22 99999-9999",
    });

    expect(payload.guestDistribution).toBeUndefined();
  });
});
