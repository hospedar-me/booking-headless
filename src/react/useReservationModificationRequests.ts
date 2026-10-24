"use client";
import type { HookContext } from "./context";
type AppLocale = string;
const translateUi = (_locale: string, key: string) => key;
import { useEffect, useState } from "react";
import type {
  GuestModificationRequestResponse,
  Reservation,
} from "../sdk/types.gen";
import { isConfirmedReservationStatus } from "../core/date-only";
type ExtendedModificationRequest = GuestModificationRequestResponse & {
  offers?: ModificationOffer[];
  currentOffer?: ModificationOffer | null;
};
type ModificationRequestsSectionProps = {
  hideAction?: boolean;
  locale: AppLocale;
  mode?: "action" | "list" | "full";
  reservation: Reservation;
};
type ModificationOffer = {
  source?: "guest" | "hotel";
  checkInDate?: string | null;
  checkOutDate?: string | null;
  numAdults?: number | null;
  numChildren?: number | null;
  numPets?: number | null;
  pets?: Array<{ petType: string; weightInGrams: number }> | null;
  accommodationCategoryId?: number | null;
  pricing?: import("../sdk/types.gen").ReservationPricing | null;
  modificationPolicy?:
    | import("../sdk/types.gen").GuestModificationPolicyPreviewResponse
    | null;
  note?: string | null;
};
export const useReservationModificationRequests = (
  {
    hideAction = false,
    locale,
    mode = "list",
    reservation,
  }: ModificationRequestsSectionProps,
  context: HookContext,
) => {
  const {
    actionCancelMyReservationModificationRequest,
    actionListMyReservationModificationRequests,
    actionRespondMyReservationModificationCounterproposal,
  } = context.operations;
  const translateUi = context.translate;
  const {
    PAYMENT_PROVIDER_PUBLIC_KEYS,
    getPaymentProviderLabel,
    isBookingFrontendPaymentProvider,
  } = context.paymentProviders;
  const router = context.navigation;
  const t = context.translations("myReservations.modificationRequests");
  const [requests, setRequests] = useState<ExtendedModificationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const canRequest = isConfirmedReservationStatus(reservation.status);
  const hasPending = requests.some((r) => r.status === "pending");
  const showAction = !hideAction && (mode === "action" || mode === "full");
  const showList = mode === "list" || mode === "full";
  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      setLoadError(null);

      const result = await actionListMyReservationModificationRequests(
        reservation.id,
        locale,
      );
      if (!active) return;

      setLoading(false);

      if (result.error || !result.data) {
        setLoadError(result.error ?? t("errors.load"));
        return;
      }

      setRequests((result.data.data ?? []) as ExtendedModificationRequest[]);
    };

    void load();
    return () => {
      active = false;
    };
  }, [locale, reservation.id, t]);
  useEffect(() => {
    if (mode === "action") return;

    const eventName = `reservation-modification-request-created:${reservation.id}`;
    const handleRequestCreated = (event: Event) => {
      const request = (event as CustomEvent<GuestModificationRequestResponse>)
        .detail;
      setRequests((prev) => {
        if (prev.some((item) => item.id === request.id)) return prev;
        return [request, ...prev];
      });
    };

    window.addEventListener(eventName, handleRequestCreated);
    return () => window.removeEventListener(eventName, handleRequestCreated);
  }, [mode, reservation.id]);
  const handleCreated = (request: GuestModificationRequestResponse) => {
    setRequests((prev) => [request, ...prev]);
    window.dispatchEvent(
      new CustomEvent(
        `reservation-modification-request-created:${reservation.id}`,
        { detail: request },
      ),
    );
  };
  const handleCancelRequest = async (requestId: string) => {
    setCancellingId(requestId);

    const result = await actionCancelMyReservationModificationRequest({
      locale,
      requestId,
      reservationId: reservation.id,
    });

    setCancellingId(null);

    if (result.data) {
      setRequests((prev) =>
        prev.map((r) =>
          r.id === requestId ? { ...r, status: "cancelled" as const } : r,
        ),
      );
      return;
    }

    setLoadError(t("errors.cancel"));
  };
  const handleCounterproposalResponse = async (
    requestId: string,
    action: "accept" | "decline",
  ) => {
    if (action === "accept" && !canRequest) return;

    setRespondingId(requestId);

    const result = await actionRespondMyReservationModificationCounterproposal({
      action,
      locale,
      requestId,
      reservationId: reservation.id,
    });

    setRespondingId(null);

    if (result.data) {
      setRequests((prev) =>
        prev.map((r) =>
          r.id === requestId
            ? {
                ...r,
                status: action === "accept" ? "approved" : "declined_by_guest",
              }
            : r,
        ),
      );
      return;
    }

    if (result.reason === "reservation_not_modifiable") {
      setLoadError(result.error);
      router.refresh();
      return;
    }

    setLoadError(result.error ?? t("errors.respond"));
  };
  const shouldShowRequestsCard = requests.length > 0;
  return {
    router,
    t,
    requests,
    setRequests,
    loading,
    setLoading,
    loadError,
    setLoadError,
    dialogOpen,
    setDialogOpen,
    cancellingId,
    setCancellingId,
    respondingId,
    setRespondingId,
    canRequest,
    hasPending,
    showAction,
    showList,
    handleCreated,
    handleCancelRequest,
    handleCounterproposalResponse,
    shouldShowRequestsCard,
  };
};
