import { randomUUID } from 'node:crypto';
import { LogAction, ReservationStatus } from '../common/enums';
import { createTestApp, TestApp } from '../../test/support/app';
import {
  createAdmin,
  createClient,
  createEmployee,
  createReservation,
  createSession,
  createSpot,
  createVehicle,
  hoursFromNow,
} from '../../test/support/factories';

describe('Reservations', () => {
  let app: TestApp;

  beforeAll(async () => {
    app = await createTestApp();
  });
  afterAll(() => app.close());
  beforeEach(() => app.reset());

  const interval = (startHours: number, endHours: number) => ({
    startAt: hoursFromNow(startHours).toISOString(),
    endAt: hoursFromNow(endHours).toISOString(),
  });

  describe('POST /reservations', () => {
    it('creates a confirmed reservation and records reservation_created', async () => {
      const client = await createClient(app);
      const admin = await createAdmin(app);
      const vehicle = await createVehicle(app, client);
      const spot = await createSpot(app);
      const when = interval(1, 3);

      const { body } = await app
        .post(
          '/reservations',
          { vehicleId: vehicle.id, spotId: spot.id, ...when },
          client,
        )
        .expect(201);

      expect(body).toMatchObject({
        userId: client.id,
        vehicleId: vehicle.id,
        spotId: spot.id,
        status: ReservationStatus.CONFIRMED,
      });
      expect(body.id).toEqual(expect.any(String));
      expect(body.vehicle).toMatchObject({ id: vehicle.id });
      expect(body.spot).toMatchObject({ id: spot.id });

      const logs = await app
        .get(`/logs?action=${LogAction.RESERVATION_CREATED}`, admin)
        .expect(200);
      expect(logs.body).toEqual([
        expect.objectContaining({
          action: LogAction.RESERVATION_CREATED,
          actorId: client.id,
          entityType: 'reservation',
          entityId: body.id,
          payload: expect.objectContaining({
            vehicleId: vehicle.id,
            spotId: spot.id,
          }),
        }),
      ]);
    });

    it('assigns a free spot when spotId is omitted', async () => {
      const client = await createClient(app);
      const vehicle = await createVehicle(app, client);
      const taken = await createSpot(app, { code: 'A-1' });
      const free = await createSpot(app, { code: 'B-1' });
      await createReservation(app, {
        vehicle,
        spot: taken,
        startAt: hoursFromNow(1),
        endAt: hoursFromNow(3),
      });

      const { body } = await app
        .post('/reservations', { vehicleId: vehicle.id, ...interval(1, 3) }, client)
        .expect(201);

      expect(body.spotId).toBe(free.id);
    });

    it('lets an admin reserve another user vehicle', async () => {
      const admin = await createAdmin(app);
      const owner = await createClient(app);
      const vehicle = await createVehicle(app, owner);
      const spot = await createSpot(app);

      const { body } = await app
        .post(
          '/reservations',
          { vehicleId: vehicle.id, spotId: spot.id, ...interval(1, 3) },
          admin,
        )
        .expect(201);

      expect(body).toMatchObject({
        userId: owner.id,
        vehicleId: vehicle.id,
      });
    });

    it('rejects another client vehicle', async () => {
      const owner = await createClient(app);
      const intruder = await createClient(app);
      const vehicle = await createVehicle(app, owner);
      const spot = await createSpot(app);

      const { body } = await app
        .post(
          '/reservations',
          { vehicleId: vehicle.id, spotId: spot.id, ...interval(1, 3) },
          intruder,
        )
        .expect(403);
      expect(body.message).toBe('You can only reserve your own vehicles');
    });

    it('rejects an overlapping confirmed reservation and allows an adjacent one', async () => {
      const client = await createClient(app);
      const vehicle = await createVehicle(app, client);
      const spot = await createSpot(app);
      const start = hoursFromNow(1);
      const mid = hoursFromNow(3);
      const later = hoursFromNow(5);

      await app
        .post(
          '/reservations',
          {
            vehicleId: vehicle.id,
            spotId: spot.id,
            startAt: start.toISOString(),
            endAt: mid.toISOString(),
          },
          client,
        )
        .expect(201);

      const overlap = await app
        .post(
          '/reservations',
          {
            vehicleId: vehicle.id,
            spotId: spot.id,
            startAt: hoursFromNow(2).toISOString(),
            endAt: later.toISOString(),
          },
          client,
        )
        .expect(409);
      expect(overlap.body.message).toBe(
        'The parking spot is not available for the requested time range',
      );

      const adjacent = await app
        .post(
          '/reservations',
          {
            vehicleId: vehicle.id,
            spotId: spot.id,
            startAt: mid.toISOString(),
            endAt: later.toISOString(),
          },
          client,
        )
        .expect(201);
      expect(adjacent.body.spotId).toBe(spot.id);
    });

    it('rejects a current interval on a spot with an open session', async () => {
      const client = await createClient(app);
      const vehicle = await createVehicle(app, client);
      const otherVehicle = await createVehicle(app, client);
      const spot = await createSpot(app);
      await createSession(app, { vehicle: otherVehicle, spot });

      const { body } = await app
        .post(
          '/reservations',
          { vehicleId: vehicle.id, spotId: spot.id, ...interval(-1, 2) },
          client,
        )
        .expect(409);
      expect(body.message).toBe(
        'The parking spot is not available for the requested time range',
      );
    });

    it('rejects auto-assign when every spot is taken', async () => {
      const client = await createClient(app);
      const vehicle = await createVehicle(app, client);
      const spot = await createSpot(app);
      await createReservation(app, {
        vehicle,
        spot,
        startAt: hoursFromNow(1),
        endAt: hoursFromNow(3),
      });

      const { body } = await app
        .post('/reservations', { vehicleId: vehicle.id, ...interval(1, 3) }, client)
        .expect(409);
      expect(body.message).toBe(
        'No parking spots available for the requested time range',
      );
    });

    it('expires an overdue no-show before assigning the spot', async () => {
      const client = await createClient(app);
      const vehicle = await createVehicle(app, client);
      const spot = await createSpot(app);
      const overdue = await createReservation(app, {
        vehicle,
        spot,
        startAt: hoursFromNow(-3),
        endAt: hoursFromNow(-1),
      });

      const { body } = await app
        .post(
          '/reservations',
          { vehicleId: vehicle.id, spotId: spot.id, ...interval(1, 3) },
          client,
        )
        .expect(201);

      expect(body.spotId).toBe(spot.id);

      const stored = await app.get(`/reservations/${overdue.id}`, client).expect(200);
      expect(stored.body.status).toBe(ReservationStatus.EXPIRED);
    });

    it('rejects unknown vehicle or spot, invalid dates, and extra fields', async () => {
      const client = await createClient(app);
      const vehicle = await createVehicle(app, client);
      const spot = await createSpot(app);
      const when = interval(1, 3);

      const unknownVehicle = await app
        .post(
          '/reservations',
          { vehicleId: randomUUID(), spotId: spot.id, ...when },
          client,
        )
        .expect(404);
      expect(unknownVehicle.body.message).toBe('Vehicle not found');

      const unknownSpot = await app
        .post(
          '/reservations',
          { vehicleId: vehicle.id, spotId: randomUUID(), ...when },
          client,
        )
        .expect(404);
      expect(unknownSpot.body.message).toBe('Parking spot not found');

      const inverted = await app
        .post(
          '/reservations',
          {
            vehicleId: vehicle.id,
            spotId: spot.id,
            startAt: hoursFromNow(3).toISOString(),
            endAt: hoursFromNow(1).toISOString(),
          },
          client,
        )
        .expect(400);
      expect(inverted.body.message).toBe('endAt must be after startAt');

      await app
        .post(
          '/reservations',
          { vehicleId: vehicle.id, spotId: spot.id, ...when, extra: true },
          client,
        )
        .expect(400);
    });

    it('rejects employee and unauthenticated requests', async () => {
      const employee = await createEmployee(app);
      const client = await createClient(app);
      const vehicle = await createVehicle(app, client);
      const spot = await createSpot(app);
      const payload = { vehicleId: vehicle.id, spotId: spot.id, ...interval(1, 3) };

      await app.post('/reservations', payload).expect(401);
      await app.post('/reservations', payload, employee).expect(403);
    });
  });

  describe('GET /reservations', () => {
    it('returns only the client reservations, newest start first', async () => {
      const owner = await createClient(app);
      const other = await createClient(app);
      const mineLater = await createVehicle(app, owner);
      const mineEarlier = await createVehicle(app, owner);
      const theirs = await createVehicle(app, other);
      const spotA = await createSpot(app);
      const spotB = await createSpot(app);
      const spotC = await createSpot(app);

      await createReservation(app, {
        vehicle: mineEarlier,
        spot: spotA,
        startAt: hoursFromNow(1),
        endAt: hoursFromNow(2),
      });
      const later = await createReservation(app, {
        vehicle: mineLater,
        spot: spotB,
        startAt: hoursFromNow(4),
        endAt: hoursFromNow(5),
      });
      await createReservation(app, {
        vehicle: theirs,
        spot: spotC,
        startAt: hoursFromNow(3),
        endAt: hoursFromNow(4),
      });

      const { body } = await app.get('/reservations', owner).expect(200);

      expect(body).toHaveLength(2);
      expect(body[0].id).toBe(later.id);
      expect(body.every((item: { userId: string }) => item.userId === owner.id)).toBe(
        true,
      );
    });

    it('lets employee and admin list every reservation', async () => {
      const employee = await createEmployee(app);
      const admin = await createAdmin(app);
      const client = await createClient(app);
      await createReservation(app, {
        vehicle: await createVehicle(app, client),
        spot: await createSpot(app),
      });

      const asEmployee = await app.get('/reservations', employee).expect(200);
      const asAdmin = await app.get('/reservations', admin).expect(200);

      expect(asEmployee.body).toHaveLength(1);
      expect(asAdmin.body).toHaveLength(1);
    });
  });

  describe('GET /reservations/:id', () => {
    it('lets the owner, an employee, and an admin read a reservation', async () => {
      const owner = await createClient(app);
      const employee = await createEmployee(app);
      const admin = await createAdmin(app);
      const reservation = await createReservation(app, {
        vehicle: await createVehicle(app, owner),
        spot: await createSpot(app),
      });

      const asOwner = await app.get(`/reservations/${reservation.id}`, owner).expect(200);
      await app.get(`/reservations/${reservation.id}`, employee).expect(200);
      await app.get(`/reservations/${reservation.id}`, admin).expect(200);

      expect(asOwner.body).toMatchObject({
        id: reservation.id,
        userId: owner.id,
        status: ReservationStatus.CONFIRMED,
      });
    });

    it('rejects another client and a missing or invalid id', async () => {
      const owner = await createClient(app);
      const intruder = await createClient(app);
      const reservation = await createReservation(app, {
        vehicle: await createVehicle(app, owner),
        spot: await createSpot(app),
      });

      const forbidden = await app
        .get(`/reservations/${reservation.id}`, intruder)
        .expect(403);
      expect(forbidden.body.message).toBe('You can only access your own reservations');

      const missing = await app.get(`/reservations/${randomUUID()}`, owner).expect(404);
      expect(missing.body.message).toBe('Reservation not found');

      await app.get('/reservations/not-a-uuid', owner).expect(400);
    });
  });

  describe('PUT /reservations/:id', () => {
    it('updates the sent fields without conflicting with itself', async () => {
      const client = await createClient(app);
      const vehicle = await createVehicle(app, client);
      const nextVehicle = await createVehicle(app, client);
      const spot = await createSpot(app);
      const nextSpot = await createSpot(app);
      const reservation = await createReservation(app, {
        vehicle,
        spot,
        startAt: hoursFromNow(1),
        endAt: hoursFromNow(3),
      });
      const nextStart = hoursFromNow(2).toISOString();
      const nextEnd = hoursFromNow(4).toISOString();

      const { body } = await app
        .put(
          `/reservations/${reservation.id}`,
          {
            vehicleId: nextVehicle.id,
            spotId: nextSpot.id,
            startAt: nextStart,
            endAt: nextEnd,
          },
          client,
        )
        .expect(200);

      expect(body).toMatchObject({
        id: reservation.id,
        vehicleId: nextVehicle.id,
        spotId: nextSpot.id,
        userId: client.id,
        status: ReservationStatus.CONFIRMED,
      });
    });

    it('rejects an overlap, a non-confirmed reservation, and another client', async () => {
      const owner = await createClient(app);
      const intruder = await createClient(app);
      const vehicle = await createVehicle(app, owner);
      const spot = await createSpot(app);
      const otherSpot = await createSpot(app);
      const reservation = await createReservation(app, {
        vehicle,
        spot,
        startAt: hoursFromNow(1),
        endAt: hoursFromNow(3),
      });
      await createReservation(app, {
        vehicle,
        spot: otherSpot,
        startAt: hoursFromNow(4),
        endAt: hoursFromNow(6),
      });
      const cancelled = await createReservation(app, {
        vehicle,
        spot: await createSpot(app),
        status: ReservationStatus.CANCELLED,
      });

      const overlap = await app
        .put(
          `/reservations/${reservation.id}`,
          {
            spotId: otherSpot.id,
            startAt: hoursFromNow(5).toISOString(),
            endAt: hoursFromNow(7).toISOString(),
          },
          owner,
        )
        .expect(409);
      expect(overlap.body.message).toBe(
        'The parking spot is not available for the requested time range',
      );

      const notConfirmed = await app
        .put(`/reservations/${cancelled.id}`, { endAt: hoursFromNow(4).toISOString() }, owner)
        .expect(400);
      expect(notConfirmed.body.message).toBe(
        'Only confirmed reservations can be updated',
      );

      const forbidden = await app
        .put(`/reservations/${reservation.id}`, { endAt: hoursFromNow(4).toISOString() }, intruder)
        .expect(403);
      expect(forbidden.body.message).toBe('You can only access your own reservations');
    });

    it('rejects employee requests and invalid data', async () => {
      const employee = await createEmployee(app);
      const client = await createClient(app);
      const reservation = await createReservation(app, {
        vehicle: await createVehicle(app, client),
        spot: await createSpot(app),
      });

      await app
        .put(`/reservations/${reservation.id}`, { endAt: hoursFromNow(4).toISOString() }, employee)
        .expect(403);

      const missing = await app
        .put(`/reservations/${randomUUID()}`, { endAt: hoursFromNow(4).toISOString() }, client)
        .expect(404);
      expect(missing.body.message).toBe('Reservation not found');

      await app
        .put(
          `/reservations/${reservation.id}`,
          {
            startAt: hoursFromNow(3).toISOString(),
            endAt: hoursFromNow(1).toISOString(),
          },
          client,
        )
        .expect(400);
    });
  });

  describe('POST /reservations/:id/cancel', () => {
    it('cancels a reservation and records reservation_cancelled', async () => {
      const client = await createClient(app);
      const admin = await createAdmin(app);
      const reservation = await createReservation(app, {
        vehicle: await createVehicle(app, client),
        spot: await createSpot(app),
      });

      const { body } = await app
        .post(`/reservations/${reservation.id}/cancel`, undefined, client)
        .expect(201);

      expect(body.status).toBe(ReservationStatus.CANCELLED);

      const logs = await app
        .get(`/logs?action=${LogAction.RESERVATION_CANCELLED}`, admin)
        .expect(200);
      expect(logs.body).toEqual([
        expect.objectContaining({
          action: LogAction.RESERVATION_CANCELLED,
          actorId: client.id,
          entityType: 'reservation',
          entityId: reservation.id,
        }),
      ]);
    });

    it('rejects a second cancel, another client, and an employee', async () => {
      const owner = await createClient(app);
      const intruder = await createClient(app);
      const employee = await createEmployee(app);
      const reservation = await createReservation(app, {
        vehicle: await createVehicle(app, owner),
        spot: await createSpot(app),
      });

      await app.post(`/reservations/${reservation.id}/cancel`, undefined, owner).expect(201);

      const again = await app
        .post(`/reservations/${reservation.id}/cancel`, undefined, owner)
        .expect(400);
      expect(again.body.message).toBe('Only confirmed reservations can be cancelled');

      await app.post(`/reservations/${reservation.id}/cancel`, undefined, intruder).expect(403);
      await app.post(`/reservations/${reservation.id}/cancel`, undefined, employee).expect(403);
    });
  });

  describe('DELETE /reservations/:id', () => {
    it('cancels a confirmed reservation instead of removing it', async () => {
      const client = await createClient(app);
      const reservation = await createReservation(app, {
        vehicle: await createVehicle(app, client),
        spot: await createSpot(app),
      });

      await app.delete(`/reservations/${reservation.id}`, client).expect(204);

      const { body } = await app.get(`/reservations/${reservation.id}`, client).expect(200);
      expect(body.status).toBe(ReservationStatus.CANCELLED);
    });

    it('removes a reservation that is no longer confirmed', async () => {
      const client = await createClient(app);
      const reservation = await createReservation(app, {
        vehicle: await createVehicle(app, client),
        spot: await createSpot(app),
        status: ReservationStatus.CANCELLED,
      });

      await app.delete(`/reservations/${reservation.id}`, client).expect(204);
      await app.get(`/reservations/${reservation.id}`, client).expect(404);
    });

    it('rejects another client and an employee', async () => {
      const owner = await createClient(app);
      const intruder = await createClient(app);
      const employee = await createEmployee(app);
      const reservation = await createReservation(app, {
        vehicle: await createVehicle(app, owner),
        spot: await createSpot(app),
      });

      await app.delete(`/reservations/${reservation.id}`, intruder).expect(403);
      await app.delete(`/reservations/${reservation.id}`, employee).expect(403);
    });
  });
});
