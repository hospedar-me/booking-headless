import type { BookingServerContext, Translator, ActionResult } from "./context";
import { bindBookingSdk, translateApiError } from "./context";
type AppLocale = string;
import type {
  CreatePreReservationRequest,
  PreReservationResponse,
} from "../sdk/types.gen";

export function createBookingCheckoutActionsOperations(
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

  async function actionCreateBookingPreReservation({
    locale,
    payload,
    useAuthenticatedUser = false,
  }: {
    locale: AppLocale;
    payload?: CreatePreReservationRequest;
    useAuthenticatedUser?: boolean;
  }): Promise<ActionResult<PreReservationResponse>> {
    const t = await getActionTranslator(locale);

    if (!payload) {
      return { error: t("actionErrors.bookingCheckout.missingPayload") };
    }

    let authHeaders: Record<string, string> | undefined;

    if (useAuthenticatedUser) {
      const session = await recoverBookingAuthSession();

      if (!session) {
        return { error: t("actionErrors.bookingCheckout.authExpired") };
      }

      authHeaders = { Authorization: `Bearer ${session.accessToken}` };
    }

    if (!BOOKING_CLIENT_ID) {
      return { error: t("actionErrors.bookingCheckout.createReservation") };
    }

    const response = await bookingEngineApi.createBookingEnginePreReservation({
      body: payload,
      headers: {
        ...bookingApiLocaleHeaders(locale),
        ...authHeaders,
      },
      path: { client_id: BOOKING_CLIENT_ID },
    });

    if (response.error || !response.data) {
      return { error: t("actionErrors.bookingCheckout.createReservation") };
    }

    return { data: response.data as PreReservationResponse };
  }
  return { actionCreateBookingPreReservation };
}
