import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  BookingCheckoutValidationError,
  buildBookingCheckoutUrl,
  buildPreReservationRequest,
  parseBookingCheckoutState,
} from "./booking-checkout";
import { buildBookingPaymentUrl } from "./booking-payment";
import type { BookingResultsApiPayload } from "./booking-results-adapter";
const actionSearchBookingResults = vi.fn();
import {
  aggregatePriceComposition,
  buildRoomCards,
  buildSelectedPlanSummaries,
  canIncreaseSelection,
  computeCategorySelectedQty,
  getQuoteDisplayFinalInCents,
  hasMixedRatePlans,
  resolveBestChoicePreselection,
} from "./booking-results-adapter";
import {
  buildBookingSearchResult,
  buildBookingResultsUrl,
  filterByCategory,
  filterByPriceRange,
  filterByRatePlan,
  filterByRoomsCount,
  formatCurrencyBRL,
  getPlanTotal,
  getRoomCardMinTotal,
  parseBookingSearchParams,
  searchBookingAvailabilities as search,
  sortOptions,
  toBookingEngineRequest,
} from "./booking-results";

const createPayload = (): BookingResultsApiPayload => ({
  search: {
    paymentOptions: [],
    recommendedCombination: [
      {
        accommodationCategoryId: 1,
        ratePlanId: 101,
        quantity: 1,
        allocations: [],
      },
      {
        accommodationCategoryId: 2,
        ratePlanId: 103,
        quantity: 1,
        allocations: [],
      },
    ],
    accommodationCategoryOffers: [
      {
        accommodationCategoryId: 1,
        availability: 2,
        fitsRequestedOccupancy: true,
        quotes: [
          {
            ratePlanId: 101,
            estimatedChildPolicyInCents: 0,
            estimatedPetPolicyInCents: 0,
            totals: {
              baseInCents: 100000,
              childPolicyInCents: 0,
              petPolicyInCents: 0,
              reservationFeesInCents: 11000,
              promotionsInCents: 1250,
              finalInCents: 109750,
              embeddedFeesInCents: 1250,
              toCollectFeesInCents: 600,
            },
            stayPricing: {
              childPolicyApplications: { dailyByDate: {} },
              childPolicyCatalog: {},
              petPolicyApplications: { dailyByDate: {} },
              petPolicyCatalog: {},
              promotionCatalog: {
                "10": {
                  id: 10,
                  name: "Promo Flex",
                  applicationType: "stay_discount",
                  discountType: "basis_points",
                  discountValue: 1000,
                  description: null,
                  promoCode: null,
                },
                "11": {
                  id: 11,
                  name: "Promo diaria",
                  applicationType: "daily_discount",
                  discountType: "fixed",
                  discountValue: 250,
                  description: null,
                  promoCode: null,
                },
              },
              feeCatalog: {
                "1": {
                  id: 1,
                  name: "Taxa de servico",
                  description: null,
                  feePeriod: "once",
                  feeStage: "in_reservation",
                  feeType: "fixed",
                  feeUnit: null,
                  feeValue: 500,
                  feeCalculationBasis: null,
                },
                "2": {
                  id: 2,
                  name: "Taxa unica percentual",
                  description: "Taxa percentual detalhada",
                  feePeriod: null,
                  feeStage: "in_reservation",
                  feeType: "basis_points",
                  feeUnit: null,
                  feeValue: 1000,
                  feeCalculationBasis: null,
                },
                "3": {
                  id: 3,
                  name: "ISS",
                  description: null,
                  feePeriod: "once",
                  feeStage: "embedded",
                  feeType: "basis_points",
                  feeUnit: null,
                  feeValue: 500,
                  feeCalculationBasis: null,
                },
                "4": {
                  id: 4,
                  name: "Taxa de turismo",
                  description: "Taxa de turismo detalhada",
                  feePeriod: "daily",
                  feeStage: "to_collect",
                  feeType: "fixed",
                  feeUnit: "guest",
                  feeValue: 300,
                  feeCalculationBasis: null,
                },
                "5": {
                  id: 5,
                  name: "Taxa de limpeza diaria",
                  description: "Taxa de limpeza detalhada",
                  feePeriod: "daily",
                  feeStage: "in_reservation",
                  feeType: "fixed",
                  feeUnit: "accommodation",
                  feeValue: 4000,
                  feeCalculationBasis: null,
                },
              },
              promotionApplications: {
                once: [{ promotionId: 10, amountInCents: 1000 }],
                dailyByDate: {
                  "2026-10-01": [{ promotionId: 11, amountInCents: 250 }],
                },
              },
              feeApplications: {
                once: [
                  { feeId: 1, amountInCents: 500 },
                  { feeId: 2, amountInCents: 2500 },
                  { feeId: 3, amountInCents: 1250 },
                ],
                dailyByDate: {
                  "2026-10-01": [{ feeId: 5, amountInCents: 4000 }],
                  "2026-10-02": [
                    { feeId: 5, amountInCents: 4000 },
                    { feeId: 4, amountInCents: 600 },
                  ],
                },
              },
              dailyBreakdown: [
                { date: "2026-10-01", baseInCents: 50000, finalInCents: 54875 },
                { date: "2026-10-02", baseInCents: 50000, finalInCents: 54875 },
              ],
            },
          },
          {
            ratePlanId: 102,
            estimatedChildPolicyInCents: 0,
            estimatedPetPolicyInCents: 0,
            totals: {
              baseInCents: 120000,
              childPolicyInCents: 0,
              petPolicyInCents: 0,
              reservationFeesInCents: 0,
              promotionsInCents: 0,
              finalInCents: 120000,
              embeddedFeesInCents: 0,
              toCollectFeesInCents: 1000,
            },
            stayPricing: {
              childPolicyApplications: { dailyByDate: {} },
              childPolicyCatalog: {},
              petPolicyApplications: { dailyByDate: {} },
              petPolicyCatalog: {},
              promotionCatalog: {},
              feeCatalog: {},
              promotionApplications: { once: [], dailyByDate: {} },
              feeApplications: { once: [], dailyByDate: {} },
              dailyBreakdown: [],
            },
          },
        ],
      },
      {
        accommodationCategoryId: 2,
        availability: 3,
        fitsRequestedOccupancy: true,
        quotes: [
          {
            ratePlanId: 103,
            estimatedChildPolicyInCents: 0,
            estimatedPetPolicyInCents: 0,
            totals: {
              baseInCents: 180000,
              childPolicyInCents: 0,
              petPolicyInCents: 0,
              reservationFeesInCents: 0,
              promotionsInCents: 0,
              finalInCents: 180000,
              embeddedFeesInCents: 0,
              toCollectFeesInCents: 2000,
            },
            stayPricing: {
              childPolicyApplications: { dailyByDate: {} },
              childPolicyCatalog: {},
              petPolicyApplications: { dailyByDate: {} },
              petPolicyCatalog: {},
              promotionCatalog: {},
              feeCatalog: {},
              promotionApplications: { once: [], dailyByDate: {} },
              feeApplications: { once: [], dailyByDate: {} },
              dailyBreakdown: [],
            },
          },
        ],
      },
    ],
  },
  categories: [
    {
      id: 1,
      name: "Duplo Standard",
      description: "Quarto standard",
      maxOccupancy: 3,
      maxAdultOccupancy: 2,
      maxChildOccupancy: 1,
      maxPetOccupancy: 0,
      sizeM2: 20,
      accommodationBedsOptions: [],
      commodities: [
        { id: 1, name: "Wifi", icon: "Wifi", description: null },
        { id: 2, name: "Cafe da manha", icon: "Coffee", description: null },
      ],
      media: [
        {
          id: 1,
          altText: null,
          displayOrder: 1,
          isCover: true,
          url: "/images/room-standard.png",
        },
      ],
    },
    {
      id: 2,
      name: "Duplo Deluxe",
      description: "Quarto deluxe",
      maxOccupancy: 3,
      maxAdultOccupancy: 2,
      maxChildOccupancy: 1,
      maxPetOccupancy: 0,
      sizeM2: 28,
      accommodationBedsOptions: [],
      commodities: [{ id: 1, name: "Wifi", icon: "Wifi", description: null }],
      media: [],
    },
  ],
  ratePlans: [
    {
      id: 101,
      name: "Plano Flex",
      description: "Cancelamento flexivel",
      active: true,
      createdAt: "2026-01-01",
      updatedAt: "2026-01-01",
      commercialPolicies: {
        cancellation: { policyDays: null, fee: null },
        modification: {
          policyDays: null,
          fee: null,
          feeBase: "new_value",
          preventLowerPriceModification: false,
        },
        payment: {
          timing: "at_booking",
          amount: { kind: "basis_points", value: 10000 },
        },
      },
    },
    {
      id: 102,
      name: "Plano Semi Flex",
      description: "Tarifa intermediaria",
      active: true,
      createdAt: "2026-01-01",
      updatedAt: "2026-01-01",
      commercialPolicies: {
        cancellation: { policyDays: null, fee: null },
        modification: {
          policyDays: null,
          fee: null,
          feeBase: "new_value",
          preventLowerPriceModification: false,
        },
        payment: {
          timing: "at_booking",
          amount: { kind: "basis_points", value: 10000 },
        },
      },
    },
    {
      id: 103,
      name: "Plano Premium",
      description: "Tarifa premium",
      active: true,
      createdAt: "2026-01-01",
      updatedAt: "2026-01-01",
      commercialPolicies: {
        cancellation: { policyDays: null, fee: null },
        modification: {
          policyDays: null,
          fee: null,
          feeBase: "new_value",
          preventLowerPriceModification: false,
        },
        payment: {
          timing: "at_booking",
          amount: { kind: "basis_points", value: 10000 },
        },
      },
    },
  ],
});

