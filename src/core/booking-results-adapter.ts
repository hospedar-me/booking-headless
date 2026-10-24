import type {
  AccommodationCategory,
  BookingEngineAccommodationCategoryCatalogItem,
  BookingEngineChildPolicyCatalogItem,
  BookingEngineFeeCatalogItem,
  BookingEnginePetPolicyCatalogItem,
  BookingEngineQuote,
  BookingEngineQuoteSelection,
  BookingEngineRatePlanCatalogItem,
  BookingEngineSearchResponse,
  BookingEngineStayPricing,
  BookingEngineTotals,
  Commodity,
  FeeType,
  PetType,
  RatePlan,
  ReservationFeePeriod,
  ReservationFeeStage,
  ReservationFeeUnit,
} from "../sdk/types.gen";

export type BookingRatePlanOptionVM = {
  quoteKey: string;
  ratePlanId: number;
  ratePlan?: RatePlan | BookingEngineRatePlanCatalogItem;
  ratePlanName: string;
  quote: BookingEngineQuote;
  total: number;
  feeLine: number;
  isPreselected: boolean;
};

export type BookingRoomCardVM = {
  roomCategoryId: number;
  category:
    | AccommodationCategory
    | BookingEngineAccommodationCategoryCatalogItem;
  name: string;
  description: string;
  imageUrl: string;
  imageUrls: string[];
  maxAdultOccupancy: number;
  maxChildOccupancy: number;
  maxOccupancy: number;
  size: number;
  commodities: Commodity[];
  availability: number;
  fitsRequestedOccupancy: boolean;
  requiredQuantityToFit: number | null;
  plans: BookingRatePlanOptionVM[];
};

export type SelectedPlanSummary = {
  quoteKey: string;
  roomCategoryId: number;
  roomName: string;
  ratePlanId: number;
  ratePlanName: string;
  quantity: number;
  unitTotal: number;
  subtotal: number;
  priceComposition?: BookingPriceComposition;
};

export type BookingPriceCompositionLine = {
  id: number | string;
  name: string;
  amountInCents: number;
  description?: string | null;
};

export type BookingFeeCompositionLine = BookingPriceCompositionLine & {
  id: number;
  feePeriod?: ReservationFeePeriod | null;
  feeStage: ReservationFeeStage;
  feeType: FeeType;
  feeUnit?: ReservationFeeUnit | null;
  feeValue: number;
};

export type BookingChildPolicyApplicationKind =
  | "free"
  | "pay_as_adult"
  | "charged";

export type BookingChildPolicyCompositionLine = BookingPriceCompositionLine & {
  id: string;
  kind: BookingChildPolicyApplicationKind;
  count: number;
  ages: number[];
};

export type BookingPetPolicyCompositionLine = BookingPriceCompositionLine & {
  id: string;
  petType: PetType;
  count: number;
  weightsInGrams: number[];
};

export type BookingPriceComposition = {
  baseInCents: number;
  promotionsInCents: number;
  reservationFeesInCents: number;
  embeddedFeesInCents: number;
  toCollectFeesInCents: number;
  childPolicyInCents: number;
  petPolicyInCents: number;
  totalInCents: number;
  promotions: BookingPriceCompositionLine[];
  childPolicies: BookingChildPolicyCompositionLine[];
  petPolicies: BookingPetPolicyCompositionLine[];
  fees: {
    reservation: BookingFeeCompositionLine[];
    embedded: BookingFeeCompositionLine[];
    toCollect: BookingFeeCompositionLine[];
  };
};

export type BookingResultsApiPayload = {
  search: BookingEngineSearchResponse;
  categories: Array<
    AccommodationCategory | BookingEngineAccommodationCategoryCatalogItem
  >;
  ratePlans: Array<RatePlan | BookingEngineRatePlanCatalogItem>;
};

const getQuoteTotal = (plan: Pick<BookingRatePlanOptionVM, "quote">) =>
  plan.quote.totals.finalInCents + plan.quote.totals.toCollectFeesInCents;

export const getEstimatedChildPolicyInCents = (
  quote: BookingEngineQuote,
): number => quote.estimatedChildPolicyInCents ?? 0;

export const getEstimatedPetPolicyInCents = (
  quote: BookingEngineQuote,
): number => quote.totals.petPolicyInCents ?? 0;

export const getQuoteDisplayFinalInCents = (
  quote: BookingEngineQuote,
): number => {
  const estimatedPolicyInCents =
    getEstimatedChildPolicyInCents(quote) + getEstimatedPetPolicyInCents(quote);

  return Math.max(0, quote.totals.finalInCents - estimatedPolicyInCents);
};

