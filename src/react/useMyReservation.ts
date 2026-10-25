import {
  projectReservationDetails,
  type ReservationCancellationFinancials,
} from "../core/reservation-detail";
("use client");
import type { HookContext } from "./context";
type AppLocale = string;
const translateUi = (_locale: string, key: string) => key;
import { useEffect, useMemo, useRef, useState } from "react";
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
export type MyReservationOptions = { locale: AppLocale; reservationId: string };
export const useMyReservation = (
  { locale, reservationId }: MyReservationOptions,
  context: HookContext,
) => {
  const {
    actionCancelMyReservation,
    actionPreviewMyReservationCancellation,
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
  const projection = projectReservationDetails(
    reservation,
    financial,
    cancellationState,
  );
  const { financialSummary, displayedOpenBalanceInCents } = projection;
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
  const scope = useMemo(() => ({ active: true }), [reservationId, locale]);
  useEffect(() => {
    scope.active = true;
    return () => {
      scope.active = false;
    };
  }, [scope]);
  const cancellationInFlight = useRef(false);
  const cancellationRequest = useRef(0);
  const loadCancellationPreview = async () => {
    if (!reservation || !scope.active) return;
    setCancellationState((c) => ({
      ...c,
      error: null,
      loadingPreview: true,
      preview: c.preview?.reservationId === reservation.id ? c.preview : null,
    }));
    const request = ++cancellationRequest.current;
    let result;
    try {
      result = await actionPreviewMyReservationCancellation(
        reservation.id,
        locale,
      );
    } catch {
      result = { error: td("errors.cancellationPreview") };
    }
    if (!scope.active || request !== cancellationRequest.current) return;
    if (result.error || !result.data) {
      setCancellationState((c) => ({
        ...c,
        error: result.error ?? td("errors.cancellationPreview"),
        loadingPreview: false,
        preview: null,
      }));
      return;
    }
    setCancellationState((c) => ({
      ...c,
      error: null,
      loadingPreview: false,
      preview: result.data,
    }));
  };

  const handleCancellationDialogOpenChange = (open: boolean) => {
    if (!open && cancellationState.submitting) return;
    setCancellationState((c) => ({ ...c, error: open ? c.error : null, open }));
    if (open) void loadCancellationPreview();
  };

  const confirmCancellation = async () => {
    if (!reservation || !scope.active || cancellationInFlight.current) return;
    cancellationInFlight.current = true;
    setCancellationState((c) => ({ ...c, error: null, submitting: true }));
    let result;
    try {
      result = await actionCancelMyReservation(reservation.id, locale);
    } catch {
      result = { error: td("errors.cancelReservation") };
    }
    cancellationInFlight.current = false;
    if (!scope.active) return;
    if (result.error || !result.data) {
      setCancellationState((c) => ({
        ...c,
        error: result.error ?? td("errors.cancelReservation"),
        submitting: false,
      }));
      return;
    }
    const payload = result.data;
    setFinancialRefreshVersion((version) => version + 1);
    setLoadState((c) => ({
      ...c,
      reservation: c.reservation
        ? {
            ...c.reservation,
            cancelledAt: payload.cancelledAt ?? c.reservation.cancelledAt,
            status: payload.status,
          }
        : c.reservation,
    }));
    setCancellationState((c) => ({
      ...c,
      error: null,
      open: false,
      preview: payload,
      result: payload,
      submitting: false,
    }));
  };

  return {
    ...projection,
    loadCancellationPreview,
    handleCancellationDialogOpenChange,
    confirmCancellation,
    copyLocale,
    t,
    td,
    finalizeReservationLabel,
    loadState,
    financialState,
    cancellationState,
    paymentObligation,
    financialRefreshVersion,
    refreshFinancial: () =>
      setFinancialRefreshVersion((version) => version + 1),
    isRefreshingFinancial,
    pendingRefundRequestsInCents,
    reservation,
    financial,
    paymentAction,
    requiredPaymentHref,
  };
};
