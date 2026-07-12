process.env.JWT_SECRET = 'test-secret';

const request = require('supertest');
const jwt = require('jsonwebtoken');

jest.mock('../config/db', () => ({
  query: jest.fn(),
}));

const pool = require('../config/db');
const app = require('../app');

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

describe('GET /api/clients/subscribers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  test('returns 403 for a client', async () => {
    const response = await request(app)
      .get('/api/clients/subscribers')
      .set('Authorization', `Bearer ${clientToken}`);
    expect(response.status).toBe(403);
  });

  test('is readable by admin and gestionnaire', async () => {
    mockQueryImplementation([
      [/^ALTER TABLE CLIENTS/, { rows: [] }],
      [
        /^SELECT ID, NAME, FIRST_NAME, PHONE, STREET/,
        {
          rows: [
            {
              id: 'c1',
              name: 'Dupont',
              first_name: 'Jean',
              phone: '+237600000000',
              street: 'Rue A',
              postal_code: '12345',
              city: 'Douala',
              is_subscribed: true,
            },
          ],
        },
      ],
    ]);

    for (const token of [adminToken, gestionnaireToken]) {
      const response = await request(app)
        .get('/api/clients/subscribers')
        .set('Authorization', `Bearer ${token}`);
      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
    }
  });
});

describe('PATCH /api/clients/:id/subscription', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  test('returns 403 for a gestionnaire (admin-only route)', async () => {
    const response = await request(app)
      .patch('/api/clients/c1/subscription')
      .set('Authorization', `Bearer ${gestionnaireToken}`)
      .send({ isSubscribed: true });

    expect(response.status).toBe(403);
  });

  test('returns 400 when isSubscribed is not a boolean', async () => {
    const response = await request(app)
      .patch('/api/clients/c1/subscription')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isSubscribed: 'yes' });

    expect(response.status).toBe(400);
  });

  test('toggles the subscription for admin', async () => {
    mockQueryImplementation([
      [/^ALTER TABLE CLIENTS/, { rows: [] }],
      [
        /^UPDATE CLIENTS/,
        { rows: [{ id: 'c1', name: 'Dupont', is_subscribed: true }] },
      ],
    ]);

    const response = await request(app)
      .patch('/api/clients/c1/subscription')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isSubscribed: true });

    expect(response.status).toBe(200);
    expect(response.body.is_subscribed).toBe(true);
  });
});

describe('GET /api/clients/subscription-status', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  test('returns 403 for an admin (client-only route)', async () => {
    const response = await request(app)
      .get('/api/clients/subscription-status')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(response.status).toBe(403);
  });

  test('returns the current subscription status', async () => {
    mockQueryImplementation([
      [/^ALTER TABLE CLIENTS/, { rows: [] }],
      [
        /^SELECT NAME, FIRST_NAME, PHONE, STREET, POSTAL_CODE, CITY, IS_SUBSCRIBED/,
        { rows: [{ name: null, first_name: null, phone: '+237600000000', is_subscribed: false }] },
      ],
    ]);

    const response = await request(app)
      .get('/api/clients/subscription-status')
      .set('Authorization', `Bearer ${clientToken}`);

    expect(response.status).toBe(200);
    expect(response.body.is_subscribed).toBe(false);
  });
});

describe('POST /api/clients/subscribe', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  test('returns 400 when a required field is missing', async () => {
    const response = await request(app)
      .post('/api/clients/subscribe')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ nom: 'Dupont', prenom: 'Jean', street: 'Rue A', postalCode: '12345', city: 'Douala' });

    expect(response.status).toBe(400);
  });

  test('returns 400 when the terms are not accepted', async () => {
    const response = await request(app)
      .post('/api/clients/subscribe')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        nom: 'Dupont',
        prenom: 'Jean',
        street: 'Rue A',
        postalCode: '12345',
        city: 'Douala',
        accepted: false,
      });

    expect(response.status).toBe(400);
  });

  test('subscribes the client when everything is valid', async () => {
    mockQueryImplementation([
      [/^ALTER TABLE CLIENTS/, { rows: [] }],
      [
        /^UPDATE CLIENTS/,
        {
          rows: [
            {
              name: 'Dupont',
              first_name: 'Jean',
              phone: '+237600000000',
              street: 'Rue A',
              postal_code: '12345',
              city: 'Douala',
              is_subscribed: true,
            },
          ],
        },
      ],
    ]);

    const response = await request(app)
      .post('/api/clients/subscribe')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        nom: 'Dupont',
        prenom: 'Jean',
        street: 'Rue A',
        postalCode: '12345',
        city: 'Douala',
        accepted: true,
      });

    expect(response.status).toBe(200);
    expect(response.body.is_subscribed).toBe(true);
  });
});

describe('DELETE /api/clients/:id', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  test('returns 403 for a gestionnaire (admin-only route)', async () => {
    const response = await request(app)
      .delete('/api/clients/c1')
      .set('Authorization', `Bearer ${gestionnaireToken}`);

    expect(response.status).toBe(403);
  });

  test('returns 404 when the client does not exist', async () => {
    mockQueryImplementation([[/^DELETE FROM CLIENTS/, { rows: [] }]]);

    const response = await request(app)
      .delete('/api/clients/unknown')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(404);
  });

  test('deletes the client for admin', async () => {
    mockQueryImplementation([[/^DELETE FROM CLIENTS/, { rows: [{ id: 'c1' }] }]]);

    const response = await request(app)
      .delete('/api/clients/c1')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });
});