const resolveChildPolicyApplicationKind = (
  catalogItem: BookingEngineChildPolicyCatalogItem,
  amountInCents: number,
): BookingChildPolicyApplicationKind => {
  if (catalogItem.payAsAdult) return "pay_as_adult";
  if (amountInCents <= 0) return "free";
  return "charged";
};

const emptyPriceComposition = (): BookingPriceComposition => ({
  baseInCents: 0,
  promotionsInCents: 0,
  reservationFeesInCents: 0,
  embeddedFeesInCents: 0,
  toCollectFeesInCents: 0,
  childPolicyInCents: 0,
  petPolicyInCents: 0,
  totalInCents: 0,
  promotions: [],
  childPolicies: [],
  petPolicies: [],
  fees: {
    reservation: [],
    embedded: [],
    toCollect: [],
  },
});

const addPromotionLine = (
  lines: Map<number, BookingPriceCompositionLine>,
  id: number,
  name: string,
  amountInCents: number,
  multiplier: number,
) => {
  const total = amountInCents * multiplier;
  if (total <= 0) return;

  const current = lines.get(id);
  lines.set(id, {
    id,
    name,
    amountInCents: (current?.amountInCents ?? 0) + total,
  });
};

const addFeeLine = (
  lines: Map<number, BookingFeeCompositionLine>,
  catalogItem: BookingEngineFeeCatalogItem,
  amountInCents: number,
  multiplier: number,
) => {
  const total = amountInCents * multiplier;
  if (total <= 0) return;

  const current = lines.get(catalogItem.id);
  lines.set(catalogItem.id, {
    id: catalogItem.id,
    name: catalogItem.name,
    amountInCents: (current?.amountInCents ?? 0) + total,
    description: catalogItem.description,
    feePeriod: catalogItem.feePeriod,
    feeStage: catalogItem.feeStage,
    feeType: catalogItem.feeType,
    feeUnit: catalogItem.feeUnit,
    feeValue: catalogItem.feeValue,
  });
};

const addChildPolicyLine = (
  lines: Map<string, BookingChildPolicyCompositionLine>,
  catalogItem: BookingEngineChildPolicyCatalogItem,
  kind: BookingChildPolicyApplicationKind,
  amountInCents: number,
  multiplier: number,
) => {
  const key = `${catalogItem.ruleId}:${kind}`;
  const current = lines.get(key);
  const ages = current?.ages ?? [];
  lines.set(key, {
    id: key,
    name: catalogItem.name,
    amountInCents: (current?.amountInCents ?? 0) + amountInCents * multiplier,
    description: catalogItem.description,
    kind,
    count: (current?.count ?? 0) + multiplier,
    ages,
  });
};

const addPetPolicyLine = (
  lines: Map<string, BookingPetPolicyCompositionLine>,
  catalogItem: BookingEnginePetPolicyCatalogItem,
  amountInCents: number,
  multiplier: number,
) => {
  const key = catalogItem.ruleId + ":" + catalogItem.petType;
  const current = lines.get(key);
  lines.set(key, {
    id: key,
    name: catalogItem.name,
    amountInCents: (current?.amountInCents ?? 0) + amountInCents * multiplier,
    description: catalogItem.description,
    petType: catalogItem.petType,
    count: (current?.count ?? 0) + multiplier,
    weightsInGrams: current?.weightsInGrams ?? [],
  });
};

