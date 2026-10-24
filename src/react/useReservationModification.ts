"use client";
import type { HookContext } from "./context";
type AppLocale = string;
const translateUi = (_locale: string, key: string) => key;
import { useState } from "react";
import { format } from "date-fns";
type DateRange = { from: Date | undefined; to?: Date };
import { searchBookingAvailabilities as searchAvailabilities } from "../core/booking-results";
import type {
  BookingRoomCardVM,
  BookingRatePlanOptionVM,
} from "../core/booking-results-adapter";
import { isConfirmedReservationStatus, parseDateOnly } from "../core/date-only";
import type {
  GuestModificationRequestPreviewResponse,
  GuestModificationRequestResponse,
  CreateGuestModificationRequest,
  PetType,
  Reservation,
  ReservationPetInput,
} from "../sdk/types.gen";
type Step = "form" | "results";
type ChildAge = { id: number; age: number };
type ModificationPet = { id: number; petType: PetType; weightKg: number };
type SelectedOption = {
  roomCategoryId: number;
  categoryName: string;
  quoteKey: string;
  priceInCents: number;
};
type ModificationPreview = GuestModificationRequestPreviewResponse;
type ModificationRequestDialogProps = {
  locale: AppLocale;
  open: boolean;
  onClose: () => void;
  onCreated: (request: GuestModificationRequestResponse) => void;
  reservation: Reservation;
};
export const parseDate = (iso: string) => parseDateOnly(iso);
export const createStableId = () =>
  Date.now() + Math.floor(Math.random() * 1000);
export const mapReservationPetToState = (
  pet: ReservationPetInput,
  index: number,
): ModificationPet => ({
  id: createStableId() + index,
  petType: pet.petType,
  weightKg: Math.max(0.1, pet.weightInGrams / 1000),
});
export const mapPetToRequest = (pet: ModificationPet): ReservationPetInput => ({
  petType: pet.petType,
  weightInGrams: Math.max(1, Math.round(pet.weightKg * 1000)),
});
export const getCardMaxPetOccupancy = (card: BookingRoomCardVM): number =>
  "maxPetOccupancy" in card.category &&
  typeof card.category.maxPetOccupancy === "number"
    ? card.category.maxPetOccupancy
    : 0;
