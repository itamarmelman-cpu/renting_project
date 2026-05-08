const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'db.json');
const STATIC_DIR = __dirname;

function readDb() {
  try {
    return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  } catch (e) {
    return { inventory: {}, orders: [], returns: [] };
  }
}

function writeDb(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf8');
}

const app = express();
app.use(bodyParser.json());

// Serve static files (the SPA)
app.use(express.static(STATIC_DIR));

// Simple ping
app.get('/api/ping', (req, res) => res.json({ ok: true }));

// Inventory endpoints
app.get('/api/inventory', (req, res) => {
  const db = readDb();
  res.json(db.inventory || {});
});

app.post('/api/inventory', (req, res) => {
  const db = readDb();
  const inventory = req.body;
  if (!inventory || typeof inventory !== 'object') {
    return res.status(400).json({ error: 'Invalid inventory payload' });
  }
  db.inventory = inventory;
  writeDb(db);
  res.json({ ok: true, inventory: db.inventory });
});

// Orders: record an order and decrement inventory
app.post('/api/orders', (req, res) => {
  const db = readDb();
  const order = req.body;
  if (!order || !Array.isArray(order.items)) {
    return res.status(400).json({ error: 'Invalid order' });
  }

  // decrement
  for (const item of order.items) {
    const id = item.productId;
    const qty = Number(item.quantity || 0);
    db.inventory[id] = Math.max(0, (db.inventory[id] || 0) - qty);
  }

  db.orders.push({ ...order, createdAt: new Date().toISOString() });
  writeDb(db);
  res.json({ ok: true });
});

// Returns: record a return and increment inventory
app.post('/api/returns', (req, res) => {
  const db = readDb();
  const ret = req.body;
  if (!ret || !ret.productId) {
    return res.status(400).json({ error: 'Invalid return' });
  }
  const id = ret.productId;
  db.inventory[id] = (db.inventory[id] || 0) + 1;
  db.returns.push({ ...ret, createdAt: new Date().toISOString() });
  writeDb(db);
  res.json({ ok: true });
});

// Stats endpoint
app.get('/api/stats', (req, res) => {
  const db = readDb();
  const totalOrders = db.orders.length;
  const totalReturns = db.returns.length;
  const totalItemsSold = db.orders.reduce((sum, o) => sum + (o.items || []).reduce((s, it) => s + (it.quantity || 0), 0), 0);
  res.json({ totalOrders, totalReturns, totalItemsSold, inventory: db.inventory });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Aguda2Go dev server listening on http://localhost:${PORT}`));
