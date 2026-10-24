"use client";
import { useBookingSearch } from "@hospedar.me/booking-headless/react";
import { parseDateOnly } from "@hospedar.me/booking-headless/core";
import { useRuntime } from "../../lib/runtime";
export default function Search() {
  const booking = useBookingSearch({}, useRuntime());
  return (
    <>
      <h1>Search accommodation</h1>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          booking.handleSearch();
        }}
      >
        <label>
          Check-in{" "}
          <input
            type="date"
            required
            onChange={(e) =>
              booking.setDateRange((range) => ({
                from: parseDateOnly(e.target.value) || undefined,
                to: range?.to,
              }))
            }
          />
        </label>
        <label>
          Check-out{" "}
          <input
            type="date"
            required
            onChange={(e) =>
              booking.setDateRange((range) => ({
                from: range?.from,
                to: parseDateOnly(e.target.value) || undefined,
              }))
            }
          />
        </label>
        <label>
          Adults{" "}
          <input
            type="number"
            min="1"
            value={booking.adults}
            onChange={(e) => booking.setAdults(Number(e.target.value))}
          />
        </label>
        <button disabled={booking.isDistributingGuests || booking.isSearching}>
          Search
        </button>
        <p role="status">{booking.distributionError}</p>
      </form>
    </>
  );
}
