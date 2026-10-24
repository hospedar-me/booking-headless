# Minimal independent Next.js consumer

From the repository root, npm run build && mkdir -p artifacts && npm pack --ignore-scripts --pack-destination artifacts. Then npm ci --prefix examples/minimal-next and npm run dev --prefix examples/minimal-next. Only the packed public artifact is imported; no Classic filesystem or visual dependency exists.

Set BACKEND_URL, BOOKING_CLIENT_ID, BOOKING_ENGINE_API_TOKEN in the server environment. Visit /en, choose dates, search, select a backend tariff, then continue to the guest checkout. Reservation submission uses the actual shared operations and idempotency handling. This minimal example stops at the existing payment URL; a complete template renders useBookingPayment there. Authenticated checkout uses createBookingOidc with injected cookie/header ports.

The example intentionally displays error identifiers. Add your template's stable translations and own UI. Production package consumers can replace the local artifact dependency with the explicit registry version 0.1.0 after its first npm publication.
