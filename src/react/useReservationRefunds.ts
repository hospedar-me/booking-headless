"use client";
import type { HookContext } from "./context";
type AppLocale = string;
const translateUi = (_locale: string, key: string) => key;
import { useEffect, useState } from "react";
import type {
  GuestRefundEligiblePaymentResponse,
  GuestRefundRequestResponse,
  PaymentRefundRequestStatus,
  Reservation,
} from "../sdk/types.gen";
export const activeStatuses: PaymentRefundRequestStatus[] = [
  "pending",
  "approved",
  "processing",
];
type RefundRequestsSectionProps = {
  buttonText?: string;
  className?: string;
  hideAction?: boolean;
  hideHeader?: boolean;
  locale: AppLocale;
  mode?: "section" | "button";
  reservation: Reservation;
  showWhenEmpty?: boolean;
};
export const centsToInputValue = (amountInCents: number) =>
  (amountInCents / 100).toFixed(2);
export const parseAmountInputToCents = (value: string) => {
  const normalized = value.trim().replace(",", ".");
  if (!normalized) return 0;

  const amount = Number(normalized);
  if (!Number.isFinite(amount)) return Number.NaN;

  return Math.round(amount * 100);
};
export const useReservationRefunds = (
  {
    buttonText,
    className,
    hideAction = false,
    hideHeader = false,
    locale,
    mode = "section",
    reservation,
    showWhenEmpty = true,
  }: RefundRequestsSectionProps,
  context: HookContext,
) => {
  const {
    actionCreateMyReservationRefundRequest,
    actionListMyReservationRefundRequests,
  } = context.operations;
  const translateUi = context.translate;
  const {
    PAYMENT_PROVIDER_PUBLIC_KEYS,
    getPaymentProviderLabel,
    isBookingFrontendPaymentProvider,
  } = context.paymentProviders;
  const t = context.translations("myReservations.refunds");
  const [requests, setRequests] = useState<GuestRefundRequestResponse[]>([]);
  const [overpaidAmount, setOverpaidAmount] = useState(0);
  const [eligiblePayments, setEligiblePayments] = useState<
    GuestRefundEligiblePaymentResponse[]
  >([]);
  const [selectedPaymentAllocationId, setSelectedPaymentAllocationId] =
    useState("");
  const [amountInput, setAmountInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const hasActiveRequest = requests.some((request) =>
    activeStatuses.includes(request.status),
  );
  const selectedPayment = eligiblePayments.find(
    (payment) => payment.paymentAllocationId === selectedPaymentAllocationId,
  );
  const requestedAmountInCents = parseAmountInputToCents(amountInput);
  const selectedPaymentLimit = selectedPayment?.refundableAmountInCents ?? 0;
  const canRequest = overpaidAmount > 0 && eligiblePayments.length > 0;
  const canSubmit =
    !submitting &&
    !!selectedPayment &&
    !!reason.trim() &&
    requestedAmountInCents > 0 &&
    requestedAmountInCents <= selectedPaymentLimit;
  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      setLoadError(null);

      const result = await actionListMyReservationRefundRequests(
        reservation.id,
        locale,
      );

      if (!active) return;
      setLoading(false);

      if (result.error || !result.data) {
        setLoadError(result.error ?? t("errors.load"));
        return;
      }

      const payload = result.data;
      setRequests(payload.data);
      setOverpaidAmount(payload.overpaidAmountInCents);
      setEligiblePayments(payload.eligiblePayments);

      const firstPayment = payload.eligiblePayments[0];
      setSelectedPaymentAllocationId(firstPayment?.paymentAllocationId ?? "");
      setAmountInput(
        firstPayment
          ? centsToInputValue(firstPayment.refundableAmountInCents)
          : "",
      );
    };

    void load();
    return () => {
      active = false;
    };
  }, [locale, reservation.id, t]);
  const handleDialogChange = (open: boolean) => {
    if (!open && submitting) return;
    setDialogOpen(open);
    if (!open) {
      setReason("");
      setSubmitError(null);
    }
  };
  const handlePaymentChange = (paymentAllocationId: string) => {
    const payment = eligiblePayments.find(
      (item) => item.paymentAllocationId === paymentAllocationId,
    );
    setSelectedPaymentAllocationId(paymentAllocationId);
    setAmountInput(
      payment ? centsToInputValue(payment.refundableAmountInCents) : "",
    );
    setSubmitError(null);
  };
  const handleSubmit = async () => {
    const trimmedReason = reason.trim();

    if (!selectedPayment) {
      setSubmitError(t("errors.selectPayment"));
      return;
    }

    if (!trimmedReason) {
      setSubmitError(t("errors.reason"));
      return;
    }

    if (
      !Number.isFinite(requestedAmountInCents) ||
      requestedAmountInCents <= 0
    ) {
      setSubmitError(t("errors.validAmount"));
      return;
    }

    if (requestedAmountInCents > selectedPaymentLimit) {
      setSubmitError(t("errors.amountLimit"));
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    const result = await actionCreateMyReservationRefundRequest({
      locale,
      reservationId: reservation.id,
      payload: {
        amountInCents: requestedAmountInCents,
        paymentAllocationId: selectedPayment.paymentAllocationId,
        paymentId: selectedPayment.paymentId,
        reason: trimmedReason,
      },
    });

    setSubmitting(false);

    if (result.error || !result.data) {
      setSubmitError(result.error ?? t("errors.submit"));
      return;
    }

    const payload = result.data;
    const nextOverpaidAmount = Math.max(
      0,
      overpaidAmount - payload.amountInCents,
    );
    const nextEligiblePayments = eligiblePayments
      .map((payment) => {
        const isSelectedPayment =
          payment.paymentId === payload.paymentId &&
          payment.paymentAllocationId === payload.paymentAllocationId;
        const paymentRemainingAmount = isSelectedPayment
          ? payment.refundableAmountInCents - payload.amountInCents
          : payment.refundableAmountInCents;

        return {
          ...payment,
          activeRequestedInCents: isSelectedPayment
            ? payment.activeRequestedInCents + payload.amountInCents
            : payment.activeRequestedInCents,
          refundableAmountInCents: Math.min(
            nextOverpaidAmount,
            Math.max(0, paymentRemainingAmount),
          ),
        };
      })
      .filter((payment) => payment.refundableAmountInCents > 0);
    const nextSelectedPayment =
      nextEligiblePayments.find(
        (payment) =>
          payment.paymentAllocationId === selectedPaymentAllocationId,
      ) ?? nextEligiblePayments[0];

    setRequests((current) => [payload, ...current]);
    window.dispatchEvent(
      new CustomEvent(`reservation-refund-request-created:${reservation.id}`, {
        detail: payload,
      }),
    );
    setOverpaidAmount(nextOverpaidAmount);
    setEligiblePayments(nextEligiblePayments);
    setSelectedPaymentAllocationId(
      nextSelectedPayment?.paymentAllocationId ?? "",
    );
    setAmountInput(
      nextSelectedPayment
        ? centsToInputValue(nextSelectedPayment.refundableAmountInCents)
        : "",
    );
    setReason("");
    setDialogOpen(false);
  };
  return {
    t,
    requests,
    setRequests,
    overpaidAmount,
    setOverpaidAmount,
    eligiblePayments,
    setEligiblePayments,
    selectedPaymentAllocationId,
    setSelectedPaymentAllocationId,
    amountInput,
    setAmountInput,
    loading,
    setLoading,
    loadError,
    setLoadError,
    dialogOpen,
    setDialogOpen,
    reason,
    setReason,
    submitting,
    setSubmitting,
    submitError,
    setSubmitError,
    hasActiveRequest,
    selectedPayment,
    requestedAmountInCents,
    selectedPaymentLimit,
    canRequest,
    canSubmit,
    handleDialogChange,
    handlePaymentChange,
    handleSubmit,
  };
};
