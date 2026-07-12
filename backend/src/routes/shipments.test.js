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

describe('GET /api/shipments/client-orders', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  test('returns 401 without a token', async () => {
    const response = await request(app).get('/api/shipments/client-orders');
    expect(response.status).toBe(401);
  });

  test('returns 403 for a non-admin role', async () => {
    const response = await request(app)
      .get('/api/shipments/client-orders')
      .set('Authorization', `Bearer ${gestionnaireToken}`);
    expect(response.status).toBe(403);
  });

  test('lists client-submitted orders for admin', async () => {
    mockQueryImplementation([
      [/^ALTER TABLE SHIPMENTS/, { rows: [] }],
      [
        /^SELECT S\.ID, S\.STATUS/,
        { rows: [{ id: 'shipment-1', status: 'COLIS_NON_RECU', tracking_token: 'tok-1', client_name: 'Jean' }] },
      ],
      [/^CREATE TABLE IF NOT EXISTS PRICING_CONFIG/, { rows: [] }],
      [/^SELECT CONFIG FROM PRICING_CONFIG/, { rows: [] }],
    ]);

    const response = await request(app)
      .get('/api/shipments/client-orders')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
  });
});

describe('GET /api/shipments/distribution', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  test('returns 403 for a client', async () => {
    const response = await request(app)
      .get('/api/shipments/distribution')
      .set('Authorization', `Bearer ${clientToken}`);
    expect(response.status).toBe(403);
  });

  test('is readable by admin', async () => {
    mockQueryImplementation([
      [/^ALTER TABLE SHIPMENTS/, { rows: [] }],
      [/^SELECT S\.ID, S\.STATUS/, { rows: [] }],
      [/^CREATE TABLE IF NOT EXISTS PRICING_CONFIG/, { rows: [] }],
      [/^SELECT CONFIG FROM PRICING_CONFIG/, { rows: [] }],
    ]);

    const response = await request(app)
      .get('/api/shipments/distribution')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
  });

  test('is readable by gestionnaire', async () => {
    mockQueryImplementation([
      [/^ALTER TABLE SHIPMENTS/, { rows: [] }],
      [/^SELECT S\.ID, S\.STATUS/, { rows: [] }],
      [/^CREATE TABLE IF NOT EXISTS PRICING_CONFIG/, { rows: [] }],
      [/^SELECT CONFIG FROM PRICING_CONFIG/, { rows: [] }],
    ]);

    const response = await request(app)
      .get('/api/shipments/distribution')
      .set('Authorization', `Bearer ${gestionnaireToken}`);

    expect(response.status).toBe(200);
  });
});

describe('PATCH /api/shipments/:id/distribution-status', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  test('returns 403 for an admin (gestionnaire-only route)', async () => {
    const response = await request(app)
      .patch('/api/shipments/shipment-1/distribution-status')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'COLIS_EXISTANT' });

    expect(response.status).toBe(403);
  });

  test('returns 400 for an invalid status', async () => {
    const response = await request(app)
      .patch('/api/shipments/shipment-1/distribution-status')
      .set('Authorization', `Bearer ${gestionnaireToken}`)
      .send({ status: 'INVALID' });

    expect(response.status).toBe(400);
  });

  test('updates the status when valid', async () => {
    mockQueryImplementation([
      [/^UPDATE SHIPMENTS/, { rows: [{ id: 'shipment-1', status: 'COLIS_EXISTANT' }] }],
    ]);

    const response = await request(app)
      .patch('/api/shipments/shipment-1/distribution-status')
      .set('Authorization', `Bearer ${gestionnaireToken}`)
      .send({ status: 'COLIS_EXISTANT' });

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('COLIS_EXISTANT');
  });

  test('marks the batch as received on the first arrival', async () => {
    mockQueryImplementation([
      [
        /^UPDATE SHIPMENTS/,
        { rows: [{ id: 'shipment-1', status: 'COLIS_EXISTANT', batch_id: 'batch-1' }] },
      ],
      [/^UPDATE SHIPMENT_BATCHES/, { rowCount: 1 }],
    ]);

    const response = await request(app)
      .patch('/api/shipments/shipment-1/distribution-status')
      .set('Authorization', `Bearer ${gestionnaireToken}`)
      .send({ status: 'COLIS_EXISTANT' });

    expect(response.status).toBe(200);
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE shipment_batches'),
      ['batch-1']
    );
  });
});

describe('PATCH /api/shipments/:id/verified-products', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  test('returns 403 for an admin (gestionnaire-only route)', async () => {
    const response = await request(app)
      .patch('/api/shipments/shipment-1/verified-products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ verifiedProducts: [true] });

    expect(response.status).toBe(403);
  });

  test('returns 400 when verifiedProducts is not a boolean array', async () => {
    const response = await request(app)
      .patch('/api/shipments/shipment-1/verified-products')
      .set('Authorization', `Bearer ${gestionnaireToken}`)
      .send({ verifiedProducts: ['yes', 'no'] });

    expect(response.status).toBe(400);
  });

  test('saves the checked products', async () => {
    mockQueryImplementation([
      [/^ALTER TABLE SHIPMENTS/, { rows: [] }],
      [
        /^UPDATE SHIPMENTS/,
        { rows: [{ id: 'shipment-1', verified_products: [true, false] }] },
      ],
    ]);

    const response = await request(app)
      .patch('/api/shipments/shipment-1/verified-products')
      .set('Authorization', `Bearer ${gestionnaireToken}`)
      .send({ verifiedProducts: [true, false] });

    expect(response.status).toBe(200);
    expect(response.body.verified_products).toEqual([true, false]);
  });
});

