"use client";
import type { HookContext } from "./context";
type AppLocale = string;
const translateUi = (_locale: string, key: string) => key;
import { useEffect, useState } from "react";
import type { FooterViewData } from "../models/home";
import type { BookingFederatedUser } from "../models/auth";
import type { GuestReservationListResponse } from "../sdk/types.gen";
type LoadState = {
  error: string | null;
  loading: boolean;
  result: GuestReservationListResponse | null;
};
type MyReservationsPageProps = {
  authenticatedUser: BookingFederatedUser;
  footerData: FooterViewData;
  locale: AppLocale;
};
export const PER_PAGE = 10;
export const useMyReservations = (
  { authenticatedUser, footerData, locale }: MyReservationsPageProps,
  context: HookContext,
) => {
  const { actionListMyReservations } = context.operations;
  const translateUi = context.translate;
  const {
    PAYMENT_PROVIDER_PUBLIC_KEYS,
    getPaymentProviderLabel,
    isBookingFrontendPaymentProvider,
  } = context.paymentProviders;
  const t = context.translations("myReservations.list");
  const [page, setPage] = useState(1);
  const [loadState, setLoadState] = useState<LoadState>({
    error: null,
    loading: true,
    result: null,
  });
  useEffect(() => {
    let active = true;

    const fetchReservations = async () => {
      const result = await actionListMyReservations({
        locale,
        page,
        perPage: PER_PAGE,
      });

      if (!active) return;

      if (result.error || !result.data) {
        setLoadState({
          error: result.error ?? t("errors.load"),
          loading: false,
          result: null,
        });
        return;
      }

      setLoadState({ error: null, loading: false, result: result.data });
    };

    void fetchReservations();

    return () => {
      active = false;
    };
  }, [locale, page, t]);
  const totalPages = loadState.result
    ? Math.ceil(loadState.result.total / PER_PAGE)
    : 0;
  return { t, page, setPage, loadState, setLoadState, totalPages };
};
