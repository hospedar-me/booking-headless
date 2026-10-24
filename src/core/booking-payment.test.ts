import { describe, expect, it } from "vitest";
import {
  buildBookingPaymentStatusUrl,
  buildBookingPaymentUrl,
  getBookingCheckoutNextUrl,
  getPendingBookingPaymentResumeUrl,
  getBookingPaymentAmountInCents,
  buildReservationBalancePaymentStatusUrl,
  buildReservationBalancePaymentUrl,
  getBookingPaymentFlowLabel,
  getBookingPaymentFailureStatus,
  getBookingPaymentMethodAcceptedNetworks,
  getBookingPaymentStatusLabel,
  getBookingReservationStatusLabel,
  getReservationPaymentAction,
  hasBookingPaymentSucceeded,
  shouldPollBookingPaymentSession,
  isBookingCardPaymentMethod,
  type BookingPaymentMethod,
  type BookingPaymentSession,
} from "./booking-payment";

const baseSession: BookingPaymentSession = {
  activePayment: null,
  expiresAt: "2026-04-23T10:00:00.000Z",
  items: [],
  paymentMethods: [],
  preReservationId: "pre-123",
  ratePlanId: 10,
  status: "active",
  totalInCents: 120000,
};

describe("booking payment helpers", () => {
  it("gera a URL da etapa de pagamento", () => {
    expect(buildBookingPaymentUrl("pt", "pre-123")).toBe(
      "/pt/booking/payment?preReservationId=pre-123",
    );
  });

  it("gera a URL da etapa de acompanhamento", () => {
    expect(buildBookingPaymentStatusUrl("pt", "pre-123")).toBe(
      "/pt/booking/payment/status?preReservationId=pre-123",
    );
  });

  it("gera as URLs para pagamento de saldo da reserva", () => {
    expect(buildReservationBalancePaymentUrl("pt", "res-123")).toBe(
      "/pt/my-reservations/res-123/payment",
    );
    expect(buildReservationBalancePaymentStatusUrl("pt", "res-123")).toBe(
      "/pt/my-reservations/res-123/payment/status",
    );
  });

  it("preserva a obrigação selecionada nas URLs de pagamento e acompanhamento", () => {
    expect(
      buildReservationBalancePaymentUrl("pt", "res-123", "obligation-1"),
    ).toBe("/pt/my-reservations/res-123/payment?obligationId=obligation-1");
    expect(
      buildReservationBalancePaymentStatusUrl("pt", "res-123", "obligation-1"),
    ).toBe(
      "/pt/my-reservations/res-123/payment/status?obligationId=obligation-1",
    );
  });

  it("pré-reserva concluída com reserva pendente não comprova confirmação nem pagamento", () => {
    const item = {
      accommodationCategoryId: 1,
      accommodationId: 1,
      accommodationName: "Suite",
      amountInCents: 120000,
      reservationId: "res-123",
      reservationStatus: "Pending" as const,
    };
    expect(
      hasBookingPaymentSucceeded({
        ...baseSession,
        status: "completed",
        items: [item],
      }),
    ).toBe(false);
    expect(
      hasBookingPaymentSucceeded({
        ...baseSession,
        status: "completed",
        items: [{ ...item, reservationStatus: "Confirmed" }],
      }),
    ).toBe(true);
    expect(
      hasBookingPaymentSucceeded({
        ...baseSession,
        status: "completed",
        items: [],
      }),
    ).toBe(false);
  });

  it("retoma o checkout da pre-reserva para reserva hold", () => {
    expect(
      getReservationPaymentAction({
        locale: "pt",
        openBalanceInCents: 120000,
        preReservationId: "pre-123",
        reservationId: "res-123",
        status: "Hold",
      }),
    ).toEqual({
      href: "/pt/booking/payment?preReservationId=pre-123",
      kind: "resume_pre_reservation",
    });
  });

  it("nunca envia hold sem preReservationId para pagamento de saldo", () => {
    expect(
      getReservationPaymentAction({
        locale: "pt",
        openBalanceInCents: 120000,
        preReservationId: null,
        reservationId: "res-123",
        status: "Hold",
      }),
    ).toBeNull();
  });

  it.each(["Pending", "Confirmed", "CheckedIn"] as const)(
    "mantem pagamento de saldo para reserva %s elegivel",
    (status) => {
      expect(
        getReservationPaymentAction({
          locale: "pt",
          openBalanceInCents: 25000,
          reservationId: "res-123",
          status,
        }),
      ).toEqual({
        href: "/pt/my-reservations/res-123/payment",
        kind: "reservation_balance",
      });
    },
  );

  it("nao oferece pagamento de saldo fora dos status elegiveis", () => {
    expect(
      getReservationPaymentAction({
        locale: "pt",
        openBalanceInCents: 25000,
        reservationId: "res-123",
        status: "CheckedOut",
      }),
    ).toBeNull();
  });

  it("nao oferece pagamento de saldo quando nao existe saldo em aberto", () => {
    expect(
      getReservationPaymentAction({
        locale: "pt",
        openBalanceInCents: 0,
        reservationId: "res-123",
        status: "Confirmed",
      }),
    ).toBeNull();
  });

  it("trata credito e debito como fluxos de cartao", () => {
    expect(isBookingCardPaymentMethod({ type: "credit_card" })).toBe(true);
    expect(isBookingCardPaymentMethod({ type: "debit_card" })).toBe(true);
    expect(isBookingCardPaymentMethod({ type: "pix" })).toBe(false);
  });

  it("usa as redes aceitas da projection correta para credito e debito", () => {
    const creditMethod: BookingPaymentMethod = {
      allowedInstallments: [1, 2, 3, 4, 5, 6],
      commercialTermsByReservation: [],
      id: 1,
      name: "Credito",
      provider: "stripe",
      type: "credit_card",
      creditCardConfig: {
        acceptedNetworks: ["visa", "mastercard"],
      },
    };
    const debitMethod: BookingPaymentMethod = {
      allowedInstallments: [1],
      commercialTermsByReservation: [],
      id: 2,
      name: "Debito",
      provider: "mercadopago",
      type: "debit_card",
      debitCardConfig: {
        acceptedNetworks: ["visa", "mastercard"],
      },
    };

    expect(getBookingPaymentMethodAcceptedNetworks(creditMethod)).toEqual([
      "visa",
      "mastercard",
    ]);
    expect(getBookingPaymentMethodAcceptedNetworks(debitMethod)).toEqual([
      "visa",
      "mastercard",
    ]);
    expect(getBookingPaymentMethodAcceptedNetworks({ type: "pix" })).toEqual(
      [],
    );
  });

  it("identifica pagamento aprovado", () => {
    expect(
      hasBookingPaymentSucceeded({
        ...baseSession,
        activePayment: {
          amountInCents: 120000,
          flowKind: "card",
          paymentMethodId: 1,
          provider: "mercadopago",
          providerPaymentId: "pay-1",
          status: "approved",
        },
      }),
    ).toBe(true);
  });

  it("identifica falha terminal do pagamento", () => {
    expect(
      getBookingPaymentFailureStatus({
        ...baseSession,
        activePayment: {
          amountInCents: 120000,
          flowKind: "pix",
          paymentMethodId: 2,
          provider: "mercadopago",
          providerPaymentId: "pay-2",
          status: "expired",
        },
      }),
    ).toBe("expired");
  });

  it("identifica expiracao da reserva", () => {
    expect(
      getBookingPaymentFailureStatus({
        ...baseSession,
        status: "expired",
      }),
    ).toBe("expired");
  });
});

