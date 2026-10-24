import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import type {
  BookingFederatedSession,
  BookingFederatedUser,
} from "../models/auth";
import type { Client } from "../sdk/client";
import * as sdk from "../sdk/sdk.gen";
type AppLocale = string;
export type CookieOptions = {
  httpOnly?: boolean;
  maxAge?: number;
  path?: string;
  sameSite?: "lax" | "strict" | "none";
  secure?: boolean;
  expires?: Date;
};
export type CookieStore = {
  get: (name: string) => { value: string } | undefined;
  set: (name: string, value: string, options?: CookieOptions) => void;
  delete: (name: string) => void;
};
export type BookingOidcConfig = {
  cookieSecret: string;
  secureCookies: boolean;
  publicBackendUrl: string;
  sessionCookieName: string;
  flowCookieName: string;
  clientId: string;
  scope: string;
  siteUrl: string;
  client: Client;
  cookies: () => Promise<CookieStore>;
  headers: () => Promise<{ get: (name: string) => string | null }>;
  logger?: {
    error: (...args: unknown[]) => void;
    warn: (...args: unknown[]) => void;
    info: (...args: unknown[]) => void;
  };
};
export function createBookingOidc(config: BookingOidcConfig) {
  const {
    publicBackendUrl: BACKEND_PUBLIC_URL,
    sessionCookieName: BOOKING_ENGINE_AUTH_COOKIE_NAME,
    flowCookieName: BOOKING_ENGINE_AUTH_FLOW_COOKIE_NAME,
    clientId: BOOKING_ENGINE_OAUTH_CLIENT_ID,
    scope: BOOKING_ENGINE_OAUTH_SCOPE,
    siteUrl: HOTEL_BASE_URL,
    cookies,
    headers,
  } = config;
  const logger = config.logger || {
    error: () => {},
    warn: () => {},
    info: () => {},
  };
  const authenticationApi = new Proxy(sdk, {
    get(target, key) {
      const method = Reflect.get(target, key);
      return typeof method === "function"
        ? (options: Record<string, unknown> = {}) =>
            method({ ...options, client: config.client })
        : method;
    },
  });
  const FLOW_MAX_AGE_SECONDS = 10 * 60;

  type BookingOidcFlow = {
    clientId: string;
    codeVerifier: string;
    locale: AppLocale;
    nonce: string;
    redirectUri: string;
    returnPath: string;
    state: string;
  };

  type IdTokenClaims = {
    aud?: string | string[];
    email?: string;
    exp?: number;
    iss?: string;
    name?: string;
    nonce?: string;
    phone_number?: string;
    preferred_username?: string;
    sub?: string;
  };

  function signingSecret() {
    const secret = config.cookieSecret;
    if (!secret)
      throw new Error("BOOKING_AUTH_COOKIE_SECRET is not configured");
    return secret;
  }

  function signature(namespace: string, payload: string) {
    return createHmac("sha256", signingSecret())
      .update(namespace)
      .update(payload)
      .digest("base64url");
  }

  function encodeSigned(namespace: string, value: object) {
    const payload = Buffer.from(JSON.stringify(value), "utf8").toString(
      "base64url",
    );
    return `${payload}.${signature(namespace, payload)}`;
  }

  function decodeSigned<T>(namespace: string, value?: string): T | null {
    if (!value) return null;

    try {
      const [payload, suppliedSignature, extra] = value.split(".");
      if (!payload || !suppliedSignature || extra) return null;

      const expected = Buffer.from(signature(namespace, payload), "base64url");
      const supplied = Buffer.from(suppliedSignature, "base64url");

      if (
        expected.length !== supplied.length ||
        !timingSafeEqual(expected, supplied)
      ) {
        return null;
      }

      return JSON.parse(
        Buffer.from(payload, "base64url").toString("utf8"),
      ) as T;
    } catch {
      return null;
    }
  }

  function constantTimeEquals(left: string, right: string) {
    const a = Buffer.from(left);
    const b = Buffer.from(right);
    return a.length === b.length && timingSafeEqual(a, b);
  }

  function sanitizeReturnPath(value?: string | null) {
    if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
    return value;
  }

  async function currentBookingOrigin() {
    const requestHeaders = await headers();
    const forwardedHost = requestHeaders
      .get("x-forwarded-host")
      ?.split(",")[0]
      ?.trim();
    const host = forwardedHost || requestHeaders.get("host");

    if (!host) return HOTEL_BASE_URL.replace(/\/+$/, "");

    const forwardedProto = requestHeaders
      .get("x-forwarded-proto")
      ?.split(",")[0]
      ?.trim();
    const protocol =
      forwardedProto ||
      (host.startsWith("localhost") || host.startsWith("127.0.0.1")
        ? "http"
        : "https");

    return `${protocol}://${host}`;
  }

  function isLoopbackOrigin(value: string) {
    try {
      const hostname = new URL(value).hostname;
      return (
        hostname === "localhost" ||
        hostname === "127.0.0.1" ||
        hostname === "::1"
      );
    } catch {
      return false;
    }
  }

  async function bookingAuthorizationOrigin() {
    const requestOrigin = await currentBookingOrigin();

    if (BOOKING_ENGINE_OAUTH_CLIENT_ID === "booking-engine-local") {
      if (!isLoopbackOrigin(requestOrigin)) {
        logger.error(
          {
            clientId: BOOKING_ENGINE_OAUTH_CLIENT_ID,
            requestOrigin,
          },
          "Local Booking Engine OAuth client cannot be used from a public origin",
        );
        throw new Error(
          "BOOKING_ENGINE_OAUTH_CLIENT_ID must be configured for public deployments",
        );
      }

      return requestOrigin;
    }

    const canonicalOrigin = new URL(HOTEL_BASE_URL).origin;

    if (isLoopbackOrigin(canonicalOrigin) && !isLoopbackOrigin(requestOrigin)) {
      logger.error(
        {
          clientId: BOOKING_ENGINE_OAUTH_CLIENT_ID,
          hotelBaseUrl: HOTEL_BASE_URL,
          requestOrigin,
        },
        "HOTEL_BASE_URL points to a loopback origin in a public deployment",
      );
      throw new Error(
        "HOTEL_BASE_URL must be configured for public deployments",
      );
    }

    return canonicalOrigin;
  }

  function cookieOptions(maxAge: number) {
    return {
      httpOnly: true,
      maxAge,
      path: "/",
      sameSite: "lax" as const,
      secure: config.secureCookies,
    };
  }

  function createPkce() {
    const codeVerifier = randomBytes(48).toString("base64url");
    const codeChallenge = createHash("sha256")
      .update(codeVerifier)
      .digest("base64url");
    return { codeChallenge, codeVerifier };
  }

  function decodeIdToken(idToken: string): IdTokenClaims {
    const [, payload] = idToken.split(".");
    if (!payload) throw new Error("OIDC ID token is malformed");
    return JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as IdTokenClaims;
  }

  function audienceMatches(aud: IdTokenClaims["aud"], clientId: string) {
    return typeof aud === "string"
      ? aud === clientId
      : Array.isArray(aud) && aud.includes(clientId);
  }

  function userFromClaims(claims: IdTokenClaims): BookingFederatedUser {
    if (!claims.sub || !claims.name) {
      throw new Error("OIDC identity claims are incomplete");
    }

    return {
      subject: claims.sub,
      email: claims.email ?? null,
      fullName: claims.name,
      phone: claims.phone_number ?? null,
      username: claims.preferred_username ?? null,
    };
  }

  async function setFlow(flow: BookingOidcFlow) {
    (await cookies()).set(
      BOOKING_ENGINE_AUTH_FLOW_COOKIE_NAME,
      encodeSigned("booking-engine-oidc-flow:v1:", flow),
      cookieOptions(FLOW_MAX_AGE_SECONDS),
    );
  }

  async function getFlow() {
    return decodeSigned<BookingOidcFlow>(
      "booking-engine-oidc-flow:v1:",
      (await cookies()).get(BOOKING_ENGINE_AUTH_FLOW_COOKIE_NAME)?.value,
    );
  }

  async function clearFlow() {
    (await cookies()).delete(BOOKING_ENGINE_AUTH_FLOW_COOKIE_NAME);
  }

  async function setSession(session: BookingFederatedSession, maxAge: number) {
    (await cookies()).set(
      BOOKING_ENGINE_AUTH_COOKIE_NAME,
      encodeSigned("booking-engine-oidc-session:v1:", session),
      cookieOptions(maxAge),
    );
  }

  async function startBookingAuthorization(
    locale: AppLocale,
    returnPath?: string | null,
  ) {
    const { codeChallenge, codeVerifier } = createPkce();
    const state = randomBytes(32).toString("base64url");
    const nonce = randomBytes(32).toString("base64url");
    const redirectUri = `${await bookingAuthorizationOrigin()}/auth/callback`;

    logger.info(
      {
        clientId: BOOKING_ENGINE_OAUTH_CLIENT_ID,
        redirectUri,
      },
      "Starting Booking Engine OIDC authorization",
    );

    const response = await authenticationApi.pushAuthorizationRequest({
      body: {
        client_id: BOOKING_ENGINE_OAUTH_CLIENT_ID,
        code_challenge: codeChallenge,
        code_challenge_method: "S256",
        nonce,
        redirect_uri: redirectUri,
        response_type: "code",
        scope: BOOKING_ENGINE_OAUTH_SCOPE,
        state,
      },
      cache: "no-store",
    });

    if (response.error || !response.data) {
      logger.warn(
        {
          clientId: BOOKING_ENGINE_OAUTH_CLIENT_ID,
          redirectUri,
          status: response.response.status,
        },
        "Booking Engine OIDC PAR was rejected",
      );
      throw new Error("Unable to create Booking Engine authorization request");
    }

    await setFlow({
      clientId: BOOKING_ENGINE_OAUTH_CLIENT_ID,
      codeVerifier,
      locale,
      nonce,
      redirectUri,
      returnPath: sanitizeReturnPath(returnPath),
      state,
    });

    const query = new URLSearchParams({
      client_id: BOOKING_ENGINE_OAUTH_CLIENT_ID,
      request_uri: response.data.request_uri,
    });

    return {
      authorizationUrl: `${BACKEND_PUBLIC_URL.replace(/\/+$/, "")}/auth/authorize?${query.toString()}`,
      state,
    };
  }

  async function completeBookingAuthorization({
    code,
    issuer,
    state,
  }: {
    code: string;
    issuer?: string | null;
    state: string;
  }) {
    const flow = await getFlow();
    if (!flow || !constantTimeEquals(flow.state, state)) {
      await clearFlow();
      throw new Error("OIDC state is invalid or expired");
    }

    const response = await authenticationApi.exchangeOidcAuthorizationCode({
      body: {
        client_id: flow.clientId,
        code,
        code_verifier: flow.codeVerifier,
        grant_type: "authorization_code",
        redirect_uri: flow.redirectUri,
      },
      cache: "no-store",
    });

    await clearFlow();

    if (response.error || !response.data) {
      throw new Error("OIDC authorization code exchange failed");
    }

    const metadata = await authenticationApi.getOpenIdProviderMetadata({
      cache: "no-store",
    });

    if (metadata.error || !metadata.data?.issuer) {
      throw new Error("OIDC discovery is unavailable");
    }

    const claims = decodeIdToken(response.data.id_token);
    const now = Math.floor(Date.now() / 1000);
    const expectedIssuer = metadata.data.issuer.replace(/\/+$/, "");

    if (
      claims.iss?.replace(/\/+$/, "") !== expectedIssuer ||
      (issuer && issuer.replace(/\/+$/, "") !== expectedIssuer) ||
      !audienceMatches(claims.aud, flow.clientId) ||
      claims.nonce !== flow.nonce ||
      typeof claims.exp !== "number" ||
      claims.exp <= now
    ) {
      throw new Error("OIDC ID token validation failed");
    }

    const expiresAt = new Date(
      Math.min(claims.exp, now + response.data.expires_in) * 1000,
    ).toISOString();

    const session: BookingFederatedSession = {
      accessToken: response.data.access_token,
      authenticatedUser: userFromClaims(claims),
      expiresAt,
    };

    await setSession(
      session,
      Math.max(1, Math.min(response.data.expires_in, claims.exp - now)),
    );

    return { flow, session };
  }

  async function recoverBookingAuthSession(): Promise<BookingFederatedSession | null> {
    const cookieStore = await cookies();
    const raw = cookieStore.get(BOOKING_ENGINE_AUTH_COOKIE_NAME)?.value;
    const session = decodeSigned<BookingFederatedSession>(
      "booking-engine-oidc-session:v1:",
      raw,
    );

    if (!session || Date.parse(session.expiresAt) <= Date.now()) {
      if (raw) cookieStore.delete(BOOKING_ENGINE_AUTH_COOKIE_NAME);
      return null;
    }

    return session;
  }

  async function clearBookingAuthSession() {
    const cookieStore = await cookies();
    cookieStore.delete(BOOKING_ENGINE_AUTH_COOKIE_NAME);
    cookieStore.delete(BOOKING_ENGINE_AUTH_FLOW_COOKIE_NAME);
  }

  return {
    startBookingAuthorization,
    completeBookingAuthorization,
    recoverBookingAuthSession,
    clearBookingAuthSession,
  };
}
