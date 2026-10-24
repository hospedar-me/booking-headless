import type { BookingServerContext, Translator, ActionResult } from "./context";
import { bindBookingSdk, translateApiError } from "./context";
type AppLocale = string;
import type {
  BookingEngineGuestDistributionRequest,
  BookingEngineGuestDistributionResponse,
  BookingEngineRequest,
  BookingEngineSelectionPreviewResponse,
  BookingEngineSearchResponse,
  BookingEngineSelectionPreviewRequest,
  CreatePreReservationRequest,
  PreReservationResponse,
} from "../sdk/types.gen";

export function createBookingEngineOperations(context: BookingServerContext) {
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

  const EMPTY_SEARCH_RESPONSE: BookingEngineSearchResponse = {
    accommodationCategoryOffers: [],
    recommendedCombination: [],
    paymentOptions: [],
  };
  const apiHeaders = (locale: AppLocale) => bookingApiLocaleHeaders(locale);
  async function actionSearchBookingEngineOptions(
    input: BookingEngineRequest,
    locale: AppLocale,
  ): Promise<ActionResult<BookingEngineSearchResponse>> {
    const t = await getActionTranslator(locale);

    if (!BOOKING_CLIENT_ID) {
      return {
        error: translateApiError(
          t,
          undefined,
          "errors.booking_engine.missing_client_id",
        ),
      };
    }

    if (!input.checkInDate || !input.checkOutDate) {
      return {
        error: translateApiError(
          t,
          undefined,
          "errors.booking_engine.search_options",
        ),
      };
    }

    try {
      const response = await bookingEngineApi.searchBookingEngineOptions({
        body: input,
        headers: apiHeaders(locale),
        path: { client_id: BOOKING_CLIENT_ID },
      });

      if (response.response.status === 204) {
        return { data: EMPTY_SEARCH_RESPONSE };
      }

      if (response.error) {
        logger.error(response.error);
        return {
          error: translateApiError(
            t,
            response.error,
            "errors.booking_engine.search_options",
          ),
        };
      }

      return {
        data:
          (response.data as BookingEngineSearchResponse | undefined) ??
          EMPTY_SEARCH_RESPONSE,
      };
    } catch (error) {
      logger.error(error);
      return {
        error: translateApiError(
          t,
          undefined,
          "errors.booking_engine.search_options",
        ),
      };
    }
  }
  async function actionCreateBookingEnginePreReservation(
    input: CreatePreReservationRequest,
    locale: AppLocale,
    useAuthenticatedUser = false,
  ): Promise<ActionResult<PreReservationResponse>> {
    const t = await getActionTranslator(locale);

    if (!BOOKING_CLIENT_ID) {
      return {
        error: translateApiError(
          t,
          undefined,
          "errors.booking_engine.missing_client_id",
        ),
      };
    }

    try {
      const session = useAuthenticatedUser
        ? await recoverBookingAuthSession()
        : null;
      if (useAuthenticatedUser && !session) {
        return {
          error: translateApiError(
            t,
            undefined,
            "actionErrors.auth.sessionExpired",
          ),
        };
      }

      const response = await bookingEngineApi.createBookingEnginePreReservation(
        {
          body: input,
          headers: {
            ...apiHeaders(locale),
            ...(session
              ? { Authorization: `Bearer ${session.accessToken}` }
              : {}),
          },
          path: { client_id: BOOKING_CLIENT_ID },
        },
      );

      if (response.error) {
        logger.error(response.error);
        return {
          error: translateApiError(
            t,
            response.error,
            "errors.booking_engine.search_options",
          ),
        };
      }

      return {
        data: response.data as PreReservationResponse,
      };
    } catch (error) {
      logger.error(error);
      return {
        error: translateApiError(
          t,
          undefined,
          "errors.booking_engine.search_options",
        ),
      };
    }
  }
  async function actionPreviewBookingEngineSelection(
    input: BookingEngineSelectionPreviewRequest,
    locale: AppLocale,
  ): Promise<ActionResult<BookingEngineSelectionPreviewResponse>> {
    const t = await getActionTranslator(locale);

    if (!BOOKING_CLIENT_ID) {
      return {
        error: translateApiError(
          t,
          undefined,
          "errors.booking_engine.missing_client_id",
        ),
      };
    }

    try {
      const response = await bookingEngineApi.previewBookingEngineSelection({
        body: input,
        headers: apiHeaders(locale),
        path: { client_id: BOOKING_CLIENT_ID },
      });

      if (response.error) {
        logger.error(response.error);
        return {
          error: translateApiError(
            t,
            response.error,
            "errors.booking_engine.search_options",
          ),
        };
      }

      return {
        data: response.data as BookingEngineSelectionPreviewResponse,
      };
    } catch (error) {
      logger.error(error);
      return {
        error: translateApiError(
          t,
          undefined,
          "errors.booking_engine.search_options",
        ),
      };
    }
  }
  async function actionDistributeBookingEngineGuests(
    input: BookingEngineGuestDistributionRequest,
    locale: AppLocale,
  ): Promise<ActionResult<BookingEngineGuestDistributionResponse>> {
    const t = await getActionTranslator(locale);

    if (!BOOKING_CLIENT_ID) {
      return {
        error: translateApiError(
          t,
          undefined,
          "errors.booking_engine.missing_client_id",
        ),
      };
    }

    try {
      const response = await bookingEngineApi.distributeBookingEngineGuests({
        body: input,
        headers: apiHeaders(locale),
        path: { client_id: BOOKING_CLIENT_ID },
      });

      if (response.error) {
        logger.error(response.error);
        return {
          error: translateApiError(
            t,
            response.error,
            "errors.booking_engine.search_options",
          ),
        };
      }

      return {
        data: response.data as BookingEngineGuestDistributionResponse,
      };
    } catch (error) {
      logger.error(error);
      return {
        error: translateApiError(
          t,
          undefined,
          "errors.booking_engine.search_options",
        ),
      };
    }
  }
  return {
    actionSearchBookingEngineOptions,
    actionCreateBookingEnginePreReservation,
    actionPreviewBookingEngineSelection,
    actionDistributeBookingEngineGuests,
  };
}
