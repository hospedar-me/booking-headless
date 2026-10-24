import * as sdk from "../sdk/sdk.gen";
import type { Client } from "../sdk/client";
import type { ApiErrorResponse } from "../sdk/types.gen";
import type { BookingFederatedSession } from "../models/auth";
export type Translator = (
  key: string,
  values?: Record<string, string | number>,
) => string;
export type ActionResult<T> =
  | { data: T; error?: undefined; reason?: undefined }
  | { data?: undefined; error: string; reason?: "reservation_not_modifiable" };
export type BookingServerContext = {
  clientId: string;
  locales: readonly string[];
  defaultLocale: string;
  client: Client;
  localeHeaders: (locale?: string) => Record<string, string>;
  getTranslator: (locale: string) => Promise<Translator>;
  translate: (locale: string, key: string) => string;
  auth: {
    getSession: () => Promise<BookingFederatedSession | null>;
    logout: () => Promise<void>;
    start: (
      locale: string,
      returnPath?: string,
    ) => Promise<{ authorizationUrl: string; state: string }>;
  };
  refresh?: () => void;
  logger?: { error: (...args: unknown[]) => void };
};
export function bindBookingSdk(context: BookingServerContext): typeof sdk {
  // The generated SDK remains the only HTTP implementation. Every call gets
  // an explicit client instead of mutating a process-global SDK singleton.
  return new Proxy(sdk, {
    get(target, property) {
      const method = Reflect.get(target, property);
      return typeof method === "function"
        ? (options: Record<string, unknown> = {}) =>
            method({ ...options, client: context.client })
        : method;
    },
  });
}
export function translateApiError(
  t: Translator,
  error: ApiErrorResponse | undefined,
  fallback: string,
): string {
  for (const key of [error?.i18n?.baseKey, fallback])
    if (key) {
      try {
        return t(key);
      } catch {}
    }
  return fallback;
}
