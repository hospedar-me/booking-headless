"use client";
import type { HookContext } from "./context";
type AppLocale = string;
const translateUi = (_locale: string, key: string) => key;
import { useEffect, useMemo, useRef, useState } from "react";
import { buildBookingCheckoutUrl } from "../core/booking-checkout";
import { buildSelectionPreviewPayload } from "../core/booking-selection-request";
import {
  filterByCategory,
  filterByPriceRange,
  filterByRatePlan,
  filterByRoomsCount,
  getFilterMetadata,
  parseBookingSearchParams,
  searchBookingAvailabilities as searchAvailabilities,
  serializeBookingSearchParams,
  sortOptions,
  type BookingResultsSort,
  type BookingSearchResult,
} from "../core/booking-results";
import {
  aggregatePriceComposition,
  buildSelectionPriceComposition,
  buildSelectedPlanSummaries,
  resolveSelectedItemTotalsFromSelection,
  type BookingRoomCardVM,
  hasMixedRatePlans,
} from "../core/booking-results-adapter";
import type {
  BookingFormCategoryOption,
  BookingFormCopyViewData,
  BookingFormRatePlanOption,
  FooterViewData,
  HeroViewData,
} from "../models/home";
import type { BookingEngineQuoteSelection } from "../sdk/types.gen";
type ResultsPageProps = {
  locale: AppLocale;
  bookingFormCopy: BookingFormCopyViewData;
  footerData: FooterViewData;
  heroData?: HeroViewData;
  categoryOptions?: BookingFormCategoryOption[];
  ratePlanOptions?: BookingFormRatePlanOption[];
  initialResult?: BookingSearchResult;
  initialError?: string | null;
  initialCriteriaKey?: string;
};
export const useBookingResults = (
  {
    locale,
    bookingFormCopy,
    footerData,
    heroData,
    categoryOptions = [],
    ratePlanOptions = [],
    initialResult,
    initialError = null,
    initialCriteriaKey,
  }: ResultsPageProps,
  context: HookContext,
) => {
  const { actionPreviewBookingSelection } = context.operations;
  const translateUi = context.translate;
  const searchBookingAvailabilities = (
    criteria: Parameters<typeof searchAvailabilities>[0],
    locale: string,
    messages: Parameters<typeof searchAvailabilities>[2],
  ) =>
    searchAvailabilities(
      criteria,
      locale,
      messages,
      context.operations.actionSearchBookingResults,
    );
  const {
    PAYMENT_PROVIDER_PUBLIC_KEYS,
    getPaymentProviderLabel,
    isBookingFrontendPaymentProvider,
  } = context.paymentProviders;
  const t = context.translations("bookingResults.page");
  const searchParams = context.searchParams;
  const criteria = useMemo(
    () => parseBookingSearchParams(searchParams),
    [searchParams],
  );
  const criteriaKey = useMemo(
    () => serializeBookingSearchParams(criteria),
    [criteria],
  );
  const hasServerHydration = Boolean(initialResult || initialError);
  const skipInitialFetch = useRef(
    Boolean(
      hasServerHydration &&
        initialCriteriaKey &&
        initialCriteriaKey === criteriaKey,
    ),
  );
  const [roomCards, setRoomCards] = useState<BookingRoomCardVM[]>(
    initialResult?.roomCards ?? [],
  );
  const [defaultSelection, setDefaultSelection] = useState<Map<number, number>>(
    initialResult?.defaultSelection ?? new Map(),
  );
  const [recommendedCombination, setRecommendedCombination] = useState(
    initialResult?.recommendedCombination ?? [],
  );
  const [selectedQuantities, setSelectedQuantities] = useState<
    Record<string, number>
  >(initialResult?.initialSelectedQuantities ?? {});
  const [loading, setLoading] = useState(!hasServerHydration);
  const [error, setError] = useState<string | null>(initialError);
  const [selectionPreview, setSelectionPreview] =
    useState<BookingEngineQuoteSelection | null>(null);
  const [selectionPreviewLoading, setSelectionPreviewLoading] = useState(false);
  const [selectionPreviewError, setSelectionPreviewError] = useState<
    string | null
  >(null);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedRatePlans, setSelectedRatePlans] = useState<string[]>([]);
  const [selectedRoomsCount, setSelectedRoomsCount] = useState<number[]>([]);
  const [sort, setSort] = useState<BookingResultsSort>("price_asc");
  const [priceRange, setPriceRange] = useState<[number, number] | null>(null);
  useEffect(() => {
    if (skipInitialFetch.current) {
      skipInitialFetch.current = false;
      return;
    }

    let active = true;

    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await searchBookingAvailabilities(criteria, locale, {
          datesRequired: t("errors.datesRequired"),
        });
        if (!active) return;
        setRoomCards(data.roomCards);
        setSelectedQuantities(data.initialSelectedQuantities);
        setDefaultSelection(data.defaultSelection);
        setRecommendedCombination(data.recommendedCombination);
      } catch (caught) {
        if (!active) return;
        if (caught instanceof Error) {
          setError(caught.message);
        } else {
          setError(t("errors.loadAvailability"));
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    run();

    return () => {
      active = false;
    };
  }, [criteria, locale, t]);
  const metadata = useMemo(() => {
    if (roomCards.length === 0) {
      return {
        categories: [] as string[],
        ratePlans: [] as string[],
        roomsCount: [1],
        minTotal: 0,
        maxTotal: 0,
      };
    }
    return getFilterMetadata(roomCards, defaultSelection);
  }, [roomCards, defaultSelection]);
  const activePriceRange = useMemo<[number, number]>(() => {
    if (metadata.minTotal === 0 && metadata.maxTotal === 0) return [0, 0];
    return priceRange ?? [metadata.minTotal, metadata.maxTotal];
  }, [priceRange, metadata.maxTotal, metadata.minTotal]);
  const filtered = useMemo(() => {
    if (roomCards.length === 0) return [];
    const byCriteriaCategory = criteria.categoryId
      ? roomCards.filter(
          (option) => option.roomCategoryId === criteria.categoryId,
        )
      : roomCards;
    const byPrice = filterByPriceRange(
      byCriteriaCategory,
      activePriceRange[0],
      activePriceRange[1],
    );
    const byCategory = filterByCategory(byPrice, selectedCategories);
    const byRatePlan = filterByRatePlan(byCategory, selectedRatePlans);
    const byRooms = filterByRoomsCount(byRatePlan, selectedRoomsCount);
    return sortOptions(byRooms, sort, selectedQuantities);
  }, [
    roomCards,
    criteria.categoryId,
    activePriceRange,
    selectedCategories,
    selectedRatePlans,
    selectedRoomsCount,
    selectedQuantities,
    sort,
  ]);
  const handleReset = () => {
    setSelectedCategories([]);
    setSelectedRatePlans([]);
    setSelectedRoomsCount([]);
    setSort("price_asc");
    setPriceRange(null);
  };
  const setQuantity = (quoteKey: string, nextQuantity: number) => {
    setSelectedQuantities((current) => {
      const value = Math.max(0, nextQuantity);
      if (value === 0) {
        const rest = { ...current };
        delete rest[quoteKey];
        return rest;
      }
      return { ...current, [quoteKey]: value };
    });
  };
  const selectedItems = useMemo(
    () => buildSelectedPlanSummaries(selectedQuantities, roomCards),
    [selectedQuantities, roomCards],
  );
  const summary = useMemo(
    () =>
      selectedItems.reduce(
        (acc, item) => {
          const roomCard = roomCards.find(
            (card) => card.roomCategoryId === item.roomCategoryId,
          );
          return {
            selectedCount: acc.selectedCount + item.quantity,
            totalValue: acc.totalValue + item.subtotal,
            totalCapacity:
              acc.totalCapacity + item.quantity * (roomCard?.maxOccupancy ?? 0),
            totalAdultCapacity:
              acc.totalAdultCapacity +
              item.quantity * (roomCard?.maxAdultOccupancy ?? 0),
            totalChildCapacity:
              acc.totalChildCapacity +
              item.quantity * (roomCard?.maxChildOccupancy ?? 0),
          };
        },
        {
          selectedCount: 0,
          totalValue: 0,
          totalCapacity: 0,
          totalAdultCapacity: 0,
          totalChildCapacity: 0,
        },
      ),
    [selectedItems, roomCards],
  );
  const estimatedPriceComposition = useMemo(
    () => aggregatePriceComposition(selectedItems),
    [selectedItems],
  );
  const previewPriceComposition = useMemo(
    () =>
      selectionPreview
        ? buildSelectionPriceComposition(selectionPreview)
        : null,
    [selectionPreview],
  );
  const priceComposition = previewPriceComposition ?? estimatedPriceComposition;
  const displayedSelectedItems = useMemo(
    () =>
      resolveSelectedItemTotalsFromSelection(selectedItems, selectionPreview),
    [selectedItems, selectionPreview],
  );
  const mixedPlans = useMemo(
    () => hasMixedRatePlans(selectedQuantities, roomCards),
    [selectedQuantities, roomCards],
  );
  useEffect(() => {
    if (
      selectedItems.length === 0 ||
      mixedPlans ||
      !criteria.checkIn ||
      !criteria.checkOut
    ) {
      setSelectionPreview(null);
      setSelectionPreviewLoading(false);
      setSelectionPreviewError(null);
      return;
    }

    const ratePlanId = selectedItems[0]?.ratePlanId;
    if (!ratePlanId) return;

    let active = true;
    const timeout = window.setTimeout(async () => {
      setSelectionPreviewLoading(true);
      setSelectionPreviewError(null);

      try {
        const response = await actionPreviewBookingSelection({
          locale,
          payload: buildSelectionPreviewPayload(
            criteria,
            selectedItems,
            ratePlanId,
          ),
        });

        if (!active) return;

        if (response.error) {
          throw new Error("preview_failed");
        }

        setSelectionPreview(response.data ?? null);
      } catch {
        if (!active) return;
        setSelectionPreview(null);
        setSelectionPreviewError(t("errors.previewUnavailable"));
      } finally {
        if (active) setSelectionPreviewLoading(false);
      }
    }, 450);

    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, [criteria, locale, mixedPlans, selectedItems, t]);
  const checkoutHref = useMemo(() => {
    if (!mixedPlans && (selectionPreviewLoading || !selectionPreview))
      return null;

    const checkoutSummary = previewPriceComposition
      ? {
          ...summary,
          totalValue: previewPriceComposition.totalInCents,
        }
      : summary;

    return buildBookingCheckoutUrl(locale, {
      criteria,
      hasMixedPlans: mixedPlans,
      items: selectedItems,
      recommendedCombination,
      priceComposition,
      summary: checkoutSummary,
    });
  }, [
    criteria,
    locale,
    mixedPlans,
    previewPriceComposition,
    priceComposition,
    recommendedCombination,
    selectedItems,
    selectionPreview,
    selectionPreviewLoading,
    summary,
  ]);
  const heroBackgroundImageUrl =
    typeof heroData?.backgroundImageUrl === "string"
      ? heroData.backgroundImageUrl
      : undefined;
  const filtersProps = {
    categories: metadata.categories,
    ratePlans: metadata.ratePlans,
    roomsCount: metadata.roomsCount,
    selectedCategories,
    selectedRatePlans,
    selectedRoomsCount,
    priceRange: activePriceRange,
    absoluteMin: metadata.minTotal,
    absoluteMax: metadata.maxTotal,
    onCategoriesChange: setSelectedCategories,
    onRatePlansChange: setSelectedRatePlans,
    onRoomsCountChange: setSelectedRoomsCount,
    onPriceRangeChange: setPriceRange,
    onReset: handleReset,
  };
  return {
    t,
    searchParams,
    criteria,
    criteriaKey,
    hasServerHydration,
    skipInitialFetch,
    roomCards,
    setRoomCards,
    defaultSelection,
    setDefaultSelection,
    recommendedCombination,
    setRecommendedCombination,
    selectedQuantities,
    setSelectedQuantities,
    loading,
    setLoading,
    error,
    setError,
    selectionPreview,
    setSelectionPreview,
    selectionPreviewLoading,
    setSelectionPreviewLoading,
    selectionPreviewError,
    setSelectionPreviewError,
    selectedCategories,
    setSelectedCategories,
    selectedRatePlans,
    setSelectedRatePlans,
    selectedRoomsCount,
    setSelectedRoomsCount,
    sort,
    setSort,
    priceRange,
    setPriceRange,
    metadata,
    activePriceRange,
    filtered,
    handleReset,
    setQuantity,
    selectedItems,
    summary,
    estimatedPriceComposition,
    previewPriceComposition,
    priceComposition,
    displayedSelectedItems,
    mixedPlans,
    checkoutHref,
    heroBackgroundImageUrl,
    filtersProps,
  };
};
