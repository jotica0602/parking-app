import { createTestApp, TestApp } from '../../test/support/app';
import { createAdmin, createClient } from '../../test/support/factories';

describe('Users', () => {
  let app: TestApp;

  beforeAll(async () => {
    app = await createTestApp();
  });
  afterAll(() => app.close());
  beforeEach(() => app.reset());

  it('only an admin can list users', async () => {
    const client = await createClient(app);
    const admin = await createAdmin(app);

    await app.get('/users', client).expect(403);

    const { body } = await app.get('/users', admin).expect(200);
    expect(body).toHaveLength(2);
  });
});
