process.env.JWT_SECRET = 'test-secret';

const request = require('supertest');
const bcrypt = require('bcryptjs');

jest.mock('../config/db', () => ({
  query: jest.fn(),
}));

const pool = require('../config/db');
const app = require('../app');

// Les routes appellent d'abord une requête "ensure" (ALTER/CREATE TABLE IF NOT EXISTS)
// dont le résultat n'est jamais lu, puis la vraie requête métier. Comme ces fonctions
// "ensure" sont mises en cache au niveau du module, l'ordre exact des appels varie selon
// les tests déjà exécutés dans ce fichier — on dispatche donc sur le texte de la requête
// plutôt que de chaîner des mockResolvedValueOnce dans un ordre fixe.
const mockQueryImplementation = (handlers) => {
  pool.query.mockImplementation((sql) => {
    const normalized = sql.trim().toUpperCase();
    if (normalized.startsWith('ALTER TABLE') || normalized.startsWith('CREATE TABLE')) {
      return Promise.resolve({ rows: [] });
    }
    for (const [matcher, result] of handlers) {
      if (matcher.test(normalized)) return Promise.resolve(result);
    }
    throw new Error(`Requête SQL non mockée: ${sql}`);
  });
};

describe('POST /api/auth/client/register', () => {
  let consoleErrorSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  test('returns 400 when phone or password is missing', async () => {
    const response = await request(app)
      .post('/api/auth/client/register')
      .send({ phone: '+237600000000' });

    expect(response.status).toBe(400);
  });

  test('returns 400 when password is too short', async () => {
    const response = await request(app)
      .post('/api/auth/client/register')
      .send({ phone: '+237600000000', password: 'abc' });

    expect(response.status).toBe(400);
  });

  test('returns 409 when a client already has a password set', async () => {
    mockQueryImplementation([
      [/^SELECT \* FROM CLIENTS/, { rows: [{ phone: '+237600000000', password_hash: 'existing-hash' }] }],
    ]);

    const response = await request(app)
      .post('/api/auth/client/register')
      .send({ phone: '+237600000000', password: 'StrongPass123' });

    expect(response.status).toBe(409);
  });

  test('creates the client and returns a token when registration succeeds', async () => {
    jest.spyOn(bcrypt, 'hash').mockResolvedValueOnce('hashed-password');
    mockQueryImplementation([
      [/^SELECT \* FROM CLIENTS/, { rows: [] }],
      [
        /^INSERT INTO CLIENTS/,
        { rows: [{ id: 'client-1', phone: '+237600000000', name: null, created_at: '2026-01-01' }] },
      ],
    ]);

    const response = await request(app)
      .post('/api/auth/client/register')
      .send({ phone: '+237600000000', password: 'StrongPass123' });

    expect(response.status).toBe(201);
    expect(response.body.token).toBeDefined();
    expect(response.body.client.phone).toBe('+237600000000');
  });
});

describe('POST /api/auth/client/login', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  test('returns 401 when the client has no password set yet', async () => {
    mockQueryImplementation([
      [/^SELECT \* FROM CLIENTS/, { rows: [{ id: 'client-1', phone: '+237600000000', password_hash: null }] }],
    ]);

    const response = await request(app)
      .post('/api/auth/client/login')
      .send({ phone: '+237600000000', password: 'whatever123' });

    expect(response.status).toBe(401);
  });
});

describe('POST /api/auth/gestionnaire/login', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  test('returns 401 for unknown username', async () => {
    mockQueryImplementation([[/^SELECT \* FROM GESTIONNAIRES/, { rows: [] }]]);

    const response = await request(app)
      .post('/api/auth/gestionnaire/login')
      .send({ username: 'unknown', password: 'whatever123' });

    expect(response.status).toBe(401);
  });
});
