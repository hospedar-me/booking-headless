import type { BookingOperations } from "../server";
import type { Translator } from "../server/context";
import type { BookingFormCopyViewData } from "../models/home";
export type FrontendPaymentProvider =
  | "hospedar_me_test"
  | "stripe"
  | "mercadopago";
export type HookContext = {
  operations: BookingOperations;
  locale: string;
  t: Translator;
  translations: (namespace?: string) => Translator;
  translate: (locale: string, key: string) => string;
  formCopy?: BookingFormCopyViewData;
  searchParams: { get: (key: string) => string | null };
  navigation: {
    push: (url: string) => void;
    replace: (url: string) => void;
    refresh: () => void;
  };
  paymentProviders: {
    PAYMENT_PROVIDER_PUBLIC_KEYS: Record<FrontendPaymentProvider, string>;
    isBookingFrontendPaymentProvider: (
      provider?: string | null,
    ) => provider is FrontendPaymentProvider;
    getPaymentProviderLabel: (
      provider?: FrontendPaymentProvider | null,
      locale?: string,
    ) => string;
  };
};
