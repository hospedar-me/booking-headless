"use client";
import { useGuestDistribution } from "./useGuestDistribution";
import type { HookContext } from "./context";
import { buildBookingResultsUrl } from "../core/booking-results";
import { format } from "date-fns";
import { mapPetToRequest } from "./useGuestDistribution";
export * from "./useGuestDistribution";
export const useBookingSearch = (
  props: Parameters<typeof useGuestDistribution>[0],
  context: HookContext,
) => {
  const state = useGuestDistribution(props, context);
  const {
    copyLocale,
    t,
    router,
    params,
    locale,
    formCopy,
    distributionRequestIdRef,
    initialDistributionRooms,
    dateRange,
    setDateRange,
    initialChildAges,
    initialPets,
    initialRooms,
    adults,
    setAdults,
    children,
    setChildren,
    childAges,
    setChildAges,
    pets,
    setPets,
    activeTab,
    setActiveTab,
    selectedCategoryId,
    setSelectedCategoryId,
    selectedRatePlanId,
    setSelectedRatePlanId,
    promotionCode,
    setPromotionCode,
    roomDistributions,
    setRoomDistributions,
    distributionMode,
    setDistributionMode,
    distributionError,
    setDistributionError,
    isDistributingGuests,
    setIsDistributingGuests,
    isSearching,
    setIsSearching,
    isDistributionOpen,
    setIsDistributionOpen,
    rooms,
    normalizedChildAges,
    childAgesKey,
    petsKey,
    automaticDistributionKey,
    lastAutomaticDistributionKeyRef,
    requestGuestDistribution,
    validateManualDistribution,
    applyManualDistribution,
    handleChildrenChange,
    updateChildAge,
    handlePetsChange,
    removePet,
    updatePet,
    getEffectivePets,
    updateRoomAdults,
    addRoom,
    removeRoom,
    addChildToRoom,
    removeChildFromRoom,
    updateRoomChildAge,
    addPetToRoom,
    removePetFromRoom,
    updateRoomPet,
    getTotalGuests,
    guestSummary,
    getEffectiveChildAges,
    activeFilterLabels,
    hasActiveFilters,
    resetFilters,
  } = state;
  const handleSearch = () => {
    if (isSearching) return;
    setIsSearching(true);
    router.push(
      buildBookingResultsUrl(locale, {
        checkIn: dateRange?.from
          ? format(dateRange.from, "yyyy-MM-dd")
          : undefined,
        checkOut: dateRange?.to
          ? format(dateRange.to, "yyyy-MM-dd")
          : undefined,
        adults,
        children,
        childAges: getEffectiveChildAges(),
        rooms,
        pets: getEffectivePets(),
        promotionCode: promotionCode.trim() || undefined,
        distribution: roomDistributions.map((room) => ({
          adults: room.adults,
          childAges: room.children.map((child) => child.age),
          pets: room.pets.map(mapPetToRequest),
        })),
        categoryId: selectedCategoryId,
        ratePlanId: selectedRatePlanId,
      }),
    );
  };

  return { ...state, handleSearch };
};
