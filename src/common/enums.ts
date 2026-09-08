export enum UserRole {
  ADMIN = 'admin',
  EMPLOYEE = 'employee',
  CLIENT = 'client',
}

export enum SpotType {
  STANDARD = 'standard',
  DISABLED = 'disabled',
  ELECTRIC = 'electric',
}

export enum ReservationStatus {
  CONFIRMED = 'confirmed',
  CANCELLED = 'cancelled',
  COMPLETED = 'completed',
}

export enum LogAction {
  RESERVATION_CREATED = 'reservation_created',
  RESERVATION_CANCELLED = 'reservation_cancelled',
  VEHICLE_ENTRY = 'vehicle_entry',
  VEHICLE_EXIT = 'vehicle_exit',
  USER_UPDATED = 'user_updated',
}
