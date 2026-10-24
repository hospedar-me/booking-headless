const translateUi = (_locale: string, key: string) => key;

type AppLocale = string;
import { toGuestDistribution } from "./booking-selection-request";
import type {
  BookingEngineRequest,
  PetType,
  RecommendedCombinationItem,
} from "../sdk/types.gen";
import {
  buildRoomCards,
  resolveBestChoicePreselection,
  type BookingRatePlanOptionVM,
  type BookingResultsApiPayload,
  type BookingRoomCardVM,
} from "./booking-results-adapter";

export type BookingResultsSort = "price_asc" | "price_desc";

export type BookingGuestDistributionParam = {
  adults: number;
  childAges: number[];
  pets?: BookingPetParam[];
};

export type BookingPetParam = {
  petType: PetType;
  weightInGrams: number;
};

export type BookingSearchParams = {
  checkIn?: string;
  checkOut?: string;
  adults: number;
  children: number;
  childAges?: number[];
  rooms: number;
  distribution?: BookingGuestDistributionParam[];
  pets?: BookingPetParam[];
  promotionCode?: string;
  categoryId?: number;
  ratePlanId?: number;
};

export type BookingSearchResult = {
  roomCards: BookingRoomCardVM[];
  initialSelectedQuantities: Record<string, number>;
  defaultSelection: Map<number, number>;
  recommendedCombination: RecommendedCombinationItem[];
};

export const DEFAULT_BOOKING_SEARCH: BookingSearchParams = {
  adults: 4,
  children: 1,
  childAges: [0],
  rooms: 1,
  pets: [],
};

export const normalizeChildAges = (
  children: number,
  childAges?: number[],
): number[] => {
  if (children <= 0) return [];

  const normalized = [...(childAges ?? [])]
    .slice(0, children)
    .map((age) => (Number.isFinite(age) && age >= 0 ? Math.floor(age) : 0));

  while (normalized.length < children) {
    normalized.push(0);
  }

  return normalized;
};

const parsePetListValue = (value: string): BookingPetParam[] | undefined => {
  if (!value) return undefined;

  const pets = value
    .split(",")
    .filter(Boolean)
    .map((item) => {
      const [petType, weightValue] = item.split("-");
      const weightInGrams = Number(weightValue);
      if (
        !["dog", "cat", "other"].includes(petType) ||
        !Number.isFinite(weightInGrams) ||
        weightInGrams <= 0
      ) {
        return null;
      }
      return {
        petType: petType as PetType,
        weightInGrams: Math.floor(weightInGrams),
      };
    });

  if (pets.length === 0 || pets.some((pet) => pet === null)) return undefined;
  return pets as BookingPetParam[];
};

const serializePetListValue = (pets?: BookingPetParam[]): string =>
  pets?.length
    ? pets.map((pet) => `${pet.petType}-${pet.weightInGrams}`).join(",")
    : "";

const parseDistributionValue = (
  value: string | null,
): BookingGuestDistributionParam[] | undefined => {
  if (!value) return undefined;

  const rooms = value
    .split("|")
    .filter(Boolean)
    .map((room) => {
      const [adultsValue, agesValue = "", petsValue = ""] = room.split(":");
      const adults = Number(adultsValue);
      const childAges = agesValue
        .split(",")
        .filter(Boolean)
        .map((age) => Number(age));
      const pets = parsePetListValue(petsValue) ?? [];

      if (
        !Number.isFinite(adults) ||
        adults < 0 ||
        childAges.some((age) => !Number.isFinite(age) || age < 0)
      ) {
        return null;
      }

      return {
        adults: Math.floor(adults),
        childAges: childAges.map((age) => Math.floor(age)),
        pets,
      };
    });

  if (rooms.length === 0 || rooms.some((room) => room === null))
    return undefined;
  return rooms as BookingGuestDistributionParam[];
};

