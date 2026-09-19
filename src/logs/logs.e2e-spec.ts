import { createTestApp, TestApp } from '../../test/support/app';
import { createAdmin, createClient } from '../../test/support/factories';

describe('Logs', () => {
  let app: TestApp;

  beforeAll(async () => {
    app = await createTestApp();
  });
  afterAll(() => app.close());
  beforeEach(() => app.reset());

  it('only an admin can read the logs', async () => {
    const client = await createClient(app);
    const admin = await createAdmin(app);

    await app.get('/logs', client).expect(403);

    const { body } = await app.get('/logs', admin).expect(200);
    expect(body).toEqual([]);
  });
});
