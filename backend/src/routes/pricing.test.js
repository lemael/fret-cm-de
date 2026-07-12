process.env.JWT_SECRET = 'test-secret';

const request = require('supertest');
const jwt = require('jsonwebtoken');

jest.mock('../config/db', () => ({
  query: jest.fn(),
}));

const pool = require('../config/db');
const app = require('../app');
const { DEFAULT_CONFIG } = require('../services/pricing');

const sign = (payload) => jwt.sign(payload, 'test-secret');
const adminToken = sign({ id: 'admin-1', username: 'admin', role: 'admin' });
const gestionnaireToken = sign({ id: 'gest-1', username: 'gestionnaire', role: 'gestionnaire' });
const clientToken = sign({ id: 'client-1', phone: '+237600000000', role: 'client' });

const mockQueryImplementation = (handlers) => {
  pool.query.mockImplementation((sql) => {
    const normalized = sql.trim().toUpperCase();
    for (const [matcher, result] of handlers) {
      if (matcher.test(normalized)) return Promise.resolve(result);
    }
    throw new Error(`Requête SQL non mockée: ${sql}`);
  });
};

describe('GET /api/pricing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  test('returns 401 without a token', async () => {
    const response = await request(app).get('/api/pricing');
    expect(response.status).toBe(401);
  });

  test('is readable by client, gestionnaire and admin', async () => {
    mockQueryImplementation([
      [/^CREATE TABLE IF NOT EXISTS PRICING_CONFIG/, { rows: [] }],
      [/^SELECT CONFIG FROM PRICING_CONFIG/, { rows: [] }],
    ]);

    for (const token of [adminToken, gestionnaireToken, clientToken]) {
      const response = await request(app).get('/api/pricing').set('Authorization', `Bearer ${token}`);
      expect(response.status).toBe(200);
      expect(response.body).toEqual(DEFAULT_CONFIG);
    }
  });
});

describe('PUT /api/pricing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  test('returns 403 for a client', async () => {
    const response = await request(app)
      .put('/api/pricing')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ config: DEFAULT_CONFIG });
    expect(response.status).toBe(403);
  });

  test('returns 403 for a gestionnaire', async () => {
    const response = await request(app)
      .put('/api/pricing')
      .set('Authorization', `Bearer ${gestionnaireToken}`)
      .send({ config: DEFAULT_CONFIG });
    expect(response.status).toBe(403);
  });

  test('returns 400 for an invalid config', async () => {
    const response = await request(app)
      .put('/api/pricing')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ config: { sizeTiers: [] } });
    expect(response.status).toBe(400);
  });

  test('saves a valid config for admin', async () => {
    mockQueryImplementation([
      [/^CREATE TABLE IF NOT EXISTS PRICING_CONFIG/, { rows: [] }],
      [/^INSERT INTO PRICING_CONFIG/, { rows: [] }],
    ]);

    const response = await request(app)
      .put('/api/pricing')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ config: DEFAULT_CONFIG });

    expect(response.status).toBe(200);
    expect(response.body).toEqual(DEFAULT_CONFIG);
  });
});
