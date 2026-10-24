export * from "./server/context";
import { createBookingEngineOperations } from "./server/booking-engine";
import { createAccommodationCategoryOperations } from "./server/accommodation-category";
import { createRatePlanOperations } from "./server/rate-plan";
import { createBookingResultsOperations } from "./server/booking-results";
import { createBookingSelectionActionsOperations } from "./server/booking-selection.actions";
import { createBookingCheckoutActionsOperations } from "./server/booking-checkout.actions";
import { createBookingPaymentActionsOperations } from "./server/booking-payment.actions";
import { createBookingAuthActionsOperations } from "./server/booking-auth.actions";
import { createMyReservationsActionsOperations } from "./server/my-reservations.actions";
import { createReservationPoliciesOperations } from "./server/reservation-policies";
import type { BookingServerContext } from "./server/context";
export function createBookingOperations(context: BookingServerContext) {
  return {
    ...createBookingEngineOperations(context),
    ...createAccommodationCategoryOperations(context),
    ...createRatePlanOperations(context),
    ...createBookingResultsOperations(context),
    ...createBookingSelectionActionsOperations(context),
    ...createBookingCheckoutActionsOperations(context),
    ...createBookingPaymentActionsOperations(context),
    ...createBookingAuthActionsOperations(context),
    ...createMyReservationsActionsOperations(context),
    ...createReservationPoliciesOperations(context),
  };
}
export type BookingOperations = ReturnType<typeof createBookingOperations>;

export * from "./server/oidc";
export { PublicContentCache } from "./server/public-content-cache";
