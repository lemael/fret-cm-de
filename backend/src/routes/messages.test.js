process.env.JWT_SECRET = 'test-secret';

const request = require('supertest');
const jwt = require('jsonwebtoken');

jest.mock('../config/db', () => ({
  query: jest.fn(),
}));

const pool = require('../config/db');
const app = require('../app');

const sign = (payload) => jwt.sign(payload, 'test-secret');
const clientToken = sign({ id: 'client-1', phone: '+237600000000', role: 'client' });
const otherClientToken = sign({ id: 'client-2', phone: '+237611111111', role: 'client' });
const adminToken = sign({ id: 'admin-1', username: 'admin', role: 'admin' });
const gestionnaireToken = sign({ id: 'gest-1', username: 'gestionnaire', role: 'gestionnaire' });

const mockQueryImplementation = (handlers) => {
  pool.query.mockImplementation((sql) => {
    const normalized = sql.trim().toUpperCase();
    if (normalized.startsWith('CREATE TABLE') || normalized.startsWith('UPDATE MESSAGES SET IS_READ')) {
      return Promise.resolve({ rows: [] });
    }
    for (const [matcher, result] of handlers) {
      if (matcher.test(normalized)) return Promise.resolve(result);
    }
    throw new Error(`Requête SQL non mockée: ${sql}`);
  });
};

const shipmentRow = {
  id: 'shipment-1',
  client_id: 'client-1',
  client_name: 'Jean',
  client_phone: '+237600000000',
};

describe('GET /api/messages/:shipmentId', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  test('returns 403 when a client requests another client\'s shipment', async () => {
    mockQueryImplementation([[/^SELECT S\.\*/, { rows: [shipmentRow] }]]);

    const response = await request(app)
      .get('/api/messages/shipment-1')
      .set('Authorization', `Bearer ${otherClientToken}`);

    expect(response.status).toBe(403);
  });

  test('allows the owning client to read the thread', async () => {
    mockQueryImplementation([
      [/^SELECT S\.\*/, { rows: [shipmentRow] }],
      [/^SELECT \* FROM MESSAGES/, { rows: [] }],
    ]);

    const response = await request(app)
      .get('/api/messages/shipment-1')
      .set('Authorization', `Bearer ${clientToken}`);

    expect(response.status).toBe(200);
  });

  test('allows a gestionnaire to read any thread', async () => {
    mockQueryImplementation([
      [/^SELECT S\.\*/, { rows: [shipmentRow] }],
      [/^SELECT \* FROM MESSAGES/, { rows: [] }],
    ]);

    const response = await request(app)
      .get('/api/messages/shipment-1')
      .set('Authorization', `Bearer ${gestionnaireToken}`);

    expect(response.status).toBe(200);
  });
});

describe('POST /api/messages/:shipmentId', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  test('stores a GESTIONNAIRE-authored reply', async () => {
    mockQueryImplementation([
      [/^SELECT S\.\*/, { rows: [shipmentRow] }],
      [/^INSERT INTO MESSAGES/, { rows: [{ id: 'msg-1', sender_role: 'GESTIONNAIRE', body: 'Bonjour' }] }],
    ]);

    const response = await request(app)
      .post('/api/messages/shipment-1')
      .set('Authorization', `Bearer ${gestionnaireToken}`)
      .send({ text: 'Bonjour' });

    expect(response.status).toBe(201);
    expect(response.body.sender_role).toBe('GESTIONNAIRE');
  });

  test('admin can also reply on the same thread', async () => {
    mockQueryImplementation([
      [/^SELECT S\.\*/, { rows: [shipmentRow] }],
      [/^INSERT INTO MESSAGES/, { rows: [{ id: 'msg-2', sender_role: 'ADMIN', body: 'Bonjour' }] }],
    ]);

    const response = await request(app)
      .post('/api/messages/shipment-1')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ text: 'Bonjour' });

    expect(response.status).toBe(201);
    expect(response.body.sender_role).toBe('ADMIN');
  });
});

describe('GET /api/messages (inbox)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  test('returns 403 for a client', async () => {
    const response = await request(app)
      .get('/api/messages')
      .set('Authorization', `Bearer ${clientToken}`);

    expect(response.status).toBe(403);
  });

  test('returns the conversation list for a gestionnaire', async () => {
    mockQueryImplementation([
      [
        /^SELECT DISTINCT ON/,
        {
          rows: [
            {
              shipment_id: 'shipment-1',
              tracking_token: 'tok-1',
              client_id: 'client-1',
              client_name: 'Jean',
              client_phone: '+237600000000',
              last_message_body: 'Bonjour',
              last_message_sender_role: 'CLIENT',
              last_message_at: '2026-01-01T00:00:00.000Z',
            },
          ],
        },
      ],
    ]);

    const response = await request(app)
      .get('/api/messages')
      .set('Authorization', `Bearer ${gestionnaireToken}`);

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
  });
});
