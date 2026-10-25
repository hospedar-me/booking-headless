import { useBookingResults } from "../src/react/useBookingResults";
import { useMyReservation } from "../src/react/useMyReservation";
import { useBookingCheckout } from "../src/react/useBookingCheckout";
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { useGuestDistribution } from "../src/react/useGuestDistribution";
import { useReservationModification } from "../src/react/useReservationModification";
import { useMyReservations } from "../src/react/useMyReservations";
import type { HookContext } from "../src/react/context";
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const t = (key: string) => key;
const context = (operations: unknown) =>
  ({
    operations,
    locale: "en",
    t,
    translations: () => t,
    translate: (_l: string, k: string) => k,
    navigation: { push: vi.fn(), replace: vi.fn(), refresh: vi.fn() },
    searchParams: new URLSearchParams(),
    paymentProviders: {
      PAYMENT_PROVIDER_PUBLIC_KEYS: {},
      isBookingFrontendPaymentProvider: () => false,
      getPaymentProviderLabel: () => "",
    },
  }) as unknown as HookContext;
function mount<T>(run: () => T) {
  const el = document.createElement("div");
  document.body.append(el);
  const root = createRoot(el);
  let value: T;
  function App() {
    value = run();
    return null;
  }
  act(() => root.render(createElement(App)));
  return {
    get current() {
      return value!;
    },
    unmount() {
      act(() => root.unmount());
      el.remove();
    },
  };
}
describe("controller concurrency", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());
  it("discards a distribution response after criteria change, before the next debounce", async () => {
    let resolve: any;
    const operation = vi.fn(() => new Promise((r) => (resolve = r)));
    const runtime = context({ actionDistributeBookingEngineGuests: operation });
    const hook = mount(() => useGuestDistribution({}, runtime));
    act(() => hook.current.setAdults(3));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(251);
    });
    expect(operation).toHaveBeenCalledTimes(1);
    act(() => hook.current.setAdults(4));
    await act(async () =>
      resolve({
        data: {
          distribution: [
            {
              numAdults: 3,
              numChildren: 0,
              childAges: [],
              numPets: 0,
              pets: [],
            },
          ],
        },
      }),
    );
    expect(hook.current.adults).toBe(4);
    hook.unmount();
  });
  it("handles transport failure and releases the distribution loading state", async () => {
    const runtime = context({
      actionDistributeBookingEngineGuests: vi
        .fn()
        .mockRejectedValue(Error("offline")),
    });
    const hook = mount(() => useGuestDistribution({}, runtime));
    act(() => hook.current.setAdults(3));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(251);
    });
    expect(hook.current.isDistributingGuests).toBe(false);
    expect(hook.current.distributionError).toBe("errors.invalidDistribution");
    hook.unmount();
  });
  it("ignores an older reservation page and completion after unmount", async () => {
    const pending: any[] = [];
    const runtime = context({
      actionListMyReservations: vi.fn(
        () => new Promise((r) => pending.push(r)),
      ),
    });
    const hook = mount(() =>
      useMyReservations(
        { authenticatedUser: {} as any, footerData: null, locale: "en" },
        runtime,
      ),
    );
    act(() => hook.current.setPage(2));
    await act(async () =>
      pending[1]({ data: { total: 20, items: [{ id: "new" }] } }),
    );
    await act(async () =>
      pending[0]({ data: { total: 1, items: [{ id: "old" }] } }),
    );
    expect(hook.current.loadState.result?.total).toBe(20);
    hook.unmount();
  });
});

it("does not start modification operations for an ineligible reservation", async () => {
  const search = vi.fn(),
    preview = vi.fn(),
    create = vi.fn();
  const runtime = context({
    actionSearchBookingResults: search,
    actionPreviewMyReservationModificationRequest: preview,
    actionCreateMyReservationModificationRequest: create,
  });
  const hook = mount(() =>
    useReservationModification(
      {
        reservation: {
          status: "CheckedIn",
          checkInDate: "2027-01-01",
          checkOutDate: "2027-01-02",
          allocation: { numAdults: 2, numChildren: 0, childAges: [], pets: [] },
          pets: [],
        } as any,
        locale: "en",
        open: true,
        onOpenChange: () => {},
        onCreated: () => {},
      } as any,
      runtime,
    ),
  );
  await act(async () => {
    await hook.current.handleSearch();
    await hook.current.handlePreview();
    await hook.current.handleSubmit();
  });
  expect(hook.current.canModify).toBe(false);
  expect(search).not.toHaveBeenCalled();
  expect(preview).not.toHaveBeenCalled();
  expect(create).not.toHaveBeenCalled();
  hook.unmount();
});

