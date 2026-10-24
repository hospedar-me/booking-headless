import type { BookingServerContext, Translator, ActionResult } from "./context";
import { bindBookingSdk, translateApiError } from "./context";
type AppLocale = string;
import type {
  BookingEngineRequest,
  BookingEngineSearchResponse,
  AccommodationCategory,
  BookingEngineAccommodationCategoryCatalogItem,
  BookingEngineRatePlanCatalogItem,
  RatePlan,
} from "../sdk/types.gen";
export type BookingResultsActionData = {
  search: BookingEngineSearchResponse;
  categories: Array<
    AccommodationCategory | BookingEngineAccommodationCategoryCatalogItem
  >;
  ratePlans: Array<RatePlan | BookingEngineRatePlanCatalogItem>;
};
import { createAccommodationCategoryOperations } from "./accommodation-category";
import { createBookingEngineOperations } from "./booking-engine";
import { createRatePlanOperations } from "./rate-plan";
export function createBookingResultsOperations(context: BookingServerContext) {
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
  const { actionGetAccommodationCategories } =
    createAccommodationCategoryOperations(context);
  const { actionSearchBookingEngineOptions } =
    createBookingEngineOperations(context);
  const { actionGetRatePlans } = createRatePlanOperations(context);
  async function actionSearchBookingResults(
    input: BookingEngineRequest,
    locale: AppLocale,
  ): Promise<ActionResult<BookingResultsActionData>> {
    const t = await getActionTranslator(locale);

    try {
      const [search, categories, ratePlans] = await Promise.all([
        actionSearchBookingEngineOptions(input, locale),
        actionGetAccommodationCategories(locale),
        actionGetRatePlans(locale),
      ]);

      if (search.error) return { error: search.error };
      if (categories.error) return { error: categories.error };
      if (ratePlans.error) return { error: ratePlans.error };

      return {
        data: {
          search: search.data!,
          categories: categories.data!,
          ratePlans: ratePlans.data!,
        },
      };
    } catch (error) {
      logger.error(error);
      return {
        error: translateApiError(
          t,
          undefined,
          "errors.booking_results.aggregate",
        ),
      };
    }
  }
  return { actionSearchBookingResults };
}
