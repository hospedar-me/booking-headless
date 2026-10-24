import type { BookingServerContext, Translator, ActionResult } from "./context";
import { bindBookingSdk, translateApiError } from "./context";
type AppLocale = string;
import { randomUUID } from "node:crypto";
import type {
  BookingCardSession,
  BookingPaymentContext,
  BookingPaymentSession,
} from "../core/booking-payment";
import type {
  BookingEnginePixInstructionResponse,
  BookingEngineReservationBalancePixInstructionResponse,
  CreateBookingEngineCardSessionRequest,
  CreateBookingEnginePixInstructionRequest,
} from "../sdk/types.gen";
type ActionTranslator = Translator;
type PaymentTarget = {
  obligationId?: string;
  context: BookingPaymentContext;
  id: string;
  locale: AppLocale;
};

export function createBookingPaymentActionsOperations(
  context: BookingServerContext,
) {
  const routing = {
    locales: context.locales,
    defaultLocale: context.defaultLocale,
  };
  const BOOKING_CLIENT_ID = context.clientId;
  const bookingEngineApi = bindBookingSdk(context);
  const logger = context.logger || { error: (..._args: unknown[]) => {} };
  const bookingApiLocaleHeaders = context.localeHeaders;
  const getActionTranslator = context.getTranslator;
  const recoverBookingAuthSession = context.auth.getSession;
  const clearBookingAuthSession = context.auth.logout;
  const startBookingAuthorization = context.auth.start;
  const refresh = context.refresh || (() => {});
  const translateUi = context.translate;

  const resolveAuthHeaders = async () => {
    const session = await recoverBookingAuthSession();
    if (!session) return null;
    return { Authorization: `Bearer ${session.accessToken}` };
  };
  const withLocaleHeaders = (
    locale: AppLocale,
    headers?: Record<string, string>,
  ) => ({
    ...headers,
    ...bookingApiLocaleHeaders(locale),
  });
  const withIdempotencyHeaders = (
    locale: AppLocale,
    headers?: Record<string, string>,
    idempotencyKey: string = randomUUID(),
  ) => ({
    ...withLocaleHeaders(locale, headers),
    "Idempotency-Key": idempotencyKey,
  });
  async function actionGetBookingPaymentSession({
    context,
    id,
    locale,
    obligationId,
  }: PaymentTarget): Promise<ActionResult<BookingPaymentSession>> {
    const t: ActionTranslator = await getActionTranslator(locale);
    if (!id)
      return { error: t("actionErrors.bookingPayment.identifyReservation") };
    if (!BOOKING_CLIENT_ID)
      return { error: t("actionErrors.bookingPayment.load") };

    if (context === "reservation_balance") {
      const headers = await resolveAuthHeaders();
      if (!headers) return { error: t("actionErrors.auth.sessionExpired") };

      const response =
        await bookingEngineApi.getGuestReservationBalancePaymentSession({
          headers: withLocaleHeaders(locale, headers),
          path: { client_id: BOOKING_CLIENT_ID, reservation_id: id },
          query: { obligationId },
        });

      if (response.error || !response.data)
        return { error: t("actionErrors.bookingPayment.load") };
      return { data: response.data };
    }

    const response =
      await bookingEngineApi.getBookingEnginePreReservationPaymentSession({
        headers: bookingApiLocaleHeaders(locale),
        path: { client_id: BOOKING_CLIENT_ID, pre_reservation_id: id },
      });

    if (response.error || !response.data)
      return { error: t("actionErrors.bookingPayment.load") };
    return { data: response.data };
  }
  async function actionCreateBookingPixInstruction({
    context,
    id,
    locale,
    obligationId,
    payload,
    idempotencyKey,
  }: PaymentTarget & {
    payload?: CreateBookingEnginePixInstructionRequest;
    idempotencyKey?: string;
  }): Promise<
    ActionResult<
      | BookingEnginePixInstructionResponse
      | BookingEngineReservationBalancePixInstructionResponse
    >
  > {
    const t: ActionTranslator = await getActionTranslator(locale);
    if (!id)
      return { error: t("actionErrors.bookingPayment.identifyReservation") };
    if (!payload?.paymentMethodId)
      return { error: t("actionErrors.bookingPayment.paymentMethod") };
    if (!payload?.payer)
      return { error: t("actionErrors.bookingPayment.payer") };
    if (!BOOKING_CLIENT_ID)
      return { error: t("actionErrors.bookingPayment.action") };

    if (context === "reservation_balance") {
      const headers = await resolveAuthHeaders();
      if (!headers) return { error: t("actionErrors.auth.sessionExpired") };

      const response =
        await bookingEngineApi.createGuestReservationBalancePixInstruction({
          body: {
            ...payload,
            obligationId: obligationId ?? payload.obligationId,
          },
          headers: withIdempotencyHeaders(locale, headers, idempotencyKey),
          path: { client_id: BOOKING_CLIENT_ID, reservation_id: id },
        });

      if (response.error || !response.data)
        return { error: t("actionErrors.bookingPayment.action") };
      return { data: response.data };
    }

    const response = await bookingEngineApi.createBookingEnginePixInstruction({
      body: payload,
      headers: withIdempotencyHeaders(locale, undefined, idempotencyKey),
      path: { client_id: BOOKING_CLIENT_ID, pre_reservation_id: id },
    });

    if (response.error || !response.data)
      return { error: t("actionErrors.bookingPayment.action") };
    return { data: response.data };
  }
  async function actionCreateBookingCardSession({
    context,
    id,
    locale,
    obligationId,
    payload,
  }: PaymentTarget & {
    payload?: CreateBookingEngineCardSessionRequest;
  }): Promise<ActionResult<BookingCardSession>> {
    const t: ActionTranslator = await getActionTranslator(locale);
    if (!id)
      return { error: t("actionErrors.bookingPayment.identifyReservation") };
    if (!payload?.paymentMethodId)
      return { error: t("actionErrors.bookingPayment.paymentMethod") };
    if (!payload?.payer)
      return { error: t("actionErrors.bookingPayment.payer") };
    if (!BOOKING_CLIENT_ID)
      return { error: t("actionErrors.bookingPayment.action") };

    if (context === "reservation_balance") {
      const headers = await resolveAuthHeaders();
      if (!headers) return { error: t("actionErrors.auth.sessionExpired") };

      const response =
        await bookingEngineApi.createGuestReservationBalanceCardSession({
          body: {
            ...payload,
            obligationId: obligationId ?? payload.obligationId,
          },
          headers: withIdempotencyHeaders(locale, headers),
          path: { client_id: BOOKING_CLIENT_ID, reservation_id: id },
        });

      if (response.error || !response.data)
        return { error: t("actionErrors.bookingPayment.action") };
      return { data: response.data };
    }

    const response = await bookingEngineApi.createBookingEngineCardSession({
      body: payload,
      headers: withIdempotencyHeaders(locale),
      path: { client_id: BOOKING_CLIENT_ID, pre_reservation_id: id },
    });

    if (response.error || !response.data)
      return { error: t("actionErrors.bookingPayment.action") };
    return { data: response.data };
  }
  async function actionGetBookingReservationObligation(
    reservationId: string,
    locale: AppLocale,
  ): Promise<
    ActionResult<
      import("../sdk/types.gen").ReservationPaymentObligationResponse
    >
  > {
    const t = await getActionTranslator(locale);
    const headers = await resolveAuthHeaders();
    if (!headers) return { error: t("actionErrors.auth.sessionExpired") };
    const response =
      await bookingEngineApi.getGuestReservationPaymentObligation({
        headers: withLocaleHeaders(locale, headers),
        path: { client_id: BOOKING_CLIENT_ID, reservation_id: reservationId },
      });
    if (response.error || !response.data)
      return { error: t("actionErrors.bookingPayment.load") };
    return { data: response.data };
  }
  return {
    actionGetBookingPaymentSession,
    actionCreateBookingPixInstruction,
    actionCreateBookingCardSession,
    actionGetBookingReservationObligation,
  };
}
