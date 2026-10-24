const translateUi = (_locale: string, key: string) => key;
import type {
  BookingEngineActivePayment,
  BookingEngineCardCheckoutDataRequest,
  BookingEngineCardSessionResponse,
  BookingEngineCreditCardPaymentMethodConfig,
  BookingEngineCustomerAction,
  BookingEngineDebitCardPaymentMethodConfig,
  BookingEnginePayerRequest,
  BookingEnginePixPaymentMethodConfig,
  BookingEnginePreReservationPaymentItem,
  BookingEnginePreReservationPaymentSessionResponse,
  BookingEnginePublicPaymentMethod,
  BookingEngineReservationBalanceCardSessionResponse,
  BookingEngineReservationBalancePaymentSessionResponse,
  CardNetwork,
  CreateBookingEngineCardSessionRequest,
  PaymentFlowKind,
  PaymentProviderKind,
  PaymentProviderStatus,
  PreReservationStatus,
  PreReservationResponse,
  ReservationBalancePaymentStatus,
  ReservationPaymentMethodKind,
  ReservationStatus,
} from "../sdk/types.gen";

export type BookingPaymentContext = "pre_reservation" | "reservation_balance";
export type BookingPaymentMethodKind = ReservationPaymentMethodKind;
export type BookingPaymentProvider = PaymentProviderKind;
export type BookingPaymentStatus = PaymentProviderStatus;
export type BookingPaymentFlowKind = PaymentFlowKind;
export type BookingPreReservationStatus = PreReservationStatus;
export type BookingPaymentCustomerAction = BookingEngineCustomerAction;
export type BookingPaymentCreditCardConfig =
  BookingEngineCreditCardPaymentMethodConfig;
export type BookingPaymentDebitCardConfig =
  BookingEngineDebitCardPaymentMethodConfig;
export type BookingPaymentPixConfig = BookingEnginePixPaymentMethodConfig;
export type BookingPaymentMethod = BookingEnginePublicPaymentMethod;
export type BookingPaymentSessionItem = BookingEnginePreReservationPaymentItem;
export type BookingPaymentPayer = BookingEnginePayerRequest;
export type BookingActivePayment = BookingEngineActivePayment;
export type BookingCardCheckoutData = BookingEngineCardCheckoutDataRequest;
export type BookingCardSessionRequest = CreateBookingEngineCardSessionRequest;

type OptionalKeys<T> = {
  [K in keyof T]-?: object extends Pick<T, K> ? K : never;
}[keyof T];

type CommonKeys<T, U> = keyof T & keyof U;
type RequiredCommonKeys<T, U> = Exclude<
  CommonKeys<T, U>,
  OptionalKeys<T> | OptionalKeys<U>
>;
type OptionalCommonKeys<T, U> = Exclude<
  CommonKeys<T, U>,
  RequiredCommonKeys<T, U>
>;

type MergeApiVariants<T, U> = {
  [K in RequiredCommonKeys<T, U>]: T[K] | U[K];
} & {
  [K in OptionalCommonKeys<T, U>]?: T[K] | U[K];
} & Partial<Omit<T, keyof U> & Omit<U, keyof T>>;

export type BookingPaymentSession = MergeApiVariants<
  BookingEnginePreReservationPaymentSessionResponse,
  BookingEngineReservationBalancePaymentSessionResponse
>;

export type BookingCardSession = MergeApiVariants<
  BookingEngineCardSessionResponse,
  BookingEngineReservationBalanceCardSessionResponse
>;

export type ReservationPaymentAction =
  | {
      href: string;
      kind: "resume_pre_reservation";
    }
  | {
      href: string;
      kind: "reservation_balance";
    }
  | null;

export const buildBookingPaymentUrl = (
  locale: string,
  preReservationId: string,
) => {
  const query = new URLSearchParams();
  query.set("preReservationId", preReservationId);
  return `/${locale}/booking/payment?${query.toString()}`;
};

export const buildBookingPaymentStatusUrl = (
  locale: string,
  preReservationId: string,
) => {
  const query = new URLSearchParams();
  query.set("preReservationId", preReservationId);
  return `/${locale}/booking/payment/status?${query.toString()}`;
};

export const buildReservationBalancePaymentUrl = (
  locale: string,
  reservationId: string,
  obligationId?: string | null,
) => {
  const query = obligationId ? `?${new URLSearchParams({ obligationId })}` : "";
  return `/${locale}/my-reservations/${reservationId}/payment${query}`;
};

export const buildReservationBalancePaymentStatusUrl = (
  locale: string,
  reservationId: string,
  obligationId?: string | null,
) => {
  const query = obligationId ? `?${new URLSearchParams({ obligationId })}` : "";
  return `/${locale}/my-reservations/${reservationId}/payment/status${query}`;
};

const BALANCE_PAYMENT_STATUSES = new Set<ReservationStatus>([
  "Pending",
  "Confirmed",
  "CheckedIn",
]);

