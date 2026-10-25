"use client";
import { useSearchParams } from "next/navigation";
import { parseBookingCheckoutState } from "@hospedar.me/booking-headless/core";
import { useBookingCheckout } from "@hospedar.me/booking-headless/react";
import { useRuntime } from "../../../lib/runtime";
export default function Checkout() {
  const params = useSearchParams();
  const booking = useBookingCheckout(
    {
      locale: "en",
      footerData: null,
      initialAuthenticatedUser: null,
      initialState: parseBookingCheckoutState(params),
    },
    useRuntime(),
  );
  return (
    <>
      <h1>Guest checkout</h1>
      <button onClick={booking.handleGuestChoice}>Continue as guest</button>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void booking.submit();
        }}
      >
        {(["fullName", "email", "phone", "notes"] as const).map((field) => (
          <label key={field}>
            {field}
            <input
              value={booking.formData[field]}
              onChange={(e) => booking.updateField(field, e.target.value)}
            />
            {booking.errors[field]}
          </label>
        ))}
        <button
          disabled={
            booking.submissionState.submitting ||
            booking.selectionPreviewLoading
          }
        >
          Reserve
        </button>
        <p role="alert">
          {booking.submissionState.error || booking.selectionPreviewError}
        </p>
      </form>
    </>
  );
}
