# Classic extraction reference

Baseline: Classic feature/template-classic, ce542c7.

- BookingForm: useBookingSearch composes useGuestDistribution; pure distribution mappings live in core.
- ResultsPage: useBookingResults owns criteria, hydration, filters, selection and authoritative previews.
- CheckoutPage: useBookingCheckout owns guest/session state, preview, popup lifecycle and reservation attempt identity. createBookingOidc owns the existing server protocol.
- BookingPaymentPage/StatusPage: useBookingPayment/useBookingPaymentStatus own payment sessions and transitions; secure provider capture stays in the consuming UI.
- MyReservationsPage/DetailPage and modification/refund/notes sections: functional controllers and server operations extracted; visual tabs, receipts/PDF and presentation remain in Classic.
- PublicContentCache: same durable API JSON and image behavior, server only.
- Appearance: shared data contract; Classic maps to CSS, wallet keeps its own fixed tokens.

Package tests exercise source without Classic. The minimal example exercises the npm-pack artifact. Initial npm namespace setup and successful served-site verification are separate release prerequisites; a local build does not prove a live deployment.
