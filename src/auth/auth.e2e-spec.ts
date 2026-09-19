import { UserRole } from '../common/enums';
import { createTestApp, TestApp } from '../../test/support/app';
import {
  createAdmin,
  createClient,
  createEmployee,
  DEFAULT_PASSWORD,
} from '../../test/support/factories';

const registerPayload = {
  name: 'Ana',
  email: 'ana@parking.test',
  password: DEFAULT_PASSWORD,
  phone: '600123123',
};

describe('Auth', () => {
  let app: TestApp;

  beforeAll(async () => {
    app = await createTestApp();
  });
  afterAll(() => app.close());
  beforeEach(() => app.reset());

  describe('POST /auth/register', () => {
    it('creates a client and does not expose the password hash', async () => {
      const { body } = await app.post('/auth/register', registerPayload).expect(201);

      expect(body).toMatchObject({
        name: 'Ana',
        email: 'ana@parking.test',
        phone: '600123123',
        role: UserRole.CLIENT,
      });
      expect(body.id).toEqual(expect.any(String));
      expect(body).not.toHaveProperty('passwordHash');
    });

    it('forces the client role even though registration is public', async () => {
      const { body } = await app
        .post('/auth/register', {
          name: 'Luis',
          email: 'luis@parking.test',
          password: DEFAULT_PASSWORD,
        })
        .expect(201);

      expect(body.role).toBe(UserRole.CLIENT);
    });

    it('rejects a duplicate email', async () => {
      await app.post('/auth/register', registerPayload).expect(201);

      const { body } = await app.post('/auth/register', registerPayload).expect(409);
      expect(body.message).toBe('A user with that email already exists');
    });

    it('rejects extra fields and invalid data', async () => {
      await app
        .post('/auth/register', { ...registerPayload, role: UserRole.ADMIN })
        .expect(400);

      await app
        .post('/auth/register', {
          name: '',
          email: 'not-an-email',
          password: 'short',
        })
        .expect(400);
    });
  });

  describe('POST /auth/login', () => {
    it('returns a token and user without passwordHash', async () => {
      await app.post('/auth/register', registerPayload).expect(201);

      const { body } = await app
        .post('/auth/login', {
          email: registerPayload.email,
          password: registerPayload.password,
        })
        .expect(201);

      expect(body.accessToken).toEqual(expect.any(String));
      expect(body.user).toMatchObject({
        email: registerPayload.email,
        role: UserRole.CLIENT,
      });
      expect(body.user).not.toHaveProperty('passwordHash');
    });

    it('allows login for admin and employee created outside public registration', async () => {
      const admin = await createAdmin(app);
      const employee = await createEmployee(app);

      const adminLogin = await app
        .post('/auth/login', { email: admin.email, password: admin.password })
        .expect(201);
      expect(adminLogin.body.user.role).toBe(UserRole.ADMIN);

      const employeeLogin = await app
        .post('/auth/login', {
          email: employee.email,
          password: employee.password,
        })
        .expect(201);
      expect(employeeLogin.body.user.role).toBe(UserRole.EMPLOYEE);
    });

    it('rejects invalid credentials with the same error', async () => {
      await app.post('/auth/register', registerPayload).expect(201);

      const unknown = await app
        .post('/auth/login', {
          email: 'nobody@parking.test',
          password: DEFAULT_PASSWORD,
        })
        .expect(401);
      const wrong = await app
        .post('/auth/login', {
          email: registerPayload.email,
          password: 'OtherPass1',
        })
        .expect(401);

      expect(unknown.body.message).toBe('Invalid credentials');
      expect(wrong.body.message).toBe('Invalid credentials');
    });

    it('rejects an invalid body', async () => {
      await app.post('/auth/login', { email: 'bad', password: '' }).expect(400);
    });
  });

  describe('GET /auth/me', () => {
    it('returns the identity from the token', async () => {
      const client = await createClient(app);

      const { body } = await app.get('/auth/me', client).expect(200);
      expect(body).toEqual({
        userId: client.id,
        email: client.email,
        role: UserRole.CLIENT,
      });
    });

    it('accepts the token issued by login', async () => {
      const user = await createEmployee(app);
      const { body } = await app
        .post('/auth/login', { email: user.email, password: user.password })
        .expect(201);

      const me = await app.get('/auth/me', body.accessToken).expect(200);
      expect(me.body).toEqual({
        userId: user.id,
        email: user.email,
        role: UserRole.EMPLOYEE,
      });
    });

    it('rejects requests without a token, with an invalid token, or an expired one', async () => {
      const user = await createClient(app);
      const expired = app.jwt.sign(
        { sub: user.id, email: user.email, role: user.role },
        { expiresIn: '-1s' },
      );

      await app.get('/auth/me').expect(401);
      await app.get('/auth/me', 'this-is-not-a-jwt').expect(401);
      await app.get('/auth/me', expired).expect(401);
    });
  });
});
