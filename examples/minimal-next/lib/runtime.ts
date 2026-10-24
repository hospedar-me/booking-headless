"use client";
import { useRouter, useSearchParams } from "next/navigation";
import type { HookContext } from "@hospedar.me/booking-headless/react";
import * as operations from "./actions";
const t = (key: string) => key;
const translations = () => t;
export function useRuntime(): HookContext {
  return {
    locale: "en",
    t,
    translations,
    translate: (_locale, key) => key,
    operations,
    searchParams: useSearchParams(),
    navigation: useRouter(),
    paymentProviders: {
      PAYMENT_PROVIDER_PUBLIC_KEYS: {
        hospedar_me_test: "",
        mercadopago: "",
        stripe: "",
      },
      isBookingFrontendPaymentProvider: (
        provider,
      ): provider is "hospedar_me_test" | "stripe" | "mercadopago" =>
        provider === "hospedar_me_test" ||
        provider === "stripe" ||
        provider === "mercadopago",
      getPaymentProviderLabel: (provider) => provider || "",
    },
  };
}
