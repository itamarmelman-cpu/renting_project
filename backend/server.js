const express = require('express');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, '../app.db');
const STATIC_DIR = path.join(__dirname, '../frontend');

// Initialize database connection pool
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
    process.exit(1);
  }
  console.log('Connected to SQLite database');
});

// Enable foreign keys
db.run('PRAGMA foreign_keys = ON');

// Utility function to run SQL with promises
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

// Serve static files (the SPA)
app.use(express.static(STATIC_DIR));

// Simple ping
app.get('/api/ping', (req, res) => res.json({ ok: true }));

// ============ Inventory endpoints ============
app.get('/api/inventory', async (req, res) => {
  try {
    const rows = await dbAll('SELECT productId, stock FROM inventory');
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

    // Clear and replace inventory
    await dbRun('DELETE FROM inventory');
    const stmt = db.prepare('INSERT INTO inventory (productId, stock) VALUES (?, ?)');
    for (const [productId, stock] of Object.entries(inventory)) {
      stmt.run(productId, stock);
    }
    stmt.finalize();

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

    // Get next order ID
    const lastOrder = await dbGet('SELECT id FROM orders ORDER BY rowid DESC LIMIT 1');
    const nextNum = (lastOrder ? parseInt(lastOrder.id.split('_')[1]) : 0) + 1;
    const orderId = `ord_${String(nextNum).padStart(4, '0')}`;

    const now = new Date().toISOString();

    // Insert order
    await dbRun(
      `INSERT INTO orders (id, customerName, provider, total, status, locker, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        orderId,
        order.customerName || null,
        order.provider || 'Unknown',
        order.total || 0,
        'completed',
        order.locker || null,
        now,
        now,
      ]
    );

    // Insert order items and decrement inventory
    for (const item of order.items) {
      await dbRun(
        'INSERT INTO order_items (orderId, productId, quantity, rentDays) VALUES (?, ?, ?, ?)',
        [orderId, item.productId, item.quantity || 1, item.rentDays || 1]
      );

      // Decrement inventory
      const current = await dbGet('SELECT stock FROM inventory WHERE productId = ?', [item.productId]);
      const newStock = Math.max(0, (current?.stock || 0) - (item.quantity || 1));
      await dbRun('UPDATE inventory SET stock = ? WHERE productId = ?', [newStock, item.productId]);
    }

    // Get the created order
    const createdOrder = await getOrderWithItems(orderId);
    res.json({ ok: true, order: createdOrder });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Helper function to get order with its items
async function getOrderWithItems(orderId) {
  const order = await dbGet('SELECT * FROM orders WHERE id = ?', [orderId]);
  if (!order) return null;

  const items = await dbAll('SELECT * FROM order_items WHERE orderId = ?', [orderId]);
  return { ...order, items };
}

app.get('/api/orders', async (req, res) => {
  try {
    const orders = await dbAll('SELECT * FROM orders ORDER BY createdAt DESC');
    
    // Attach items to each order
    for (const order of orders) {
      const items = await dbAll('SELECT * FROM order_items WHERE orderId = ?', [order.id]);
      order.items = items;
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
    const { status, locker } = req.body;
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
    if (locker !== undefined) {
      updates.push('locker = ?');
      values.push(locker);
    }

    updates.push('updatedAt = ?');
    values.push(now);

    if (updates.length > 0) {
      values.push(req.params.id);
      await dbRun(`UPDATE orders SET ${updates.join(', ')} WHERE id = ?`, values);
    }

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

    // Insert return
    await dbRun(
      `INSERT INTO returns (id, firstName, lastName, productId, productName, createdAt)
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

    // Increment inventory
    const current = await dbGet('SELECT stock FROM inventory WHERE productId = ?', [ret.productId]);
    const newStock = (current?.stock || 0) + 1;
    await dbRun('UPDATE inventory SET stock = ? WHERE productId = ?', [newStock, ret.productId]);

    res.json({ ok: true, returnId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/returns', async (req, res) => {
  try {
    const returns = await dbAll('SELECT * FROM returns ORDER BY createdAt DESC');
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
    const inventoryRows = await dbAll('SELECT productId, stock FROM inventory');

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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Aguda2Go dev server listening on http://localhost:${PORT}`));

// Graceful shutdown
process.on('SIGINT', () => {
  db.close();
  process.exit(0);
});
