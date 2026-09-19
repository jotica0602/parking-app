import { LogAction, SYSTEM_ACTOR_ID, UserRole } from '../common/enums';
import { createTestApp, TestApp } from '../../test/support/app';
import {
  createAdmin,
  createClient,
  createEmployee,
  createReservation,
  createSpot,
  createVehicle,
  hoursFromNow,
} from '../../test/support/factories';

describe('Logs', () => {
  let app: TestApp;

  beforeAll(async () => {
    app = await createTestApp();
  });
  afterAll(() => app.close());
  beforeEach(() => app.reset());

  describe('GET /logs', () => {
    it('returns an empty list when nothing has been recorded', async () => {
      const admin = await createAdmin(app);

      const { body } = await app.get('/logs', admin).expect(200);
      expect(body).toEqual([]);
    });

    it('lists logs newest first after a user update', async () => {
      const firstAdmin = await createAdmin(app);
      const secondAdmin = await createAdmin(app);
      const firstTarget = await createClient(app);
      const secondTarget = await createClient(app);

      await app
        .put(`/users/${firstTarget.id}`, { name: 'First' }, firstAdmin)
        .expect(200);
      await app
        .put(`/users/${secondTarget.id}`, { name: 'Second' }, secondAdmin)
        .expect(200);

      const { body } = await app.get('/logs', firstAdmin).expect(200);

      expect(body).toHaveLength(2);
      expect(body.map((log: { entityId: string }) => log.entityId)).toEqual([
        secondTarget.id,
        firstTarget.id,
      ]);
      expect(body[0]).toEqual(
        expect.objectContaining({
          _id: expect.any(String),
          action: LogAction.USER_UPDATED,
          actorId: secondAdmin.id,
          actorRole: UserRole.ADMIN,
          entityType: 'user',
          entityId: secondTarget.id,
          payload: { updatedFields: ['name'] },
          createdAt: expect.any(String),
        }),
      );
    });

    it('filters by action and actorId', async () => {
      const admin = await createAdmin(app);
      const client = await createClient(app);
      const vehicle = await createVehicle(app, client);
      const spot = await createSpot(app);
      const target = await createClient(app);

      await app.put(`/users/${target.id}`, { name: 'Patched' }, admin).expect(200);
      await app
        .post(
          '/reservations',
          {
            vehicleId: vehicle.id,
            spotId: spot.id,
            startAt: hoursFromNow(1).toISOString(),
            endAt: hoursFromNow(3).toISOString(),
          },
          client,
        )
        .expect(201);

      const byAction = await app
        .get(`/logs?action=${LogAction.USER_UPDATED}`, admin)
        .expect(200);
      expect(byAction.body).toHaveLength(1);
      expect(byAction.body[0].action).toBe(LogAction.USER_UPDATED);

      const byActor = await app
        .get(`/logs?actorId=${client.id}`, admin)
        .expect(200);
      expect(byActor.body).toHaveLength(1);
      expect(byActor.body[0].action).toBe(LogAction.RESERVATION_CREATED);
      expect(byActor.body[0].actorId).toBe(client.id);
    });

    it('filters by createdAt range', async () => {
      const admin = await createAdmin(app);
      const target = await createClient(app);
      const past = new Date(Date.now() - 60_000).toISOString();
      const future = new Date(Date.now() + 60_000).toISOString();

      await app.put(`/users/${target.id}`, { name: 'Patched' }, admin).expect(200);

      const inRange = await app.get(`/logs?from=${past}&to=${future}`, admin).expect(200);
      expect(inRange.body).toHaveLength(1);

      const tooEarly = await app.get(`/logs?to=${past}`, admin).expect(200);
      expect(tooEarly.body).toEqual([]);

      const tooLate = await app.get(`/logs?from=${future}`, admin).expect(200);
      expect(tooLate.body).toEqual([]);
    });

    it('includes reservation and session actions, including no-show expiry', async () => {
      const admin = await createAdmin(app);
      const client = await createClient(app);
      const employee = await createEmployee(app);
      const reservedVehicle = await createVehicle(app, client);
      const reservedSpot = await createSpot(app);
      const sessionVehicle = await createVehicle(app, client);
      const sessionSpot = await createSpot(app);
      const overdueVehicle = await createVehicle(app, client);
      const overdueSpot = await createSpot(app);

      await createReservation(app, {
        vehicle: overdueVehicle,
        spot: overdueSpot,
        startAt: hoursFromNow(-3),
        endAt: hoursFromNow(-1),
      });

      const reservation = await app
        .post(
          '/reservations',
          {
            vehicleId: reservedVehicle.id,
            spotId: reservedSpot.id,
            startAt: hoursFromNow(1).toISOString(),
            endAt: hoursFromNow(3).toISOString(),
          },
          client,
        )
        .expect(201);
      await app
        .post(`/reservations/${reservation.body.id}/cancel`, undefined, client)
        .expect(201);

      const session = await app
        .post(
          '/sessions',
          { vehicleId: sessionVehicle.id, spotId: sessionSpot.id },
          employee,
        )
        .expect(201);
      await app.post(`/sessions/${session.body.id}/close`, undefined, employee).expect(201);

      // Creating the reservation above already expired the overdue no-show.
      const { body } = await app.get('/logs', admin).expect(200);
      const actions = body.map((log: { action: string }) => log.action);

      expect(actions).toEqual(
        expect.arrayContaining([
          LogAction.RESERVATION_CREATED,
          LogAction.RESERVATION_CANCELLED,
          LogAction.RESERVATION_EXPIRED,
          LogAction.VEHICLE_ENTRY,
          LogAction.VEHICLE_EXIT,
        ]),
      );
      expect(
        body.find((log: { action: string }) => log.action === LogAction.RESERVATION_EXPIRED),
      ).toEqual(
        expect.objectContaining({
          actorId: SYSTEM_ACTOR_ID,
          actorRole: 'system',
          entityType: 'reservation',
        }),
      );
    });

    it('rejects extra fields and invalid filters', async () => {
      const admin = await createAdmin(app);

      await app.get('/logs?action=not-an-action', admin).expect(400);
      await app.get('/logs?from=not-a-date', admin).expect(400);
      await app.get('/logs?extra=1', admin).expect(400);
    });

    it('rejects employee, client, and unauthenticated requests', async () => {
      const employee = await createEmployee(app);
      const client = await createClient(app);

      await app.get('/logs').expect(401);
      await app.get('/logs', employee).expect(403);
      await app.get('/logs', client).expect(403);
    });
  });
});
