import { createTestApp, TestApp } from '../../test/support/app';
import { createEmployee, createSpot } from '../../test/support/factories';

describe('Occupancy', () => {
  let app: TestApp;

  beforeAll(async () => {
    app = await createTestApp();
  });
  afterAll(() => app.close());
  beforeEach(() => app.reset());

  it('an employee queries occupancy', async () => {
    const employee = await createEmployee(app);
    await createSpot(app, { code: 'A-1' });

    const { body } = await app.get('/occupancy', employee).expect(200);

    expect(body.spots).toEqual([
      expect.objectContaining({ code: 'A-1', status: 'free' }),
    ]);
  });
});