const buildStayPriceComposition = (
  stayPricing: BookingEngineStayPricing,
  totals: BookingEngineTotals,
  quantity: number,
): BookingPriceComposition => {
  const promotions = new Map<number, BookingPriceCompositionLine>();
  const reservationFees = new Map<number, BookingFeeCompositionLine>();
  const embeddedFees = new Map<number, BookingFeeCompositionLine>();
  const toCollectFees = new Map<number, BookingFeeCompositionLine>();
  const childPolicies = new Map<string, BookingChildPolicyCompositionLine>();
  const petPolicies = new Map<string, BookingPetPolicyCompositionLine>();

  const getFeeGroup = (feeStage: ReservationFeeStage) => {
    if (feeStage === "embedded") return embeddedFees;
    if (feeStage === "to_collect") return toCollectFees;
    return reservationFees;
  };

  stayPricing.promotionApplications.once.forEach((application) => {
    const catalogItem =
      stayPricing.promotionCatalog[String(application.promotionId)];
    if (catalogItem)
      addPromotionLine(
        promotions,
        catalogItem.id,
        catalogItem.name,
        application.amountInCents,
        quantity,
      );
  });

  Object.values(stayPricing.promotionApplications.dailyByDate).forEach(
    (applications) => {
      applications.forEach((application) => {
        const catalogItem =
          stayPricing.promotionCatalog[String(application.promotionId)];
        if (catalogItem)
          addPromotionLine(
            promotions,
            catalogItem.id,
            catalogItem.name,
            application.amountInCents,
            quantity,
          );
      });
    },
  );

  stayPricing.feeApplications.once.forEach((application) => {
    const catalogItem = stayPricing.feeCatalog[String(application.feeId)];
    if (catalogItem)
      addFeeLine(
        getFeeGroup(catalogItem.feeStage),
        catalogItem,
        application.amountInCents,
        quantity,
      );
  });

  Object.values(stayPricing.feeApplications.dailyByDate).forEach(
    (applications) => {
      applications.forEach((application) => {
        const catalogItem = stayPricing.feeCatalog[String(application.feeId)];
        if (catalogItem)
          addFeeLine(
            getFeeGroup(catalogItem.feeStage),
            catalogItem,
            application.amountInCents,
            quantity,
          );
      });
    },
  );

  Object.values(stayPricing.childPolicyApplications?.dailyByDate ?? {}).forEach(
    (applications) => {
      applications.forEach((application) => {
        const catalogItem =
          stayPricing.childPolicyCatalog?.[String(application.ruleId)];
        if (catalogItem) {
          addChildPolicyLine(
            childPolicies,
            catalogItem,
            resolveChildPolicyApplicationKind(
              catalogItem,
              application.amountInCents,
            ),
            application.amountInCents,
            quantity,
          );
        }
      });
    },
  );

  Object.values(stayPricing.petPolicyApplications?.dailyByDate ?? {}).forEach(
    (applications) => {
      applications.forEach((application) => {
        const catalogItem =
          stayPricing.petPolicyCatalog?.[String(application.ruleId)];
        if (catalogItem) {
          addPetPolicyLine(
            petPolicies,
            catalogItem,
            application.amountInCents,
            quantity,
          );
        }
      });
    },
  );

  return {
    baseInCents: totals.baseInCents * quantity,
    promotionsInCents: totals.promotionsInCents * quantity,
    reservationFeesInCents: totals.reservationFeesInCents * quantity,
    embeddedFeesInCents: totals.embeddedFeesInCents * quantity,
    toCollectFeesInCents: totals.toCollectFeesInCents * quantity,
    childPolicyInCents: (totals.childPolicyInCents ?? 0) * quantity,
    petPolicyInCents: (totals.petPolicyInCents ?? 0) * quantity,
    totalInCents:
      (totals.finalInCents + totals.toCollectFeesInCents) * quantity,
    promotions: Array.from(promotions.values()).sort((a, b) =>
      a.name.localeCompare(b.name),
    ),
    childPolicies: Array.from(childPolicies.values()).sort((a, b) =>
      a.name.localeCompare(b.name),
    ),
    petPolicies: Array.from(petPolicies.values()).sort((a, b) =>
      a.name.localeCompare(b.name),
    ),
    fees: {
      reservation: Array.from(reservationFees.values()).sort((a, b) =>
        a.name.localeCompare(b.name),
      ),
      embedded: Array.from(embeddedFees.values()).sort((a, b) =>
        a.name.localeCompare(b.name),
      ),
      toCollect: Array.from(toCollectFees.values()).sort((a, b) =>
        a.name.localeCompare(b.name),
      ),
    },
  };
};

const buildQuotePriceComposition = (
  quote: BookingEngineQuote,
  quantity: number,
): BookingPriceComposition =>
  buildStayPriceComposition(quote.stayPricing, quote.totals, quantity);

export const buildSelectionPriceComposition = (
  selection: BookingEngineQuoteSelection,
): BookingPriceComposition => {
  const composition = aggregatePriceComposition(
    selection.selectedAccommodations.map((accommodation) => ({
      priceComposition: buildStayPriceComposition(
        accommodation.stayPricing,
        accommodation.totals,
        1,
      ),
    })),
  );

  return {
    ...composition,
    baseInCents: selection.totals.baseInCents,
    promotionsInCents: selection.totals.promotionsInCents,
    reservationFeesInCents: selection.totals.reservationFeesInCents,
    embeddedFeesInCents: selection.totals.embeddedFeesInCents,
    toCollectFeesInCents: selection.totals.toCollectFeesInCents,
    childPolicyInCents: selection.totals.childPolicyInCents,
    petPolicyInCents: selection.totals.petPolicyInCents,
    totalInCents:
      selection.totals.finalInCents + selection.totals.toCollectFeesInCents,
  };
};