const serializeDistributionValue = (
  distribution?: BookingGuestDistributionParam[],
): string | undefined => {
  if (!distribution || distribution.length === 0) return undefined;
  return distribution
    .map(
      (room) =>
        `${room.adults}:${room.childAges.join(",")}:${serializePetListValue(room.pets)}`,
    )
    .join("|");
};

const parsePetsValue = (
  value: string | null,
): BookingPetParam[] | undefined => {
  if (!value) return undefined;

  const pets = value
    .split("|")
    .filter(Boolean)
    .map((item) => {
      const [petType, weightValue] = item.split(":");
      const weightInGrams = Number(weightValue);
      if (
        !["dog", "cat", "other"].includes(petType) ||
        !Number.isFinite(weightInGrams) ||
        weightInGrams <= 0
      ) {
        return null;
      }
      return {
        petType: petType as PetType,
        weightInGrams: Math.floor(weightInGrams),
      };
    });

  if (pets.length === 0 || pets.some((pet) => pet === null)) return undefined;
  return pets as BookingPetParam[];
};

const serializePetsValue = (pets?: BookingPetParam[]): string | undefined => {
  if (!pets || pets.length === 0) return undefined;
  return pets.map((pet) => `${pet.petType}:${pet.weightInGrams}`).join("|");
};

export const formatCurrencyBRL = (valueInCents: number): string => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(valueInCents / 100);
};

export const getPlanTotal = (plan: BookingRatePlanOptionVM): number =>
  plan.quote.totals.finalInCents + plan.quote.totals.toCollectFeesInCents;

export const getRoomCardMinTotal = (roomCard: BookingRoomCardVM): number =>
  roomCard.plans.reduce(
    (min, plan) => Math.min(min, getPlanTotal(plan)),
    Number.POSITIVE_INFINITY,
  );

const getSelectedQtyInRoomCard = (
  roomCard: BookingRoomCardVM,
  selectedQuantities: Record<string, number>,
): number =>
  roomCard.plans.reduce(
    (acc, plan) => acc + (selectedQuantities[plan.quoteKey] ?? 0),
    0,
  );

const getFitSortRank = (roomCard: BookingRoomCardVM): number => {
  if (roomCard.fitsRequestedOccupancy) return 0;
  if (roomCard.requiredQuantityToFit !== null) return 1;
  return 2;
};

export const sortOptions = (
  options: BookingRoomCardVM[],
  sort: BookingResultsSort = "price_asc",
  selectedQuantities: Record<string, number> = {},
) => {
  const sorted = [...options];
  sorted.sort((a, b) => {
    const selectedDiff =
      Number(getSelectedQtyInRoomCard(b, selectedQuantities) > 0) -
      Number(getSelectedQtyInRoomCard(a, selectedQuantities) > 0);
    if (selectedDiff !== 0) return selectedDiff;

    const fitDiff = getFitSortRank(a) - getFitSortRank(b);
    if (fitDiff !== 0) return fitDiff;

    const requiredLeft = a.requiredQuantityToFit ?? Number.POSITIVE_INFINITY;
    const requiredRight = b.requiredQuantityToFit ?? Number.POSITIVE_INFINITY;
    if (requiredLeft !== requiredRight) return requiredLeft - requiredRight;

    const left = getRoomCardMinTotal(a);
    const right = getRoomCardMinTotal(b);
    return sort === "price_asc" ? left - right : right - left;
  });
  return sorted;
};

export const filterByPriceRange = (
  options: BookingRoomCardVM[],
  min: number,
  max: number,
) => {
  return options.filter((option) => {
    const total = getRoomCardMinTotal(option);
    return total >= min && total <= max;
  });
};

export const filterByCategory = (
  options: BookingRoomCardVM[],
  categories: string[],
) => {
  if (categories.length === 0) return options;
  return options.filter((option) =>
    categories.some((selected) =>
      option.name.toLowerCase().includes(selected.toLowerCase()),
    ),
  );
};

