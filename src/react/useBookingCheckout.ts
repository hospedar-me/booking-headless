"use client";
import type { HookContext } from "./context";
type AppLocale = string;
const translateUi = (_locale: string, key: string) => key;
import { useEffect, useRef, useState } from "react";
import type { FooterViewData } from "../models/home";
import type {
  BookingCheckoutAuthChoice,
  BookingFederatedUser,
} from "../models/auth";
import { isBookingAuthPopupMessage } from "../models/auth";
import {
  BookingCheckoutValidationError,
  buildPreReservationRequest,
  type BookingCheckoutState,
  type GuestCheckoutFormData,
} from "../core/booking-checkout";
import { getBookingCheckoutNextUrl } from "../core/booking-payment";
import { buildBookingResultsUrl } from "../core/booking-results";
import { buildSelectionPreviewPayload } from "../core/booking-selection-request";
import type { BookingEngineSelectionPreviewResponse } from "../sdk/types.gen";
import type { BookingEngineReservationPoliciesResponse } from "../sdk/types.gen";
type CheckoutPageProps = {
  footerData: FooterViewData;
  initialAuthenticatedUser: BookingFederatedUser | null;
  initialState: BookingCheckoutState | null;
  locale: AppLocale;
};
type GuestCheckoutFormErrors = Partial<
  Record<keyof GuestCheckoutFormData, string>
