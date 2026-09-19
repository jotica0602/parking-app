import { createTestApp, TestApp } from '../../test/support/app';
import {
  createClient,
  createSpot,
  createVehicle,
  hoursFromNow,
} from '../../test/support/factories';

describe('Reservations', () => {
  let app: TestApp;

  beforeAll(async () => {
    app = await createTestApp();
  });
  afterAll(() => app.close());
  beforeEach(() => app.reset());

  it('a client reserves a parking spot', async () => {
    const client = await createClient(app);
    const vehicle = await createVehicle(app, client);
    const spot = await createSpot(app);

    const { body } = await app
      .post(
        '/reservations',
        {
          vehicleId: vehicle.id,
          spotId: spot.id,
          startAt: hoursFromNow(1).toISOString(),
          endAt: hoursFromNow(3).toISOString(),
        },
        client,
      )
      .expect(201);

    expect(body).toMatchObject({
      vehicleId: vehicle.id,
      spotId: spot.id,
      status: 'confirmed',
    });
  });
});
