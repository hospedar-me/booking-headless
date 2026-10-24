type HospedarMeTestCardData = {
  installments: number;
  paymentMethodToken: string;
};
("use client");
import type { HookContext } from "./context";
type AppLocale = string;
const translateUi = (_locale: string, key: string) => key;
import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import type { FooterViewData } from "../models/home";
import {
  executeBookingCustomerAction,
  isBookingCustomerActionExpired,
} from "../browser/customer-action";
import {
  buildBookingPaymentStatusUrl,
  getBookingPaymentAmountInCents,
  getPendingBookingPaymentResumeUrl,
  buildReservationBalancePaymentStatusUrl,
  type BookingCardCheckoutData,
  type BookingCardSession,
  type BookingPaymentContext,
  type BookingPaymentPayer,
  type BookingPaymentSession,
} from "../core/booking-payment";
type PaymentStep = "payer" | "method" | "payment";
type BookingPaymentPageProps = {
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
type PaymentPayerErrors = Partial<Record<keyof BookingPaymentPayer, string>>;
export const EMPTY_PAYER: BookingPaymentPayer = {
  email: "",
  firstName: "",
  identificationNumber: "",
  identificationType: "CPF",
  lastName: "",
};
export const validatePayer = (
  payer: BookingPaymentPayer,
  t: (key: string, values?: Record<string, string | number>) => string,
): PaymentPayerErrors => {
  const errors: PaymentPayerErrors = {};

  if (!payer.firstName.trim()) {
    errors.firstName = t("validation.firstName");
  }

  if (!payer.lastName.trim()) {
    errors.lastName = t("validation.lastName");
  }

  if (!payer.email.trim()) {
    errors.email = t("validation.email");
  } else if (!/\S+@\S+\.\S+/.test(payer.email)) {
    errors.email = t("validation.validEmail");
  }

  if (!payer.identificationType.trim()) {
    errors.identificationType = t("validation.documentType");
  }

  if (!payer.identificationNumber.trim()) {
    errors.identificationNumber = t("validation.documentNumber");
  }

  return errors;
};
export const useBookingPayment = (
  {
    footerData,
    locale,
    preReservationId,
    reservationId,
    obligationId,
  }: BookingPaymentPageProps,
  context: HookContext,
) => {
  const {
    actionCreateBookingCardSession,
    actionCreateBookingPixInstruction,
    actionGetBookingPaymentSession,
  } = context.operations;
  const translateUi = context.translate;
  const {
    PAYMENT_PROVIDER_PUBLIC_KEYS,
    getPaymentProviderLabel,
    isBookingFrontendPaymentProvider,
  } = context.paymentProviders;
  const copyLocale = context.locale;
  const t = context.translations("bookingPayment.page");
  const router = context.navigation;
  const paymentContext: BookingPaymentContext = reservationId
    ? "reservation_balance"
    : "pre_reservation";
  const paymentTargetId = reservationId ?? preReservationId ?? null;
  const resumedReservationTitle = translateUi(
    locale === "pt" ? "pt" : "en",
    "BookingPaymentPage.completeYourReservation",
  );
  const [currentStep, setCurrentStep] = useState<PaymentStep>("payer");
  const [loadState, setLoadState] = useState<PaymentLoadState>({
    error: null,
    loading: Boolean(paymentTargetId),
    session: null,
  });
  const [selectedMethodId, setSelectedMethodId] = useState<number | null>(null);
  const [payer, setPayer] = useState<BookingPaymentPayer>(EMPTY_PAYER);
  const [payerErrors, setPayerErrors] = useState<PaymentPayerErrors>({});
  const [pixError, setPixError] = useState<string | null>(null);
  const [pixLoading, setPixLoading] = useState(false);
  const pixInFlight = useRef(false);
  const pixAttempt = useRef<{ fingerprint: string; key: string } | null>(null);
  const [cardError, setCardError] = useState<string | null>(null);
  const [cardLoading, setCardLoading] = useState(false);
  const [brickReady, setBrickReady] = useState(false);
  const testProviderPublishableKey =
    PAYMENT_PROVIDER_PUBLIC_KEYS.hospedar_me_test;
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
        error: t("errors.load"),
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

    setLoadState((current) => ({ ...current, error: null, loading: true }));
    const nextState = await fetchPaymentSession();
    const resumeUrl = getPendingBookingPaymentResumeUrl(
      locale,
      nextState.session,
      {
        context: paymentContext,
        id: paymentTargetId,
        obligationId,
      },
    );
    if (resumeUrl) {
      router.replace(resumeUrl);
      return;
    }

    if (
      paymentContext === "pre_reservation" &&
      preReservationId &&
      nextState.session &&
      (nextState.session.status === "completed" ||
        (nextState.session.status === "active" &&
          nextState.session.confirmationRequiresPayment === false))
    ) {
      router.replace(buildBookingPaymentStatusUrl(locale, preReservationId));
      return;
    }

    setLoadState({
      error: nextState.error,
      loading: false,
      session: nextState.session,
    });
  });
  useEffect(() => {
    void loadSession();
  }, [paymentTargetId, obligationId]);
  const paymentAmountInCents = loadState.session
    ? getBookingPaymentAmountInCents(loadState.session, paymentContext)
    : 0;
  const resolvedSelectedMethodId =
    selectedMethodId ?? loadState.session?.paymentMethods[0]?.id ?? null;
  const selectedMethod = useMemo(
    () =>
      loadState.session?.paymentMethods.find(
        (method) => method.id === resolvedSelectedMethodId,
      ) ?? null,
    [loadState.session, resolvedSelectedMethodId],
  );
  const selectedProvider = isBookingFrontendPaymentProvider(
    selectedMethod?.provider,
  )
    ? selectedMethod.provider
    : null;
  const selectedProviderPublicKey = selectedProvider
    ? PAYMENT_PROVIDER_PUBLIC_KEYS[selectedProvider]
    : "";
  const acceptedTerms = selectedMethod?.commercialTermsByReservation ?? [];
  const selectedCardInstallments = useMemo(() => {
    if (
      !loadState.session ||
      selectedMethod?.type !== "credit_card" ||
      !selectedMethod.creditCardConfig
    ) {
      return [1];
    }

    return selectedMethod.allowedInstallments;
  }, [loadState.session, selectedMethod]);
  const updatePayerField = (
    field: keyof BookingPaymentPayer,
    value: string,
  ) => {
    setPayer((current) => ({ ...current, [field]: value }));
    setPayerErrors((current) => ({ ...current, [field]: undefined }));
    setPixError(null);
    setCardError(null);
  };
  const ensurePayerIsValid = () => {
    const errors = validatePayer(payer, t);
    setPayerErrors(errors);
    return Object.keys(errors).length === 0;
  };
  const navigateToWaitingPage = () => {
    if (!paymentTargetId) return;
    router.push(
      paymentContext === "reservation_balance"
        ? buildReservationBalancePaymentStatusUrl(
            locale,
            paymentTargetId,
            obligationId,
          )
        : buildBookingPaymentStatusUrl(locale, paymentTargetId),
    );
  };
  const finishCardPayment = async (session: BookingCardSession) => {
    if (session.customerAction) {
      if (isBookingCustomerActionExpired(session.customerAction)) {
        throw new Error(t("errors.action"));
      }

      executeBookingCustomerAction(session.customerAction);
      return;
    }

    navigateToWaitingPage();
  };
  const handleGeneratePix = async () => {
    if (pixInFlight.current || !resolvedSelectedMethodId || !paymentTargetId)
      return;
    if (!ensurePayerIsValid()) return;

    const fingerprint = JSON.stringify({
      paymentContext,
      paymentTargetId,
      obligationId,
      acceptedTerms,
      resolvedSelectedMethodId,
      payer,
    });
    if (pixAttempt.current?.fingerprint !== fingerprint) {
      pixAttempt.current = { fingerprint, key: crypto.randomUUID() };
    }
    pixInFlight.current = true;
    setPixLoading(true);
    setPixError(null);

    try {
      const result = await actionCreateBookingPixInstruction({
        idempotencyKey: pixAttempt.current.key,
        context: paymentContext,
        obligationId,
        id: paymentTargetId,
        locale,
        payload: {
          paymentMethodId: resolvedSelectedMethodId,
          payer,
        },
      });

      if (result.error || !result.data) {
        throw new Error(result.error ?? t("errors.action"));
      }

      setPixLoading(false);
      navigateToWaitingPage();
    } catch (error) {
      // Creation may have committed even if the browser did not receive its response.
      const refreshed = await fetchPaymentSession().catch(() => null);
      const resumeUrl = getPendingBookingPaymentResumeUrl(
        locale,
        refreshed?.session ?? null,
        {
          context: paymentContext,
          id: paymentTargetId,
          obligationId,
        },
      );
      if (resumeUrl) {
        router.replace(resumeUrl);
        return;
      }
      setPixError(
        error instanceof Error && error.message
          ? error.message
          : t("errors.action"),
      );
    } finally {
      pixInFlight.current = false;
      setPixLoading(false);
    }
  };
  const handleMercadoPagoCardSubmit = async (
    checkout: BookingCardCheckoutData,
  ) => {
    if (!resolvedSelectedMethodId || !paymentTargetId) {
      throw new Error(t("errors.identifyReservationOrMethod"));
    }

    if (!ensurePayerIsValid()) {
      throw new Error(t("errors.fillPayer"));
    }

    setCardLoading(true);
    setCardError(null);

    const result = await actionCreateBookingCardSession({
      context: paymentContext,
      obligationId,
      id: paymentTargetId,
      locale,
      payload: {
        paymentMethodId: resolvedSelectedMethodId,
        payer,
        checkout,
      },
    });

    if (result.error || !result.data) {
      const message = t("errors.action");
      setCardError(message);
      setCardLoading(false);
      throw new Error(message);
    }

    setCardLoading(false);
    await finishCardPayment(result.data);
  };
  const handleStripeCardSubmit = async () => {
    if (!resolvedSelectedMethodId || !paymentTargetId) {
      throw new Error(t("errors.identifyReservationOrMethod"));
    }

    if (!ensurePayerIsValid()) {
      throw new Error(t("errors.fillPayer"));
    }

    setCardLoading(true);
    setCardError(null);

    const result = await actionCreateBookingCardSession({
      context: paymentContext,
      obligationId,
      id: paymentTargetId,
      locale,
      payload: {
        paymentMethodId: resolvedSelectedMethodId,
        payer,
      },
    });

    setCardLoading(false);

    if (result.error || !result.data) {
      const message = t("errors.action");
      setCardError(message);
      throw new Error(message);
    }

    return {
      clientSecret: result.data.clientSecret,
      customerAction: result.data.customerAction,
      sellerProviderAccountId: result.data.sellerProviderAccountId,
    };
  };
  const handleTestProviderCardSubmit = async (
    testData: HospedarMeTestCardData,
  ) => {
    if (!resolvedSelectedMethodId || !paymentTargetId) {
      throw new Error(t("errors.identifyReservationOrMethod"));
    }

    if (!ensurePayerIsValid()) {
      throw new Error(t("errors.fillPayer"));
    }

    setCardLoading(true);
    setCardError(null);

    const result = await actionCreateBookingCardSession({
      context: paymentContext,
      obligationId,
      id: paymentTargetId,
      locale,
      payload: {
        paymentMethodId: resolvedSelectedMethodId,
        payer,
        checkout: {
          installments: testData.installments,
          providerCheckoutToken: testData.paymentMethodToken,
        },
      },
    });

    if (result.error || !result.data) {
      const message = t("errors.action");
      setCardError(message);
      setCardLoading(false);
      throw new Error(message);
    }

    setCardLoading(false);
    await finishCardPayment(result.data);
  };
  const cardBrickKey = useMemo(() => {
    if (!loadState.session || !resolvedSelectedMethodId)
      return "card-brick-empty";
    return [
      loadState.session.preReservationId ??
        loadState.session.reservationId ??
        paymentTargetId,
      resolvedSelectedMethodId,
      payer.email,
      payer.identificationType,
      payer.identificationNumber,
    ].join(":");
  }, [
    loadState.session,
    payer.email,
    payer.identificationNumber,
    payer.identificationType,
    paymentTargetId,
    resolvedSelectedMethodId,
  ]);
  const handleNextFromPayer = () => {
    const errors = validatePayer(payer, t);
    setPayerErrors(errors);
    if (Object.keys(errors).length === 0) setCurrentStep("method");
  };
  const handleNextFromMethod = () => {
    if (resolvedSelectedMethodId !== null) setCurrentStep("payment");
  };
  return {
    copyLocale,
    t,
    router,
    paymentContext,
    paymentTargetId,
    resumedReservationTitle,
    currentStep,
    setCurrentStep,
    loadState,
    setLoadState,
    selectedMethodId,
    setSelectedMethodId,
    payer,
    setPayer,
    payerErrors,
    setPayerErrors,
    pixError,
    setPixError,
    pixLoading,
    setPixLoading,
    pixInFlight,
    pixAttempt,
    cardError,
    setCardError,
    cardLoading,
    setCardLoading,
    brickReady,
    setBrickReady,
    testProviderPublishableKey,
    fetchPaymentSession,
    loadSession,
    paymentAmountInCents,
    resolvedSelectedMethodId,
    selectedMethod,
    selectedProvider,
    selectedProviderPublicKey,
    acceptedTerms,
    selectedCardInstallments,
    updatePayerField,
    ensurePayerIsValid,
    navigateToWaitingPage,
    finishCardPayment,
    handleGeneratePix,
    handleMercadoPagoCardSubmit,
    handleStripeCardSubmit,
    handleTestProviderCardSubmit,
    cardBrickKey,
    handleNextFromPayer,
    handleNextFromMethod,
  };
};
