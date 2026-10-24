import type { BookingSearchParams } from "./booking-results";
import type {
  BookingPriceComposition,
  SelectedPlanSummary,
} from "./booking-results-adapter";
import {
  buildSelectionAccommodations,
  toGuestDistribution,
} from "./booking-selection-request";
import { normalizeChildAges } from "./booking-results";
import type {
  CreatePreReservationRequest,
  RecommendedCombinationItem,
} from "../sdk/types.gen";

export type BookingCheckoutSummary = {
  selectedCount: number;
  totalCapacity: number;
  totalValue: number;
};

export type BookingCheckoutState = {
  criteria: BookingSearchParams;
  hasMixedPlans: boolean;
  items: SelectedPlanSummary[];
  recommendedCombination?: RecommendedCombinationItem[];
  priceComposition?: BookingPriceComposition;
  summary: BookingCheckoutSummary;
};

export type GuestCheckoutFormData = {
  email: string;
  fullName: string;
  notes: string;
  phone: string;
};

type BookingCheckoutValidationMessages = {
  datesRequired?: string;
  mixedPlans?: string;
  selectAccommodation?: string;
};

export class BookingCheckoutValidationError extends Error {
  constructor(
    readonly code: string,
    message = code,
    readonly params: Record<string, string | number> = {},
  ) {
    super(message);
    this.name = "BookingCheckoutValidationError";
  }
}

const BOOKING_CHECKOUT_STATE_PARAM = "state";

const isBookingCheckoutState = (
  value: unknown,
): value is BookingCheckoutState => {
  if (!value || typeof value !== "object") return false;

  const candidate = value as Partial<BookingCheckoutState>;

  if (!candidate.criteria || typeof candidate.criteria !== "object")
    return false;
  if (!candidate.summary || typeof candidate.summary !== "object") return false;
  if (!Array.isArray(candidate.items)) return false;
  if (typeof candidate.hasMixedPlans !== "boolean") return false;
  if (
    "childAges" in candidate.criteria &&
    candidate.criteria.childAges !== undefined &&
    (!Array.isArray(candidate.criteria.childAges) ||
      !candidate.criteria.childAges.every((value) => typeof value === "number"))
  ) {
    return false;
  }

  return candidate.items.every((item) => {
    if (!item || typeof item !== "object") return false;

    return (
      typeof item.quantity === "number" &&
      typeof item.quoteKey === "string" &&
      typeof item.ratePlanId === "number" &&
      typeof item.ratePlanName === "string" &&
      typeof item.roomCategoryId === "number" &&
      typeof item.roomName === "string" &&
      typeof item.subtotal === "number" &&
      typeof item.unitTotal === "number"
    );
  });
};

export const buildBookingCheckoutUrl = (
  locale: string,
  state: BookingCheckoutState,
): string | null => {
  if (state.items.length === 0) return null;

  const query = new URLSearchParams();
  query.set(BOOKING_CHECKOUT_STATE_PARAM, JSON.stringify(state));

  return `/${locale}/booking?${query.toString()}`;
};

export const parseBookingCheckoutState = (searchParams: {
  get: (key: string) => string | null;
}): BookingCheckoutState | null => {
  const rawState = searchParams.get(BOOKING_CHECKOUT_STATE_PARAM);
  if (!rawState) return null;

  try {
    const parsed = JSON.parse(rawState) as unknown;
    return isBookingCheckoutState(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

export const buildPreReservationRequest = (
  state: BookingCheckoutState,
  guest: GuestCheckoutFormData,
  validationMessages: BookingCheckoutValidationMessages = {},
): CreatePreReservationRequest => {
  if (state.items.length === 0) {
    throw new BookingCheckoutValidationError(
      "checkoutValidation.selectAccommodation",
      validationMessages.selectAccommodation,
    );
  }

  const ratePlanIds = Array.from(
    new Set(state.items.map((item) => item.ratePlanId)),
  );

  if (ratePlanIds.length !== 1) {
    throw new BookingCheckoutValidationError(
      "checkoutValidation.mixedPlans",
      validationMessages.mixedPlans,
    );
  }

  if (!state.criteria.checkIn || !state.criteria.checkOut) {
    throw new BookingCheckoutValidationError(
      "checkoutValidation.datesRequired",
      validationMessages.datesRequired,
    );
  }

  return {
    idempotencyKey: crypto.randomUUID(),
    accommodations: buildSelectionAccommodations(state.items),
    checkInDate: state.criteria.checkIn,
    checkOutDate: state.criteria.checkOut,
    childAges: normalizeChildAges(
      state.criteria.children,
      state.criteria.childAges,
    ),
    guestDistribution: toGuestDistribution(state.criteria.distribution),
    numAdults: state.criteria.adults,
    numChildren: state.criteria.children,
    numPets: state.criteria.pets?.length ?? 0,
    pets: state.criteria.pets ?? [],
    promotionCode: state.criteria.promotionCode?.trim() || undefined,
    primaryGuest: {
      email: guest.email,
      fullName: guest.fullName,
      notes: guest.notes || undefined,
      phone: guest.phone,
    },
    ratePlanId: ratePlanIds[0],
  };
};
