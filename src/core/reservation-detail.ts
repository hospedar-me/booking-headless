import type {
  Reservation,
  ReservationFinancialDetails,
  ReservationFinancialStatementLine,
  ReservationStatus,
} from "../sdk/types.gen";
export type ReservationPriceCompositionLine = {
  amountInCents: number;
  description?: string | null;
  id: string | number;
  name: string;
};
export const isPaymentMovement = (line: ReservationFinancialStatementLine) =>
  line.entryType === "PAYMENT" || line.entryType === "REFUND";
export const effectiveSignedAmountInCents = (
  line: ReservationFinancialStatementLine,
) => {
  const stateAmount = line.state.amountInCents;
  const isVoidedState =
    line.state.kind === "voided" || line.state.kind === "partially_voided";

  if (!isVoidedState || stateAmount <= 0) {
    return line.signedAmountInCents;
  }

  if (line.signedAmountInCents >= 0) {
    return Math.max(0, line.signedAmountInCents - stateAmount);
  }

  return Math.min(0, line.signedAmountInCents + stateAmount);
};
export type ReservationCancellationFinancials = {
  reservationId: string;
  status: ReservationStatus;
  cancelledAt?: string | null;
  penaltyInCents: number;
  postReservationAdjustmentsInCents?: number | null;
  settlementTotalInCents?: number | null;
  refundAmountInCents: number;
  balanceDueInCents?: number | null;
  totalPaidInCents?: number | null;
  totalInCents?: number | null;
  isPenaltyApplied: boolean;
  policyDays?: number | null;
  feeType?: "basis_points" | "fixed" | string | null;
  feeAmount?: number | null;
};

