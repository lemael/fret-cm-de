process.env.JWT_SECRET = 'test-secret';

const request = require('supertest');
const jwt = require('jsonwebtoken');

jest.mock('../config/db', () => ({
  query: jest.fn(),
}));

const pool = require('../config/db');
const app = require('../app');

const clientToken = jwt.sign({ id: 'client-1', phone: '+237600000000', role: 'client' }, 'test-secret');

const mockQueryImplementation = (handlers) => {
  pool.query.mockImplementation((sql) => {
    const normalized = sql.trim().toUpperCase();
    for (const [matcher, result] of handlers) {
      if (matcher.test(normalized)) return Promise.resolve(result);
    }
    throw new Error(`Requête SQL non mockée: ${sql}`);
  });
};

describe('POST /api/orders', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  test('returns 401 without a token', async () => {
    const response = await request(app).post('/api/orders').send({});
    expect(response.status).toBe(401);
  });

  test('returns 400 when required fields are missing', async () => {
    const response = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ weightKg: 5 });

    expect(response.status).toBe(400);
  });

  test('creates a shipment with COLIS_NON_RECU status', async () => {
    mockQueryImplementation([
      [/^SELECT COLUMN_NAME/, {
        rows: [
          'id', 'client_id', 'phase', 'category', 'status', 'tracking_token',
          'weight_kg', 'length_cm', 'width_cm', 'height_cm',
          'content_description', 'pickup_address', 'delivery_address', 'source',
        ].map((column_name) => ({ column_name })),
      }],
      [/^INSERT INTO SHIPMENTS/, { rows: [{ id: 'shipment-1', status: 'COLIS_NON_RECU', tracking_token: 'tok-1' }] }],
      [/^SELECT NAME, PHONE FROM CLIENTS/, { rows: [{ name: 'Jean', phone: '+237600000000' }] }],
      [/^CREATE TABLE/, { rows: [] }],
      [/^INSERT INTO NOTIFICATIONS/, { rows: [] }],
    ]);

    const response = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        weightKg: 12,
        lengthCm: 30,
        widthCm: 20,
        heightCm: 15,
        contentDescription: 'Vêtements',
        pickupAddress: 'Francfort',
        deliveryAddress: 'Douala',
      });

    expect(response.status).toBe(201);
    expect(response.body.shipment.status).toBe('COLIS_NON_RECU');
    expect(response.body.statusLink).toContain('tok-1');
  });
});
