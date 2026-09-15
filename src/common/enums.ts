export enum UserRole {
  ADMIN = 'admin',
  EMPLOYEE = 'employee',
  CLIENT = 'client',
}

// Actor stored in activity logs when the system expires a no-show
export const SYSTEM_ACTOR_ID = 'system';
export const SYSTEM_ACTOR_ROLE = 'system';

export enum SpotType {
  STANDARD = 'standard',
  DISABLED = 'disabled',
  ELECTRIC = 'electric',
}

export enum ReservationStatus {
  CONFIRMED = 'confirmed',
  CANCELLED = 'cancelled',
  COMPLETED = 'completed',
  EXPIRED = 'expired',
}

export enum LogAction {
  RESERVATION_CREATED = 'reservation_created',
  RESERVATION_CANCELLED = 'reservation_cancelled',
  RESERVATION_EXPIRED = 'reservation_expired',
  VEHICLE_ENTRY = 'vehicle_entry',
  VEHICLE_EXIT = 'vehicle_exit',
  USER_UPDATED = 'user_updated',
}

export enum SpotOccupancyStatus {
  OCCUPIED = 'occupied',
  RESERVED = 'reserved',
  FREE = 'free',
}