// Display projections of backend-authorized data, never pricing or eligibility authority.
export function projectCancellationPreview(
  preview: ReservationCancellationFinancials,
  fallbackModificationFeeInCents: number,
) {
  const paidInCents = preview.totalPaidInCents ?? 0;
  const postAdjustmentsInCents =
    preview.postReservationAdjustmentsInCents ?? fallbackModificationFeeInCents;
  const settlementTotalInCents =
    preview.settlementTotalInCents ??
    postAdjustmentsInCents + preview.penaltyInCents;
  const refundAmountInCents = preview.refundAmountInCents;
  const balanceDueInCents =
    preview.balanceDueInCents ??
    Math.max(settlementTotalInCents - paidInCents, 0);

  return {
    paidInCents,
    postAdjustmentsInCents,
    settlementTotalInCents,
    refundAmountInCents,
    balanceDueInCents,
  };
}
export function projectReservationDetails(
  reservation: Reservation | null,
  financial: ReservationFinancialDetails | null,
  cancellationState: {
    preview: ReservationCancellationFinancials | null;
    result: ReservationCancellationFinancials | null;
  },
) {
  const financialSummary = financial?.summary ?? null;
  const financialStatement = financial?.statement ?? null;
  const statementLines = financialStatement?.lines ?? [];
  const chargeStatementLines = statementLines.filter(
    (line) => !isPaymentMovement(line),
  );
  const paymentStatementLines = statementLines.filter(isPaymentMovement);
  const sumChargeLines = (kinds: string[]) =>
    chargeStatementLines
      .filter((line) => kinds.includes(String(line.kind)))
      .reduce((sum, line) => sum + effectiveSignedAmountInCents(line), 0);
  const stayChargesInCents = sumChargeLines(["daily_charge", "child_policy"]);
  const feeChargesInCents = sumChargeLines([
    "tax",
    "service_fee",
    "manual_charge",
  ]);
  const discountChargesInCents = sumChargeLines([
    "promotion_discount",
    "reservation_discount",
    "adjustment_discount",
  ]);
  const adjustmentChargesInCents = sumChargeLines(["adjustment"]);
  const postedModificationFeeInCents = chargeStatementLines
    .filter((line) => String(line.kind) === "modification_fee")
    .reduce((sum, line) => sum + effectiveSignedAmountInCents(line), 0);
  const postedCancellationFeeInCents = chargeStatementLines
    .filter((line) => String(line.kind) === "cancellation_fee")
    .reduce((sum, line) => sum + effectiveSignedAmountInCents(line), 0);
  const modificationFeeInCents = Math.max(0, postedModificationFeeInCents);
  const rawReservationValueInCents =
    financialSummary?.reservationValueInCents ??
    reservation?.pricing.totals.finalInCents ??
    0;
  const isCancelledReservation = reservation?.status === "Cancelled";
  const cancellationFeeInCents = Math.max(
    0,
    isCancelledReservation
      ? (cancellationState.result?.penaltyInCents ??
          cancellationState.preview?.penaltyInCents ??
          postedCancellationFeeInCents)
      : postedCancellationFeeInCents,
  );
  const postReservationAdjustmentsInCents =
    modificationFeeInCents + cancellationFeeInCents;
  const cancellationSettlementTotalInCents = isCancelledReservation
    ? postReservationAdjustmentsInCents
    : 0;
  const displayedTotalWithLocalFeesInCents = financialSummary
    ? financialSummary.totalWithLocalFeesInCents
    : rawReservationValueInCents;
  const displayedAccountTotalInCents = isCancelledReservation
    ? cancellationSettlementTotalInCents
    : displayedTotalWithLocalFeesInCents + postReservationAdjustmentsInCents;
  const usesFolioStatement =
    reservation?.status === "CheckedIn" || reservation?.status === "CheckedOut";
  const displayedOpenBalanceInCents = financialSummary
    ? isCancelledReservation
      ? Math.max(
          0,
          cancellationSettlementTotalInCents - financialSummary.paidInCents,
        )
      : usesFolioStatement
        ? financialSummary.openBalanceInCents
        : Math.max(
            0,
            rawReservationValueInCents +
              postReservationAdjustmentsInCents -
              financialSummary.paidInCents,
          )
    : 0;
  const displayedOverpaidInCents = financialSummary
    ? isCancelledReservation
      ? Math.max(
          0,
          financialSummary.paidInCents - cancellationSettlementTotalInCents,
        )
      : usesFolioStatement
        ? financialSummary.overpaidInCents
        : Math.max(
            0,
            financialSummary.paidInCents - displayedAccountTotalInCents,
          )
    : 0;
  const displayedToCollectAtPropertyInCents =
    financialSummary && !isCancelledReservation
      ? financialSummary.toCollectAtPropertyInCents
      : 0;
  const displayedAmountDueIncludingLocalInCents = financialSummary
    ? Math.max(0, displayedOpenBalanceInCents) +
      (usesFolioStatement ? 0 : displayedToCollectAtPropertyInCents)
    : 0;
  const displayedFinalBalanceInCents = financialSummary
    ? isCancelledReservation
      ? cancellationSettlementTotalInCents - financialSummary.paidInCents
      : displayedAmountDueIncludingLocalInCents
    : 0;
  const reservationPricing = reservation?.pricing;
  const dailyBaseInCents = Object.values(
    reservationPricing?.stayPricing.dailyBreakdown ?? {},
  ).reduce((sum, day) => sum + day.pricing.baseInCents, 0);
  const stayPricing = reservationPricing?.stayPricing;
  const aggregatePriceLines = (
    entries: { amountInCents: number; id: string | number }[],
    catalog: Record<string, { description?: string | null; name: string }>,
  ): ReservationPriceCompositionLine[] =>
    Array.from(
      entries.reduce((amounts, entry) => {
        const key = String(entry.id);
        amounts.set(key, (amounts.get(key) ?? 0) + entry.amountInCents);
        return amounts;
      }, new Map<string, number>()),
    ).flatMap(([id, amountInCents]) => {
      const item = catalog[id];
      return item
        ? [
            {
              amountInCents,
              description: item.description,
              id,
              name: item.name,
            },
          ]
        : [];
    });

  const promotionEntries = [
    ...(stayPricing?.promotionApplications.once ?? []).map((item) => ({
      amountInCents: item.amountInCents,
      id: item.promotionId,
    })),
    ...Object.values(stayPricing?.promotionApplications.dailyByDate ?? {})
      .flat()
      .map((item) => ({
        amountInCents: item.amountInCents,
        id: item.promotionId,
      })),
  ];
  const promotionLines = aggregatePriceLines(
    promotionEntries,
    stayPricing?.promotionCatalog ?? {},
  );
  const childPolicyLines = aggregatePriceLines(
    Object.values(stayPricing?.childPolicyApplications?.dailyByDate ?? {})
      .flat()
      .map((item) => ({ amountInCents: item.amountInCents, id: item.ruleId })),
    stayPricing?.childPolicyCatalog ?? {},
  );
  const petPolicyLines = aggregatePriceLines(
    Object.values(stayPricing?.petPolicyApplications?.dailyByDate ?? {})
      .flat()
      .map((item) => ({ amountInCents: item.amountInCents, id: item.ruleId })),
    stayPricing?.petPolicyCatalog ?? {},
  );
  const feeEntries = [
    ...(stayPricing?.feeApplications.once ?? []).map((item) => ({
      amountInCents: item.amountInCents,
      id: item.feeId,
    })),
    ...Object.values(stayPricing?.feeApplications.dailyByDate ?? {})
      .flat()
      .map((item) => ({ amountInCents: item.amountInCents, id: item.feeId })),
  ];
  const reservationFeeLines = aggregatePriceLines(
    feeEntries.filter(
      (item) =>
        stayPricing?.feeCatalog[String(item.id)]?.feeStage === "in_reservation",
    ),
    stayPricing?.feeCatalog ?? {},
  );
  const embeddedFeeLines = aggregatePriceLines(
    feeEntries.filter(
      (item) =>
        stayPricing?.feeCatalog[String(item.id)]?.feeStage === "embedded",
    ),
    stayPricing?.feeCatalog ?? {},
  );
  const toCollectFeeLines = aggregatePriceLines(
    feeEntries.filter(
      (item) =>
        stayPricing?.feeCatalog[String(item.id)]?.feeStage === "to_collect",
    ),
    stayPricing?.feeCatalog ?? {},
  );
  const totalInCents = rawReservationValueInCents;
  const priceTotalInCents = displayedTotalWithLocalFeesInCents;
  const canCancelReservation = reservation
    ? reservation.status === "Pending" || reservation.status === "Confirmed"
    : false;

  const paymentStatus = !financialSummary
    ? null
    : isCancelledReservation
      ? {
          kind:
            displayedOverpaidInCents > 0
              ? "credit"
              : displayedOpenBalanceInCents > 0
                ? "open"
                : "cancelledSettled",
          amountInCents:
            displayedOverpaidInCents || displayedOpenBalanceInCents,
        }
      : financialSummary.overpaidInCents > 0
        ? { kind: "credit", amountInCents: financialSummary.overpaidInCents }
        : financialSummary.openBalanceInCents > 0
          ? { kind: "open", amountInCents: financialSummary.openBalanceInCents }
          : financialSummary.toCollectAtPropertyInCents > 0
            ? {
                kind: "toCollect",
                amountInCents: financialSummary.toCollectAtPropertyInCents,
              }
            : { kind: "paid", amountInCents: 0 };
  return {
    financialSummary,
    financialStatement,
    statementLines,
    chargeStatementLines,
    paymentStatementLines,
    stayChargesInCents,
    feeChargesInCents,
    discountChargesInCents,
    adjustmentChargesInCents,
    postedModificationFeeInCents,
    postedCancellationFeeInCents,
    modificationFeeInCents,
    rawReservationValueInCents,
    isCancelledReservation,
    cancellationFeeInCents,
    postReservationAdjustmentsInCents,
    cancellationSettlementTotalInCents,
    displayedTotalWithLocalFeesInCents,
    displayedAccountTotalInCents,
    usesFolioStatement,
    displayedOpenBalanceInCents,
    displayedOverpaidInCents,
    displayedToCollectAtPropertyInCents,
    displayedAmountDueIncludingLocalInCents,
    displayedFinalBalanceInCents,
    dailyBaseInCents,
    promotionEntries,
    promotionLines,
    childPolicyLines,
    petPolicyLines,
    reservationFeeLines,
    embeddedFeeLines,
    toCollectFeeLines,
    totalInCents,
    priceTotalInCents,
    canCancelReservation,
    paymentStatus,
    cancellationPreview: cancellationState.preview
      ? projectCancellationPreview(
          cancellationState.preview,
          modificationFeeInCents,
        )
      : null,
  };
}
