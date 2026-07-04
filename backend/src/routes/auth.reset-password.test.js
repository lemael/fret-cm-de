const request = require('supertest');
const bcrypt = require('bcryptjs');

jest.mock('../config/db', () => ({
  query: jest.fn(),
}));

const pool = require('../config/db');
const app = require('../app');

describe('POST /api/auth/reset-password', () => {
  let consoleErrorSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  test('returns 400 when required fields are missing', async () => {
    const response = await request(app)
      .post('/api/auth/reset-password')
      .send({ username: 'admin' });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: 'Champs manquants' });
  });

  test('returns 400 when password is too short', async () => {
    const response = await request(app)
      .post('/api/auth/reset-password')
      .send({ username: 'admin', newPassword: 'short' });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: 'Le mot de passe doit contenir au moins 8 caractères',
    });
  });

  test('returns 403 when admin username does not exist', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    const response = await request(app)
      .post('/api/auth/reset-password')
      .send({ username: 'unknown-admin', newPassword: 'StrongPass123' });

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ error: 'Username admin invalide' });
    expect(pool.query).toHaveBeenCalledTimes(1);
  });

  test('returns 200 and updates hash when username exists', async () => {
    jest.spyOn(bcrypt, 'hash').mockResolvedValueOnce('hashed-password');
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 'admin-id-1' }] })
      .mockResolvedValueOnce({ rowCount: 1 });

    const response = await request(app)
      .post('/api/auth/reset-password')
      .send({ username: 'admin', newPassword: 'StrongPass123' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ success: true });
    expect(pool.query).toHaveBeenNthCalledWith(
      1,
      'SELECT id FROM admins WHERE username = $1',
      ['admin']
    );
    expect(bcrypt.hash).toHaveBeenCalledWith('StrongPass123', 12);
    expect(pool.query).toHaveBeenNthCalledWith(
      2,
      'UPDATE admins SET password_hash = $1 WHERE id = $2',
      ['hashed-password', 'admin-id-1']
    );
  });

  test('returns 500 when database update fails', async () => {
    jest.spyOn(bcrypt, 'hash').mockResolvedValueOnce('hashed-password');
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 'admin-id-1' }] })
      .mockRejectedValueOnce(new Error('db failure'));

    const response = await request(app)
      .post('/api/auth/reset-password')
      .send({ username: 'admin', newPassword: 'StrongPass123' });

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: 'Erreur serveur' });
  });
});
