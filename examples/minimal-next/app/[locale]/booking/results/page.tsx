"use client";
import Link from "next/link";
import { useBookingResults } from "@hospedar.me/booking-headless/react";
import { useRuntime } from "../../../../lib/runtime";
export default function Results() {
  const booking = useBookingResults(
    { locale: "en", footerData: null, bookingFormCopy: null },
    useRuntime(),
  );
  return (
    <>
      <h1>Accommodation</h1>
      {booking.loading ? (
        <p>Searching…</p>
      ) : booking.error ? (
        <p role="alert">{booking.error}</p>
      ) : booking.roomCards.length === 0 ? (
        <p>No availability.</p>
      ) : (
        booking.roomCards.map((room) => (
          <section key={room.roomCategoryId}>
            <h2>{room.name}</h2>
            {room.plans.map((plan) => (
              <p key={plan.quoteKey}>
                {plan.ratePlanName}{" "}
                <button onClick={() => booking.setQuantity(plan.quoteKey, 1)}>
                  Select
                </button>
              </p>
            ))}
          </section>
        ))
      )}
      {booking.checkoutHref && (
        <Link href={booking.checkoutHref}>Continue to checkout</Link>
      )}
      <p role="status">{booking.selectionPreviewError}</p>
    </>
  );
}
