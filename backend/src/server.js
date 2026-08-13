const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const express = require('express');
const cors = require('cors');
const https = require('https');
const fs = require('fs');
const crypto = require('crypto');
const socketIo = require('socket.io');
const Database = require('./db');

const ALLOWED_ORIGINS = [
  'https://localhost:5173',
  'https://lanceterrill.github.io',
];

const ADMIN_TOKEN = process.env.ADMIN_TOKEN;
if (!ADMIN_TOKEN) {
  throw new Error('ADMIN_TOKEN environment variable is required');
}

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  const expected = Buffer.from(ADMIN_TOKEN);
  const actual = Buffer.from(token);
  const authorized = actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
  if (!authorized) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

const app = express();
const server = https.createServer(
  {
    key: fs.readFileSync(path.join(__dirname, '..', 'certs', 'key.pem')),
    cert: fs.readFileSync(path.join(__dirname, '..', 'certs', 'cert.pem')),
  },
  app
);
const io = socketIo(server, {
  cors: { origin: ALLOWED_ORIGINS, methods: ['GET', 'POST'] }
});

app.use(cors({ origin: ALLOWED_ORIGINS }));
app.use(express.json());

// Initialize database
const db = new Database('./assets.db');

// Socket.io real-time
io.on('connection', (socket) => {
  console.log('iPad connected:', socket.id);
  socket.on('disconnect', () => console.log('iPad disconnected'));
});

// API Routes
app.post('/api/assets', requireAuth, (req, res) => {
  const { computerName, pcUser, modelNumber, serial } = req.body;
  db.addAsset(computerName, pcUser, modelNumber, serial);
  io.emit('assetAdded', { computerName, pcUser, modelNumber, serial });
  res.json({ success: true });
});

app.post('/api/verify', requireAuth, (req, res) => {
  res.json({ ok: true });
});

app.get('/api/assets', async (req, res) => {
  res.json(await db.getAllAssets());
});

server.listen(3000, () => console.log('Server running on https://localhost:3000'));