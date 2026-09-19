import { ReservationStatus, SpotOccupancyStatus } from '../common/enums';
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

describe('Occupancy', () => {
  let app: TestApp;

  beforeAll(async () => {
    app = await createTestApp();
  });
  afterAll(() => app.close());
  beforeEach(() => app.reset());

  describe('GET /occupancy', () => {
    it('returns empty totals when there are no spots', async () => {
      const employee = await createEmployee(app);

      const { body } = await app.get('/occupancy', employee).expect(200);

      expect(body.generatedAt).toEqual(expect.any(String));
      expect(body.totals).toEqual({
        total: 0,
        occupied: 0,
        reserved: 0,
        free: 0,
      });
      expect(body.spots).toEqual([]);
    });

    it('marks a spot free, reserved, or occupied and orders by code', async () => {
      const employee = await createEmployee(app);
      const client = await createClient(app);
      const occupiedSpot = await createSpot(app, { code: 'C-1' });
      const reservedSpot = await createSpot(app, { code: 'A-1' });
      const freeSpot = await createSpot(app, { code: 'B-1' });
      const reservedVehicle = await createVehicle(app, client);
      const occupiedVehicle = await createVehicle(app, client);

      const reservation = await createReservation(app, {
        vehicle: reservedVehicle,
        spot: reservedSpot,
        startAt: hoursFromNow(-1),
        endAt: hoursFromNow(2),
      });
      const session = await createSession(app, {
        vehicle: occupiedVehicle,
        spot: occupiedSpot,
      });

      const { body } = await app.get('/occupancy', employee).expect(200);

      expect(body.spots.map((spot: { code: string }) => spot.code)).toEqual([
        'A-1',
        'B-1',
        'C-1',
      ]);
      expect(body.spots).toEqual([
        expect.objectContaining({
          id: reservedSpot.id,
          code: 'A-1',
          status: SpotOccupancyStatus.RESERVED,
          reservationId: reservation.id,
        }),
        expect.objectContaining({
          id: freeSpot.id,
          code: 'B-1',
          status: SpotOccupancyStatus.FREE,
        }),
        expect.objectContaining({
          id: occupiedSpot.id,
          code: 'C-1',
          status: SpotOccupancyStatus.OCCUPIED,
          sessionId: session.id,
        }),
      ]);
      expect(body.spots[1].sessionId).toBeUndefined();
      expect(body.spots[1].reservationId).toBeUndefined();
      expect(body.totals).toEqual({
        total: 3,
        occupied: 1,
        reserved: 1,
        free: 1,
      });
    });

    it('prefers an open session over a current reservation on the same spot', async () => {
      const employee = await createEmployee(app);
      const client = await createClient(app);
      const spot = await createSpot(app, { code: 'A-1' });
      const vehicle = await createVehicle(app, client);
      const reservation = await createReservation(app, {
        vehicle,
        spot,
        startAt: hoursFromNow(-1),
        endAt: hoursFromNow(2),
      });
      const session = await createSession(app, { vehicle, spot, reservation });

      const { body } = await app.get('/occupancy', employee).expect(200);

      expect(body.spots).toEqual([
        expect.objectContaining({
          id: spot.id,
          status: SpotOccupancyStatus.OCCUPIED,
          sessionId: session.id,
          reservationId: reservation.id,
        }),
      ]);
      expect(body.totals).toEqual({
        total: 1,
        occupied: 1,
        reserved: 0,
        free: 0,
      });
    });

    it('ignores future, cancelled, and closed activity', async () => {
      const employee = await createEmployee(app);
      const client = await createClient(app);
      const futureSpot = await createSpot(app, { code: 'A-1' });
      const cancelledSpot = await createSpot(app, { code: 'B-1' });
      const closedSpot = await createSpot(app, { code: 'C-1' });
      const futureVehicle = await createVehicle(app, client);
      const cancelledVehicle = await createVehicle(app, client);
      const closedVehicle = await createVehicle(app, client);

      await createReservation(app, {
        vehicle: futureVehicle,
        spot: futureSpot,
        startAt: hoursFromNow(1),
        endAt: hoursFromNow(3),
      });
      await createReservation(app, {
        vehicle: cancelledVehicle,
        spot: cancelledSpot,
        startAt: hoursFromNow(-1),
        endAt: hoursFromNow(2),
        status: ReservationStatus.CANCELLED,
      });
      const session = await createSession(app, {
        vehicle: closedVehicle,
        spot: closedSpot,
      });
      await app.post(`/sessions/${session.id}/close`, undefined, employee).expect(201);

      const { body } = await app.get('/occupancy', employee).expect(200);

      expect(body.spots.every((spot: { status: string }) => spot.status === SpotOccupancyStatus.FREE)).toBe(
        true,
      );
      expect(body.totals).toEqual({
        total: 3,
        occupied: 0,
        reserved: 0,
        free: 3,
      });
    });

    it('expires an overdue no-show and shows the spot as free', async () => {
      const employee = await createEmployee(app);
      const client = await createClient(app);
      const spot = await createSpot(app, { code: 'A-1' });
      const vehicle = await createVehicle(app, client);
      const reservation = await createReservation(app, {
        vehicle,
        spot,
        startAt: hoursFromNow(-3),
        endAt: hoursFromNow(-1),
      });

      const { body } = await app.get('/occupancy', employee).expect(200);

      expect(body.spots).toEqual([
        expect.objectContaining({
          id: spot.id,
          status: SpotOccupancyStatus.FREE,
        }),
      ]);
      expect(body.totals.free).toBe(1);

      const stored = await app.get(`/reservations/${reservation.id}`, employee).expect(200);
      expect(stored.body.status).toBe(ReservationStatus.EXPIRED);
    });

    it('lets an admin read occupancy and rejects client or unauthenticated requests', async () => {
      const admin = await createAdmin(app);
      const client = await createClient(app);
      await createSpot(app, { code: 'A-1' });

      const { body } = await app.get('/occupancy', admin).expect(200);
      expect(body.spots).toEqual([
        expect.objectContaining({ code: 'A-1', status: SpotOccupancyStatus.FREE }),
      ]);

      await app.get('/occupancy').expect(401);
      await app.get('/occupancy', client).expect(403);
    });
  });
});
