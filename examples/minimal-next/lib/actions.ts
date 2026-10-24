"use server";
import { booking } from "./server";
export async function actionSearchBookingEngineOptions(
  ...args: Parameters<typeof booking.actionSearchBookingEngineOptions>
) {
  return booking.actionSearchBookingEngineOptions(...args);
}
export async function actionCreateBookingEnginePreReservation(
  ...args: Parameters<typeof booking.actionCreateBookingEnginePreReservation>
) {
  return booking.actionCreateBookingEnginePreReservation(...args);
}
export async function actionPreviewBookingEngineSelection(
  ...args: Parameters<typeof booking.actionPreviewBookingEngineSelection>
) {
  return booking.actionPreviewBookingEngineSelection(...args);
}
export async function actionDistributeBookingEngineGuests(
  ...args: Parameters<typeof booking.actionDistributeBookingEngineGuests>
) {
  return booking.actionDistributeBookingEngineGuests(...args);
}
export async function actionGetAccommodationCategories(
  ...args: Parameters<typeof booking.actionGetAccommodationCategories>
) {
  return booking.actionGetAccommodationCategories(...args);
}
export async function actionGetRatePlans(
  ...args: Parameters<typeof booking.actionGetRatePlans>
) {
  return booking.actionGetRatePlans(...args);
}
export async function actionSearchBookingResults(
  ...args: Parameters<typeof booking.actionSearchBookingResults>
) {
  return booking.actionSearchBookingResults(...args);
}
export async function actionPreviewBookingSelection(
  ...args: Parameters<typeof booking.actionPreviewBookingSelection>
) {
  return booking.actionPreviewBookingSelection(...args);
}
export async function actionCreateBookingPreReservation(
  ...args: Parameters<typeof booking.actionCreateBookingPreReservation>
) {
  return booking.actionCreateBookingPreReservation(...args);
}
export async function actionGetBookingPaymentSession(
  ...args: Parameters<typeof booking.actionGetBookingPaymentSession>
) {
  return booking.actionGetBookingPaymentSession(...args);
}
export async function actionCreateBookingPixInstruction(
  ...args: Parameters<typeof booking.actionCreateBookingPixInstruction>
) {
  return booking.actionCreateBookingPixInstruction(...args);
}
export async function actionCreateBookingCardSession(
  ...args: Parameters<typeof booking.actionCreateBookingCardSession>
) {
  return booking.actionCreateBookingCardSession(...args);
}
export async function actionGetBookingReservationObligation(
  ...args: Parameters<typeof booking.actionGetBookingReservationObligation>
) {
  return booking.actionGetBookingReservationObligation(...args);
}
export async function actionStartBookingAuthorization(
  ...args: Parameters<typeof booking.actionStartBookingAuthorization>
) {
  return booking.actionStartBookingAuthorization(...args);
}
export async function actionGetBookingAuthSession(
  ...args: Parameters<typeof booking.actionGetBookingAuthSession>
) {
  return booking.actionGetBookingAuthSession(...args);
}
export async function actionLogoutBookingAuthSession(
  ...args: Parameters<typeof booking.actionLogoutBookingAuthSession>
) {
  return booking.actionLogoutBookingAuthSession(...args);
}
export async function actionListMyReservations(
  ...args: Parameters<typeof booking.actionListMyReservations>
) {
  return booking.actionListMyReservations(...args);
}
export async function actionGetMyReservation(
  ...args: Parameters<typeof booking.actionGetMyReservation>
) {
  return booking.actionGetMyReservation(...args);
}
export async function actionGetMyReservationFinancialDetails(
  ...args: Parameters<typeof booking.actionGetMyReservationFinancialDetails>
) {
  return booking.actionGetMyReservationFinancialDetails(...args);
}
export async function actionPreviewMyReservationCancellation(
  ...args: Parameters<typeof booking.actionPreviewMyReservationCancellation>
) {
  return booking.actionPreviewMyReservationCancellation(...args);
}
export async function actionCancelMyReservation(
  ...args: Parameters<typeof booking.actionCancelMyReservation>
) {
  return booking.actionCancelMyReservation(...args);
}
export async function actionUpdateMyReservationNotes(
  ...args: Parameters<typeof booking.actionUpdateMyReservationNotes>
) {
  return booking.actionUpdateMyReservationNotes(...args);
}
export async function actionListMyReservationModificationRequests(
  ...args: Parameters<
    typeof booking.actionListMyReservationModificationRequests
  >
) {
  return booking.actionListMyReservationModificationRequests(...args);
}
export async function actionPreviewMyReservationModificationRequest(
  ...args: Parameters<
    typeof booking.actionPreviewMyReservationModificationRequest
  >
) {
  return booking.actionPreviewMyReservationModificationRequest(...args);
}
export async function actionCreateMyReservationModificationRequest(
  ...args: Parameters<
    typeof booking.actionCreateMyReservationModificationRequest
  >
) {
  return booking.actionCreateMyReservationModificationRequest(...args);
}
export async function actionCancelMyReservationModificationRequest(
  ...args: Parameters<
    typeof booking.actionCancelMyReservationModificationRequest
  >
) {
  return booking.actionCancelMyReservationModificationRequest(...args);
}
export async function actionRespondMyReservationModificationCounterproposal(
  ...args: Parameters<
    typeof booking.actionRespondMyReservationModificationCounterproposal
  >
) {
  return booking.actionRespondMyReservationModificationCounterproposal(...args);
}
export async function actionListMyReservationRefundRequests(
  ...args: Parameters<typeof booking.actionListMyReservationRefundRequests>
) {
  return booking.actionListMyReservationRefundRequests(...args);
}
export async function actionCreateMyReservationRefundRequest(
  ...args: Parameters<typeof booking.actionCreateMyReservationRefundRequest>
) {
  return booking.actionCreateMyReservationRefundRequest(...args);
}
export async function actionGetReservationPolicies(
  ...args: Parameters<typeof booking.actionGetReservationPolicies>
) {
  return booking.actionGetReservationPolicies(...args);
}
