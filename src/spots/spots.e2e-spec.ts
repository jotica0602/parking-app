import { createTestApp, TestApp } from '../../test/support/app';
import { createAdmin, createClient } from '../../test/support/factories';

describe('Spots', () => {
  let app: TestApp;

  beforeAll(async () => {
    app = await createTestApp();
  });
  afterAll(() => app.close());
  beforeEach(() => app.reset());

  it('an admin creates a parking spot; a client cannot', async () => {
    const admin = await createAdmin(app);
    const client = await createClient(app);

    await app.post('/spots', { code: 'A-1' }, client).expect(403);

    const { body } = await app
      .post('/spots', { code: 'A-1' }, admin)
      .expect(201);

    expect(body.code).toBe('A-1');
  });
});
