import { createTestApp, TestApp } from '../../test/support/app';
import { createClient } from '../../test/support/factories';

describe('Vehicles', () => {
  let app: TestApp;

  beforeAll(async () => {
    app = await createTestApp();
  });
  afterAll(() => app.close());
  beforeEach(() => app.reset());

  it('a client registers their vehicle', async () => {
    const client = await createClient(app);

    const { body } = await app
      .post('/vehicles', { licensePlate: '1234ABC' }, client)
      .expect(201);

    expect(body).toMatchObject({
      licensePlate: '1234ABC',
      ownerId: client.id,
    });
  });
});
