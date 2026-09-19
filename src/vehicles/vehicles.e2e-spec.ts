import { randomUUID } from 'node:crypto';
import { createTestApp, TestApp } from '../../test/support/app';
import {
  createAdmin,
  createClient,
  createEmployee,
  createVehicle,
} from '../../test/support/factories';

describe('Vehicles', () => {
  let app: TestApp;

  beforeAll(async () => {
    app = await createTestApp();
  });
  afterAll(() => app.close());
  beforeEach(() => app.reset());

  describe('POST /vehicles', () => {
    it('registers a vehicle for the authenticated client', async () => {
      const client = await createClient(app);

      const { body } = await app
        .post(
          '/vehicles',
          {
            licensePlate: '1234ABC',
            brand: 'Seat',
            model: 'Ibiza',
            color: 'blue',
          },
          client,
        )
        .expect(201);

      expect(body).toMatchObject({
        licensePlate: '1234ABC',
        brand: 'Seat',
        model: 'Ibiza',
        color: 'blue',
        ownerId: client.id,
      });
      expect(body.id).toEqual(expect.any(String));
    });

    it('ignores ownerId sent by a client', async () => {
      const client = await createClient(app);
      const other = await createClient(app);

      const { body } = await app
        .post(
          '/vehicles',
          { licensePlate: '1234ABC', ownerId: other.id },
          client,
        )
        .expect(201);

      expect(body.ownerId).toBe(client.id);
    });

    it('lets an admin assign the vehicle to another user', async () => {
      const admin = await createAdmin(app);
      const owner = await createClient(app);

      const { body } = await app
        .post(
          '/vehicles',
          { licensePlate: '1234ABC', ownerId: owner.id },
          admin,
        )
        .expect(201);

      expect(body.ownerId).toBe(owner.id);
    });

    it('assigns the admin as owner when ownerId is omitted', async () => {
      const admin = await createAdmin(app);

      const { body } = await app
        .post('/vehicles', { licensePlate: '1234ABC' }, admin)
        .expect(201);

      expect(body.ownerId).toBe(admin.id);
    });

    it('rejects a duplicate license plate', async () => {
      const client = await createClient(app);
      await app.post('/vehicles', { licensePlate: '1234ABC' }, client).expect(201);

      const { body } = await app
        .post('/vehicles', { licensePlate: '1234ABC' }, client)
        .expect(409);
      expect(body.message).toBe('A vehicle with that license plate already exists');
    });

    it('rejects extra fields and invalid data', async () => {
      const client = await createClient(app);

      await app
        .post('/vehicles', { licensePlate: '1234ABC', extra: true }, client)
        .expect(400);
      await app.post('/vehicles', { licensePlate: '' }, client).expect(400);
      await app
        .post('/vehicles', { licensePlate: '1234ABC', ownerId: 'not-a-uuid' }, client)
        .expect(400);
    });

    it('rejects employee and unauthenticated requests', async () => {
      const employee = await createEmployee(app);
      const payload = { licensePlate: '1234ABC' };

      await app.post('/vehicles', payload).expect(401);
      await app.post('/vehicles', payload, employee).expect(403);
    });
  });

  describe('GET /vehicles', () => {
    it('returns only the client vehicles', async () => {
      const owner = await createClient(app);
      const other = await createClient(app);
      const mine = await createVehicle(app, owner, { licensePlate: '1111AAA' });
      await createVehicle(app, other, { licensePlate: '2222BBB' });

      const { body } = await app.get('/vehicles', owner).expect(200);

      expect(body).toHaveLength(1);
      expect(body[0]).toMatchObject({ id: mine.id, ownerId: owner.id });
    });

    it('lets an admin list every vehicle', async () => {
      const admin = await createAdmin(app);
      const owner = await createClient(app);
      await createVehicle(app, owner, { licensePlate: '1111AAA' });
      await createVehicle(app, admin, { licensePlate: '2222BBB' });

      const { body } = await app.get('/vehicles', admin).expect(200);
      expect(body).toHaveLength(2);
    });

    it('rejects employee and unauthenticated requests', async () => {
      const employee = await createEmployee(app);

      await app.get('/vehicles').expect(401);
      await app.get('/vehicles', employee).expect(403);
    });
  });

  describe('GET /vehicles/:id', () => {
    it('lets the owner and an admin read a vehicle', async () => {
      const owner = await createClient(app);
      const admin = await createAdmin(app);
      const vehicle = await createVehicle(app, owner, { licensePlate: '1234ABC' });

      const asOwner = await app.get(`/vehicles/${vehicle.id}`, owner).expect(200);
      const asAdmin = await app.get(`/vehicles/${vehicle.id}`, admin).expect(200);

      expect(asOwner.body).toMatchObject({
        id: vehicle.id,
        licensePlate: '1234ABC',
        ownerId: owner.id,
      });
      expect(asAdmin.body).toEqual(asOwner.body);
    });

    it('rejects another client', async () => {
      const owner = await createClient(app);
      const intruder = await createClient(app);
      const vehicle = await createVehicle(app, owner);

      const { body } = await app
        .get(`/vehicles/${vehicle.id}`, intruder)
        .expect(403);
      expect(body.message).toBe('You can only manage your own vehicles');
    });

    it('rejects a missing or invalid id', async () => {
      const owner = await createClient(app);

      const missing = await app.get(`/vehicles/${randomUUID()}`, owner).expect(404);
      expect(missing.body.message).toBe('Vehicle not found');

      await app.get('/vehicles/not-a-uuid', owner).expect(400);
    });
  });

  describe('PUT /vehicles/:id', () => {
    it('updates the sent fields', async () => {
      const owner = await createClient(app);
      const vehicle = await createVehicle(app, owner, { licensePlate: '1234ABC' });

      const { body } = await app
        .put(
          `/vehicles/${vehicle.id}`,
          { licensePlate: '5678DEF', color: 'red' },
          owner,
        )
        .expect(200);

      expect(body).toMatchObject({
        id: vehicle.id,
        licensePlate: '5678DEF',
        color: 'red',
        ownerId: owner.id,
      });
    });

    it('lets an admin update another user vehicle', async () => {
      const admin = await createAdmin(app);
      const owner = await createClient(app);
      const vehicle = await createVehicle(app, owner, { licensePlate: '1234ABC' });

      const { body } = await app
        .put(`/vehicles/${vehicle.id}`, { color: 'black' }, admin)
        .expect(200);

      expect(body).toMatchObject({ id: vehicle.id, color: 'black' });
    });

    it('allows keeping the same plate and rejects a duplicate', async () => {
      const owner = await createClient(app);
      const vehicle = await createVehicle(app, owner, { licensePlate: '1111AAA' });
      await createVehicle(app, owner, { licensePlate: '2222BBB' });

      await app
        .put(`/vehicles/${vehicle.id}`, { licensePlate: '1111AAA', color: 'red' }, owner)
        .expect(200);

      const { body } = await app
        .put(`/vehicles/${vehicle.id}`, { licensePlate: '2222BBB' }, owner)
        .expect(409);
      expect(body.message).toBe('A vehicle with that license plate already exists');
    });

    it('rejects another client and a missing id', async () => {
      const owner = await createClient(app);
      const intruder = await createClient(app);
      const vehicle = await createVehicle(app, owner);

      const forbidden = await app
        .put(`/vehicles/${vehicle.id}`, { color: 'red' }, intruder)
        .expect(403);
      expect(forbidden.body.message).toBe('You can only manage your own vehicles');

      const missing = await app
        .put(`/vehicles/${randomUUID()}`, { color: 'red' }, owner)
        .expect(404);
      expect(missing.body.message).toBe('Vehicle not found');
    });
  });

  describe('DELETE /vehicles/:id', () => {
    it('lets the owner delete their vehicle', async () => {
      const owner = await createClient(app);
      const vehicle = await createVehicle(app, owner);

      await app.delete(`/vehicles/${vehicle.id}`, owner).expect(204);
      await app.get(`/vehicles/${vehicle.id}`, owner).expect(404);
    });

    it('lets an admin delete another user vehicle', async () => {
      const admin = await createAdmin(app);
      const owner = await createClient(app);
      const vehicle = await createVehicle(app, owner);

      await app.delete(`/vehicles/${vehicle.id}`, admin).expect(204);
      await app.get(`/vehicles/${vehicle.id}`, admin).expect(404);
    });

    it('rejects another client and a missing id', async () => {
      const owner = await createClient(app);
      const intruder = await createClient(app);
      const vehicle = await createVehicle(app, owner);

      const forbidden = await app
        .delete(`/vehicles/${vehicle.id}`, intruder)
        .expect(403);
      expect(forbidden.body.message).toBe('You can only manage your own vehicles');

      const missing = await app.delete(`/vehicles/${randomUUID()}`, owner).expect(404);
      expect(missing.body.message).toBe('Vehicle not found');
    });
  });
});
