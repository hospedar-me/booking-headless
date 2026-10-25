"use client";
import {
  parseDate,
  getDefaultStayRange,
  createStableId,
  toRoomDistributions,
  searchDistributionToRooms,
  flattenRoomChildren,
  flattenRoomPets,
  assignChildrenToFirstRoom,
  assignPetsToFirstRoom,
  mapPetToRequest,
  sumRoomAdults,
  createInitialRoomDistributions,
} from "../core/guest-distribution";
import type {
  ChildAge,
  BookingPet,
  RoomDistribution,
} from "../core/guest-distribution";
export * from "../core/guest-distribution";

import type { HookContext } from "./context";
type AppLocale = string;
const translateUi = (_locale: string, key: string) => key;
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
type DateRange = { from: Date | undefined; to?: Date };
import { buildBookingResultsUrl } from "../core/booking-results";
import type {
  BookingGuestDistributionParam,
  BookingSearchParams,
} from "../core/booking-results";
import { parseDateOnly } from "../core/date-only";
import type {
  BookingEngineGuestDistributionRequest,
  BookingEngineGuestDistributionRoom,
  PetType,
} from "../sdk/types.gen";
import type {
  BookingFormCategoryOption,
  BookingFormCopyViewData,
  BookingFormRatePlanOption,
} from "../models/home";
type DistributionMode = "automatic" | "manual";
type BookingFormProps = {
  copy?: BookingFormCopyViewData;
  initialValues?: Partial<BookingSearchParams>;
  categoryOptions?: BookingFormCategoryOption[];
  ratePlanOptions?: BookingFormRatePlanOption[];
};
export const useGuestDistribution = (
  {
    copy,
    initialValues,
    categoryOptions = [],
    ratePlanOptions = [],
  }: BookingFormProps,
  context: HookContext,
) => {
  const { actionDistributeBookingEngineGuests } = context.operations;
  const translateUi = context.translate;
  const {
    PAYMENT_PROVIDER_PUBLIC_KEYS,
    getPaymentProviderLabel,
    isBookingFrontendPaymentProvider,
  } = context.paymentProviders;
  const copyLocale = context.locale;
  const t = context.translations("bookingForm");
  const router = context.navigation;
  const params = { locale: context.locale };
  const locale = (params?.locale || "pt") as AppLocale;
  const formCopy = {
    ...context.formCopy,
    ...(copy ?? {}),
  };
  const distributionRequestIdRef = useRef(0);
  const initialDistributionRooms = useMemo(
    () => searchDistributionToRooms(initialValues?.distribution),
    [initialValues?.distribution],
  );
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    const from = parseDate(initialValues?.checkIn);
    const to = parseDate(initialValues?.checkOut);
    return from && to ? { from, to } : getDefaultStayRange();
  });
  const initialChildAges = useMemo<ChildAge[]>(
    () =>
      Array.from({ length: initialValues?.children ?? 0 }, (_, index) => ({
        id: Date.now() + index,
        age: initialValues?.childAges?.[index] ?? 0,
      })),
    [initialValues?.childAges, initialValues?.children],
  );
  const initialPets = useMemo<BookingPet[]>(
    () =>
      (initialValues?.pets ?? []).map((pet, index) => ({
        id: 500 + index,
        petType: pet.petType,
        weightKg: Math.max(0.1, pet.weightInGrams / 1000),
      })),
    [initialValues?.pets],
  );
  const initialRooms = useMemo(() => {
    if (initialDistributionRooms) {
      const roomsWithChildren =
        flattenRoomChildren(initialDistributionRooms).length === 0 &&
        initialChildAges.length > 0
          ? assignChildrenToFirstRoom(
              initialDistributionRooms,
              initialChildAges,
            )
          : initialDistributionRooms;

      return flattenRoomPets(roomsWithChildren).length === 0 &&
        initialPets.length > 0
        ? assignPetsToFirstRoom(roomsWithChildren, initialPets)
        : roomsWithChildren;
    }

    return createInitialRoomDistributions({
      adults: initialValues?.adults ?? 2,
      childAges: initialChildAges,
      pets: initialPets,
      rooms: initialValues?.rooms ?? 1,
    });
  }, [
    initialChildAges,
    initialDistributionRooms,
    initialPets,
    initialValues?.adults,
    initialValues?.rooms,
  ]);
  const [adults, setAdults] = useState(() => sumRoomAdults(initialRooms));
  const [children, setChildren] = useState(
    () => flattenRoomChildren(initialRooms).length,
  );
  const [childAges, setChildAges] = useState<ChildAge[]>(() =>
    flattenRoomChildren(initialRooms),
  );
  const [pets, setPets] = useState<BookingPet[]>(() =>
    flattenRoomPets(initialRooms),
  );
  const [activeTab, setActiveTab] = useState<"main" | "advanced">("main");
  const [selectedCategoryId, setSelectedCategoryId] = useState<
    number | undefined
  >(initialValues?.categoryId);
  const [selectedRatePlanId, setSelectedRatePlanId] = useState<
    number | undefined
  >(initialValues?.ratePlanId);
  const [promotionCode, setPromotionCode] = useState(
    initialValues?.promotionCode ?? "",
  );
  const [roomDistributions, setRoomDistributions] = useState<
    RoomDistribution[]
  >(() => initialRooms);
  const [distributionMode, setDistributionMode] = useState<DistributionMode>(
    initialDistributionRooms ? "manual" : "automatic",
  );
  const [distributionError, setDistributionError] = useState<string | null>(
    null,
  );
  const [isDistributingGuests, setIsDistributingGuests] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isDistributionOpen, setIsDistributionOpen] = useState(false);
  const rooms = roomDistributions.length;
  const normalizedChildAges = useMemo(
    () => childAges.map((child) => child.age),
    [childAges],
  );
  const childAgesKey = useMemo(
    () => normalizedChildAges.join(","),
    [normalizedChildAges],
  );
  const petsKey = useMemo(
    () =>
      pets
        .map(
          (pet) =>
            `${pet.petType}:${Math.max(1, Math.round(pet.weightKg * 1000))}`,
        )
        .join(","),
    [pets],
  );
  const automaticDistributionKey = `${adults}:${children}:${childAgesKey}:${petsKey}:${rooms}`;
  const lastAutomaticDistributionKeyRef = useRef(automaticDistributionKey);
  const selectCategory = useCallback(
    (categoryId?: number) => setSelectedCategoryId(categoryId),
    [],
  );
  useEffect(() => {
    distributionRequestIdRef.current++;
    return () => {
      distributionRequestIdRef.current++;
    };
  }, [automaticDistributionKey, distributionMode]);
  const requestGuestDistribution = useCallback(
    async (
      input: BookingEngineGuestDistributionRequest,
      applyResponse: boolean,
    ) => {
      const requestId = distributionRequestIdRef.current + 1;
      distributionRequestIdRef.current = requestId;
      setIsDistributingGuests(true);
      setDistributionError(null);

      const response = await actionDistributeBookingEngineGuests(
        input,
        locale,
      ).catch(() => ({
        data: undefined,
        error: t("errors.invalidDistribution"),
      }));

      if (distributionRequestIdRef.current !== requestId) return;

      setIsDistributingGuests(false);

      if (response.error || !response.data) {
        setDistributionError(response.error ?? t("errors.invalidDistribution"));
        return;
      }

      if (applyResponse) {
        const responseRooms = toRoomDistributions(response.data.distribution);
        const nextRooms = responseRooms;
        const nextChildAges = flattenRoomChildren(nextRooms);
        const nextPets = flattenRoomPets(nextRooms);

        setRoomDistributions(nextRooms);
        setAdults(sumRoomAdults(nextRooms));
        setChildren(nextChildAges.length);
        setPets(nextPets);
        setChildAges((currentChildAges) =>
          currentChildAges.map((child) => child.age).join(",") ===
          nextChildAges.map((child) => child.age).join(",")
            ? currentChildAges
            : nextChildAges,
        );
      }
    },
    [locale, t],
  );
  useEffect(() => {
    if (distributionMode !== "automatic") return;
    if (lastAutomaticDistributionKeyRef.current === automaticDistributionKey) {
      return;
    }

    const timeout = window.setTimeout(() => {
      lastAutomaticDistributionKeyRef.current = automaticDistributionKey;
      void requestGuestDistribution(
        {
          numAdults: adults,
          numChildren: children,
          childAges: normalizedChildAges,
          numPets: pets.length,
          pets: pets.map(mapPetToRequest),
          numAccommodations: rooms,
        },
        true,
      );
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [
    adults,
    automaticDistributionKey,
    children,
    childAgesKey,
    distributionMode,
    normalizedChildAges,
    pets,
    requestGuestDistribution,
    rooms,
  ]);
  const validateManualDistribution = useCallback(
    (nextRooms: RoomDistribution[]) => {
      const nextChildAges = flattenRoomChildren(nextRooms);
      const nextPets = flattenRoomPets(nextRooms);
      void requestGuestDistribution(
        {
          numAdults: sumRoomAdults(nextRooms),
          numChildren: nextChildAges.length,
          childAges: nextChildAges.map((child) => child.age),
          numPets: nextPets.length,
          pets: nextPets.map(mapPetToRequest),
          numAccommodations: nextRooms.length,
          distribution: nextRooms.map((room) => ({
            numAdults: room.adults,
            numChildren: room.children.length,
            childAges: room.children.map((child) => child.age),
            numPets: room.pets.length,
            pets: room.pets.map(mapPetToRequest),
          })),
        },
        false,
      );
    },
    [requestGuestDistribution],
  );
  const applyManualDistribution = (nextRooms: RoomDistribution[]) => {
    const nextChildAges = flattenRoomChildren(nextRooms);
    setDistributionMode("manual");
    setRoomDistributions(nextRooms);
    setAdults(sumRoomAdults(nextRooms));
    setChildren(nextChildAges.length);
    setChildAges(nextChildAges);
    setPets(flattenRoomPets(nextRooms));
    validateManualDistribution(nextRooms);
  };
  const handleChildrenChange = (newCount: number) => {
    setDistributionMode("automatic");
    setChildAges((current) => {
      const nextChildren =
        newCount <= current.length
          ? current.slice(0, newCount)
          : [
              ...current,
              ...Array.from({ length: newCount - current.length }, () => ({
                id: createStableId(),
                age: 0,
              })),
            ];
      setRoomDistributions((rooms) =>
        assignChildrenToFirstRoom(rooms, nextChildren),
      );
      return nextChildren;
    });
    setChildren(newCount);
  };
  const updateChildAge = (id: number, age: number) => {
    setDistributionMode("automatic");
    setChildAges((current) => {
      const nextChildren = current.map((child) =>
        child.id === id ? { ...child, age } : child,
      );
      setRoomDistributions((rooms) =>
        assignChildrenToFirstRoom(rooms, nextChildren),
      );
      return nextChildren;
    });
  };
  const handlePetsChange = (newCount: number) => {
    setDistributionMode("automatic");
    setPets((current) => {
      const nextPets =
        newCount <= current.length
          ? current.slice(0, newCount)
          : [
              ...current,
              ...Array.from({ length: newCount - current.length }, () => ({
                id: createStableId(),
                petType: "dog" as PetType,
                weightKg: 10,
              })),
            ];
      setRoomDistributions((rooms) => assignPetsToFirstRoom(rooms, nextPets));
      return nextPets;
    });
  };
  const removePet = (id: number) => {
    setDistributionMode("automatic");
    setPets((current) => {
      const nextPets = current.filter((pet) => pet.id !== id);
      setRoomDistributions((rooms) => assignPetsToFirstRoom(rooms, nextPets));
      return nextPets;
    });
  };
  const updatePet = (id: number, updates: Partial<BookingPet>) => {
    setDistributionMode("automatic");
    setPets((current) => {
      const nextPets = current.map((pet) =>
        pet.id === id ? { ...pet, ...updates } : pet,
      );
      setRoomDistributions((rooms) => assignPetsToFirstRoom(rooms, nextPets));
      return nextPets;
    });
  };
  const getEffectivePets = () => pets.map(mapPetToRequest);
  const updateRoomAdults = (roomId: number, newAdults: number) => {
    applyManualDistribution(
      roomDistributions.map((room) =>
        room.id === roomId ? { ...room, adults: newAdults } : room,
      ),
    );
  };
  const addRoom = () => {
    if (rooms >= 8) return;
    applyManualDistribution([
      ...roomDistributions,
      { id: createStableId(), adults: 1, children: [], pets: [] },
    ]);
  };
  const removeRoom = (roomId: number) => {
    if (rooms <= 1) return;
    applyManualDistribution(
      roomDistributions.filter((room) => room.id !== roomId),
    );
  };
  const addChildToRoom = (roomId: number) => {
    applyManualDistribution(
      roomDistributions.map((room) =>
        room.id === roomId
          ? {
              ...room,
              children: [...room.children, { id: createStableId(), age: 0 }],
            }
          : room,
      ),
    );
  };
  const removeChildFromRoom = (roomId: number, childId: number) => {
    applyManualDistribution(
      roomDistributions.map((room) =>
        room.id === roomId
          ? { ...room, children: room.children.filter((c) => c.id !== childId) }
          : room,
      ),
    );
  };
  const updateRoomChildAge = (roomId: number, childId: number, age: number) => {
    applyManualDistribution(
      roomDistributions.map((room) =>
        room.id === roomId
          ? {
              ...room,
              children: room.children.map((c) =>
                c.id === childId ? { ...c, age } : c,
              ),
            }
          : room,
      ),
    );
  };
  const addPetToRoom = (roomId: number) => {
    applyManualDistribution(
      roomDistributions.map((room) =>
        room.id === roomId
          ? {
              ...room,
              pets: [
                ...room.pets,
                { id: createStableId(), petType: "dog", weightKg: 10 },
              ],
            }
          : room,
      ),
    );
  };
  const removePetFromRoom = (roomId: number, petId: number) => {
    applyManualDistribution(
      roomDistributions.map((room) =>
        room.id === roomId
          ? { ...room, pets: room.pets.filter((pet) => pet.id !== petId) }
          : room,
      ),
    );
  };
  const updateRoomPet = (
    roomId: number,
    petId: number,
    updates: Partial<BookingPet>,
  ) => {
    applyManualDistribution(
      roomDistributions.map((room) =>
        room.id === roomId
          ? {
              ...room,
              pets: room.pets.map((pet) =>
                pet.id === petId ? { ...pet, ...updates } : pet,
              ),
            }
          : room,
      ),
    );
  };
  const getTotalGuests = () => adults + children;
  const guestSummary = [
    t("adultsSummary", { count: adults }),
    children > 0 ? t("childrenSummary", { count: children }) : null,
    pets.length > 0 ? t("petsSummary", { count: pets.length }) : null,
  ]
    .filter(Boolean)
    .join(", ");
  const getEffectiveChildAges = () => {
    const distributedChildren = roomDistributions.flatMap((room) =>
      room.children.map((child) => child.age),
    );
    if (distributedChildren.length > 0) return distributedChildren;
    return childAges.map((child) => child.age);
  };
  const activeFilterLabels = [
    promotionCode.trim()
      ? `${t("promotionCodeLabel")}: ${promotionCode.trim()}`
      : undefined,
    categoryOptions.find((category) => category.id === selectedCategoryId)
      ?.name,
    ratePlanOptions.find((ratePlan) => ratePlan.id === selectedRatePlanId)
      ?.name,
  ].filter((label): label is string => Boolean(label));
  const hasActiveFilters = Boolean(
    promotionCode.trim() || selectedCategoryId || selectedRatePlanId,
  );
  const resetFilters = () => {
    setPromotionCode("");
    setSelectedCategoryId(undefined);
    setSelectedRatePlanId(undefined);
  };
  return {
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
    selectCategory,
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
  };
};