describe("contractual payment requirement", () => {
  it("uses only the amount due now for an advance payment", () => {
    expect(
      getBookingPaymentAmountInCents(
        {
          ...baseSession,
          amountDueNowInCents: 37200,
          reservationTotalInCents: 74400,
          totalInCents: 74400,
        },
        "pre_reservation",
      ),
    ).toBe(37200);
  });
  it("does not replace a zero current requirement with the reservation total", () => {
    expect(
      getBookingPaymentAmountInCents(
        { ...baseSession, amountDueNowInCents: 0 },
        "pre_reservation",
      ),
    ).toBe(0);
  });
  it("keeps the balance session amount for voluntary balance payments", () => {
    expect(
      getBookingPaymentAmountInCents(baseSession, "reservation_balance"),
    ).toBe(120000);
  });
  it("skips payment for deferred and at-property policies", () => {
    expect(
      getBookingCheckoutNextUrl("pt", {
        preReservationId: "pre-123",
        status: "completed",
        confirmationRequiresPayment: false,
      }),
    ).toBe("/pt/booking/payment/status?preReservationId=pre-123");
    expect(
      getBookingCheckoutNextUrl("pt", {
        preReservationId: "pre-123",
        status: "active",
        confirmationRequiresPayment: false,
      }),
    ).toBe("/pt/booking/payment/status?preReservationId=pre-123");
  });
  it("requests payment only when the backend requires it for confirmation", () => {
    expect(
      getBookingCheckoutNextUrl("pt", {
        preReservationId: "pre-123",
        status: "active",
        confirmationRequiresPayment: true,
      }),
    ).toBe("/pt/booking/payment?preReservationId=pre-123");
  });
});

