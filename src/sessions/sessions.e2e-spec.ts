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

describe('Sessions', () => {
  let app: TestApp;

  beforeAll(async () => {
    app = await createTestApp();
  });
  afterAll(() => app.close());
  beforeEach(() => app.reset());

  describe('POST /sessions', () => {
    it('records an entry and a vehicle_entry log', async () => {
      const employee = await createEmployee(app);
      const client = await createClient(app);
      const vehicle = await createVehicle(app, client);
      const spot = await createSpot(app);
      const enteredAt = hoursFromNow(-1).toISOString();

      const { body } = await app
        .post(
          '/sessions',
          { vehicleId: vehicle.id, spotId: spot.id, enteredAt },
          employee,
        )
        .expect(201);

      expect(body).toMatchObject({
        vehicleId: vehicle.id,
        spotId: spot.id,
        reservationId: null,
        enteredAt: expect.any(String),
        exitedAt: null,
      });
      expect(body.id).toEqual(expect.any(String));
      expect(body.vehicle).toMatchObject({ id: vehicle.id });
      expect(body.spot).toMatchObject({ id: spot.id });

      const logs = await app
        .get(`/logs?action=${LogAction.VEHICLE_ENTRY}`, await createAdmin(app))
        .expect(200);
      expect(logs.body).toEqual([
        expect.objectContaining({
          action: LogAction.VEHICLE_ENTRY,
          actorId: employee.id,
          entityType: 'session',
          entityId: body.id,
          payload: {
            vehicleId: vehicle.id,
            spotId: spot.id,
            reservationId: null,
          },
        }),
      ]);
    });

    it('links a confirmed reservation', async () => {
      const employee = await createEmployee(app);
      const client = await createClient(app);
      const vehicle = await createVehicle(app, client);
      const spot = await createSpot(app);
      const reservation = await createReservation(app, { vehicle, spot });

      const { body } = await app
        .post(
          '/sessions',
          {
            vehicleId: vehicle.id,
            spotId: spot.id,
            reservationId: reservation.id,
          },
          employee,
        )
        .expect(201);

      expect(body.reservationId).toBe(reservation.id);
    });

    it('rejects a second open session for the same vehicle or spot', async () => {
      const employee = await createEmployee(app);
      const client = await createClient(app);
      const vehicle = await createVehicle(app, client);
      const otherVehicle = await createVehicle(app, client);
      const spot = await createSpot(app);
      const otherSpot = await createSpot(app);

      await app
        .post('/sessions', { vehicleId: vehicle.id, spotId: spot.id }, employee)
        .expect(201);

      const sameVehicle = await app
        .post(
          '/sessions',
          { vehicleId: vehicle.id, spotId: otherSpot.id },
          employee,
        )
        .expect(409);
      expect(sameVehicle.body.message).toBe(
        'This vehicle already has an open parking session',
      );

      const sameSpot = await app
        .post(
          '/sessions',
          { vehicleId: otherVehicle.id, spotId: spot.id },
          employee,
        )
        .expect(409);
      expect(sameSpot.body.message).toBe(
        'This parking spot already has an open session',
      );
    });

    it('allows a new entry after the previous session is closed', async () => {
      const employee = await createEmployee(app);
      const client = await createClient(app);
      const vehicle = await createVehicle(app, client);
      const spot = await createSpot(app);
      const payload = { vehicleId: vehicle.id, spotId: spot.id };

      const first = await app.post('/sessions', payload, employee).expect(201);
      await app.post(`/sessions/${first.body.id}/close`, undefined, employee).expect(201);

      const { body } = await app.post('/sessions', payload, employee).expect(201);
      expect(body.id).not.toBe(first.body.id);
      expect(body.exitedAt).toBeNull();
    });

    it('rejects a reservation that is missing, not confirmed, or mismatched', async () => {
      const employee = await createEmployee(app);
      const client = await createClient(app);
      const vehicle = await createVehicle(app, client);
      const otherVehicle = await createVehicle(app, client);
      const spot = await createSpot(app);
      const otherSpot = await createSpot(app);
      const cancelled = await createReservation(app, {
        vehicle,
        spot,
        status: ReservationStatus.CANCELLED,
      });
      const otherReservation = await createReservation(app, {
        vehicle: otherVehicle,
        spot: otherSpot,
      });
      const overdue = await createReservation(app, {
        vehicle,
        spot,
        startAt: hoursFromNow(-3),
        endAt: hoursFromNow(-1),
      });

      const missing = await app
        .post(
          '/sessions',
          {
            vehicleId: vehicle.id,
            spotId: spot.id,
            reservationId: randomUUID(),
          },
          employee,
        )
        .expect(404);
      expect(missing.body.message).toBe('Reservation not found');

      const notConfirmed = await app
        .post(
          '/sessions',
          {
            vehicleId: vehicle.id,
            spotId: spot.id,
            reservationId: cancelled.id,
          },
          employee,
        )
        .expect(400);
      expect(notConfirmed.body.message).toBe('The reservation is no longer confirmed');

      const wrongVehicle = await app
        .post(
          '/sessions',
          {
            vehicleId: vehicle.id,
            spotId: otherSpot.id,
            reservationId: otherReservation.id,
          },
          employee,
        )
        .expect(400);
      expect(wrongVehicle.body.message).toBe(
        'The reservation does not belong to this vehicle',
      );

      const wrongSpot = await app
        .post(
          '/sessions',
          {
            vehicleId: otherVehicle.id,
            spotId: spot.id,
            reservationId: otherReservation.id,
          },
          employee,
        )
        .expect(400);
      expect(wrongSpot.body.message).toBe(
        'The reservation does not match this parking spot',
      );

      const expired = await app
        .post(
          '/sessions',
          {
            vehicleId: vehicle.id,
            spotId: spot.id,
            reservationId: overdue.id,
          },
          employee,
        )
        .expect(400);
      expect(expired.body.message).toBe('The reservation is no longer confirmed');
    });

    it('rejects unknown vehicle or spot and invalid data', async () => {
      const employee = await createEmployee(app);
      const client = await createClient(app);
      const vehicle = await createVehicle(app, client);
      const spot = await createSpot(app);

      const unknownVehicle = await app
        .post(
          '/sessions',
          { vehicleId: randomUUID(), spotId: spot.id },
          employee,
        )
        .expect(404);
      expect(unknownVehicle.body.message).toBe('Vehicle not found');

      const unknownSpot = await app
        .post(
          '/sessions',
          { vehicleId: vehicle.id, spotId: randomUUID() },
          employee,
        )
        .expect(404);
      expect(unknownSpot.body.message).toBe('Parking spot not found');

      await app
        .post('/sessions', { vehicleId: vehicle.id, spotId: spot.id, extra: true }, employee)
        .expect(400);
      await app.post('/sessions', { vehicleId: 'bad', spotId: spot.id }, employee).expect(400);
    });

    it('rejects client and unauthenticated requests', async () => {
      const client = await createClient(app);
      const vehicle = await createVehicle(app, client);
      const spot = await createSpot(app);
      const payload = { vehicleId: vehicle.id, spotId: spot.id };

      await app.post('/sessions', payload).expect(401);
      await app.post('/sessions', payload, client).expect(403);
    });
  });

  describe('GET /sessions', () => {
    it('lists sessions newest first for employee and admin', async () => {
      const employee = await createEmployee(app);
      const admin = await createAdmin(app);
      const client = await createClient(app);
      const olderVehicle = await createVehicle(app, client);
      const newerVehicle = await createVehicle(app, client);
      const olderSpot = await createSpot(app);
      const newerSpot = await createSpot(app);

      await createSession(app, { vehicle: olderVehicle, spot: olderSpot });
      await createSession(app, { vehicle: newerVehicle, spot: newerSpot });

      const asEmployee = await app.get('/sessions', employee).expect(200);
      const asAdmin = await app.get('/sessions', admin).expect(200);

      expect(asEmployee.body).toHaveLength(2);
      expect(new Date(asEmployee.body[0].enteredAt).getTime()).toBeGreaterThanOrEqual(
        new Date(asEmployee.body[1].enteredAt).getTime(),
      );
      expect(asEmployee.body[0].vehicle).toBeDefined();
      expect(asEmployee.body[0].spot).toBeDefined();
      expect(asAdmin.body.map((session: { id: string }) => session.id)).toEqual(
        asEmployee.body.map((session: { id: string }) => session.id),
      );
    });

    it('rejects client and unauthenticated requests', async () => {
      const client = await createClient(app);

      await app.get('/sessions').expect(401);
      await app.get('/sessions', client).expect(403);
    });
  });

  describe('GET /sessions/:id', () => {
    it('returns a session', async () => {
      const employee = await createEmployee(app);
      const client = await createClient(app);
      const vehicle = await createVehicle(app, client);
      const spot = await createSpot(app);
      const session = await createSession(app, { vehicle, spot });

      const { body } = await app.get(`/sessions/${session.id}`, employee).expect(200);
      expect(body).toMatchObject({
        id: session.id,
        vehicleId: vehicle.id,
        spotId: spot.id,
      });
    });

    it('rejects a missing or invalid id', async () => {
      const employee = await createEmployee(app);

      const missing = await app.get(`/sessions/${randomUUID()}`, employee).expect(404);
      expect(missing.body.message).toBe('Parking session not found');

      await app.get('/sessions/not-a-uuid', employee).expect(400);
    });
  });

  describe('PUT /sessions/:id', () => {
    it('updates the sent fields', async () => {
      const employee = await createEmployee(app);
      const client = await createClient(app);
      const vehicle = await createVehicle(app, client);
      const spot = await createSpot(app);
      const nextSpot = await createSpot(app);
      const session = await createSession(app, { vehicle, spot });
      const exitedAt = new Date().toISOString();

      const { body } = await app
        .put(`/sessions/${session.id}`, { spotId: nextSpot.id, exitedAt }, employee)
        .expect(200);

      expect(body).toMatchObject({
        id: session.id,
        spotId: nextSpot.id,
        vehicleId: vehicle.id,
      });
      expect(body.exitedAt).toEqual(expect.any(String));
    });

    it('rejects a missing id and invalid data', async () => {
      const employee = await createEmployee(app);
      const session = await createSession(app, {
        vehicle: await createVehicle(app, await createClient(app)),
        spot: await createSpot(app),
      });

      const missing = await app
        .put(`/sessions/${randomUUID()}`, { spotId: randomUUID() }, employee)
        .expect(404);
      expect(missing.body.message).toBe('Parking session not found');

      await app.put(`/sessions/${session.id}`, { spotId: 'bad' }, employee).expect(400);
    });
  });

  describe('POST /sessions/:id/close', () => {
    it('closes the session, completes the reservation, and records vehicle_exit', async () => {
      const employee = await createEmployee(app);
      const admin = await createAdmin(app);
      const client = await createClient(app);
      const vehicle = await createVehicle(app, client);
      const spot = await createSpot(app);
      const reservation = await createReservation(app, {
        vehicle,
        spot,
        startAt: hoursFromNow(-1),
        endAt: hoursFromNow(2),
      });
      const session = await createSession(app, { vehicle, spot, reservation });

      const { body } = await app
        .post(`/sessions/${session.id}/close`, undefined, employee)
        .expect(201);

      expect(body.exitedAt).toEqual(expect.any(String));

      const stored = await app.get(`/reservations/${reservation.id}`, employee).expect(200);
      expect(stored.body.status).toBe(ReservationStatus.COMPLETED);

      const logs = await app
        .get(`/logs?action=${LogAction.VEHICLE_EXIT}`, admin)
        .expect(200);
      expect(logs.body).toEqual([
        expect.objectContaining({
          action: LogAction.VEHICLE_EXIT,
          actorId: employee.id,
          entityType: 'session',
          entityId: session.id,
          payload: expect.objectContaining({
            vehicleId: vehicle.id,
            spotId: spot.id,
            exitedAt: expect.any(String),
          }),
        }),
      ]);
    });

    it('rejects a session that is already closed', async () => {
      const employee = await createEmployee(app);
      const client = await createClient(app);
      const session = await createSession(app, {
        vehicle: await createVehicle(app, client),
        spot: await createSpot(app),
      });

      await app.post(`/sessions/${session.id}/close`, undefined, employee).expect(201);

      const { body } = await app
        .post(`/sessions/${session.id}/close`, undefined, employee)
        .expect(400);
      expect(body.message).toBe('This parking session is already closed');
    });

    it('rejects a missing id', async () => {
      const employee = await createEmployee(app);

      const { body } = await app
        .post(`/sessions/${randomUUID()}/close`, undefined, employee)
        .expect(404);
      expect(body.message).toBe('Parking session not found');
    });
  });

  describe('DELETE /sessions/:id', () => {
    it('deletes a session', async () => {
      const employee = await createEmployee(app);
      const client = await createClient(app);
      const session = await createSession(app, {
        vehicle: await createVehicle(app, client),
        spot: await createSpot(app),
      });

      await app.delete(`/sessions/${session.id}`, employee).expect(204);
      await app.get(`/sessions/${session.id}`, employee).expect(404);
    });

    it('rejects a missing id and a client request', async () => {
      const employee = await createEmployee(app);
      const client = await createClient(app);
      const session = await createSession(app, {
        vehicle: await createVehicle(app, client),
        spot: await createSpot(app),
      });

      const missing = await app.delete(`/sessions/${randomUUID()}`, employee).expect(404);
      expect(missing.body.message).toBe('Parking session not found');

      await app.delete(`/sessions/${session.id}`, client).expect(403);
    });
  });
});
