const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const clientRoutes = require('./routes/clients');
const shipmentRoutes = require('./routes/shipments');
const statusRoutes = require('./routes/status');
const orderRoutes = require('./routes/orders');
const messageRoutes = require('./routes/messages');
const disputeRoutes = require('./routes/disputes');
const financeRoutes = require('./routes/finance');
const notificationRoutes = require('./routes/notifications');
const announcementRoutes = require('./routes/announcements');
const clientNotificationRoutes = require('./routes/clientNotifications');

const app = express();

app.use(cors());
app.use(express.json());

// Routes protegees (JWT requis)
app.use('/api/auth', authRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/shipments', shipmentRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/disputes', disputeRoutes);
app.use('/api/finance', financeRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/announcements', announcementRoutes);
app.use('/api/client-notifications', clientNotificationRoutes);

// Route publique (page client)
app.use('/api/status', statusRoutes);

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

module.exports = app;
