import type {
  BookingGuestDistributionParam,
  BookingSearchParams,
} from "./booking-results";
import type { SelectedPlanSummary } from "./booking-results-adapter";
import type { BookingEngineGuestDistributionRoom } from "../sdk/types.gen";

export const toGuestDistribution = (
  distribution?: BookingGuestDistributionParam[],
): BookingEngineGuestDistributionRoom[] | undefined => {
  if (!distribution?.length) return undefined;

  return distribution.map((room) => ({
    numAdults: room.adults,
    numChildren: room.childAges.length,
    childAges: [...room.childAges],
    numPets: room.pets?.length ?? 0,
    pets: (room.pets ?? []).map((pet) => ({ ...pet })),
  }));
};

export const buildSelectionAccommodations = (
  items: SelectedPlanSummary[],
): Array<{ accommodationCategoryId: number }> =>
  items.flatMap((item) =>
    Array.from({ length: item.quantity }, () => ({
      accommodationCategoryId: item.roomCategoryId,
    })),
  );

export const buildSelectionPreviewPayload = (
  criteria: BookingSearchParams,
  items: SelectedPlanSummary[],
  ratePlanId: number,
) => ({
  accommodations: buildSelectionAccommodations(items),
  checkInDate: criteria.checkIn ?? "",
  checkOutDate: criteria.checkOut ?? "",
  childAges: [...(criteria.childAges ?? [])],
  guestDistribution: toGuestDistribution(criteria.distribution),
  numAdults: criteria.adults,
  numChildren: criteria.children,
  promotionCode: criteria.promotionCode,
  numPets: criteria.pets?.length ?? 0,
  pets: (criteria.pets ?? []).map((pet) => ({ ...pet })),
  ratePlanId,
});
