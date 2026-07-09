process.env.JWT_SECRET = 'test-secret';

const request = require('supertest');
const jwt = require('jsonwebtoken');

jest.mock('../config/db', () => ({
  query: jest.fn(),
}));

const pool = require('../config/db');
const app = require('../app');

const clientToken = jwt.sign({ id: 'client-1', phone: '+237600000000', role: 'client' }, 'test-secret');
const gestionnaireToken = jwt.sign({ id: 'gest-1', username: 'gestionnaire', role: 'gestionnaire' }, 'test-secret');

const mockQueryImplementation = (handlers) => {
  pool.query.mockImplementation((sql) => {
    const normalized = sql.trim().toUpperCase();
    if (normalized.startsWith('CREATE TABLE')) {
      return Promise.resolve({ rows: [] });
    }
    for (const [matcher, result] of handlers) {
      if (matcher.test(normalized)) return Promise.resolve(result);
    }
    throw new Error(`Requête SQL non mockée: ${sql}`);
  });
};

describe('GET /api/announcements', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  test('is readable by a client', async () => {
    mockQueryImplementation([[/^SELECT \* FROM ANNOUNCEMENTS/, { rows: [] }]]);

    const response = await request(app)
      .get('/api/announcements')
      .set('Authorization', `Bearer ${clientToken}`);

    expect(response.status).toBe(200);
  });
});

describe('POST /api/announcements', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  test('returns 403 when the caller is a client', async () => {
    const response = await request(app)
      .post('/api/announcements')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ title: 'Titre', body: 'Texte' });

    expect(response.status).toBe(403);
  });

  test('returns 400 when title or body is missing', async () => {
    const response = await request(app)
      .post('/api/announcements')
      .set('Authorization', `Bearer ${gestionnaireToken}`)
      .send({ title: 'Titre' });

    expect(response.status).toBe(400);
  });

  test('lets a gestionnaire create an announcement', async () => {
    mockQueryImplementation([
      [
        /^INSERT INTO ANNOUNCEMENTS/,
        { rows: [{ id: 'ann-1', title: 'Titre', body: 'Texte', author_role: 'GESTIONNAIRE' }] },
      ],
    ]);

    const response = await request(app)
      .post('/api/announcements')
      .set('Authorization', `Bearer ${gestionnaireToken}`)
      .send({ title: 'Titre', body: 'Texte' });

    expect(response.status).toBe(201);
    expect(response.body.author_role).toBe('GESTIONNAIRE');
  });
});