export const filterByRatePlan = (
  options: BookingRoomCardVM[],
  ratePlans: string[],
) => {
  if (ratePlans.length === 0) return options;
  const selected = new Set(ratePlans.map((plan) => plan.toLowerCase()));
  return options.filter((option) =>
    option.plans.some((plan) => selected.has(plan.ratePlanName.toLowerCase())),
  );
};

export const buildCategoryDefaultSelection = (
  roomCards: BookingRoomCardVM[],
  selectedQuantitiesByQuote: Record<string, number>,
) => {
  const map = new Map<number, number>();

  for (const roomCard of roomCards) {
    let selected = 0;

    for (const plan of roomCard.plans) {
      selected += selectedQuantitiesByQuote[plan.quoteKey] ?? 0;
    }

    if (selected > 0) {
      map.set(roomCard.roomCategoryId, selected);
    }
  }

  return map;
};

export const filterByRoomsCount = (
  options: BookingRoomCardVM[],
  roomsCount: number[],
) => {
  if (roomsCount.length === 0) return options;

  const maxRooms = Math.max(...roomsCount);
  return options.filter(
    (option) =>
      option.requiredQuantityToFit !== null &&
      option.requiredQuantityToFit <= maxRooms,
  );
};

export const parseBookingSearchParams = (searchParams: {
  get: (key: string) => string | null;
}): BookingSearchParams => {
  const readNumber = (key: string, fallback: number, min = 0) => {
    const value = Number(searchParams.get(key));
    if (!Number.isFinite(value) || value < min) return fallback;
    return Math.floor(value);
  };

  const readOptionalNumber = (key: string, min = 1) => {
    const value = Number(searchParams.get(key));
    if (!Number.isFinite(value) || value < min) return undefined;
    return Math.floor(value);
  };

  const checkIn = searchParams.get("checkIn") || undefined;
  const checkOut = searchParams.get("checkOut") || undefined;
  const distribution = parseDistributionValue(searchParams.get("distribution"));
  const pets = parsePetsValue(searchParams.get("pets"));
  const promotionCode = searchParams.get("promotionCode")?.trim() || undefined;
  const children = readNumber("children", DEFAULT_BOOKING_SEARCH.children, 0);
  const childAges = normalizeChildAges(
    children,
    (searchParams.get("childAges") || "")
      .split(",")
      .filter(Boolean)
      .map((value) => Number(value)),
  );

  return {
    checkIn,
    checkOut,
    adults: readNumber("adults", DEFAULT_BOOKING_SEARCH.adults, 1),
    children,
    childAges,
    rooms: readNumber("rooms", DEFAULT_BOOKING_SEARCH.rooms, 1),
    distribution,
    pets: pets ?? [],
    promotionCode,
    categoryId: readOptionalNumber("categoryId"),
    ratePlanId: readOptionalNumber("ratePlanId"),
  };
};

export const serializeBookingSearchParams = (
  params: BookingSearchParams,
): string => {
  return [
    params.checkIn ?? "",
    params.checkOut ?? "",
    String(params.adults),
    String(params.children),
    normalizeChildAges(params.children, params.childAges).join(","),
    String(params.rooms),
    serializeDistributionValue(params.distribution) ?? "",
    serializePetsValue(params.pets) ?? "",
    params.promotionCode?.trim() ?? "",
    params.categoryId ? String(params.categoryId) : "",
    params.ratePlanId ? String(params.ratePlanId) : "",
  ].join("|");
};

export const buildBookingResultsUrl = (
  locale: string,
  params: BookingSearchParams,
): string => {
  const query = new URLSearchParams();
  if (params.checkIn) query.set("checkIn", params.checkIn);
  if (params.checkOut) query.set("checkOut", params.checkOut);
  query.set("adults", String(params.adults));
  query.set("children", String(params.children));
  const childAges = normalizeChildAges(params.children, params.childAges);
  if (childAges.length > 0) query.set("childAges", childAges.join(","));
  query.set("rooms", String(params.rooms));
  const distribution = serializeDistributionValue(params.distribution);
  if (distribution) query.set("distribution", distribution);
  const pets = serializePetsValue(params.pets);
  if (pets) query.set("pets", pets);
  if (params.promotionCode?.trim())
    query.set("promotionCode", params.promotionCode.trim());
  if (params.categoryId) query.set("categoryId", String(params.categoryId));
  if (params.ratePlanId) query.set("ratePlanId", String(params.ratePlanId));

  const serialized = query.toString();
  return `/${locale}/booking/results${serialized ? `?${serialized}` : ""}`;
};