>;
type SubmissionState = {
  error: string | null;
  submitting: boolean;
};
type LogoutState = {
  error: string | null;
  submitting: boolean;
};
type PendingAuthPopup = {
  mode: Exclude<BookingCheckoutAuthChoice, "guest">;
  state: string;
};
export const EMPTY_FORM: GuestCheckoutFormData = {
  email: "",
  fullName: "",
  notes: "",
  phone: "",
};
export const validateGuestForm = (
  value: GuestCheckoutFormData,
  t: (key: string) => string,
): GuestCheckoutFormErrors => {
  const errors: GuestCheckoutFormErrors = {};

  if (!value.fullName.trim()) {
    errors.fullName = t("validation.fullName");
  }

  if (!value.email.trim()) {
    errors.email = t("validation.email");
  } else if (!/\S+@\S+\.\S+/.test(value.email)) {
    errors.email = t("validation.validEmail");
  }

  if (!value.phone.trim()) {
    errors.phone = t("validation.phone");
  }

  return errors;
};
export const mergeAuthenticatedUserIntoForm = (
  current: GuestCheckoutFormData,
  authenticatedUser: BookingFederatedUser,
): GuestCheckoutFormData => {
  return {
    ...current,
    email: authenticatedUser.email ?? current.email,
    fullName: authenticatedUser.fullName || current.fullName,
    phone: authenticatedUser.phone ?? current.phone,
  };
};
export const useBookingCheckout = (
  {
    footerData,
    initialAuthenticatedUser,
    initialState,
    locale,
  }: CheckoutPageProps,
  context: HookContext,
) => {
  const {
    actionGetBookingAuthSession,
    actionLogoutBookingAuthSession,
    actionStartBookingAuthorization,
    actionCreateBookingPreReservation,
    actionPreviewBookingSelection,
    actionGetReservationPolicies,
  } = context.operations;
  const translateUi = context.translate;
  const {
    PAYMENT_PROVIDER_PUBLIC_KEYS,
    getPaymentProviderLabel,
    isBookingFrontendPaymentProvider,
  } = context.paymentProviders;
  const copyLocale = context.locale;
  const t = context.translations("bookingCheckout");
  const router = context.navigation;
  const [formData, setFormData] = useState<GuestCheckoutFormData>(() =>
    initialAuthenticatedUser
      ? mergeAuthenticatedUserIntoForm(EMPTY_FORM, initialAuthenticatedUser)
      : EMPTY_FORM,
  );
  const [errors, setErrors] = useState<GuestCheckoutFormErrors>({});
  const [submissionState, setSubmissionState] = useState<SubmissionState>({
    error: null,
    submitting: false,
  });
  const [authChoice, setAuthChoice] =
    useState<BookingCheckoutAuthChoice | null>(
      initialAuthenticatedUser ? "login" : null,
    );
  const [authenticatedUser, setAuthenticatedUser] =
    useState<BookingFederatedUser | null>(initialAuthenticatedUser);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [logoutState, setLogoutState] = useState<LogoutState>({
    error: null,
    submitting: false,
  });
  const [selectionPreview, setSelectionPreview] =
    useState<BookingEngineSelectionPreviewResponse | null>(null);
  const [selectionPreviewError, setSelectionPreviewError] = useState<
    string | null
  >(null);
  const [selectionPreviewLoading, setSelectionPreviewLoading] = useState(false);
  const [reservationPolicies, setReservationPolicies] =
    useState<BookingEngineReservationPoliciesResponse | null>(null);
  const pendingAuthPopupRef = useRef<PendingAuthPopup | null>(null);
  const reservationAttempt = useRef<{
    key: string;
    fingerprint: string;
  } | null>(null);
  const authPopupRef = useRef<Window | null>(null);
  const popupWatchRef = useRef<number | null>(null);
  const clearPopupWatch = () => {
    if (popupWatchRef.current !== null) {
      window.clearInterval(popupWatchRef.current);
      popupWatchRef.current = null;
    }
  };
  const resultsUrl = initialState
    ? buildBookingResultsUrl(locale, initialState.criteria)
    : `/${locale}`;
  useEffect(() => {
    if (!initialAuthenticatedUser) return;

    setFormData((current) =>
      mergeAuthenticatedUserIntoForm(current, initialAuthenticatedUser),
    );
  }, [initialAuthenticatedUser]);
  useEffect(() => {
    if (
      !initialState ||
      initialState.items.length === 0 ||
      initialState.hasMixedPlans
    ) {
      setSelectionPreview(null);
      setSelectionPreviewError(null);
      setSelectionPreviewLoading(false);
      return;
    }

    const ratePlanIds = Array.from(
      new Set(initialState.items.map((item) => item.ratePlanId)),
    );
    if (
      ratePlanIds.length !== 1 ||
      !initialState.criteria.checkIn ||
      !initialState.criteria.checkOut
    ) {
      setSelectionPreview(null);
      return;
    }

    let active = true;

    const run = async () => {
      setSelectionPreviewLoading(true);
      setSelectionPreviewError(null);

      try {
        const response = await actionPreviewBookingSelection({
          locale,
          payload: buildSelectionPreviewPayload(
            initialState.criteria,
            initialState.items,
            ratePlanIds[0],
          ),
        });

        if (!active) return;

        if (response.error) {
          throw new Error("selection_preview_failed");
        }

        setSelectionPreview(response.data ?? null);
      } catch {
        if (!active) return;
        setSelectionPreview(null);
        setSelectionPreviewError(t("errors.selectionPreview"));
      } finally {
        if (active) setSelectionPreviewLoading(false);
      }
    };

    void run();

    return () => {
      active = false;
    };
  }, [initialState, locale, t]);
  useEffect(() => {
    let active = true;
    void actionGetReservationPolicies(locale).then((result) => {
      if (active && result.data) setReservationPolicies(result.data);
    });
    return () => {
      active = false;
    };
  }, [locale]);
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      const pendingAuthPopup = pendingAuthPopupRef.current;
      const popup = authPopupRef.current;
      if (!pendingAuthPopup || !popup) return;
      if (event.origin !== window.location.origin) return;
      if (event.source !== popup) return;
      if (!isBookingAuthPopupMessage(event.data)) return;
      if (event.data.state !== pendingAuthPopup.state) return;

      setAuthLoading(true);
      setAuthError(null);

      try {
        if (event.data.status !== "success") {
          throw new Error(t("errors.identification"));
        }

        const result = await actionGetBookingAuthSession(locale);
        const nextUser = result.data?.authenticatedUser ?? null;

        if (result.error || !nextUser) {
          throw new Error(t("errors.identification"));
        }

        setAuthenticatedUser(nextUser);
        setAuthChoice(pendingAuthPopup.mode);
        setFormData((current) =>
          mergeAuthenticatedUserIntoForm(current, nextUser),
        );
        setSubmissionState((current) => ({ ...current, error: null }));
      } catch (error) {
        setAuthError(
          error instanceof Error ? error.message : t("errors.identification"),
        );
      } finally {
        clearPopupWatch();
        setAuthLoading(false);
        pendingAuthPopupRef.current = null;
        authPopupRef.current = null;
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [locale, t]);
  const updateField = (field: keyof GuestCheckoutFormData, value: string) => {
    setFormData((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setSubmissionState((current) => ({ ...current, error: null }));
  };
  const openAuthPopup = async (
    mode: Exclude<BookingCheckoutAuthChoice, "guest">,
  ) => {
    const popup = window.open(
      "about:blank",
      "booking-engine-auth",
      "popup=yes,width=560,height=760,noopener=false,noreferrer=false",
    );

    if (!popup) {
      setAuthError(t("errors.openAuthWindow"));
      return;
    }

    authPopupRef.current = popup;
    setAuthChoice(mode);
    setAuthLoading(true);
    setAuthError(null);
    clearPopupWatch();
    popupWatchRef.current = window.setInterval(() => {
      if (!popup.closed) return;
      clearPopupWatch();
      authPopupRef.current = null;
      pendingAuthPopupRef.current = null;
      setAuthLoading(false);
    }, 400);

    try {
      const result = await actionStartBookingAuthorization(
        locale,
        `${window.location.pathname}${window.location.search}`,
      );

      if (result.error || !result.data) {
        throw new Error(t("errors.openAccountIdentification"));
      }

      pendingAuthPopupRef.current = { mode, state: result.data.state };
      popup.location.assign(result.data.authorizationUrl);
      popup.focus();
    } catch (error) {
      popup.close();
      clearPopupWatch();
      authPopupRef.current = null;
      pendingAuthPopupRef.current = null;
      setAuthLoading(false);
      setAuthError(
        error instanceof Error
          ? error.message
          : t("errors.openAccountIdentification"),
      );
    }
  };
  const handleGuestChoice = () => {
    setAuthChoice("guest");
    setAuthError(null);
    clearPopupWatch();
    pendingAuthPopupRef.current = null;
    authPopupRef.current?.close();
    authPopupRef.current = null;
  };
  const handleLogout = async () => {
    setLogoutState({
      error: null,
      submitting: true,
    });

    try {
      const result = await actionLogoutBookingAuthSession(locale);

      if (result.error) {
        throw new Error(t("errors.logout"));
      }

      setAuthenticatedUser(null);
      setAuthChoice(null);
      setAuthError(null);
      clearPopupWatch();
      pendingAuthPopupRef.current = null;
      authPopupRef.current?.close();
      authPopupRef.current = null;
      setLogoutState({
        error: null,
        submitting: false,
      });
    } catch (error) {
      setLogoutState({
        error: error instanceof Error ? error.message : t("errors.logout"),
        submitting: false,
      });
    }
  };
  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!initialState) return;

    if (!authChoice) {
      setSubmissionState({
        error: t("errors.chooseAuth"),
        submitting: false,
      });
      return;
    }

    if (authChoice !== "guest" && !authenticatedUser) {
      setSubmissionState({
        error: t("errors.completeAuth"),
        submitting: false,
      });
      return;
    }

    const nextErrors = validateGuestForm(formData, t);
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    try {
      const options = selectionPreview?.paymentOptions;
      if (
        !options ||
        options.ratePlanReference !== initialState.items[0]?.ratePlanId
      ) {
        throw new Error(t("errors.selectionPreview"));
      }
      const payload = buildPreReservationRequest(initialState, formData, {
        datesRequired: t("errors.datesRequired"),
        mixedPlans: t("errors.mixedPlans"),
        selectAccommodation: t("errors.selectAccommodation"),
      });

      const fingerprint = JSON.stringify({
        ...payload,
        idempotencyKey: undefined,
        authenticated: authChoice !== "guest",
      });
      if (reservationAttempt.current?.fingerprint !== fingerprint)
        reservationAttempt.current = { key: crypto.randomUUID(), fingerprint };
      payload.idempotencyKey = reservationAttempt.current.key;

      setSubmissionState({
        error: null,
        submitting: true,
      });

      const result = await actionCreateBookingPreReservation({
        locale,
        payload,
        useAuthenticatedUser: authChoice !== "guest",
      });

      if (result.error || !result.data) {
        throw new Error(t("errors.checkout"));
      }

      router.push(getBookingCheckoutNextUrl(locale, result.data));
    } catch (error) {
      setSubmissionState({
        error:
          error instanceof BookingCheckoutValidationError ||
          error instanceof Error
            ? error.message
            : t("errors.checkout"),
        submitting: false,
      });
      return;
    }

    setSubmissionState({
      error: null,
      submitting: false,
    });
  };
  return {
    copyLocale,
    t,
    router,
    formData,
    setFormData,
    errors,
    setErrors,
    submissionState,
    setSubmissionState,
    authChoice,
    setAuthChoice,
    authenticatedUser,
    setAuthenticatedUser,
    authError,
    setAuthError,
    authLoading,
    setAuthLoading,
    logoutState,
    setLogoutState,
    selectionPreview,
    setSelectionPreview,
    selectionPreviewError,
    setSelectionPreviewError,
    selectionPreviewLoading,
    setSelectionPreviewLoading,
    reservationPolicies,
    setReservationPolicies,
    pendingAuthPopupRef,
    reservationAttempt,
    authPopupRef,
    popupWatchRef,
    clearPopupWatch,
    resultsUrl,
    updateField,
    openAuthPopup,
    handleGuestChoice,
    handleLogout,
    handleSubmit,
  };
};
