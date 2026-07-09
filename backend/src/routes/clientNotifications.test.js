process.env.JWT_SECRET = 'test-secret';

const request = require('supertest');
const jwt = require('jsonwebtoken');

jest.mock('../config/db', () => ({
  query: jest.fn(),
}));

const pool = require('../config/db');
const app = require('../app');

const clientToken = jwt.sign({ id: 'client-1', phone: '+237600000000', role: 'client' }, 'test-secret');
const adminToken = jwt.sign({ id: 'admin-1', username: 'admin', role: 'admin' }, 'test-secret');

const mockQueryImplementation = (handlers) => {
  pool.query.mockImplementation((sql) => {
    const normalized = sql.trim().toUpperCase();
    if (normalized.startsWith('ALTER TABLE')) {
      return Promise.resolve({ rows: [] });
    }
    for (const [matcher, result] of handlers) {
      if (matcher.test(normalized)) return Promise.resolve(result);
    }
    throw new Error(`Requête SQL non mockée: ${sql}`);
  });
};

describe('GET /api/client-notifications', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  test('returns 401 for a non-client role', async () => {
    const response = await request(app)
      .get('/api/client-notifications')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(403);
  });

  test('merges unread messages and unseen announcements', async () => {
    mockQueryImplementation([
      [
        /^SELECT DISTINCT ON \(M\.SHIPMENT_ID\)/,
        { rows: [{ shipment_id: 'shipment-1', body: 'Bonjour', created_at: '2026-01-02T00:00:00.000Z' }] },
      ],
      [/^SELECT LAST_ANNOUNCEMENT_SEEN_AT/, { rows: [{ last_announcement_seen_at: null }] }],
      [
        /^SELECT ID, TITLE, BODY, CREATED_AT FROM ANNOUNCEMENTS/,
        { rows: [{ id: 'ann-1', title: 'Nouveaux tarifs', body: 'Les tarifs changent', created_at: '2026-01-01T00:00:00.000Z' }] },
      ],
    ]);

    const response = await request(app)
      .get('/api/client-notifications')
      .set('Authorization', `Bearer ${clientToken}`);

    expect(response.status).toBe(200);
    expect(response.body.unreadCount).toBe(2);
    expect(response.body.items.map((i) => i.type)).toEqual(['MESSAGE', 'ANNOUNCEMENT']);
  });
});

describe('PATCH /api/client-notifications/mark-announcements-seen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  test('marks announcements as seen for the current client', async () => {
    mockQueryImplementation([[/^UPDATE CLIENTS/, { rowCount: 1 }]]);

    const response = await request(app)
      .patch('/api/client-notifications/mark-announcements-seen')
      .set('Authorization', `Bearer ${clientToken}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ success: true });
  });
});
