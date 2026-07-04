const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const clientRoutes = require('./routes/clients');
const shipmentRoutes = require('./routes/shipments');
const statusRoutes = require('./routes/status');

const app = express();

app.use(cors());
app.use(express.json());

// Routes protegees (JWT requis)
app.use('/api/auth', authRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/shipments', shipmentRoutes);

// Route publique (page client)
app.use('/api/status', statusRoutes);

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

module.exports = app;
