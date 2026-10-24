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
  const preview = { paymentOptions: { ratePlanReference: 10 } };
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
  const event = { preventDefault: () => {} } as any;
  await act(async () => {
    await hook.current.handleSubmit(event);
  });
  await act(async () => {
    await hook.current.handleSubmit(event);
  });
  expect(create).toHaveBeenCalledTimes(2);
  expect(create.mock.calls[0][0].payload.idempotencyKey).toBe(
    create.mock.calls[1][0].payload.idempotencyKey,
  );
  act(() => hook.current.updateField("notes", "Changed request"));
  await act(async () => {
    await hook.current.handleSubmit(event);
  });
  expect(create.mock.calls[2][0].payload.idempotencyKey).not.toBe(
    create.mock.calls[0][0].payload.idempotencyKey,
  );
  hook.unmount();
});
