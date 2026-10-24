import { createBookingOperations } from "@hospedar.me/booking-headless/server";
import { createClient } from "@hospedar.me/booking-headless/sdk";
export const booking = createBookingOperations({
  clientId: process.env.BOOKING_CLIENT_ID || "",
  locales: ["en"],
  defaultLocale: "en",
  client: createClient({
    baseUrl: process.env.BACKEND_URL || "http://localhost:8080",
    headers: {
      Authorization: "Bearer " + (process.env.BOOKING_ENGINE_API_TOKEN || ""),
    },
  }),
  localeHeaders: () => ({ "x-locale": "en" }),
  getTranslator: async () => (key) => key,
  translate: (_locale, key) => key,
  auth: {
    getSession: async () => null,
    logout: async () => {},
    start: async () => {
      throw Error(
        "This example demonstrates guest checkout. Configure createBookingOidc for authenticated checkout.",
      );
    },
  },
});