export const buildSelectedOption = (
  card: BookingRoomCardVM,
  plan: BookingRatePlanOptionVM,
): SelectedOption => ({
  roomCategoryId: card.roomCategoryId,
  categoryName: card.name,
  quoteKey: plan.quoteKey,
  priceInCents: plan.quote.totals.finalInCents,
});
export const useReservationModification = (
  {
    locale,
    open,
    onClose,
    onCreated,
    reservation,
  }: ModificationRequestDialogProps,
  context: HookContext,
) => {
  const {
    actionCreateMyReservationModificationRequest,
    actionPreviewMyReservationModificationRequest,
  } = context.operations;
  const translateUi = context.translate;
  const searchBookingAvailabilities = (
    ...args: Parameters<typeof searchAvailabilities> extends [
      ...infer T,
      unknown,
    ]
      ? T
      : never
  ) =>
    searchAvailabilities(
      args[0],
      args[1],
      args[2],
      context.operations.actionSearchBookingResults,
    );
  const {
    PAYMENT_PROVIDER_PUBLIC_KEYS,
    getPaymentProviderLabel,
    isBookingFrontendPaymentProvider,
  } = context.paymentProviders;
  const t = context.translations("myReservations.modificationDialog");
  const canModify = isConfirmedReservationStatus(reservation.status);
  const [step, setStep] = useState<Step>("form");
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => ({
    from: parseDate(reservation.checkInDate),
    to: parseDate(reservation.checkOutDate),
  }));
  const [adults, setAdults] = useState(reservation.allocation.numAdults);
  const [children, setChildren] = useState(reservation.allocation.numChildren);
  const [childAges, setChildAges] = useState<ChildAge[]>(() =>
    reservation.allocation.childAges.map((age, index) => ({
      id: createStableId() + index,
      age,
    })),
  );
  const [pets, setPets] = useState<ModificationPet[]>(() =>
    reservation.allocation.pets.map(mapReservationPetToState),
  );
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [cards, setCards] = useState<BookingRoomCardVM[]>([]);
  const [selected, setSelected] = useState<SelectedOption | null>(null);
  const [preview, setPreview] = useState<ModificationPreview | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const handleClose = () => {
    onClose();
    // reset after animation
    setTimeout(() => {
      setStep("form");
      setSearchError(null);
      setCards([]);
      setSelected(null);
      setPreview(null);
      setSubmitError(null);
      setDateRange({
        from: parseDate(reservation.checkInDate),
        to: parseDate(reservation.checkOutDate),
      });
      setAdults(reservation.allocation.numAdults);
      setChildren(reservation.allocation.numChildren);
      setChildAges(
        reservation.allocation.childAges.map((age, index) => ({
          id: createStableId() + index,
          age,
        })),
      );
      setPets(reservation.allocation.pets.map(mapReservationPetToState));
    }, 300);
  };
  const handleChildrenChange = (newCount: number) => {
    if (newCount > children) {
      setChildAges((prev) => [...prev, { id: createStableId(), age: 0 }]);
    } else if (newCount < children) {
      setChildAges((prev) => prev.slice(0, -1));
    }
    setChildren(newCount);
  };
  const updateChildAge = (id: number, age: number) => {
    setChildAges((prev) =>
      prev.map((child) => (child.id === id ? { ...child, age } : child)),
    );
  };
  const handlePetsChange = (newCount: number) => {
    setPets((prev) => {
      if (newCount > prev.length) {
        return [
          ...prev,
          ...Array.from({ length: newCount - prev.length }, () => ({
            id: createStableId(),
            petType: "dog" as PetType,
            weightKg: 10,
          })),
        ];
      }
      return prev.slice(0, Math.max(0, newCount));
    });
  };
  const updatePet = (id: number, updates: Partial<ModificationPet>) => {
    setPets((prev) =>
      prev.map((pet) => (pet.id === id ? { ...pet, ...updates } : pet)),
    );
  };
  const removePet = (id: number) => {
    setPets((prev) => prev.filter((pet) => pet.id !== id));
  };
  const handleSearch = async () => {
    if (!canModify) return;

    if (!dateRange?.from || !dateRange?.to) {
      setSearchError(t("errors.selectDates"));
      return;
    }

    setSearching(true);
    setSearchError(null);
    setSelected(null);
    setPreview(null);

    try {
      const result = await searchBookingAvailabilities(
        {
          checkIn: format(dateRange.from, "yyyy-MM-dd"),
          checkOut: format(dateRange.to, "yyyy-MM-dd"),
          adults,
          children,
          childAges: childAges.map((c) => c.age),
          rooms: 1,
          pets: pets.map(mapPetToRequest),
          ratePlanId: reservation.ratePlanSnapshot.ratePlanId,
        },
        locale,
        { datesRequired: t("errors.selectDates") },
      );

      const singleRoomCards = result.roomCards
        .map((card) => ({
          ...card,
          plans: card.plans.filter(
            (plan) =>
              plan.ratePlanId === reservation.ratePlanSnapshot.ratePlanId,
          ),
        }))
        .filter(
          (card) =>
            card.plans.length > 0 &&
            card.maxAdultOccupancy >= adults &&
            card.maxOccupancy >= adults + children &&
            getCardMaxPetOccupancy(card) >= pets.length,
        );

      if (singleRoomCards.length === 0) {
        setSearchError(t("errors.noAvailability"));
        setSearching(false);
        return;
      }

      const originalCategoryCard = singleRoomCards.find(
        (card) => card.roomCategoryId === reservation.accommodationCategoryId,
      );
      const originalCategoryPlan = originalCategoryCard?.plans[0];

      setCards(singleRoomCards);
      setSelected(
        originalCategoryCard && originalCategoryPlan
          ? buildSelectedOption(originalCategoryCard, originalCategoryPlan)
          : null,
      );
      setStep("results");
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : t("errors.search"));
    } finally {
      setSearching(false);
    }
  };
  const handleSelect = (categoryId: number, plan: BookingRatePlanOptionVM) => {
    const card = cards.find((item) => item.roomCategoryId === categoryId);
    if (!card) return;

    setPreview(null);
    setSelected(buildSelectedOption(card, plan));
  };
  const buildRequestBody = () => {
    if (!dateRange?.from || !dateRange?.to) return null;

    const body: Record<string, unknown> = {
      checkInDate: format(dateRange.from, "yyyy-MM-dd"),
      checkOutDate: format(dateRange.to, "yyyy-MM-dd"),
      numAdults: adults,
      numChildren: children,
      childAges: childAges.map((c) => c.age),
      numPets: pets.length,
      pets: pets.map(mapPetToRequest),
    };

    if (selected) {
      body.accommodationCategoryId = selected.roomCategoryId;
    }

    return body;
  };
  const handlePreview = async () => {
    if (!canModify) return;

    const body = buildRequestBody();
    if (!body) return;

    setPreviewing(true);
    setSubmitError(null);

    const result = await actionPreviewMyReservationModificationRequest({
      locale,
      payload: body as CreateGuestModificationRequest,
      reservationId: reservation.id,
    });
    setPreviewing(false);

    if (result.error || !result.data) {
      setSubmitError(result.error ?? t("errors.preview"));
      return;
    }

    setPreview(result.data);
  };
  const handleSubmit = async () => {
    if (!canModify) return;

    const body = buildRequestBody();
    if (!body) return;

    if (!preview) {
      await handlePreview();
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    const result = await actionCreateMyReservationModificationRequest({
      locale,
      payload: body as CreateGuestModificationRequest,
      reservationId: reservation.id,
    });
    setSubmitting(false);

    if (result.error || !result.data) {
      setSubmitError(result.error ?? t("errors.submit"));
      return;
    }

    onCreated(result.data);
    handleClose();
  };
  return {
    t,
    canModify,
    step,
    setStep,
    dateRange,
    setDateRange,
    adults,
    setAdults,
    children,
    setChildren,
    childAges,
    setChildAges,
    pets,
    setPets,
    searching,
    setSearching,
    searchError,
    setSearchError,
    cards,
    setCards,
    selected,
    setSelected,
    preview,
    setPreview,
    previewing,
    setPreviewing,
    submitting,
    setSubmitting,
    submitError,
    setSubmitError,
    handleClose,
    handleChildrenChange,
    updateChildAge,
    handlePetsChange,
    updatePet,
    removePet,
    handleSearch,
    handleSelect,
    buildRequestBody,
    handlePreview,
    handleSubmit,
  };
};