it("reuses a failed checkout idempotency key until its content changes", async () => {
  const create = vi.fn().mockResolvedValue({ error: "offline" });
  const preview = {
    paymentOptions: { ratePlanReference: 10 },
    commercialPolicies: {},
  };
  const runtime = context({
    actionPreviewBookingSelection: vi.fn().mockResolvedValue({ data: preview }),
    actionGetReservationPolicies: vi.fn().mockResolvedValue({ data: {} }),
    actionCreateBookingPreReservation: create,
  });
  const initialState = {
    criteria: {
      checkIn: "2027-01-01",
      checkOut: "2027-01-02",
      adults: 2,
      children: 0,
      rooms: 1,
    },
    items: [{ roomCategoryId: 1, ratePlanId: 10, quantity: 1 }],
    summary: { selectedCount: 1, totalValue: 100, totalCapacity: 2 },
    hasMixedPlans: false,
  } as any;
  const hook = mount(() =>
    useBookingCheckout(
      {
        initialState,
        initialAuthenticatedUser: null,
        footerData: null,
        locale: "en",
      },
      runtime,
    ),
  );
  await act(async () => {});
  act(() => {
    hook.current.setAuthChoice("guest");
    hook.current.setFormData({
      fullName: "Guest",
      email: "guest@example.test",
      phone: "12345",
      notes: "",
    });
    hook.current.setSelectionPreview(preview as any);
  });
  await act(async () => {
    await hook.current.submit();
  });
  await act(async () => {
    await hook.current.submit();
  });
  expect(create).toHaveBeenCalledTimes(2);
  expect(create.mock.calls[0][0].payload.idempotencyKey).toBe(
    create.mock.calls[1][0].payload.idempotencyKey,
  );
  act(() => hook.current.updateField("notes", "Changed request"));
  await act(async () => {
    await hook.current.submit();
  });
  expect(create.mock.calls[2][0].payload.idempotencyKey).not.toBe(
    create.mock.calls[0][0].payload.idempotencyKey,
  );
  hook.unmount();
});

