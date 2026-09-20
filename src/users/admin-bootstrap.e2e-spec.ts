import { UserRole } from '../common/enums';
import { createTestApp, TestApp } from '../../test/support/app';
import { createClient } from '../../test/support/factories';
import { UsersService } from './users.service';

describe('Admin bootstrap', () => {
  let app: TestApp;
  let users: UsersService;

  beforeAll(async () => {
    app = await createTestApp();
    users = app.app.get(UsersService);
  });
  afterAll(() => app.close());
  beforeEach(() => app.reset());

  it('creates the admin from env credentials so they can log in', async () => {
    const email = 'env-admin@parking.test';
    const password = 'EnvPass123!';

    await expect(
      users.ensureBootstrapAdmin({ name: 'Env Admin', email, password }),
    ).resolves.toBe('created');

    const { body } = await app.post('/auth/login', { email, password }).expect(201);
    expect(body.user).toMatchObject({ email, role: UserRole.ADMIN });
  });

  it('is idempotent when the admin already matches', async () => {
    const input = {
      name: 'Env Admin',
      email: 'env-admin@parking.test',
      password: 'EnvPass123!',
    };

    await users.ensureBootstrapAdmin(input);
    await expect(users.ensureBootstrapAdmin(input)).resolves.toBe('unchanged');
  });

  it('promotes an existing user and syncs the password from env', async () => {
    const client = await createClient(app);
    const nextPassword = 'NewEnvPass1!';

    await expect(
      users.ensureBootstrapAdmin({
        name: 'Promoted',
        email: client.email,
        password: nextPassword,
      }),
    ).resolves.toBe('updated');

    await app
      .post('/auth/login', { email: client.email, password: client.password })
      .expect(401);
    const { body } = await app
      .post('/auth/login', { email: client.email, password: nextPassword })
      .expect(201);
    expect(body.user.role).toBe(UserRole.ADMIN);
  });
});