export const resolveSelectedItemTotalsFromSelection = (
  items: SelectedPlanSummary[],
  selection: BookingEngineQuoteSelection | null,
): SelectedPlanSummary[] => {
  if (!selection) return items;

  const totalsByCategory = new Map<number, number[]>();
  selection.selectedAccommodations.forEach((accommodation) => {
    const total =
      accommodation.totals.finalInCents +
      accommodation.totals.toCollectFeesInCents;
    const current =
      totalsByCategory.get(accommodation.accommodationCategoryId) ?? [];
    current.push(total);
    totalsByCategory.set(accommodation.accommodationCategoryId, current);
  });

  return items.map((item) => {
    const categoryTotals = totalsByCategory.get(item.roomCategoryId) ?? [];
    const selectedTotals = categoryTotals.splice(0, item.quantity);

    if (selectedTotals.length !== item.quantity) {
      return item;
    }

    const subtotal = selectedTotals.reduce((sum, total) => sum + total, 0);
    return {
      ...item,
      subtotal,
      unitTotal: Math.round(subtotal / item.quantity),
    };
  });
};

export const aggregatePriceComposition = (
  items: Pick<SelectedPlanSummary, "priceComposition">[],
) => {
  const total = emptyPriceComposition();

  const mergeLines = <Line extends BookingPriceCompositionLine>(
    current: Line[],
    next: Line[],
  ) => {
    const byId = new Map<Line["id"], Line>();
    [...current, ...next].forEach((line) => {
      const existing = byId.get(line.id);
      byId.set(line.id, {
        ...line,
        amountInCents: (existing?.amountInCents ?? 0) + line.amountInCents,
      });
    });
    return Array.from(byId.values()).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  };

  items.forEach(({ priceComposition }) => {
    if (!priceComposition) return;

    total.baseInCents += priceComposition.baseInCents;
    total.promotionsInCents += priceComposition.promotionsInCents;
    total.reservationFeesInCents += priceComposition.reservationFeesInCents;
    total.embeddedFeesInCents += priceComposition.embeddedFeesInCents;
    total.toCollectFeesInCents += priceComposition.toCollectFeesInCents;
    total.childPolicyInCents += priceComposition.childPolicyInCents;
    total.petPolicyInCents += priceComposition.petPolicyInCents;
    total.totalInCents += priceComposition.totalInCents;
    total.promotions = mergeLines(
      total.promotions,
      priceComposition.promotions,
    );
    total.childPolicies = mergeLines(
      total.childPolicies,
      priceComposition.childPolicies,
    );
    total.petPolicies = mergeLines(
      total.petPolicies,
      priceComposition.petPolicies,
    );
    total.fees.reservation = mergeLines(
      total.fees.reservation,
      priceComposition.fees.reservation,
    );
    total.fees.embedded = mergeLines(
      total.fees.embedded,
      priceComposition.fees.embedded,
    );
    total.fees.toCollect = mergeLines(
      total.fees.toCollect,
      priceComposition.fees.toCollect,
    );
  });

  return total;
};

const resolveCategoryImageUrls = (
  category:
    | AccommodationCategory
    | BookingEngineAccommodationCategoryCatalogItem,
): string[] => {
  const media = [...(category.media ?? [])]
    .filter((item) => !("mediaType" in item) || item.mediaType === "photo")
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .map((item) => item.url);

  return media;
};

