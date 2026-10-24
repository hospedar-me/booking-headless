"use client";
import type { HookContext } from "./context";
type AppLocale = string;
const translateUi = (_locale: string, key: string) => key;
import { useEffect, useState } from "react";
import type { FooterViewData } from "../models/home";
import type { BookingFederatedUser } from "../models/auth";
import {
  getReservationPaymentAction,
  buildReservationBalancePaymentUrl,
} from "../core/booking-payment";
import type {
  Reservation,
  ReservationFinancialDetails,
  ReservationFinancialStatementLine,
  GuestRefundRequestResponse,
  ReservationStatus,
} from "../sdk/types.gen";
type LoadState = {
  error: string | null;
  loading: boolean;
  reservation: Reservation | null;
};
type FinancialState = {
  details: ReservationFinancialDetails | null;
  error: string | null;
  loading: boolean;
};
type CancellationDialogState = {
  error: string | null;
  loadingPreview: boolean;
  open: boolean;
  preview: ReservationCancellationFinancials | null;
  result: ReservationCancellationFinancials | null;
  submitting: boolean;
};
type ReservationRequestFilter = "all" | "modifications" | "refunds";
type MyReservationDetailPageProps = {
  authenticatedUser: BookingFederatedUser;
  footerData: FooterViewData;
  locale: AppLocale;
  reservationId: string;
  voucherLogoUrl?: string | null;
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
type ReservationCancellationFinancials = {
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
export const useMyReservation = (
  {
    authenticatedUser,
    footerData,
    locale,
    reservationId,
    voucherLogoUrl,
  }: MyReservationDetailPageProps,
  context: HookContext,
) => {
  const {
    actionGetMyReservation,
    actionGetMyReservationFinancialDetails,
    actionListMyReservationRefundRequests,
    actionGetBookingReservationObligation,
  } = context.operations;
  const translateUi = context.translate;
  const {
    PAYMENT_PROVIDER_PUBLIC_KEYS,
    getPaymentProviderLabel,
    isBookingFrontendPaymentProvider,
  } = context.paymentProviders;
  const copyLocale = context.locale;
  const t = context.translations();
  const td = context.translations("myReservations.detail");
  const finalizeReservationLabel = translateUi(
    locale === "pt" ? "pt" : "en",
    "MyReservationDetailPage.completeReservation",
  );
  const [loadState, setLoadState] = useState<LoadState>({
    error: null,
    loading: true,
    reservation: null,
  });
  const [financialState, setFinancialState] = useState<FinancialState>({
    details: null,
    error: null,
    loading: true,
  });
  const [cancellationState, setCancellationState] =
    useState<CancellationDialogState>({
      error: null,
      loadingPreview: false,
      open: false,
      preview: null,
      result: null,
      submitting: false,
    });
  const [paymentObligation, setPaymentObligation] = useState<
    import("../sdk/types.gen").ReservationPaymentObligationResponse | null
  >(null);
  const [financialRefreshVersion, setFinancialRefreshVersion] = useState(0);
  const [isRefreshingFinancial, setIsRefreshingFinancial] = useState(false);
  const [activeTab, setActiveTab] = useState("summary");
  const [requestFilter, setRequestFilter] =
    useState<ReservationRequestFilter>("all");
  const [pendingRefundRequestsInCents, setPendingRefundRequestsInCents] =
    useState(0);
  useEffect(() => {
    let active = true;
    let inFlight = false;

    const loadAll = async () => {
      if (inFlight) return;
      inFlight = true;
      setIsRefreshingFinancial(true);
      try {
        const [reservationResult, financialResult, obligationResult] =
          await Promise.all([
            actionGetMyReservation(reservationId, locale),
            actionGetMyReservationFinancialDetails(reservationId, locale),
            actionGetBookingReservationObligation(reservationId, locale),
          ]);

        if (!active) return;
        setPaymentObligation(obligationResult.data ?? null);

        if (reservationResult.error || !reservationResult.data) {
          setLoadState({
            error: reservationResult.error,
            loading: false,
            reservation: null,
          });
          setFinancialState((current) => ({ ...current, loading: false }));
          return;
        }
        setLoadState({
          error: null,
          loading: false,
          reservation: reservationResult.data,
        });

        if (financialResult.error || !financialResult.data) {
          setFinancialState({
            details: null,
            error: financialResult.error,
            loading: false,
          });
          return;
        }
        setFinancialState({
          details: financialResult.data,
          error: null,
          loading: false,
        });
      } catch {
        if (active) {
          setLoadState((current) => ({
            ...current,
            loading: false,
            error: td("errors.refreshFinancial"),
          }));
          setFinancialState((current) => ({ ...current, loading: false }));
        }
      } finally {
        inFlight = false;
        if (active) setIsRefreshingFinancial(false);
      }
    };

    const refreshVisible = () => {
      if (!document.hidden) void loadAll();
    };
    void loadAll();
    const timer = window.setInterval(refreshVisible, 15000);
    window.addEventListener("focus", refreshVisible);
    document.addEventListener("visibilitychange", refreshVisible);
    window.addEventListener(
      "reservation-refund-request-created:" + reservationId,
      refreshVisible,
    );
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", refreshVisible);
      document.removeEventListener("visibilitychange", refreshVisible);
      window.removeEventListener(
        "reservation-refund-request-created:" + reservationId,
        refreshVisible,
      );
    };
  }, [locale, reservationId, financialRefreshVersion, td]);
  useEffect(() => {
    let active = true;

    const loadRefundRequests = async () => {
      const result = await actionListMyReservationRefundRequests(
        reservationId,
        locale,
      );
      if (!active || result.error || !result.data) return;

      const pendingAmount = result.data.data
        .filter((request) => request.status === "pending")
        .reduce((sum, request) => sum + request.amountInCents, 0);
      setPendingRefundRequestsInCents(pendingAmount);
    };

    void loadRefundRequests();
    return () => {
      active = false;
    };
  }, [locale, reservationId]);
  useEffect(() => {
    const eventName = `reservation-refund-request-created:${reservationId}`;
    const handleRequestCreated = (event: Event) => {
      const request = (event as CustomEvent<GuestRefundRequestResponse>).detail;
      if (request.status !== "pending") return;
      setPendingRefundRequestsInCents(
        (current) => current + request.amountInCents,
      );
    };

    window.addEventListener(eventName, handleRequestCreated);
    return () => window.removeEventListener(eventName, handleRequestCreated);
  }, [reservationId]);
  const reservation = loadState.reservation;
  const financial = financialState.details;
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
  const showPriceTab = true;
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
  const paymentAction = reservation
    ? getReservationPaymentAction({
        locale,
        openBalanceInCents: displayedOpenBalanceInCents,
        preReservationId: reservation.preReservationId,
        reservationId: reservation.id,
        status: reservation.status,
      })
    : null;
  const requiredPaymentHref =
    reservation &&
    paymentAction?.kind === "reservation_balance" &&
    paymentObligation?.obligation &&
    paymentObligation.financial.remainingInCents > 0 &&
    paymentObligation.financial.remainingInCents < displayedOpenBalanceInCents
      ? buildReservationBalancePaymentUrl(
          locale,
          reservation.id,
          paymentObligation.obligation.id,
        )
      : null;
  return {
    copyLocale,
    t,
    td,
    finalizeReservationLabel,
    loadState,
    setLoadState,
    financialState,
    setFinancialState,
    cancellationState,
    setCancellationState,
    paymentObligation,
    setPaymentObligation,
    financialRefreshVersion,
    setFinancialRefreshVersion,
    isRefreshingFinancial,
    setIsRefreshingFinancial,
    activeTab,
    setActiveTab,
    requestFilter,
    setRequestFilter,
    pendingRefundRequestsInCents,
    setPendingRefundRequestsInCents,
    reservation,
    financial,
    financialSummary,
    financialStatement,
    statementLines,
    chargeStatementLines,
    paymentStatementLines,
    sumChargeLines,
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
    showPriceTab,
    displayedTotalWithLocalFeesInCents,
    displayedAccountTotalInCents,
    usesFolioStatement,
    displayedOpenBalanceInCents,
    paymentAction,
    requiredPaymentHref,
  };
};
