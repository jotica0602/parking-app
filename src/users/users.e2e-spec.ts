import { randomUUID } from 'node:crypto';
import { LogAction, UserRole } from '../common/enums';
import { createTestApp, TestApp } from '../../test/support/app';
import {
  createAdmin,
  createClient,
  createEmployee,
  DEFAULT_PASSWORD,
} from '../../test/support/factories';

const newUser = {
  name: 'Marta Ruiz',
  email: 'marta@parking.test',
  password: DEFAULT_PASSWORD,
  phone: '600111222',
};

describe('Users', () => {
  let app: TestApp;

  beforeAll(async () => {
    app = await createTestApp();
  });
  afterAll(() => app.close());
  beforeEach(() => app.reset());

  describe('POST /users', () => {
    it('creates a client by default and does not expose the password hash', async () => {
      const admin = await createAdmin(app);

      const { body } = await app.post('/users', newUser, admin).expect(201);

      expect(body).toMatchObject({
        name: newUser.name,
        email: newUser.email,
        phone: newUser.phone,
        role: UserRole.CLIENT,
      });
      expect(body.id).toEqual(expect.any(String));
      expect(body).not.toHaveProperty('passwordHash');
    });

    it('lets an admin create employees and other admins', async () => {
      const admin = await createAdmin(app);

      const employee = await app
        .post(
          '/users',
          { ...newUser, email: 'emp@parking.test', role: UserRole.EMPLOYEE },
          admin,
        )
        .expect(201);
      const otherAdmin = await app
        .post(
          '/users',
          { ...newUser, email: 'boss@parking.test', role: UserRole.ADMIN },
          admin,
        )
        .expect(201);

      expect(employee.body.role).toBe(UserRole.EMPLOYEE);
      expect(otherAdmin.body.role).toBe(UserRole.ADMIN);
    });

    it('rejects a duplicate email', async () => {
      const admin = await createAdmin(app);
      await app.post('/users', newUser, admin).expect(201);

      const { body } = await app.post('/users', newUser, admin).expect(409);
      expect(body.message).toBe('A user with that email already exists');
    });

    it('rejects extra fields and invalid data', async () => {
      const admin = await createAdmin(app);

      await app
        .post('/users', { ...newUser, extra: true }, admin)
        .expect(400);
      await app
        .post('/users', { ...newUser, email: 'not-an-email' }, admin)
        .expect(400);
      await app
        .post('/users', { ...newUser, password: 'short' }, admin)
        .expect(400);
      await app
        .post('/users', { ...newUser, role: 'superadmin' }, admin)
        .expect(400);
    });

    it('rejects employee, client, and unauthenticated requests', async () => {
      const employee = await createEmployee(app);
      const client = await createClient(app);

      await app.post('/users', newUser).expect(401);
      await app.post('/users', newUser, employee).expect(403);
      await app.post('/users', newUser, client).expect(403);
    });
  });

  describe('GET /users', () => {
    it('lists every user without password hashes', async () => {
      const admin = await createAdmin(app);
      await createClient(app);
      await createEmployee(app);

      const { body } = await app.get('/users', admin).expect(200);

      expect(body).toHaveLength(3);
      for (const user of body) {
        expect(user).not.toHaveProperty('passwordHash');
        expect(user).toEqual(
          expect.objectContaining({
            id: expect.any(String),
            email: expect.any(String),
            role: expect.any(String),
          }),
        );
      }
    });

    it('rejects employee, client, and unauthenticated requests', async () => {
      const employee = await createEmployee(app);
      const client = await createClient(app);

      await app.get('/users').expect(401);
      await app.get('/users', employee).expect(403);
      await app.get('/users', client).expect(403);
    });
  });

  describe('GET /users/:id', () => {
    it('returns a user without the password hash', async () => {
      const admin = await createAdmin(app);
      const target = await createClient(app);

      const { body } = await app.get(`/users/${target.id}`, admin).expect(200);

      expect(body).toMatchObject({
        id: target.id,
        email: target.email,
        role: UserRole.CLIENT,
      });
      expect(body).not.toHaveProperty('passwordHash');
    });

    it('rejects a missing or invalid id', async () => {
      const admin = await createAdmin(app);

      const missing = await app.get(`/users/${randomUUID()}`, admin).expect(404);
      expect(missing.body.message).toBe('User not found');

      await app.get('/users/not-a-uuid', admin).expect(400);
    });

    it('rejects employee and client requests', async () => {
      const employee = await createEmployee(app);
      const client = await createClient(app);

      await app.get(`/users/${client.id}`, employee).expect(403);
      await app.get(`/users/${client.id}`, client).expect(403);
    });
  });

  describe('PUT /users/:id', () => {
    it('updates the sent fields and records a user_updated log', async () => {
      const admin = await createAdmin(app);
      const target = await createClient(app);

      const { body } = await app
        .put(
          `/users/${target.id}`,
          { name: 'Updated Name', role: UserRole.EMPLOYEE },
          admin,
        )
        .expect(200);

      expect(body).toMatchObject({
        id: target.id,
        name: 'Updated Name',
        email: target.email,
        role: UserRole.EMPLOYEE,
      });
      expect(body).not.toHaveProperty('passwordHash');

      const logs = await app
        .get(`/logs?action=${LogAction.USER_UPDATED}`, admin)
        .expect(200);
      expect(logs.body).toEqual([
        expect.objectContaining({
          action: LogAction.USER_UPDATED,
          actorId: admin.id,
          actorRole: UserRole.ADMIN,
          entityType: 'user',
          entityId: target.id,
          payload: { updatedFields: ['name', 'role'] },
        }),
      ]);
    });

    it('hashes a new password so the user can log in with it', async () => {
      const admin = await createAdmin(app);
      const target = await createClient(app);
      const nextPassword = 'NewPass123!';

      await app
        .put(`/users/${target.id}`, { password: nextPassword }, admin)
        .expect(200);

      await app
        .post('/auth/login', { email: target.email, password: target.password })
        .expect(401);
      await app
        .post('/auth/login', { email: target.email, password: nextPassword })
        .expect(201);

      const logs = await app
        .get(`/logs?action=${LogAction.USER_UPDATED}`, admin)
        .expect(200);
      expect(logs.body[0].payload).toEqual({ updatedFields: ['password'] });
    });

    it('allows keeping the same email and rejects a duplicate', async () => {
      const admin = await createAdmin(app);
      const target = await createClient(app);
      const other = await createClient(app);

      await app
        .put(`/users/${target.id}`, { email: target.email, name: 'Same' }, admin)
        .expect(200);

      const { body } = await app
        .put(`/users/${target.id}`, { email: other.email }, admin)
        .expect(409);
      expect(body.message).toBe('A user with that email already exists');
    });

    it('rejects a missing id and invalid data', async () => {
      const admin = await createAdmin(app);
      const target = await createClient(app);

      const missing = await app
        .put(`/users/${randomUUID()}`, { name: 'Ghost' }, admin)
        .expect(404);
      expect(missing.body.message).toBe('User not found');

      await app.put(`/users/${target.id}`, { email: 'bad' }, admin).expect(400);
      await app.put(`/users/${target.id}`, { password: 'short' }, admin).expect(400);
    });

    it('rejects employee, client, and unauthenticated requests', async () => {
      const employee = await createEmployee(app);
      const client = await createClient(app);
      const payload = { name: 'Nope' };

      await app.put(`/users/${client.id}`, payload).expect(401);
      await app.put(`/users/${client.id}`, payload, employee).expect(403);
      await app.put(`/users/${client.id}`, payload, client).expect(403);
    });
  });

  describe('DELETE /users/:id', () => {
    it('deletes a user', async () => {
      const admin = await createAdmin(app);
      const target = await createClient(app);

      await app.delete(`/users/${target.id}`, admin).expect(204);
      await app.get(`/users/${target.id}`, admin).expect(404);
    });

    it('rejects a missing id', async () => {
      const admin = await createAdmin(app);

      const { body } = await app.delete(`/users/${randomUUID()}`, admin).expect(404);
      expect(body.message).toBe('User not found');
    });

    it('rejects employee, client, and unauthenticated requests', async () => {
      const employee = await createEmployee(app);
      const client = await createClient(app);

      await app.delete(`/users/${client.id}`).expect(401);
      await app.delete(`/users/${client.id}`, employee).expect(403);
      await app.delete(`/users/${client.id}`, client).expect(403);
    });
  });
});
