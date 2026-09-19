import * as bcrypt from 'bcryptjs';
import { ReservationStatus, SpotType, UserRole } from '../../src/common/enums';
import { Reservation } from '../../src/reservations/reservation.entity';
import { ParkingSession } from '../../src/sessions/parking-session.entity';
import { ParkingSpot } from '../../src/spots/parking-spot.entity';
import { User } from '../../src/users/user.entity';
import { Vehicle } from '../../src/vehicles/vehicle.entity';
import type { TestApp } from './app';

export const DEFAULT_PASSWORD = 'Password123!';

const hashCache = new Map<string, string>();
let seq = 0;
const next = () => String(++seq);

export type TestUser = {
  id: string;
  email: string;
  password: string;
  role: UserRole;
  token: string;
};

export async function createUser(
  app: TestApp,
  options: { role?: UserRole; email?: string; password?: string } = {},
): Promise<TestUser> {
  const role = options.role ?? UserRole.CLIENT;
  const password = options.password ?? DEFAULT_PASSWORD;
  const suffix = next();
  const repo = app.dataSource.getRepository(User);
  const user = await repo.save(
    repo.create({
      name: `Test ${role} ${suffix}`,
      email: options.email ?? `${role}-${suffix}@parking.test`,
      role,
      passwordHash: hashPassword(password),
    }),
  );
  return {
    id: user.id,
    email: user.email,
    password,
    role: user.role,
    token: app.jwt.sign({ sub: user.id, email: user.email, role: user.role }),
  };
}

export const createClient = (app: TestApp) =>
  createUser(app, { role: UserRole.CLIENT });
export const createEmployee = (app: TestApp) =>
  createUser(app, { role: UserRole.EMPLOYEE });
export const createAdmin = (app: TestApp) =>
  createUser(app, { role: UserRole.ADMIN });

export async function createSpot(
  app: TestApp,
  options: { code?: string; type?: SpotType } = {},
) {
  const repo = app.dataSource.getRepository(ParkingSpot);
  return repo.save(
    repo.create({
      code: options.code ?? `S-${next()}`,
      floor: 0,
      type: options.type ?? SpotType.STANDARD,
    }),
  );
}

export async function createVehicle(
  app: TestApp,
  owner: TestUser,
  options: { licensePlate?: string } = {},
) {
  const repo = app.dataSource.getRepository(Vehicle);
  return repo.save(
    repo.create({
      licensePlate: options.licensePlate ?? `P-${next()}`,
      ownerId: owner.id,
    }),
  );
}

export async function createReservation(
  app: TestApp,
  input: {
    vehicle: Vehicle;
    spot: ParkingSpot;
    startAt?: Date;
    endAt?: Date;
    status?: ReservationStatus;
  },
) {
  const repo = app.dataSource.getRepository(Reservation);
  return repo.save(
    repo.create({
      userId: input.vehicle.ownerId,
      vehicleId: input.vehicle.id,
      spotId: input.spot.id,
      startAt: input.startAt ?? hoursFromNow(1),
      endAt: input.endAt ?? hoursFromNow(3),
      status: input.status ?? ReservationStatus.CONFIRMED,
    }),
  );
}

export async function createSession(
  app: TestApp,
  input: {
    vehicle: Vehicle;
    spot: ParkingSpot;
    reservation?: Reservation;
  },
) {
  const repo = app.dataSource.getRepository(ParkingSession);
  return repo.save(
    repo.create({
      vehicleId: input.vehicle.id,
      spotId: input.spot.id,
      reservationId: input.reservation?.id,
      enteredAt: new Date(),
    }),
  );
}

export const hoursFromNow = (hours: number) =>
  new Date(Date.now() + hours * 3600_000);

function hashPassword(plain: string): string {
  const cached = hashCache.get(plain);
  if (cached) return cached;
  const hash = bcrypt.hashSync(plain, 4);
  hashCache.set(plain, hash);
  return hash;
}
