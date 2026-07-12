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

  test('returns 400 for an invalid sizeCategory', async () => {
    const response = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        weightKg: 12,
        sizeCategory: 'NOT_A_CATEGORY',
        contentDescription: 'Vêtements',
        pickupAddress: 'Francfort',
        deliveryAddress: 'Douala',
      });

    expect(response.status).toBe(400);
  });

  test('returns 403 when the client is not subscribed', async () => {
    mockQueryImplementation([
      [/^ALTER TABLE SHIPMENTS/, { rows: [] }],
      [/^ALTER TABLE CLIENTS/, { rows: [] }],
      [/^SELECT NAME, PHONE, IS_SUBSCRIBED FROM CLIENTS/, { rows: [{ name: 'Jean', phone: '+237600000000', is_subscribed: false }] }],
    ]);

    const response = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        weightKg: 12,
        sizeCategory: 'XL',
        contentDescription: 'Vêtements',
        pickupAddress: 'Francfort',
        deliveryAddress: 'Douala',
      });

    expect(response.status).toBe(403);
  });

  test('creates a shipment with COLIS_RECU ("souhait du client") initial status', async () => {
    mockQueryImplementation([
      [/^ALTER TABLE SHIPMENTS/, { rows: [] }],
      [/^ALTER TABLE CLIENTS/, { rows: [] }],
      [/^SELECT NAME, PHONE, IS_SUBSCRIBED FROM CLIENTS/, { rows: [{ name: 'Jean', phone: '+237600000000', is_subscribed: true }] }],
      [/^SELECT COLUMN_NAME/, {
        rows: [
          'id', 'client_id', 'phase', 'category', 'status', 'tracking_token',
          'weight_kg', 'length_cm', 'width_cm', 'height_cm', 'size_category',
          'content_description', 'pickup_address', 'delivery_address', 'source',
        ].map((column_name) => ({ column_name })),
      }],
      [/^INSERT INTO SHIPMENTS/, { rows: [{ id: 'shipment-1', status: 'COLIS_RECU', tracking_token: 'tok-1' }] }],
      [/^CREATE TABLE/, { rows: [] }],
      [/^INSERT INTO NOTIFICATIONS/, { rows: [] }],
    ]);

    const response = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        weightKg: 12,
        sizeCategory: 'XL',
        contentDescription: 'Vêtements',
        pickupAddress: 'Francfort',
        deliveryAddress: 'Douala',
      });

    expect(response.status).toBe(201);
    expect(response.body.shipment.status).toBe('COLIS_RECU');
    expect(response.body.statusLink).toContain('tok-1');

    const insertCall = pool.query.mock.calls.find(([sql]) => /^INSERT INTO SHIPMENTS/i.test(sql.trim()));
    expect(insertCall[1]).toContain('COLIS_RECU');
  });
});

describe('GET /api/orders/mine', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  test('returns 401 without a token', async () => {
    const response = await request(app).get('/api/orders/mine');
    expect(response.status).toBe(401);
  });

  test('includes a computed price for each order', async () => {
    mockQueryImplementation([
      [
        /^SELECT \* FROM SHIPMENTS/,
        { rows: [{ id: 'shipment-1', size_category: 'XL', weight_kg: '12', client_id: 'client-1' }] },
      ],
      [/^CREATE TABLE IF NOT EXISTS PRICING_CONFIG/, { rows: [] }],
      [/^SELECT CONFIG FROM PRICING_CONFIG/, { rows: [] }],
    ]);

    const response = await request(app)
      .get('/api/orders/mine')
      .set('Authorization', `Bearer ${clientToken}`);

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
    expect(response.body[0].price_eur).toBe(40);
  });
});
