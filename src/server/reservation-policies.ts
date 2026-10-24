import type { BookingServerContext, Translator, ActionResult } from "./context";
import { bindBookingSdk, translateApiError } from "./context";
type AppLocale = string;
import type { BookingEngineReservationPoliciesResponse } from "../sdk/types.gen";

export function createReservationPoliciesOperations(
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

  async function actionGetReservationPolicies(
    locale: AppLocale,
  ): Promise<ActionResult<BookingEngineReservationPoliciesResponse>> {
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
      const response =
        await bookingEngineApi.getBookingEngineReservationPolicies({
          headers: bookingApiLocaleHeaders(locale),
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
        data: response.data as BookingEngineReservationPoliciesResponse,
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
  return { actionGetReservationPolicies };
}
