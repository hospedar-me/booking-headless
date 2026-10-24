# @hospedar.me/booking-headless

Reservation operations and React controllers shared by Hospedar.me booking templates. Version 0.1.0 is extracted from Classic ce542c7. No components, CSS, Next.js, translations or mutable credential singleton.

## Entries

- Root and /core: search, date-only values, distribution payloads, quote selection, checkout payloads, payment transitions and navigation contracts.
- /models: API-derived view models and the appearance/configuration contract.
- /react: useBookingSearch, useGuestDistribution, useBookingResults, useBookingCheckout, useBookingPayment, useBookingPaymentStatus, useMyReservations, useMyReservation and reservation modification/refund/notes controllers. Hooks accept explicit operations, navigation and stable translators.
- /sdk: the single OpenAPI generated client. Pass createClient({baseUrl,headers,fetch}) explicitly. Never put service credentials in browser configuration.
- /server: createBookingOperations, createBookingOidc and PublicContentCache. Inject cookies, request headers, locale, sessions, client and durable storage.
- /browser: provider redirects and popup/customer-action helpers.

Hooks expose functional state and actions; templates own rendering, accessibility, transitions, dialogs and translated UI. Error keys belong to the template translator. SDK prices, availability and eligibility remain authoritative. The existing checkout state query parameter and OAuth callback routes are unchanged. Card integrations supply provider tokens; no PAN/CVV belongs in shared booking state.

## Development

Use the project Docker Compose Node tooling container. Inside the package: npm ci, npm run lint, npm test, npm run build, npm pack. The Classic is not needed to compile, test or use this repository.

Copy a newer backend OpenAPI into spec/hotel.json and run npm run generate:api. Never hand edit src/sdk. Consumers update an explicit package version and lockfile; they do not generate another SDK.

## Independent example

Run mkdir -p artifacts && npm pack --pack-destination artifacts, then npm ci --prefix examples/minimal-next and npm run dev --prefix examples/minimal-next. Set BACKEND_URL, BOOKING_CLIENT_ID and BOOKING_ENGINE_API_TOKEN on its server. The example imports the packed artifact, never Classic components or source aliases. See its README.

## Runtime and resilient content

PublicContentCache keeps API JSON and image bytes on durable storage scoped to the client. It serves existing content while refreshing and retains it on upstream failure. Booking prices and writes are never served from this public-content cache. Map its local media URLs using your existing media route; with no stored public profile, render the template's unavailable page.

## npm publishing prerequisite

The GitHub repository is public. Initial npm ownership of @hospedar.me must be established before the first registry release. Configure an npm trusted publisher for organization hospedar-me, repository booking-headless, workflow publish.yml, environment npm, then tag v0.1.0. The workflow uses Node 24/npm 11 and GitHub OIDC, without a persistent npm publishing token. See https://docs.npmjs.com/trusted-publishers/. Public package installation needs no token.

The SDK entry exports createClient for the HTTP execution context. The Hotel API endpoint with the same generated name remains available as hotelApi.createClient (also createHotelClient). All other generated endpoints retain their existing names.
