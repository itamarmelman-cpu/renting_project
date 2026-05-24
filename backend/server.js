const express = require('express');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, '../app.db');
const STATIC_DIR = path.join(__dirname, '../frontend');

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
    process.exit(1);
  }
  console.log('Connected to SQLite database');
});

db.run('PRAGMA foreign_keys = ON');

// Migration: add quantity column to returns for existing databases
db.run("ALTER TABLE returns ADD COLUMN quantity INTEGER NOT NULL DEFAULT 1", () => {});

function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function dbAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
}

const app = express();
app.use(bodyParser.json());
app.use(express.static(STATIC_DIR));

app.get('/api/ping', (req, res) => res.json({ ok: true }));

// ============ Inventory endpoints ============
app.get('/api/inventory', async (req, res) => {
  try {
    const rows = await dbAll('SELECT id AS productId, stock FROM products');
    const inventory = {};
    rows.forEach((row) => {
      inventory[row.productId] = row.stock;
    });
    res.json(inventory);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/inventory', async (req, res) => {
  try {
    const inventory = req.body;
    if (!inventory || typeof inventory !== 'object') {
      return res.status(400).json({ error: 'Invalid inventory payload' });
    }

    for (const [productId, stock] of Object.entries(inventory)) {
      await dbRun('UPDATE products SET stock = ? WHERE id = ?', [stock, productId]);
    }

    res.json({ ok: true, inventory });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ============ Orders endpoints ============
app.post('/api/orders', async (req, res) => {
  try {
    const order = req.body;
    if (!order || !Array.isArray(order.items)) {
      return res.status(400).json({ error: 'Invalid order' });
    }

    const lastOrder = await dbGet('SELECT id FROM orders ORDER BY rowid DESC LIMIT 1');
    const nextNum = (lastOrder ? parseInt(lastOrder.id.split('_')[1]) : 0) + 1;
    const orderId = `ord_${String(nextNum).padStart(4, '0')}`;

    const now = new Date().toISOString();

    await dbRun(
      `INSERT INTO orders (id, customer_name, payment_provider, total, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        orderId,
        order.customerName || null,
        order.provider || 'Unknown',
        order.total || 0,
        'completed',
        now,
        now,
      ]
    );

    for (const item of order.items) {
      await dbRun(
        'INSERT INTO order_items (order_id, product_id, quantity, rent_days, unit_price) VALUES (?, ?, ?, ?, ?)',
        [orderId, item.productId, item.quantity || 1, item.rentDays || 1, item.unitPrice || 0]
      );

      const current = await dbGet('SELECT stock FROM products WHERE id = ?', [item.productId]);
      const newStock = Math.max(0, (current?.stock || 0) - (item.quantity || 1));
      await dbRun('UPDATE products SET stock = ? WHERE id = ?', [newStock, item.productId]);
    }

    const createdOrder = await getOrderWithItems(orderId);
    res.json({ ok: true, order: createdOrder });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

async function getOrderWithItems(orderId) {
  const order = await dbGet(
    `SELECT id, customer_name AS customerName, payment_provider AS provider,
            total, status, created_at AS createdAt, updated_at AS updatedAt
     FROM orders WHERE id = ?`,
    [orderId]
  );
  if (!order) return null;

  const items = await dbAll(
    `SELECT id, order_id AS orderId, product_id AS productId,
            quantity, rent_days AS rentDays, unit_price AS unitPrice
     FROM order_items WHERE order_id = ?`,
    [orderId]
  );
  return { ...order, items };
}

app.get('/api/orders', async (req, res) => {
  try {
    const orders = await dbAll(
      `SELECT id, customer_name AS customerName, payment_provider AS provider,
              total, status, created_at AS createdAt, updated_at AS updatedAt
       FROM orders ORDER BY created_at DESC`
    );

    for (const order of orders) {
      order.items = await dbAll(
        `SELECT id, order_id AS orderId, product_id AS productId,
                quantity, rent_days AS rentDays, unit_price AS unitPrice
         FROM order_items WHERE order_id = ?`,
        [order.id]
      );
    }

    res.json(orders);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/orders/:id', async (req, res) => {
  try {
    const order = await getOrderWithItems(req.params.id);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    res.json(order);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/orders/:id', async (req, res) => {
  try {
    const { status } = req.body;
    const now = new Date().toISOString();

    const order = await dbGet('SELECT * FROM orders WHERE id = ?', [req.params.id]);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const updates = [];
    const values = [];

    if (status) {
      updates.push('status = ?');
      values.push(status);
    }

    updates.push('updated_at = ?');
    values.push(now);

    values.push(req.params.id);
    await dbRun(`UPDATE orders SET ${updates.join(', ')} WHERE id = ?`, values);

    const updated = await getOrderWithItems(req.params.id);
    res.json({ ok: true, order: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ============ Returns endpoints ============

app.get('/api/active-rentals', async (req, res) => {
  try {
    const rows = await dbAll(`
      SELECT p.id AS productId, p.name AS productName
      FROM products p
      WHERE p.type = 'rent'
        AND (SELECT COALESCE(SUM(oi.quantity), 0) FROM order_items oi WHERE oi.product_id = p.id)
          > (SELECT COALESCE(SUM(r.quantity),  0) FROM returns r        WHERE r.product_id  = p.id)
    `);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/validate-return', async (req, res) => {
  try {
    const { firstName, lastName, items } = req.body;
    if (!firstName || !lastName || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Invalid request' });
    }

    const customerName = `${firstName} ${lastName}`;
    const errors = [];
    const validItems = [];

    for (const { productId, quantity } of items) {
      const product = await dbGet(
        'SELECT * FROM products WHERE id = ? AND type = "rent"',
        [productId]
      );
      if (!product) {
        errors.push('מוצר לא נמצא או אינו מוצר להשכרה');
        continue;
      }

      const rentedRow = await dbGet(
        `SELECT COALESCE(SUM(oi.quantity), 0) AS total
         FROM order_items oi
         JOIN orders o ON o.id = oi.order_id
         WHERE o.customer_name = ? AND oi.product_id = ?`,
        [customerName, productId]
      );

      const returnedRow = await dbGet(
        `SELECT COALESCE(SUM(quantity), 0) AS total
         FROM returns
         WHERE first_name = ? AND last_name = ? AND product_id = ?`,
        [firstName, lastName, productId]
      );

      const totalRented   = rentedRow?.total   || 0;
      const totalReturned = returnedRow?.total  || 0;
      const available     = totalRented - totalReturned;

      if (available <= 0) {
        errors.push(`${product.name}: לא נמצאה השכרה פעילה על שמך`);
      } else if (quantity > available) {
        errors.push(`${product.name}: ביקשת להחזיר ${quantity} אך יש לך רק ${available} בהשכרה פעילה`);
      } else {
        validItems.push({ productId, quantity, productName: product.name });
      }
    }

    if (errors.length > 0) {
      return res.json({ valid: false, errors });
    }
    res.json({ valid: true, items: validItems });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/returns', async (req, res) => {
  try {
    const { firstName, lastName, items } = req.body;
    if (!firstName || !lastName || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Invalid return' });
    }

    const now = new Date().toISOString();
    const returnedItems = [];

    for (const { productId, productName, quantity } of items) {
      const returnId = `ret_${Date.now()}_${productId}`;
      const qty = quantity || 1;

      await dbRun(
        `INSERT INTO returns (id, first_name, last_name, product_id, product_name, quantity, returned_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [returnId, firstName, lastName, productId, productName || '', qty, now]
      );

      const current = await dbGet('SELECT stock FROM products WHERE id = ?', [productId]);
      const newStock = (current?.stock || 0) + qty;
      await dbRun('UPDATE products SET stock = ? WHERE id = ?', [newStock, productId]);

      returnedItems.push({ returnId, productId, quantity: qty });
    }

    res.json({ ok: true, returns: returnedItems });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/returns', async (req, res) => {
  try {
    const returns = await dbAll(
      `SELECT id, first_name AS firstName, last_name AS lastName,
              product_id AS productId, product_name AS productName,
              quantity, returned_at AS createdAt
       FROM returns ORDER BY returned_at DESC`
    );
    res.json(returns);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ============ Stats endpoint ============
app.get('/api/stats', async (req, res) => {
  try {
    const totalOrdersRow = await dbGet('SELECT COUNT(*) as count FROM orders');
    const totalReturnsRow = await dbGet('SELECT COUNT(*) as count FROM returns');
    const totalItemsSoldRow = await dbGet('SELECT SUM(quantity) as total FROM order_items');
    const inventoryRows = await dbAll('SELECT id AS productId, stock FROM products');

    const inventory = {};
    inventoryRows.forEach((row) => {
      inventory[row.productId] = row.stock;
    });

    res.json({
      totalOrders: totalOrdersRow?.count || 0,
      totalReturns: totalReturnsRow?.count || 0,
      totalItemsSold: totalItemsSoldRow?.total || 0,
      inventory,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ============ Locker endpoints ============

const ARDUINO_BRIDGE_URL = 'http://localhost:5001';

// resolvers waiting for Arduino hardware confirmation: { open: fn | null, close: fn | null }
const lockerPending = { open: null, close: null };

// Arduino bridge calls this once it has physically opened / closed
app.post('/api/locker/callback', (req, res) => {
  const { status } = req.body; // expected: 'open' or 'closed'
  if (!status || !['open', 'closed'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status. Expected "open" or "closed"' });
  }
  const command = status === 'open' ? 'open' : 'close';
  if (lockerPending[command]) {
    lockerPending[command]({ status });
    lockerPending[command] = null;
    res.json({ ok: true });
  } else {
    res.status(404).json({ error: 'No pending locker request for this status' });
  }
});

// Frontend sends 'open' or 'close'; we forward to Arduino bridge then long-poll until callback arrives
app.post('/api/locker/:command', async (req, res) => {
  const { command } = req.params;
  if (!['open', 'close'].includes(command)) {
    return res.status(400).json({ error: 'Invalid command' });
  }

  // Forward command to Arduino bridge
  let bridgeResponse = null;
  try {
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), 3000);
    const r = await fetch(`${ARDUINO_BRIDGE_URL}/api/locker/${command}`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ command }),
      signal:  controller.signal,
    });
    clearTimeout(tid);
    if (r.ok) bridgeResponse = await r.json();
  } catch {
    // Bridge not reachable — fall through to mock
  }

  if (!bridgeResponse) {
    // Mock mode: no hardware connected, resolve immediately
    return res.json({ status: command === 'open' ? 'open' : 'closed', mocked: true });
  }

  // Bridge says locker is already in the desired state — no callback will arrive
  if (bridgeResponse.alreadyInState) {
    return res.json({ status: bridgeResponse.status });
  }

  // Long-poll: hold the request open until ESP32 calls /api/locker/callback (max 30 s)
  const result = await new Promise((resolve) => {
    const timer = setTimeout(() => {
      lockerPending[command] = null;
      resolve({ status: command === 'open' ? 'open' : 'closed', timedOut: true });
    }, 30000);

    lockerPending[command] = (data) => {
      clearTimeout(timer);
      resolve(data);
    };
  });

  res.json(result);
});

// ============ Query explorer (dev only) ============
app.post('/api/query', async (req, res) => {
  const { sql } = req.body;
  if (!sql || typeof sql !== 'string') {
    return res.status(400).json({ error: 'No SQL provided' });
  }
  const trimmed = sql.trim().toUpperCase();
  if (!trimmed.startsWith('SELECT') && !trimmed.startsWith('PRAGMA')) {
    return res.status(400).json({ error: 'Only SELECT queries are allowed in the explorer' });
  }
  try {
    const rows = await dbAll(sql);
    res.json({ rows });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/explorer', (req, res) => {
  res.sendFile(path.join(__dirname, '../database/query.html'));
});

app.get('/er-diagram', (req, res) => {
  res.sendFile(path.join(__dirname, '../database/er-diagram.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`AguGo dev server listening on http://localhost:${PORT}`));

process.on('SIGINT', () => {
  db.close();
  process.exit(0);
});
