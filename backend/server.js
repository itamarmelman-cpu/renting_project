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
app.post('/api/returns', async (req, res) => {
  try {
    const ret = req.body;
    if (!ret || !ret.productId) {
      return res.status(400).json({ error: 'Invalid return' });
    }

    const returnId = `ret_${Date.now()}`;
    const now = new Date().toISOString();

    await dbRun(
      `INSERT INTO returns (id, first_name, last_name, product_id, product_name, returned_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        returnId,
        ret.firstName || '',
        ret.lastName || '',
        ret.productId,
        ret.productName || '',
        now,
      ]
    );

    const current = await dbGet('SELECT stock FROM products WHERE id = ?', [ret.productId]);
    const newStock = (current?.stock || 0) + 1;
    await dbRun('UPDATE products SET stock = ? WHERE id = ?', [newStock, ret.productId]);

    res.json({ ok: true, returnId });
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
              returned_at AS createdAt
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