export const buildRoomCards = (
  payload: BookingResultsApiPayload,
): BookingRoomCardVM[] => {
  const categoryById = new Map(
    payload.categories.map((category) => [category.id, category]),
  );
  const ratePlanById = new Map(
    payload.ratePlans.map((ratePlan) => [ratePlan.id, ratePlan]),
  );

  return payload.search.accommodationCategoryOffers
    .map((option): BookingRoomCardVM | null => {
      const category = categoryById.get(option.accommodationCategoryId);
      if (!category) return null;

      const imageUrls = resolveCategoryImageUrls(category);
      const plans: BookingRatePlanOptionVM[] = option.quotes
        .map((quote, quoteIndex): BookingRatePlanOptionVM => {
          const ratePlan = ratePlanById.get(quote.ratePlanId);
          const total =
            quote.totals.finalInCents + quote.totals.toCollectFeesInCents;

          return {
            quoteKey: `${option.accommodationCategoryId}-${quote.ratePlanId}-${quoteIndex}`,
            ratePlanId: quote.ratePlanId,
            ratePlan,
            ratePlanName: ratePlan?.name ?? `Plano ${quote.ratePlanId}`,
            quote,
            total,
            feeLine: quote.totals.toCollectFeesInCents,
            isPreselected: false,
          };
        })
        .sort((a, b) => a.total - b.total);

      return {
        roomCategoryId: option.accommodationCategoryId,
        category,
        name: category.name,
        description: category.description ?? "",
        imageUrl: imageUrls[0] || "",
        imageUrls,
        maxAdultOccupancy: category.maxAdultOccupancy,
        maxChildOccupancy: category.maxChildOccupancy,
        maxOccupancy: category.maxOccupancy,
        size: category.sizeM2 ?? 0,
        commodities: "commodities" in category ? category.commodities : [],
        availability: option.availability,
        fitsRequestedOccupancy: option.fitsRequestedOccupancy ?? true,
        requiredQuantityToFit:
          option.requiredQuantityToFit ??
          (option.fitsRequestedOccupancy === false ? null : 1),
        plans,
      };
    })
    .filter((item): item is BookingRoomCardVM => Boolean(item));
};

export const resolveBestChoicePreselection = (
  payload: BookingResultsApiPayload,
  roomCards: BookingRoomCardVM[],
): Record<string, number> => {
  const selectedQuantities: Record<string, number> = {};

  payload.search.recommendedCombination.forEach((bestChoice) => {
    const roomCard = roomCards.find(
      (card) => card.roomCategoryId === bestChoice.accommodationCategoryId,
    );
    if (!roomCard || roomCard.plans.length === 0) return;

    const matchedPlan = roomCard.plans.find(
      (plan) => plan.ratePlanId === bestChoice.ratePlanId,
    );
    const selectedPlan = matchedPlan ?? roomCard.plans[0];
    selectedQuantities[selectedPlan.quoteKey] = bestChoice.quantity;
  });

  return selectedQuantities;
};

export const computeCategorySelectedQty = (
  selectedQuantities: Record<string, number>,
  roomCategoryId: number,
  roomCards: BookingRoomCardVM[],
): number => {
  const roomCard = roomCards.find(
    (card) => card.roomCategoryId === roomCategoryId,
  );
  if (!roomCard) return 0;
  return roomCard.plans.reduce(
    (acc, plan) => acc + (selectedQuantities[plan.quoteKey] ?? 0),
    0,
  );
};

export const canIncreaseSelection = ({
  selectedQuantities,
  roomCategoryId,
  availability,
  roomCards,
}: {
  selectedQuantities: Record<string, number>;
  roomCategoryId: number;
  availability: number;
  roomCards: BookingRoomCardVM[];
}) => {
  return (
    computeCategorySelectedQty(selectedQuantities, roomCategoryId, roomCards) <
    availability
  );
};

export const hasMixedRatePlans = (
  selectedQuantities: Record<string, number>,
  roomCards: BookingRoomCardVM[],
): boolean => {
  const selectedPlanNames = new Set<string>();

  roomCards.forEach((roomCard) => {
    roomCard.plans.forEach((plan) => {
      if ((selectedQuantities[plan.quoteKey] ?? 0) > 0) {
        selectedPlanNames.add(plan.ratePlanName);
      }
    });
  });

  return selectedPlanNames.size > 1;
};

export const buildSelectedPlanSummaries = (
  selectedQuantities: Record<string, number>,
  roomCards: BookingRoomCardVM[],
): SelectedPlanSummary[] => {
  const items: SelectedPlanSummary[] = [];

  roomCards.forEach((roomCard) => {
    roomCard.plans.forEach((plan) => {
      const quantity = selectedQuantities[plan.quoteKey] ?? 0;
      if (quantity === 0) return;
      const unitTotal = getQuoteTotal(plan);
      items.push({
        quoteKey: plan.quoteKey,
        roomCategoryId: roomCard.roomCategoryId,
        roomName: roomCard.name,
        ratePlanId: plan.ratePlanId,
        ratePlanName: plan.ratePlanName,
        quantity,
        priceComposition: buildQuotePriceComposition(plan.quote, quantity),
        unitTotal,
        subtotal: unitTotal * quantity,
      });
    });
  });

  return items.sort((a, b) => a.roomName.localeCompare(b.roomName));
};