describe("continuing an existing collection", () => {
  const session = (
    status: "pending" | "approved" | "expired" | "rejected" | "cancelled",
    flowKind: "pix" | "card" = "pix",
  ): BookingPaymentSession => ({
    ...baseSession,
    activePayment: {
      amountInCents: 72600,
      flowKind,
      paymentMethodId: 2,
      provider: "hospedar_me_test",
      providerPaymentId: "existing-payment",
      status,
    },
  });

  it.each(["pix", "card"] as const)(
    "resumes pending %s for a reservation without creating another collection",
    (flow) => {
      expect(
        getPendingBookingPaymentResumeUrl("pt", session("pending", flow), {
          context: "reservation_balance",
          id: "reservation-1",
          obligationId: "obligation-1",
        }),
      ).toBe(
        "/pt/my-reservations/reservation-1/payment/status?obligationId=obligation-1",
      );
    },
  );

  it("resumes the original pre-reservation checkout", () => {
    expect(
      getPendingBookingPaymentResumeUrl("en", session("pending"), {
        context: "pre_reservation",
        id: "pre-1",
      }),
    ).toBe("/en/booking/payment/status?preReservationId=pre-1");
  });

  it.each(["approved", "expired", "rejected", "cancelled"] as const)(
    "does not block a new collection because of a previous %s attempt",
    (status) => {
      expect(
        getPendingBookingPaymentResumeUrl("pt", session(status), {
          context: "reservation_balance",
          id: "reservation-1",
        }),
      ).toBeNull();
    },
  );

  it("allows the initial payment when no collection exists", () => {
    expect(
      getPendingBookingPaymentResumeUrl("pt", baseSession, {
        context: "reservation_balance",
        id: "reservation-1",
      }),
    ).toBeNull();
  });
});

describe("payment confirmation convergence", () => {
  it("keeps reading while an approved payment awaits reservation confirmation", () => {
    const session = {
      ...baseSession,
      confirmationRequiresPayment: false,
      activePayment: {
        amountInCents: 1000,
        flowKind: "pix" as const,
        paymentMethodId: 2,
        provider: "hospedar_me_test" as const,
        providerPaymentId: "payment-1",
        status: "approved" as const,
      },
      items: [
        {
          accommodationCategoryId: 1,
          accommodationId: 1,
          accommodationName: "Suite",
          amountInCents: 1000,
          reservationId: "reservation-1",
          reservationStatus: "Pending" as const,
        },
      ],
    };
    expect(hasBookingPaymentSucceeded(session)).toBe(true);
    expect(shouldPollBookingPaymentSession(session)).toBe(true);
    expect(
      shouldPollBookingPaymentSession({
        ...session,
        status: "completed",
        items: session.items.map((item) => ({
          ...item,
          reservationStatus: "Confirmed",
        })),
      }),
    ).toBe(false);
    expect(
      shouldPollBookingPaymentSession({ ...session, status: "cancelled" }),
    ).toBe(false);
  });

  it("finishes balance payments without requiring pre-reservation items", () => {
    expect(
      shouldPollBookingPaymentSession({
        ...baseSession,
        status: "paid",
        items: [],
      }),
    ).toBe(false);
  });
});

it("returns functional status identifiers for template translation", () => {
  expect(getBookingPaymentStatusLabel("approved", "en")).toBe(
    "enums.getBookingPaymentStatusLabel.approved",
  );
});
