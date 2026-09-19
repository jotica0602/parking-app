import { randomUUID } from 'node:crypto';
import { SpotType } from '../common/enums';
import { createTestApp, TestApp } from '../../test/support/app';
import {
  createAdmin,
  createClient,
  createEmployee,
  createSpot,
} from '../../test/support/factories';

describe('Spots', () => {
  let app: TestApp;

  beforeAll(async () => {
    app = await createTestApp();
  });
  afterAll(() => app.close());
  beforeEach(() => app.reset());

  describe('POST /spots', () => {
    it('creates a spot with defaults when only the code is sent', async () => {
      const admin = await createAdmin(app);

      const { body } = await app.post('/spots', { code: 'A-1' }, admin).expect(201);

      expect(body).toMatchObject({
        code: 'A-1',
        type: SpotType.STANDARD,
      });
      expect(body.id).toEqual(expect.any(String));
      expect(body.floor ?? null).toBeNull();
    });

    it('creates a spot with floor and type', async () => {
      const admin = await createAdmin(app);

      const { body } = await app
        .post(
          '/spots',
          { code: 'E-1', floor: 2, type: SpotType.ELECTRIC },
          admin,
        )
        .expect(201);

      expect(body).toMatchObject({
        code: 'E-1',
        floor: 2,
        type: SpotType.ELECTRIC,
      });
    });

    it('rejects a duplicate code', async () => {
      const admin = await createAdmin(app);
      await app.post('/spots', { code: 'A-1' }, admin).expect(201);

      const { body } = await app.post('/spots', { code: 'A-1' }, admin).expect(409);
      expect(body.message).toBe('A parking spot with that code already exists');
    });

    it('rejects extra fields and invalid data', async () => {
      const admin = await createAdmin(app);

      await app
        .post('/spots', { code: 'A-1', extra: true }, admin)
        .expect(400);

      await app.post('/spots', { code: '' }, admin).expect(400);
      await app.post('/spots', { code: 'A-1', floor: -1 }, admin).expect(400);
      await app
        .post('/spots', { code: 'A-1', type: 'invalid' }, admin)
        .expect(400);
    });

    it('rejects employee, client, and unauthenticated requests', async () => {
      const employee = await createEmployee(app);
      const client = await createClient(app);
      const payload = { code: 'A-1' };

      await app.post('/spots', payload).expect(401);
      await app.post('/spots', payload, employee).expect(403);
      await app.post('/spots', payload, client).expect(403);
    });
  });

  describe('GET /spots', () => {
    it('lets admin and employee list spots ordered by code', async () => {
      const admin = await createAdmin(app);
      const employee = await createEmployee(app);
      await createSpot(app, { code: 'C-1' });
      await createSpot(app, { code: 'A-1' });
      await createSpot(app, { code: 'B-1' });

      const asAdmin = await app.get('/spots', admin).expect(200);
      const asEmployee = await app.get('/spots', employee).expect(200);

      expect(asAdmin.body.map((spot: { code: string }) => spot.code)).toEqual([
        'A-1',
        'B-1',
        'C-1',
      ]);
      expect(asEmployee.body).toEqual(asAdmin.body);
    });

    it('rejects client and unauthenticated requests', async () => {
      const client = await createClient(app);

      await app.get('/spots').expect(401);
      await app.get('/spots', client).expect(403);
    });
  });

  describe('GET /spots/:id', () => {
    it('lets admin and employee read a spot', async () => {
      const admin = await createAdmin(app);
      const employee = await createEmployee(app);
      const spot = await createSpot(app, { code: 'A-1' });

      const asAdmin = await app.get(`/spots/${spot.id}`, admin).expect(200);
      const asEmployee = await app.get(`/spots/${spot.id}`, employee).expect(200);

      expect(asAdmin.body).toMatchObject({ id: spot.id, code: 'A-1' });
      expect(asEmployee.body).toEqual(asAdmin.body);
    });

    it('rejects a missing or invalid id', async () => {
      const admin = await createAdmin(app);

      const missing = await app.get(`/spots/${randomUUID()}`, admin).expect(404);
      expect(missing.body.message).toBe('Parking spot not found');

      await app.get('/spots/not-a-uuid', admin).expect(400);
    });

    it('rejects client and unauthenticated requests', async () => {
      const client = await createClient(app);
      const spot = await createSpot(app, { code: 'A-1' });

      await app.get(`/spots/${spot.id}`).expect(401);
      await app.get(`/spots/${spot.id}`, client).expect(403);
    });
  });

  describe('PUT /spots/:id', () => {
    it('updates the sent fields', async () => {
      const admin = await createAdmin(app);
      const spot = await createSpot(app, { code: 'A-1' });

      const { body } = await app
        .put(
          `/spots/${spot.id}`,
          { code: 'A-2', floor: 3, type: SpotType.DISABLED },
          admin,
        )
        .expect(200);

      expect(body).toMatchObject({
        id: spot.id,
        code: 'A-2',
        floor: 3,
        type: SpotType.DISABLED,
      });
    });

    it('allows keeping the same code and rejects a duplicate', async () => {
      const admin = await createAdmin(app);
      const spot = await createSpot(app, { code: 'A-1' });
      await createSpot(app, { code: 'B-1' });

      await app.put(`/spots/${spot.id}`, { code: 'A-1', floor: 1 }, admin).expect(200);

      const { body } = await app
        .put(`/spots/${spot.id}`, { code: 'B-1' }, admin)
        .expect(409);
      expect(body.message).toBe('A parking spot with that code already exists');
    });

    it('rejects a missing id and invalid data', async () => {
      const admin = await createAdmin(app);
      const spot = await createSpot(app, { code: 'A-1' });

      const missing = await app
        .put(`/spots/${randomUUID()}`, { code: 'Z-1' }, admin)
        .expect(404);
      expect(missing.body.message).toBe('Parking spot not found');

      await app.put(`/spots/${spot.id}`, { code: '' }, admin).expect(400);
      await app.put(`/spots/${spot.id}`, { floor: -1 }, admin).expect(400);
    });

    it('rejects employee, client, and unauthenticated requests', async () => {
      const employee = await createEmployee(app);
      const client = await createClient(app);
      const spot = await createSpot(app, { code: 'A-1' });
      const payload = { code: 'A-2' };

      await app.put(`/spots/${spot.id}`, payload).expect(401);
      await app.put(`/spots/${spot.id}`, payload, employee).expect(403);
      await app.put(`/spots/${spot.id}`, payload, client).expect(403);
    });
  });

  describe('DELETE /spots/:id', () => {
    it('deletes a spot', async () => {
      const admin = await createAdmin(app);
      const spot = await createSpot(app, { code: 'A-1' });

      await app.delete(`/spots/${spot.id}`, admin).expect(204);
      await app.get(`/spots/${spot.id}`, admin).expect(404);
    });

    it('rejects a missing id', async () => {
      const admin = await createAdmin(app);

      const { body } = await app.delete(`/spots/${randomUUID()}`, admin).expect(404);
      expect(body.message).toBe('Parking spot not found');
    });

    it('rejects employee, client, and unauthenticated requests', async () => {
      const employee = await createEmployee(app);
      const client = await createClient(app);
      const spot = await createSpot(app, { code: 'A-1' });

      await app.delete(`/spots/${spot.id}`).expect(401);
      await app.delete(`/spots/${spot.id}`, employee).expect(403);
      await app.delete(`/spots/${spot.id}`, client).expect(403);
    });
  });
});