describe('POST /api/shipments/close-loading', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  test('returns 403 for an admin (gestionnaire-only route)', async () => {
    const response = await request(app)
      .post('/api/shipments/close-loading')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(403);
  });

  test('returns 400 when no parcel is fully checked', async () => {
    mockQueryImplementation([
      [/^ALTER TABLE SHIPMENTS/, { rows: [] }],
      [
        /^SELECT ID, CONTENT_DESCRIPTION, VERIFIED_PRODUCTS/,
        {
          rows: [
            { id: 's1', content_description: 'Chaussures\nSac', verified_products: [true, false] },
            { id: 's2', content_description: 'Montre', verified_products: null },
          ],
        },
      ],
    ]);

    const response = await request(app)
      .post('/api/shipments/close-loading')
      .set('Authorization', `Bearer ${gestionnaireToken}`);

    expect(response.status).toBe(400);
  });

  test('closes fully-checked parcels and publishes an announcement', async () => {
    mockQueryImplementation([
      [/^ALTER TABLE SHIPMENTS/, { rows: [] }],
      [
        /^SELECT ID, CONTENT_DESCRIPTION, VERIFIED_PRODUCTS/,
        {
          rows: [
            { id: 's1', content_description: 'Chaussures\nSac', verified_products: [true, true] },
            { id: 's2', content_description: 'Montre', verified_products: [false] },
          ],
        },
      ],
      [/^UPDATE SHIPMENTS/, { rowCount: 1 }],
      [/^CREATE TABLE IF NOT EXISTS ANNOUNCEMENTS/, { rows: [] }],
      [/^INSERT INTO ANNOUNCEMENTS/, { rows: [{ id: 'ann-1' }] }],
    ]);

    const response = await request(app)
      .post('/api/shipments/close-loading')
      .set('Authorization', `Bearer ${gestionnaireToken}`);

    expect(response.status).toBe(201);
    expect(response.body.closedCount).toBe(1);
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE shipments'),
      [['s1']]
    );
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO announcements'),
      ['Chargement des colis', "Les colis sont chargés et prêts à l'envoi.", 'GESTIONNAIRE']
    );
  });
});

describe('GET /api/shipments/shipped-history', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  test('returns 403 for a client', async () => {
    const response = await request(app)
      .get('/api/shipments/shipped-history')
      .set('Authorization', `Bearer ${clientToken}`);

    expect(response.status).toBe(403);
  });

  test('lists closed parcels for gestionnaire', async () => {
    mockQueryImplementation([
      [/^ALTER TABLE SHIPMENTS/, { rows: [] }],
      [/^SELECT S\.ID, S\.STATUS/, { rows: [{ id: 's1', status: 'COLIS_BIEN_ENVOYE', tracking_token: 'tok-1' }] }],
      [/^CREATE TABLE IF NOT EXISTS PRICING_CONFIG/, { rows: [] }],
      [/^SELECT CONFIG FROM PRICING_CONFIG/, { rows: [] }],
    ]);

    const response = await request(app)
      .get('/api/shipments/shipped-history')
      .set('Authorization', `Bearer ${gestionnaireToken}`);

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
  });
});

describe('POST /api/shipments/close-batch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  test('returns 400 when no package is ready', async () => {
    mockQueryImplementation([[/^SELECT ID FROM SHIPMENTS/, { rows: [] }]]);

    const response = await request(app)
      .post('/api/shipments/close-batch')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(400);
  });

  test('creates a batch and attaches ready packages', async () => {
    mockQueryImplementation([
      [/^SELECT ID FROM SHIPMENTS/, { rows: [{ id: 's1' }, { id: 's2' }] }],
      [/^INSERT INTO SHIPMENT_BATCHES/, { rows: [{ id: 'batch-1', shipped_at: '2026-01-01T00:00:00.000Z' }] }],
      [/^UPDATE SHIPMENTS/, { rowCount: 2 }],
    ]);

    const response = await request(app)
      .post('/api/shipments/close-batch')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(201);
    expect(response.body.packagesCount).toBe(2);
    expect(response.body.batch.id).toBe('batch-1');
  });
});

describe('GET /api/shipments/batches', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  test('lists batch history for admin', async () => {
    mockQueryImplementation([
      [
        /^SELECT B\.ID/,
        { rows: [{ id: 'batch-1', shipped_at: '2026-01-01', received_at: null, packages_count: '3' }] },
      ],
    ]);

    const response = await request(app)
      .get('/api/shipments/batches')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
  });
});