export const toBookingEngineRequest = (
  params: BookingSearchParams,
): BookingEngineRequest => {
  const normalizedChildAges = normalizeChildAges(
    params.children,
    params.childAges,
  );

  const accommodations = params.categoryId
    ? Array.from({ length: Math.max(1, params.rooms) }, () => ({
        accommodationCategoryId: params.categoryId!,
      }))
    : undefined;

  return {
    accommodations,
    checkInDate: params.checkIn ?? "",
    checkOutDate: params.checkOut ?? "",
    numAdults: params.adults,
    numChildren: params.children,
    childAges: normalizedChildAges,
    numAccommodations: params.rooms,
    numPets: params.pets?.length ?? 0,
    pets: params.pets ?? [],
    promotionCode: params.promotionCode?.trim() || undefined,
    guestDistribution: toGuestDistribution(params.distribution),
    ratePlanId: params.ratePlanId,
  };
};

export const buildBookingSearchResult = (
  payload: BookingResultsApiPayload,
): BookingSearchResult => {
  const baseRoomCards = buildRoomCards(payload);
  const selectedQuantitiesByQuote = resolveBestChoicePreselection(
    payload,
    baseRoomCards,
  );
  const roomCards = sortOptions(
    baseRoomCards,
    "price_asc",
    selectedQuantitiesByQuote,
  );
  const defaultSelection = buildCategoryDefaultSelection(
    roomCards,
    selectedQuantitiesByQuote,
  );

  return {
    roomCards,
    initialSelectedQuantities: selectedQuantitiesByQuote,
    defaultSelection,
    recommendedCombination: payload.search.recommendedCombination,
  };
};

export const searchBookingAvailabilities = async (
  params: BookingSearchParams,
  locale: AppLocale,
  messages: { datesRequired?: string } = {},
  actionSearchBookingResults: (
    input: BookingEngineRequest,
    locale: string,
  ) => Promise<{ data?: BookingResultsApiPayload; error?: string }>,
): Promise<BookingSearchResult> => {
  if (!params.checkIn || !params.checkOut) {
    throw new Error(
      messages.datesRequired ??
        translateUi(locale, "checkoutValidation.searchDatesRequired"),
    );
  }

  const response = await actionSearchBookingResults(
    toBookingEngineRequest(params),
    locale,
  );

  if (response.error) {
    throw new Error(response.error);
  }

  return buildBookingSearchResult(response.data!);
};

export const getFilterMetadata = (
  options: BookingRoomCardVM[],
  defaultSelection: Map<number, number>,
) => {
  const categories = Array.from(new Set(options.map((option) => option.name)));
  const ratePlans = Array.from(
    new Set(
      options.flatMap((option) =>
        option.plans.map((plan) => plan.ratePlanName),
      ),
    ),
  );
  void defaultSelection;
  const roomsCountFromOffers = options
    .map((option) => option.requiredQuantityToFit)
    .filter((value): value is number => value !== null && value > 0);
  const roomsCount = Array.from(
    new Set(roomsCountFromOffers.length > 0 ? roomsCountFromOffers : [1]),
  ).sort((a, b) => a - b);
  const totals = options.map(getRoomCardMinTotal);

  return {
    categories,
    ratePlans,
    roomsCount,
    minTotal: totals.length > 0 ? Math.min(...totals) : 0,
    maxTotal: totals.length > 0 ? Math.max(...totals) : 0,
  };
};
