"use client";
import type { HookContext } from "./context";
type AppLocale = string;
const translateUi = (_locale: string, key: string) => key;
import { useEffect, useEffectEvent, useState } from "react";
import type { FooterViewData } from "../models/home";
import {
  executeBookingCustomerAction,
  isBookingCustomerActionExpired,
} from "../browser/customer-action";
import {
  getBookingPaymentFailureStatus,
  hasBookingPaymentSucceeded,
  shouldPollBookingPaymentSession,
  type BookingPaymentSession,
} from "../core/booking-payment";
type BookingPaymentStatusPageProps = {
  footerData: FooterViewData;
  locale: AppLocale;
  preReservationId?: string;
  reservationId?: string;
  obligationId?: string;
};
type PaymentLoadState = {
  error: string | null;
  loading: boolean;
  session: BookingPaymentSession | null;
};
export const useBookingPaymentStatus = (
  {
    footerData,
    locale,
    preReservationId,
    reservationId,
    obligationId,
  }: BookingPaymentStatusPageProps,
  context: HookContext,
) => {
  const { actionGetBookingPaymentSession } = context.operations;
  const translateUi = context.translate;
  const {
    PAYMENT_PROVIDER_PUBLIC_KEYS,
    getPaymentProviderLabel,
    isBookingFrontendPaymentProvider,
  } = context.paymentProviders;
  const t = context.translations("bookingPayment.status");
  const paymentContext = reservationId
    ? "reservation_balance"
    : "pre_reservation";
  const paymentTargetId = reservationId ?? preReservationId ?? null;
  const [loadState, setLoadState] = useState<PaymentLoadState>({
    error: null,
    loading: Boolean(paymentTargetId),
    session: null,
  });
  const [customerActionError, setCustomerActionError] = useState<string | null>(
    null,
  );
  const [pixCopied, setPixCopied] = useState(false);
  const fetchPaymentSession = async () => {
    if (!paymentTargetId) {
      return {
        error: t("errors.identifyReservation"),
        session: null,
      } satisfies Pick<PaymentLoadState, "error" | "session">;
    }

    const result = await actionGetBookingPaymentSession({
      context: paymentContext,
      obligationId,
      id: paymentTargetId,
      locale,
    });

    if (result.error || !result.data) {
      return {
        error: t("errors.status"),
        session: null,
      } satisfies Pick<PaymentLoadState, "error" | "session">;
    }

    return {
      error: null,
      session: result.data,
    } satisfies Pick<PaymentLoadState, "error" | "session">;
  };
  const loadSession = useEffectEvent(async () => {
    if (!paymentTargetId) {
      setLoadState({
        error: t("errors.identifyReservation"),
        loading: false,
        session: null,
      });
      return;
    }

    const nextState = await fetchPaymentSession();
    setLoadState({
      error: nextState.error,
      loading: false,
      session: nextState.session,
    });
  });
  const handleRefreshStatus = async () => {
    setLoadState((current) => ({ ...current, error: null, loading: true }));
    const nextState = await fetchPaymentSession();
    setLoadState({
      error: nextState.error,
      loading: false,
      session: nextState.session,
    });
  };
  useEffect(() => {
    void loadSession();
  }, [paymentTargetId, obligationId]);
  const paymentSucceeded = hasBookingPaymentSucceeded(loadState.session);
  const paymentFailure = getBookingPaymentFailureStatus(loadState.session);
  const activePayment = loadState.session?.activePayment ?? null;
  const customerAction = activePayment?.customerAction ?? null;
  const customerActionExpired = customerAction
    ? isBookingCustomerActionExpired(customerAction)
    : false;
  const shouldPoll = Boolean(
    paymentTargetId &&
      !loadState.loading &&
      shouldPollBookingPaymentSession(loadState.session),
  );
  useEffect(() => {
    if (!shouldPoll) return undefined;

    const interval = window.setInterval(() => {
      void loadSession();
    }, 5000);

    return () => window.clearInterval(interval);
  }, [shouldPoll]);
  const handleCustomerAction = () => {
    if (!customerAction) return;

    if (customerActionExpired) {
      setCustomerActionError(
        translateUi(
          locale === "pt" ? "pt" : "en",
          "BookingPaymentStatusPage.thisAdditionalStepExpiredRefreshTheStatusToGetANewAction",
        ),
      );
      void handleRefreshStatus();
      return;
    }

    try {
      setCustomerActionError(null);
      executeBookingCustomerAction(customerAction);
    } catch {
      setCustomerActionError(
        translateUi(
          locale === "pt" ? "pt" : "en",
          "BookingPaymentStatusPage.weCouldNotOpenTheAdditionalPaymentStepTryRefreshingTheStatus",
        ),
      );
    }
  };
  const handleCopyPix = async () => {
    if (!activePayment?.copyPasteCode) return;

    try {
      await navigator.clipboard.writeText(activePayment.copyPasteCode);
      setPixCopied(true);
      window.setTimeout(() => setPixCopied(false), 2000);
    } catch {
      setPixCopied(false);
    }
  };
  const reservationWithoutImmediatePayment =
    paymentContext === "pre_reservation" &&
    loadState.session?.status === "completed" &&
    loadState.session?.amountDueNowInCents === 0 &&
    !paymentFailure;
  const pendingReservation =
    loadState.session?.items?.some(
      (item) => item.reservationStatus === "Pending",
    ) ?? false;
  const reservationTitle = pendingReservation
    ? translateUi(
        locale === "pt" ? "pt" : "en",
        "BookingPaymentStatusPage.reservationPendingPayment",
      )
    : translateUi(
        locale === "pt" ? "pt" : "en",
        "BookingPaymentStatusPage.reservationConfirmed",
      );
  const reservationDescription = translateUi(
    locale === "pt" ? "pt" : "en",
    "BookingPaymentStatusPage.noPaymentIsRequiredNowCheckTheAmountAndDeadlineForYourReservationBelow",
  );
  const tone =
    paymentSucceeded || reservationWithoutImmediatePayment
      ? "success"
      : paymentFailure
        ? "error"
        : "pending";

  const hasPix =
    activePayment?.flowKind === "pix" &&
    activePayment.status === "pending" &&
    activePayment.copyPasteCode;
  return {
    t,
    paymentContext,
    paymentTargetId,
    loadState,
    setLoadState,
    customerActionError,
    setCustomerActionError,
    pixCopied,
    setPixCopied,
    fetchPaymentSession,
    loadSession,
    handleRefreshStatus,
    paymentSucceeded,
    paymentFailure,
    activePayment,
    customerAction,
    customerActionExpired,
    shouldPoll,
    handleCustomerAction,
    handleCopyPix,
    reservationWithoutImmediatePayment,
    pendingReservation,
    reservationTitle,
    reservationDescription,
    tone,
    hasPix,
  };
};
