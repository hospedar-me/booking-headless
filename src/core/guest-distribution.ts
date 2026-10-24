import { parseDateOnly } from "./date-only";
import type { BookingGuestDistributionParam } from "./booking-results";
import type {
  BookingEngineGuestDistributionRoom,
  PetType,
} from "../sdk/types.gen";
type DateRange = { from: Date | undefined; to?: Date };
export interface ChildAge {
  id: number;
  age: number;
}
export interface BookingPet {
  id: number;
  petType: PetType;
  weightKg: number;
}
export interface RoomDistribution {
  id: number;
  adults: number;
  children: ChildAge[];
  pets: BookingPet[];
}
export const parseDate = (value?: string) => {
  return parseDateOnly(value);
};
export const getDefaultStayRange = (): DateRange => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return { from: today, to: tomorrow };
};
export const createStableId = () =>
  Date.now() + Math.floor(Math.random() * 1000);
export const toRoomDistributions = (
  distribution: BookingEngineGuestDistributionRoom[],
): RoomDistribution[] =>
  distribution.map((room) => ({
    id: createStableId(),
    adults: room.numAdults,
    children: room.childAges.map((age) => ({ id: createStableId(), age })),
    pets: room.pets.map((pet) => ({
      id: createStableId(),
      petType: pet.petType,
      weightKg: Math.max(0.1, pet.weightInGrams / 1000),
    })),
  }));
export const searchDistributionToRooms = (
  distribution?: BookingGuestDistributionParam[],
): RoomDistribution[] | null => {
  if (!distribution || distribution.length === 0) return null;

  return distribution.map((room) => ({
    id: createStableId(),
    adults: room.adults,
    children: room.childAges.map((age) => ({ id: createStableId(), age })),
    pets: (room.pets ?? []).map((pet) => ({
      id: createStableId(),
      petType: pet.petType,
      weightKg: Math.max(0.1, pet.weightInGrams / 1000),
    })),
  }));
};
export const flattenRoomChildren = (
  distribution: RoomDistribution[],
): ChildAge[] =>
  distribution.flatMap((room) => room.children.map((child) => ({ ...child })));
export const flattenRoomPets = (
  distribution: RoomDistribution[],
): BookingPet[] =>
  distribution.flatMap((room) => room.pets.map((pet) => ({ ...pet })));
export const assignChildrenToFirstRoom = (
  distribution: RoomDistribution[],
  children: ChildAge[],
): RoomDistribution[] =>
  distribution.map((room, index) => ({
    ...room,
    children: index === 0 ? children.map((child) => ({ ...child })) : [],
  }));
export const assignPetsToFirstRoom = (
  distribution: RoomDistribution[],
  pets: BookingPet[],
): RoomDistribution[] =>
  distribution.map((room, index) => ({
    ...room,
    pets: index === 0 ? pets.map((pet) => ({ ...pet })) : [],
  }));
export const mapPetToRequest = (pet: BookingPet) => ({
  petType: pet.petType,
  weightInGrams: Math.max(1, Math.round(pet.weightKg * 1000)),
});
export const sumRoomAdults = (distribution: RoomDistribution[]): number =>
  distribution.reduce((sum, room) => sum + room.adults, 0);
export const createInitialRoomDistributions = ({
  adults,
  childAges,
  pets,
  rooms,
}: {
  adults: number;
  childAges: ChildAge[];
  pets: BookingPet[];
  rooms: number;
}): RoomDistribution[] => {
  const roomCount = Math.max(1, rooms);
  const baseAdults = Math.floor(adults / roomCount);
  const extraAdults = adults % roomCount;

  return Array.from({ length: roomCount }, (_, index) => ({
    id: createStableId(),
    adults: Math.max(1, baseAdults + (index < extraAdults ? 1 : 0)),
    children: index === 0 ? childAges.map((child) => ({ ...child })) : [],
    pets: index === 0 ? pets.map((pet) => ({ ...pet })) : [],
  }));
};
