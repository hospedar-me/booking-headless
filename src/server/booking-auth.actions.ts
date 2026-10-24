import type { BookingServerContext, Translator, ActionResult } from "./context";
import { bindBookingSdk, translateApiError } from "./context";
type AppLocale = string;
import type { BookingFederatedSession } from "../models/auth";

export function createBookingAuthActionsOperations(
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

  async function actionStartBookingAuthorization(
    locale: AppLocale,
    returnPath?: string,
  ): Promise<ActionResult<{ authorizationUrl: string; state: string }>> {
    const t = await getActionTranslator(locale);

    try {
      return { data: await startBookingAuthorization(locale, returnPath) };
    } catch (error) {
      logger.error(
        { err: error },
        "Failed to start Booking Engine OIDC authorization",
      );
      return { error: t("actionErrors.bookingAuth.identification") };
    }
  }
  async function actionGetBookingAuthSession(
    locale: AppLocale,
  ): Promise<ActionResult<BookingFederatedSession>> {
    const t = await getActionTranslator(locale);
    const session = await recoverBookingAuthSession();

    if (!session) return { error: t("actionErrors.auth.sessionExpired") };
    return { data: session };
  }
  async function actionLogoutBookingAuthSession(
    locale: AppLocale,
  ): Promise<ActionResult<true>> {
    const t = await getActionTranslator(locale);

    try {
      await clearBookingAuthSession();
      return { data: true };
    } catch {
      return { error: t("actionErrors.bookingAuth.logout") };
    }
  }
  return {
    actionStartBookingAuthorization,
    actionGetBookingAuthSession,
    actionLogoutBookingAuthSession,
  };
}