export const getReservationPaymentAction = ({
  locale,
  openBalanceInCents,
  preReservationId,
  reservationId,
  status,
}: {
  locale: string;
  openBalanceInCents: number;
  preReservationId?: string | null;
  reservationId: string;
  status: ReservationStatus;
}): ReservationPaymentAction => {
  if (status === "Hold") {
    return preReservationId
      ? {
          href: buildBookingPaymentUrl(locale, preReservationId),
          kind: "resume_pre_reservation",
        }
      : null;
  }

  if (openBalanceInCents <= 0 || !BALANCE_PAYMENT_STATUSES.has(status)) {
    return null;
  }

  return {
    href: buildReservationBalancePaymentUrl(locale, reservationId),
    kind: "reservation_balance",
  };
};

export const getBookingReservationStatusLabel = (
  status: PreReservationStatus | ReservationBalancePaymentStatus,
  locale: string,
) => translateUi(locale, `enums.getBookingReservationStatusLabel.${status}`);

export const getBookingPaymentStatusLabel = (
  status: PaymentProviderStatus,
  locale: string,
) => translateUi(locale, `enums.getBookingPaymentStatusLabel.${status}`);

export const getBookingPaymentFlowLabel = (
  flowKind: PaymentFlowKind,
  locale: string,
) => translateUi(locale, `enums.getBookingPaymentFlowLabel.${flowKind}`);

export const isBookingCardPaymentMethod = (
  method?: Pick<BookingEnginePublicPaymentMethod, "type"> | null,
) => method?.type === "credit_card" || method?.type === "debit_card";

export const getBookingPaymentMethodAcceptedNetworks = (
  method?: Pick<
    BookingEnginePublicPaymentMethod,
    "type" | "creditCardConfig" | "debitCardConfig"
  > | null,
): CardNetwork[] => {
  if (method?.type === "credit_card")
    return method.creditCardConfig?.acceptedNetworks ?? [];
  if (method?.type === "debit_card")
    return method.debitCardConfig?.acceptedNetworks ?? [];
  return [];
};

export const isBookingPaymentTerminalStatus = (
  status: PaymentProviderStatus,
) => {
  return (
    status === "approved" ||
    status === "rejected" ||
    status === "cancelled" ||
    status === "expired"
  );
};

export const getBookingPaymentAttemptStatus = (
  session: BookingPaymentSession | null,
) => {
  if (!session?.activePayment) return null;
  return session.activePayment.status;
};

export const hasBookingPaymentSucceeded = (
  session: BookingPaymentSession | null,
) => {
  if (!session) return false;
  return (
    (session.status === "completed" &&
      (session.items?.length ?? 0) > 0 &&
      session.items!.every((item) =>
        ["Confirmed", "CheckedIn", "CheckedOut"].includes(
          item.reservationStatus,
        ),
      )) ||
    session.status === "paid" ||
    session.activePayment?.status === "approved"
  );
};

export const getBookingPaymentFailureStatus = (
  session: BookingPaymentSession | null,
) => {
  if (!session) return null;
  if (session.status === "expired")
    return "expired" satisfies PaymentProviderStatus;
  if (session.status === "cancelled")
    return "cancelled" satisfies PaymentProviderStatus;

  const attemptStatus = getBookingPaymentAttemptStatus(session);
  if (!attemptStatus) return null;

  return attemptStatus === "rejected" ||
    attemptStatus === "cancelled" ||
    attemptStatus === "expired"
    ? attemptStatus
    : null;
};

/** Approval and reservation confirmation can be projected by different consumers. */
export const shouldPollBookingPaymentSession = (
  session: BookingPaymentSession | null,
) => {
  if (getBookingPaymentFailureStatus(session)) return false;
  if (!hasBookingPaymentSucceeded(session)) return true;
  return Boolean(
    session?.items?.some(
      (item) =>
        item.reservationStatus === "Pending" ||
        item.reservationStatus === "Hold",
    ),
  );
};

export const getBookingCheckoutNextUrl = (
  locale: string,
  reservation: Pick<
    PreReservationResponse,
    "preReservationId" | "status" | "confirmationRequiresPayment"
  >,
) =>
  reservation.status === "completed" || !reservation.confirmationRequiresPayment
    ? buildBookingPaymentStatusUrl(locale, reservation.preReservationId)
    : buildBookingPaymentUrl(locale, reservation.preReservationId);

export const getBookingPaymentAmountInCents = (
  session: BookingPaymentSession,
  context: BookingPaymentContext,
) =>
  context === "pre_reservation"
    ? (session.amountDueNowInCents ?? 0)
    : session.totalInCents;

/** A pending collection must be continued before another one can be opened. */
export const getPendingBookingPaymentResumeUrl = (
  locale: string,
  session: BookingPaymentSession | null,
  target: { context: BookingPaymentContext; id: string; obligationId?: string },
): string | null => {
  if (session?.activePayment?.status !== "pending") return null;
  return target.context === "reservation_balance"
    ? buildReservationBalancePaymentStatusUrl(
        locale,
        target.id,
        target.obligationId,
      )
    : buildBookingPaymentStatusUrl(locale, target.id);
};