describe("booking-results helpers", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.mocked(actionSearchBookingResults).mockReset();
  });

  it("formata moeda em centavos para BRL", () => {
    expect(formatCurrencyBRL(156800)).toBe("R$ 1.568,00");
  });

  it("monta room cards e agrupa multiplos planos no mesmo quarto", () => {
    const cards = buildRoomCards(createPayload());

    const room1 = cards.find((card) => card.roomCategoryId === 1);
    expect(room1?.plans.length).toBeGreaterThan(1);
    expect(room1?.imageUrl).toBe("/images/room-standard.png");
  });

  it("pre-selecao usa accommodationCategoryId + ratePlanId do recommendedCombination", () => {
    const payload = createPayload();
    const cards = buildRoomCards(payload);
    const selected = resolveBestChoicePreselection(payload, cards);

    const room1 = cards.find((card) => card.roomCategoryId === 1);
    const room1Plan101 = room1?.plans.find((plan) => plan.ratePlanId === 101);
    const room2 = cards.find((card) => card.roomCategoryId === 2);
    const room2Plan103 = room2?.plans.find((plan) => plan.ratePlanId === 103);

    expect(room1Plan101).toBeDefined();
    expect(room2Plan103).toBeDefined();
    expect(selected[room1Plan101!.quoteKey]).toBe(1);
    expect(selected[room2Plan103!.quoteKey]).toBe(1);
  });

  it("bloqueia incremento quando atinge disponibilidade por categoria", () => {
    const cards = buildRoomCards(createPayload());
    const room1 = cards.find((card) => card.roomCategoryId === 1)!;

    const selected = {
      [room1.plans[0].quoteKey]: 1,
      [room1.plans[1].quoteKey]: 1,
    };

    expect(computeCategorySelectedQty(selected, 1, cards)).toBe(2);
    expect(
      canIncreaseSelection({
        selectedQuantities: selected,
        roomCategoryId: 1,
        availability: 2,
        roomCards: cards,
      }),
    ).toBe(false);
  });

  it("detecta mistura de planos tarifarios na selecao", () => {
    const cards = buildRoomCards(createPayload());
    const selected = {
      [cards[0].plans[0].quoteKey]: 1,
      [cards[1].plans[0].quoteKey]: 1,
    };

    expect(hasMixedRatePlans(selected, cards)).toBe(true);
  });

  it("searchBookingAvailabilities retorna erro de validacao quando datas ausentes", async () => {
    const datesRequired =
      "Informe as datas de check-in e check-out para buscar disponibilidades.";

    await expect(
      searchBookingAvailabilities({ adults: 2, children: 0, rooms: 1 }, "pt", {
        datesRequired,
      }),
    ).rejects.toThrow(datesRequired);
  });

  it("searchBookingAvailabilities usa action agregadora e retorna dados", async () => {
    const payload = createPayload();
    vi.mocked(actionSearchBookingResults).mockResolvedValue({
      data: payload,
    });

    const result = await searchBookingAvailabilities(
      {
        adults: 2,
        children: 0,
        rooms: 1,
        checkIn: "2026-11-20",
        checkOut: "2026-11-22",
      },
      "pt",
    );

    expect(actionSearchBookingResults).toHaveBeenCalled();
    expect(result.roomCards.length).toBeGreaterThan(0);
  });

  it("searchBookingAvailabilities propaga erro vindo da action", async () => {
    vi.mocked(actionSearchBookingResults).mockResolvedValue({
      error: "checkInDate and checkOutDate are required.",
    });

    await expect(
      searchBookingAvailabilities(
        {
          adults: 2,
          children: 0,
          rooms: 1,
          checkIn: "2026-11-20",
          checkOut: "2026-11-22",
        },
        "pt",
      ),
    ).rejects.toThrow("checkInDate and checkOutDate are required.");
  });

  it("filtra por categoria + plano + faixa de preco", () => {
    const payload = createPayload();
    const roomCards = buildRoomCards(payload);
    const byCategory = filterByCategory(roomCards, ["Deluxe"]);
    const byPlan = filterByRatePlan(byCategory, ["Plano Premium"]);
    const byPrice = filterByPriceRange(byPlan, 1, 1_000_000);
    const byRooms = filterByRoomsCount(byPrice, [1]);

    expect(byRooms.length).toBeGreaterThan(0);
    expect(byRooms.every((option) => option.requiredQuantityToFit === 1)).toBe(
      true,
    );
    expect(byRooms[0].name).toContain("Deluxe");
  });

  it("buildBookingSearchResult preserva preselecoes e defaultSelection", () => {
    const result = buildBookingSearchResult(createPayload());

    expect(result.initialSelectedQuantities).toEqual({
      [result.roomCards[0].plans[0].quoteKey]: 1,
      [result.roomCards[1].plans[0].quoteKey]: 1,
    });
    expect(
      result.defaultSelection.get(result.roomCards[0].roomCategoryId),
    ).toBe(1);
    expect(
      result.defaultSelection.get(result.roomCards[1].roomCategoryId),
    ).toBe(1);
  });

  it("ordena por menor preco minimo de plano", () => {
    const roomCards = buildRoomCards(createPayload());
    const sorted = sortOptions([roomCards[1], roomCards[0]], "price_asc");

    expect(getRoomCardMinTotal(sorted[0])).toBeLessThanOrEqual(
      getRoomCardMinTotal(sorted[1]),
    );
  });

  it("monta resumo de selecionados com subtotais", () => {
    const roomCards = buildRoomCards(createPayload());
    const selected = {
      [roomCards[0].plans[0].quoteKey]: 2,
    };

    const items = buildSelectedPlanSummaries(selected, roomCards);
    expect(items).toHaveLength(1);
    expect(items[0].unitTotal).toBe(getPlanTotal(roomCards[0].plans[0]));
    expect(items[0].subtotal).toBe(items[0].quantity * items[0].unitTotal);
  });

  it("calcula total exibido do card sem dobrar politicas estimadas", () => {
    const quote = buildRoomCards(createPayload())[0].plans[0].quote;

    expect(
      getQuoteDisplayFinalInCents({
        ...quote,
        estimatedChildPolicyInCents: 25_515,
        totals: {
          ...quote.totals,
          finalInCents: 185_042,
          petPolicyInCents: 24_500,
        },
      }),
    ).toBe(135_027);
  });

  it("agrega composicao de preco com promocoes e taxas por secao", () => {
    const roomCards = buildRoomCards(createPayload());
    const selected = {
      [roomCards[0].plans[0].quoteKey]: 2,
    };

    const items = buildSelectedPlanSummaries(selected, roomCards);
    const composition = aggregatePriceComposition(items);

    expect(composition.promotions).toEqual([
      expect.objectContaining({ amountInCents: 500, name: "Promo diaria" }),
      expect.objectContaining({ amountInCents: 2000, name: "Promo Flex" }),
    ]);
    expect(composition.fees.reservation).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          amountInCents: 16000,
          description: "Taxa de limpeza detalhada",
          name: "Taxa de limpeza diaria",
        }),
        expect.objectContaining({
          amountInCents: 5000,
          description: "Taxa percentual detalhada",
          name: "Taxa unica percentual",
        }),
      ]),
    );
    expect(composition.fees.embedded).toEqual([
      expect.objectContaining({ amountInCents: 2500, name: "ISS" }),
    ]);
    expect(composition.fees.toCollect).toEqual([
      expect.objectContaining({
        amountInCents: 1200,
        description: "Taxa de turismo detalhada",
        name: "Taxa de turismo",
      }),
    ]);
  });

  it("gera URL de resultados com querystring esperada", () => {
    const url = buildBookingResultsUrl("pt", {
      checkIn: "2026-10-01",
      checkOut: "2026-10-03",
      adults: 4,
      children: 1,
      rooms: 2,
    });

    expect(url).toBe(
      "/pt/booking/results?checkIn=2026-10-01&checkOut=2026-10-03&adults=4&children=1&childAges=0&rooms=2",
    );
  });

  it("gera URL de resultados preservando idades das criancas", () => {
    const url = buildBookingResultsUrl("pt", {
      checkIn: "2026-10-01",
      checkOut: "2026-10-03",
      adults: 2,
      children: 2,
      childAges: [4, 7],
      rooms: 1,
    });

    expect(url).toBe(
      "/pt/booking/results?checkIn=2026-10-01&checkOut=2026-10-03&adults=2&children=2&childAges=4%2C7&rooms=1",
    );
  });

  it("gera e interpreta URL de resultados preservando distribuicao dos hospedes", () => {
    const url = buildBookingResultsUrl("pt", {
      checkIn: "2026-10-01",
      checkOut: "2026-10-03",
      adults: 2,
      children: 2,
      childAges: [6, 8],
      rooms: 2,
      distribution: [
        { adults: 1, childAges: [6] },
        { adults: 1, childAges: [8] },
      ],
    });

    expect(url).toBe(
      "/pt/booking/results?checkIn=2026-10-01&checkOut=2026-10-03&adults=2&children=2&childAges=6%2C8&rooms=2&distribution=1%3A6%3A%7C1%3A8%3A",
    );

    const parsed = parseBookingSearchParams(
      new URL(`http://localhost${url}`).searchParams,
    );

    expect(parsed.distribution).toEqual([
      { adults: 1, childAges: [6], pets: [] },
      { adults: 1, childAges: [8], pets: [] },
    ]);
  });

  it("gera e interpreta URL de resultados preservando pets globais e distribuidos", () => {
    const url = buildBookingResultsUrl("pt", {
      checkIn: "2026-10-01",
      checkOut: "2026-10-03",
      adults: 2,
      children: 0,
      childAges: [],
      rooms: 1,
      distribution: [
        {
          adults: 2,
          childAges: [],
          pets: [{ petType: "dog", weightInGrams: 10000 }],
        },
      ],
      pets: [{ petType: "dog", weightInGrams: 10000 }],
    });

    expect(url).toBe(
      "/pt/booking/results?checkIn=2026-10-01&checkOut=2026-10-03&adults=2&children=0&rooms=1&distribution=2%3A%3Adog-10000&pets=dog%3A10000",
    );

    const parsed = parseBookingSearchParams(
      new URL(`http://localhost${url}`).searchParams,
    );

    expect(parsed.distribution).toEqual([
      {
        adults: 2,
        childAges: [],
        pets: [{ petType: "dog", weightInGrams: 10000 }],
      },
    ]);
    expect(parsed.pets).toEqual([{ petType: "dog", weightInGrams: 10000 }]);
  });

  it("nao gera URL de checkout quando nao ha itens selecionados", () => {
    const url = buildBookingCheckoutUrl("pt", {
      criteria: {
        adults: 2,
        checkIn: "2026-10-01",
        checkOut: "2026-10-03",
        children: 0,
        childAges: [],
        rooms: 1,
      },
      hasMixedPlans: false,
      items: [],
      summary: {
        selectedCount: 0,
        totalCapacity: 0,
        totalValue: 0,
      },
    });

    expect(url).toBeNull();
  });

  it("serializa e reconstrui o estado do checkout", () => {
    const roomCards = buildRoomCards(createPayload());
    const selected = {
      [roomCards[0].plans[0].quoteKey]: 1,
    };
    const items = buildSelectedPlanSummaries(selected, roomCards);
    const url = buildBookingCheckoutUrl("pt", {
      criteria: {
        adults: 2,
        checkIn: "2026-10-01",
        checkOut: "2026-10-03",
        children: 1,
        childAges: [6],
        rooms: 1,
      },
      hasMixedPlans: false,
      items,
      summary: {
        selectedCount: 1,
        totalCapacity: roomCards[0].maxOccupancy,
        totalValue: items[0].subtotal,
      },
    });

    const parsed = parseBookingCheckoutState(
      new URL(url!, "http://localhost").searchParams,
    );
    expect(parsed?.items).toEqual(items);
    expect(parsed?.summary.totalValue).toBe(items[0].subtotal);
    expect(parsed?.criteria.childAges).toEqual([6]);
  });

  it("monta payload de pre-reserva com acomodacoes repetidas pela quantidade", () => {
    const roomCards = buildRoomCards(createPayload());
    const selected = {
      [roomCards[0].plans[0].quoteKey]: 2,
    };
    const items = buildSelectedPlanSummaries(selected, roomCards);

    const payload = buildPreReservationRequest(
      {
        criteria: {
          adults: 2,
          checkIn: "2026-10-01",
          checkOut: "2026-10-03",
          children: 2,
          childAges: [4, 7],
          rooms: 1,
        },
        hasMixedPlans: false,
        items,
        summary: {
          selectedCount: 2,
          totalCapacity: roomCards[0].maxOccupancy * 2,
          totalValue: items[0].subtotal,
        },
      },
      {
        email: "hospede@example.com",
        fullName: "Hospede Teste",
        notes: "",
        phone: "11999999999",
      },
    );

    expect(payload.ratePlanId).toBe(roomCards[0].plans[0].ratePlanId);
    expect(payload.childAges).toEqual([4, 7]);
    expect(payload.accommodations).toEqual([
      { accommodationCategoryId: roomCards[0].roomCategoryId },
      { accommodationCategoryId: roomCards[0].roomCategoryId },
    ]);
  });

  it("bloqueia pre-reserva quando a selecao mistura planos tarifarios", () => {
    const roomCards = buildRoomCards(createPayload());
    const items = buildSelectedPlanSummaries(
      {
        [roomCards[0].plans[0].quoteKey]: 1,
        [roomCards[0].plans[1].quoteKey]: 1,
      },
      roomCards,
    );

    expect(() =>
      buildPreReservationRequest(
        {
          criteria: {
            adults: 2,
            checkIn: "2026-10-01",
            checkOut: "2026-10-03",
            children: 0,
            childAges: [],
            rooms: 1,
          },
          hasMixedPlans: true,
          items,
          summary: {
            selectedCount: 2,
            totalCapacity: roomCards[0].maxOccupancy * 2,
            totalValue: items.reduce((total, item) => total + item.subtotal, 0),
          },
        },
        {
          email: "hospede@example.com",
          fullName: "Hospede Teste",
          notes: "",
          phone: "11999999999",
        },
      ),
    ).toThrow(BookingCheckoutValidationError);
  });

  it("envia childAges reais para o booking engine request", () => {
    expect(
      toBookingEngineRequest({
        adults: 2,
        checkIn: "2026-10-01",
        checkOut: "2026-10-03",
        children: 2,
        childAges: [5, 8],
        rooms: 1,
      }),
    ).toMatchObject({
      childAges: [5, 8],
      numAccommodations: 1,
      numChildren: 2,
    });
  });

  it("gera URL da etapa de pagamento com o preReservationId", () => {
    expect(buildBookingPaymentUrl("pt", "pre-123")).toBe(
      "/pt/booking/payment?preReservationId=pre-123",
    );
  });
});

function searchBookingAvailabilities(
  ...args: Parameters<typeof search> extends [...infer T, unknown] ? T : never
) {
  return search(args[0], args[1], args[2], actionSearchBookingResults);
}
