import { createTestApp, TestApp } from '../../test/support/app';
import {
  createClient,
  createEmployee,
  createSpot,
  createVehicle,
} from '../../test/support/factories';

describe('Sessions', () => {
  let app: TestApp;

  beforeAll(async () => {
    app = await createTestApp();
  });
  afterAll(() => app.close());
  beforeEach(() => app.reset());

  it('an employee records an entry; a client cannot', async () => {
    const client = await createClient(app);
    const employee = await createEmployee(app);
    const vehicle = await createVehicle(app, client);
    const spot = await createSpot(app);
    const payload = { vehicleId: vehicle.id, spotId: spot.id };

    await app.post('/sessions', payload, client).expect(403);

    const { body } = await app
      .post('/sessions', payload, employee)
      .expect(201);

    expect(body).toMatchObject(payload);
  });
});