it("exposes explicit category selection without a template event protocol", () => {
  const runtime = context({});
  const hook = mount(() => useGuestDistribution({}, runtime));
  act(() => hook.current.selectCategory(42));
  expect(hook.current.selectedCategoryId).toBe(42);
  act(() =>
    window.dispatchEvent(
      new CustomEvent("booking-category-selected", {
        detail: { categoryId: 99 },
      }),
    ),
  );
  expect(hook.current.selectedCategoryId).toBe(42);
  hook.unmount();
});
it("invalidates price and checkout immediately and ignores outdated quantity and rate-plan replies", async () => {
  vi.useFakeTimers();
  try {
    const pending: any[] = [];
    const preview = vi.fn(
      () => new Promise((resolve) => pending.push(resolve)),
    );
    const runtime = context({ actionPreviewBookingSelection: preview });
    runtime.searchParams = new URLSearchParams(
      "checkIn=2027-01-01&checkOut=2027-01-03&adults=2&children=0&rooms=1",
    );
    const totals = {
      baseInCents: 1000,
      finalInCents: 1000,
      childPolicyInCents: 0,
      petPolicyInCents: 0,
      promotionsInCents: 0,
      reservationFeesInCents: 0,
      embeddedFeesInCents: 0,
      toCollectFeesInCents: 0,
    };
    const quote = (id: number) => ({
      quoteKey: "1:" + id,
      ratePlanId: id,
      ratePlanName: "Rate " + id,
      total: 1000,
      quote: {
        ratePlanId: id,
        totals,
        stayPricing: {
          dailyBreakdown: [],
          promotionApplications: { once: [], dailyByDate: {} },
          promotionCatalog: {},
          feeApplications: { once: [], dailyByDate: {} },
          feeCatalog: {},
          childPolicyApplications: { dailyByDate: {} },
          childPolicyCatalog: {},
          petPolicyApplications: { dailyByDate: {} },
          petPolicyCatalog: {},
        },
      },
    });
    const initialResult = {
      roomCards: [
        {
          roomCategoryId: 1,
          name: "Room",
          category: { id: 1, name: "Room" },
          maxOccupancy: 2,
          maxAdultOccupancy: 2,
          maxChildOccupancy: 0,
          availability: 4,
          plans: [quote(10), quote(11)],
        },
      ],
      initialSelectedQuantities: { "1:10": 1 },
      defaultSelection: new Map([[1, 10]]),
      recommendedCombination: [],
    };
    const props: any = {
      locale: "en",
      footerData: null,
      bookingFormCopy: null,
      initialResult,
      initialCriteriaKey: "hydrate",
    };
    // Supply the exact hydration key so the initial backend search is not repeated.
    const { serializeBookingSearchParams, parseBookingSearchParams } =
      await import("../src/core/booking-results");
    props.initialCriteriaKey = serializeBookingSearchParams(
      parseBookingSearchParams(runtime.searchParams),
    );
    const hook = mount(() => useBookingResults(props, runtime));
    await act(async () => vi.advanceTimersByTimeAsync(450));
    const result = (amount: number) => ({
      data: {
        ratePlanId: 10,
        selectedAccommodations: [],
        totals: { ...totals, finalInCents: amount },
      },
    });
    await act(async () => pending[0](result(1000)));
    expect(hook.current.selectionPreview?.totals.finalInCents).toBe(1000);
    expect(hook.current.checkoutHref).toBeTruthy();
    act(() => hook.current.setQuantity("1:10", 2));
    expect(hook.current.selectionPreview).toBeNull();
    expect(hook.current.checkoutHref).toBeNull();
    expect(hook.current.selectionPreviewLoading).toBe(true);
    await act(async () => vi.advanceTimersByTimeAsync(450));
    act(() => {
      hook.current.setQuantity("1:10", 0);
      hook.current.setQuantity("1:11", 1);
    });
    expect(hook.current.checkoutHref).toBeNull();
    await act(async () => pending[1](result(2000)));
    expect(hook.current.selectionPreview).toBeNull();
    await act(async () => vi.advanceTimersByTimeAsync(450));
    await act(async () =>
      pending[2]({
        ...result(3000),
        data: { ...result(3000).data, ratePlanId: 11 },
      }),
    );
    expect(hook.current.selectionPreview?.ratePlanId).toBe(11);
    expect(hook.current.checkoutHref).toBeTruthy();
    hook.unmount();
  } finally {
    vi.useRealTimers();
  }
});
it("owns cancellation preview, submission and local reservation refresh without duplicate submissions", async () => {
  const reservation = {
    id: "r",
    status: "Confirmed",
    pricing: {
      totals: { finalInCents: 10000 },
      stayPricing: {
        dailyBreakdown: {},
        promotionApplications: { once: [], dailyByDate: {} },
        promotionCatalog: {},
        feeApplications: { once: [], dailyByDate: {} },
        feeCatalog: {},
      },
    },
  };
  let resolve: any;
  const cancel = vi.fn(() => new Promise((r) => (resolve = r)));
  const response = {
    reservationId: "r",
    status: "Cancelled",
    penaltyInCents: 2000,
    refundAmountInCents: 4000,
    isPenaltyApplied: true,
  };
  const runtime = context({
    actionGetMyReservation: vi.fn().mockResolvedValue({ data: reservation }),
    actionGetMyReservationFinancialDetails: vi
      .fn()
      .mockResolvedValue({
        data: {
          summary: {
            reservationValueInCents: 10000,
            totalWithLocalFeesInCents: 10000,
            paidInCents: 6000,
            openBalanceInCents: 4000,
          },
          statement: { lines: [] },
        },
      }),
    actionGetBookingReservationObligation: vi
      .fn()
      .mockResolvedValue({ data: null }),
    actionListMyReservationRefundRequests: vi
      .fn()
      .mockResolvedValue({ data: { data: [] } }),
    actionPreviewMyReservationCancellation: vi
      .fn()
      .mockResolvedValue({ data: response }),
    actionCancelMyReservation: cancel,
  });
  const hook = mount(() =>
    useMyReservation(
      {
        reservationId: "r",
        locale: "en",
      },
      runtime,
    ),
  );
  await act(async () => {});
  await act(async () => hook.current.loadCancellationPreview());
  expect(hook.current.cancellationPreview?.settlementTotalInCents).toBe(2000);
  let first: any;
  act(() => {
    first = hook.current.confirmCancellation();
    void hook.current.confirmCancellation();
  });
  expect(cancel).toHaveBeenCalledTimes(1);
  await act(async () => {
    resolve({ data: response });
    await first;
  });
  expect(hook.current.cancellationState.result?.status).toBe("Cancelled");
  expect(hook.current.cancellationState.submitting).toBe(false);
  hook.unmount();
});

it('blocks checkout when current quote policies are missing instead of using an old catalogue',async()=>{
 const create=vi.fn();const stale=vi.fn().mockResolvedValue({data:{ratePlans:[{id:10,commercialPolicies:{stale:true}}]}});
 const runtime=context({actionPreviewBookingSelection:vi.fn().mockResolvedValue({data:{paymentOptions:{ratePlanReference:10}}}),actionGetReservationPolicies:stale,actionCreateBookingPreReservation:create});
 const initialState={criteria:{checkIn:'2027-01-01',checkOut:'2027-01-02',adults:2,children:0,rooms:1},items:[{roomCategoryId:1,ratePlanId:10,quantity:1}],summary:{selectedCount:1,totalValue:100,totalCapacity:2},hasMixedPlans:false} as any;
 const hook=mount(()=>useBookingCheckout({initialState,initialAuthenticatedUser:null,footerData:null,locale:'en'},runtime));await act(async()=>{});
 expect(hook.current.selectionPreview).toBeNull();expect(hook.current.selectionPreviewError).toBe('errors.selectionPreview');expect(stale).not.toHaveBeenCalled();
 act(()=>{hook.current.setAuthChoice('guest');hook.current.setFormData({fullName:'Guest',email:'guest@example.test',phone:'12345',notes:''})});await act(async()=>hook.current.submit());expect(create).not.toHaveBeenCalled();hook.unmount();
});
