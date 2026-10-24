export type BookingCheckoutAuthChoice = "guest" | "login" | "register";

export type BookingFederatedUser = {
  subject: string;
  email?: string | null;
  fullName: string;
  phone?: string | null;
  username?: string | null;
};

export type BookingFederatedSession = {
  accessToken: string;
  authenticatedUser: BookingFederatedUser;
  expiresAt: string;
};

export type BookingAuthPopupMessage = {
  state: string;
  status: "success" | "error";
  type: "booking-engine-auth-complete";
};

export const isBookingAuthPopupMessage = (
  value: unknown,
): value is BookingAuthPopupMessage => {
  if (!value || typeof value !== "object") return false;

  const candidate = value as Partial<BookingAuthPopupMessage>;
  return (
    candidate.type === "booking-engine-auth-complete" &&
    (candidate.status === "success" || candidate.status === "error") &&
    typeof candidate.state === "string" &&
    candidate.state.length >= 32
  );
};
