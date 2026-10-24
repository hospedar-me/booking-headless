import type { BookingServerContext, Translator, ActionResult } from "./context";
import { bindBookingSdk, translateApiError } from "./context";
type AppLocale = string;
import type {
  BookingEngineSelectionPreviewResponse,
  BookingEngineSelectionPreviewRequest,
} from "../sdk/types.gen";
import { createBookingEngineOperations } from "./booking-engine";
export function createBookingSelectionActionsOperations(
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
  const { actionPreviewBookingEngineSelection } =
    createBookingEngineOperations(context);
  const isSupportedLocale = (value: string): value is AppLocale => {
    return (routing.locales as readonly string[]).includes(value);
  };
  const resolveLocale = (locale?: string): AppLocale => {
    return locale && isSupportedLocale(locale) ? locale : routing.defaultLocale;
  };
  async function actionPreviewBookingSelection({
    locale,
    payload,
  }: {
    locale?: string;
    payload?: BookingEngineSelectionPreviewRequest;
  }): Promise<ActionResult<BookingEngineSelectionPreviewResponse>> {
    const resolvedLocale = resolveLocale(locale);
    const t = await getActionTranslator(resolvedLocale);

    if (!payload) {
      return { error: t("actionErrors.bookingSelection.missingPayload") };
    }

    const response = await actionPreviewBookingEngineSelection(
      payload,
      resolvedLocale,
    );

    if (response.error || !response.data) {
      return { error: t("actionErrors.bookingSelection.preview") };
    }

    return { data: response.data };
  }
  return { actionPreviewBookingSelection };
}
