import type { BookingServerContext, Translator, ActionResult } from "./context";
import { bindBookingSdk, translateApiError } from "./context";
type AppLocale = string;
import type {
  BookingEngineReservationCancellationPreviewResponse,
  ApiErrorResponse,
  CreateGuestModificationRequest,
  CreateGuestRefundRequest,
  GuestModificationRequestListResponse,
  GuestModificationRequestPreviewResponse,
  GuestModificationRequestResponse,
  GuestRefundRequestListResponse,
  GuestRefundRequestResponse,
  GuestReservationListResponse,
  Reservation,
  ReservationFinancialDetails,
  UpdateGuestReservationNotesRequest,
} from "../sdk/types.gen";
type ActionTranslator = Translator;

export function createMyReservationsActionsOperations(
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

  const getAuthHeaders = async (
    t: ActionTranslator,
    fallbackKey = "actionErrors.auth.sessionExpired",
  ): Promise<ActionResult<{ Authorization: string }>> => {
    const session = await recoverBookingAuthSession();
    if (!session) return { error: t(fallbackKey) };
    return { data: { Authorization: `Bearer ${session.accessToken}` } };
  };
  const withLocaleHeaders = (
    locale: AppLocale,
    headers?: Record<string, string>,
  ) => ({
    ...headers,
    ...bookingApiLocaleHeaders(locale),
  });
  const getApiErrorMessage = (
    t: ActionTranslator,
    payload: unknown,
    fallbackKey: string,
  ) => {
    return translateApiError(
      t,
      payload as ApiErrorResponse | undefined,
      fallbackKey,
    );
  };
  const modificationStatusChangedMessage = (locale: AppLocale) =>
    translateUi(
      String(locale).toLowerCase().startsWith("pt") ? "pt" : "en",
      "my_reservations_actions.thisReservationIsNoLongerAvailableForModificationTheReservationDetailsHaveBeenRefreshed",
    );
  const isReservationModificationStatusConflict = (
    payload: unknown,
  ): boolean => {
    const error = payload as ApiErrorResponse | undefined;
    const conflictData = error?.code.data as
      | { kind?: string }
      | null
      | undefined;

    return (
      error?.code.type === "conflict" &&
      conflictData?.kind === "reservation_update_not_allowed_for_status"
    );
  };
  const reservationModificationStatusConflict = (locale: AppLocale) => {
    refresh();
    return {
      error: modificationStatusChangedMessage(locale),
      reason: "reservation_not_modifiable" as const,
    };
  };
  async function actionListMyReservations({
    locale,
    page = 1,
    perPage = 20,
  }: {
    locale: AppLocale;
    page?: number;
    perPage?: number;
  }): Promise<ActionResult<GuestReservationListResponse>> {
    const t = await getActionTranslator(locale);
    const headers = await getAuthHeaders(
      t,
      "actionErrors.auth.sessionExpiredReservations",
    );
    if (headers.error) return { error: headers.error };

    const response = await bookingEngineApi.listGuestReservations({
      headers: withLocaleHeaders(locale, headers.data),
      path: { client_id: BOOKING_CLIENT_ID },
      query: { page, perPage },
    });

    if (response.response.status === 204) {
      return { data: { data: [], total: 0 } };
    }

    if (response.error || !response.data) {
      return {
        error: getApiErrorMessage(
          t,
          response.error,
          "actionErrors.myReservations.loadList",
        ),
      };
    }

    return { data: response.data as GuestReservationListResponse };
  }
  async function actionGetMyReservation(
    reservationId: string,
    locale: AppLocale,
  ): Promise<ActionResult<Reservation>> {
    const t = await getActionTranslator(locale);
    const headers = await getAuthHeaders(t);
    if (headers.error) return { error: headers.error };

    const response = await bookingEngineApi.getGuestReservationById({
      headers: withLocaleHeaders(locale, headers.data),
      path: { client_id: BOOKING_CLIENT_ID, reservation_id: reservationId },
    });

    if (response.response.status === 404) {
      return { error: t("actionErrors.myReservations.notFound") };
    }

    if (response.error || !response.data) {
      return {
        error: getApiErrorMessage(
          t,
          response.error,
          "actionErrors.myReservations.loadDetail",
        ),
      };
    }

    return { data: response.data as Reservation };
  }
  async function actionGetMyReservationFinancialDetails(
    reservationId: string,
    locale: AppLocale,
  ): Promise<ActionResult<ReservationFinancialDetails>> {
    const t = await getActionTranslator(locale);
    const headers = await getAuthHeaders(
      t,
      "actionErrors.auth.sessionExpiredReservation",
    );
    if (headers.error) return { error: headers.error };

    const response = await bookingEngineApi.getGuestReservationFinancialDetails(
      {
        headers: withLocaleHeaders(locale, headers.data),
        path: { client_id: BOOKING_CLIENT_ID, reservation_id: reservationId },
      },
    );

    if (response.error || !response.data) {
      return {
        error: getApiErrorMessage(
          t,
          response.error,
          "actionErrors.myReservations.financialDetails",
        ),
      };
    }

    return { data: response.data as ReservationFinancialDetails };
  }
  async function actionPreviewMyReservationCancellation(
    reservationId: string,
    locale: AppLocale,
  ): Promise<
    ActionResult<BookingEngineReservationCancellationPreviewResponse>
  > {
    const t = await getActionTranslator(locale);
    const headers = await getAuthHeaders(t);
    if (headers.error) return { error: headers.error };

    const response = await bookingEngineApi.previewGuestReservationCancellation(
      {
        headers: withLocaleHeaders(locale, headers.data),
        path: { client_id: BOOKING_CLIENT_ID, reservation_id: reservationId },
      },
    );

    if (response.error || !response.data) {
      return {
        error: getApiErrorMessage(
          t,
          response.error,
          "actionErrors.myReservations.cancellationPreview",
        ),
      };
    }

    return {
      data: response.data as BookingEngineReservationCancellationPreviewResponse,
    };
  }
  async function actionCancelMyReservation(
    reservationId: string,
    locale: AppLocale,
  ): Promise<
    ActionResult<BookingEngineReservationCancellationPreviewResponse>
  > {
    const t = await getActionTranslator(locale);
    const headers = await getAuthHeaders(t);
    if (headers.error) return { error: headers.error };

    const response = await bookingEngineApi.cancelGuestReservation({
      headers: withLocaleHeaders(locale, headers.data),
      path: { client_id: BOOKING_CLIENT_ID, reservation_id: reservationId },
    });

    if (response.error || !response.data) {
      return {
        error: getApiErrorMessage(
          t,
          response.error,
          "actionErrors.myReservations.cancelReservation",
        ),
      };
    }

    return {
      data: response.data as BookingEngineReservationCancellationPreviewResponse,
    };
  }
  async function actionUpdateMyReservationNotes({
    locale,
    notes,
    reservationId,
  }: UpdateGuestReservationNotesRequest & {
    locale: AppLocale;
    reservationId: string;
  }): Promise<ActionResult<unknown>> {
    const t = await getActionTranslator(locale);
    const headers = await getAuthHeaders(t);
    if (headers.error) return { error: headers.error };

    const response = await bookingEngineApi.updateGuestReservationNotes({
      body: { notes },
      headers: withLocaleHeaders(locale, headers.data),
      path: { client_id: BOOKING_CLIENT_ID, reservation_id: reservationId },
    });

    if (response.error) {
      return {
        error: getApiErrorMessage(
          t,
          response.error,
          "actionErrors.myReservations.saveNotes",
        ),
      };
    }

    return { data: response.data ?? true };
  }
  async function actionListMyReservationModificationRequests(
    reservationId: string,
    locale: AppLocale,
  ): Promise<ActionResult<GuestModificationRequestListResponse>> {
    const t = await getActionTranslator(locale);
    const headers = await getAuthHeaders(t);
    if (headers.error) return { error: headers.error };

    const response = await bookingEngineApi.listGuestModificationRequests({
      headers: withLocaleHeaders(locale, headers.data),
      path: { client_id: BOOKING_CLIENT_ID, reservation_id: reservationId },
    });

    if (response.response.status === 204) {
      return { data: { data: [] } };
    }

    if (response.error || !response.data) {
      return {
        error: getApiErrorMessage(
          t,
          response.error,
          "actionErrors.myReservations.loadModificationRequests",
        ),
      };
    }

    return { data: response.data as GuestModificationRequestListResponse };
  }
  async function actionPreviewMyReservationModificationRequest({
    locale,
    payload,
    reservationId,
  }: {
    locale: AppLocale;
    payload: CreateGuestModificationRequest;
    reservationId: string;
  }): Promise<ActionResult<GuestModificationRequestPreviewResponse>> {
    const t = await getActionTranslator(locale);
    const headers = await getAuthHeaders(t);
    if (headers.error) return { error: headers.error };

    const response = await bookingEngineApi.previewGuestModificationRequest({
      body: payload,
      headers: withLocaleHeaders(locale, headers.data),
      path: { client_id: BOOKING_CLIENT_ID, reservation_id: reservationId },
    });

    if (isReservationModificationStatusConflict(response.error)) {
      return reservationModificationStatusConflict(locale);
    }

    if (response.error || !response.data) {
      return {
        error: getApiErrorMessage(
          t,
          response.error,
          "actionErrors.myReservations.previewModification",
        ),
      };
    }

    return { data: response.data as GuestModificationRequestPreviewResponse };
  }
  async function actionCreateMyReservationModificationRequest({
    locale,
    payload,
    reservationId,
  }: {
    locale: AppLocale;
    payload: CreateGuestModificationRequest;
    reservationId: string;
  }): Promise<ActionResult<GuestModificationRequestResponse>> {
    const t = await getActionTranslator(locale);
    const headers = await getAuthHeaders(t);
    if (headers.error) return { error: headers.error };

    const response = await bookingEngineApi.createGuestModificationRequest({
      body: payload,
      headers: withLocaleHeaders(locale, headers.data),
      path: { client_id: BOOKING_CLIENT_ID, reservation_id: reservationId },
    });

    if (isReservationModificationStatusConflict(response.error)) {
      return reservationModificationStatusConflict(locale);
    }

    if (response.response.status === 409) {
      return { error: t("actionErrors.myReservations.pendingModification") };
    }

    if (response.error || !response.data) {
      return {
        error: getApiErrorMessage(
          t,
          response.error,
          "actionErrors.myReservations.createModification",
        ),
      };
    }

    return { data: response.data as GuestModificationRequestResponse };
  }
  async function actionCancelMyReservationModificationRequest({
    locale,
    requestId,
    reservationId,
  }: {
    locale: AppLocale;
    requestId: string;
    reservationId: string;
  }): Promise<ActionResult<true>> {
    const t = await getActionTranslator(locale);
    const headers = await getAuthHeaders(t);
    if (headers.error) return { error: headers.error };

    const response = await bookingEngineApi.cancelGuestModificationRequest({
      headers: withLocaleHeaders(locale, headers.data),
      path: {
        client_id: BOOKING_CLIENT_ID,
        request_id: requestId,
        reservation_id: reservationId,
      },
    });

    if (response.response.status === 204 || !response.error) {
      return { data: true };
    }

    return {
      error: getApiErrorMessage(
        t,
        response.error,
        "actionErrors.myReservations.cancelModification",
      ),
    };
  }
  async function actionRespondMyReservationModificationCounterproposal({
    action,
    locale,
    requestId,
    reservationId,
  }: {
    action: "accept" | "decline";
    locale: AppLocale;
    requestId: string;
    reservationId: string;
  }): Promise<ActionResult<true>> {
    const t = await getActionTranslator(locale);
    const headers = await getAuthHeaders(t);
    if (headers.error) return { error: headers.error };

    const path = {
      client_id: BOOKING_CLIENT_ID,
      request_id: requestId,
      reservation_id: reservationId,
    };
    const response =
      action === "accept"
        ? await bookingEngineApi.acceptGuestModificationCounterproposal({
            headers: withLocaleHeaders(locale, headers.data),
            path,
          })
        : await bookingEngineApi.declineGuestModificationCounterproposal({
            headers: withLocaleHeaders(locale, headers.data),
            path,
          });

    if (
      action === "accept" &&
      isReservationModificationStatusConflict(response.error)
    ) {
      return reservationModificationStatusConflict(locale);
    }

    if (response.response.status === 204 || !response.error) {
      return { data: true };
    }

    return {
      error: getApiErrorMessage(
        t,
        response.error,
        "actionErrors.myReservations.respondCounterproposal",
      ),
    };
  }
  async function actionListMyReservationRefundRequests(
    reservationId: string,
    locale: AppLocale,
  ): Promise<ActionResult<GuestRefundRequestListResponse>> {
    const t = await getActionTranslator(locale);
    const headers = await getAuthHeaders(t);
    if (headers.error) return { error: headers.error };

    const response = await bookingEngineApi.listGuestRefundRequests({
      headers: withLocaleHeaders(locale, headers.data),
      path: { client_id: BOOKING_CLIENT_ID, reservation_id: reservationId },
    });

    if (response.error || !response.data) {
      return {
        error: getApiErrorMessage(
          t,
          response.error,
          "actionErrors.myReservations.loadRefunds",
        ),
      };
    }

    return { data: response.data as GuestRefundRequestListResponse };
  }
  async function actionCreateMyReservationRefundRequest({
    locale,
    payload,
    reservationId,
  }: {
    locale: AppLocale;
    payload: CreateGuestRefundRequest;
    reservationId: string;
  }): Promise<ActionResult<GuestRefundRequestResponse>> {
    const t = await getActionTranslator(locale);
    const headers = await getAuthHeaders(t);
    if (headers.error) return { error: headers.error };

    const response = await bookingEngineApi.createGuestRefundRequest({
      body: payload,
      headers: withLocaleHeaders(locale, headers.data),
      path: { client_id: BOOKING_CLIENT_ID, reservation_id: reservationId },
    });

    if (response.error || !response.data) {
      return {
        error: getApiErrorMessage(
          t,
          response.error,
          "actionErrors.myReservations.createRefund",
        ),
      };
    }

    return { data: response.data as GuestRefundRequestResponse };
  }
  return {
    actionListMyReservations,
    actionGetMyReservation,
    actionGetMyReservationFinancialDetails,
    actionPreviewMyReservationCancellation,
    actionCancelMyReservation,
    actionUpdateMyReservationNotes,
    actionListMyReservationModificationRequests,
    actionPreviewMyReservationModificationRequest,
    actionCreateMyReservationModificationRequest,
    actionCancelMyReservationModificationRequest,
    actionRespondMyReservationModificationCounterproposal,
    actionListMyReservationRefundRequests,
    actionCreateMyReservationRefundRequest,
  };
}
