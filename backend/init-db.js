#!/usr/bin/env node

/**
 * Initialize SQLite database and migrate data from data/seed-data.json
 * Run: node init-db.js
 */

const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, '../app.db');
const JSON_FILE = path.join(__dirname, '../data/seed-data.json');

function initDatabase() {
    const db = new sqlite3.Database(DB_FILE, (err) => {
        if (err) {
            console.error('Error opening database:', err.message);
            process.exit(1);
        }
        console.log('Connected to SQLite database at', DB_FILE);
    });

    db.serialize(() => {
        // Create inventory table
        db.run(`
            CREATE TABLE IF NOT EXISTS inventory (
                productId TEXT PRIMARY KEY,
                stock INTEGER NOT NULL DEFAULT 0
            )
        `, (err) => {
            if (err) console.error('Error creating inventory table:', err);
            else console.log('✓ inventory table created');
        });

        // Create orders table
        db.run(`
            CREATE TABLE IF NOT EXISTS orders (
                id TEXT PRIMARY KEY,
                customerName TEXT NOT NULL,
                provider TEXT DEFAULT 'Unknown',
                total REAL NOT NULL DEFAULT 0,
                status TEXT DEFAULT 'pending',
                locker TEXT,
                createdAt TEXT NOT NULL,
                updatedAt TEXT NOT NULL
            )
        `, (err) => {
            if (err) console.error('Error creating orders table:', err);
            else console.log('✓ orders table created');
        });

        // Create order_items table (for line items)
        db.run(`
            CREATE TABLE IF NOT EXISTS order_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                orderId TEXT NOT NULL,
                productId TEXT NOT NULL,
                quantity INTEGER NOT NULL DEFAULT 1,
                rentDays INTEGER DEFAULT 1,
                unitPrice REAL DEFAULT 0,
                FOREIGN KEY (orderId) REFERENCES orders(id)
            )
        `, (err) => {
            if (err) console.error('Error creating order_items table:', err);
            else console.log('✓ order_items table created');
        });

        // Create returns table
        db.run(`
            CREATE TABLE IF NOT EXISTS returns (
                id TEXT PRIMARY KEY,
                firstName TEXT NOT NULL,
                lastName TEXT NOT NULL,
                productId TEXT NOT NULL,
                productName TEXT NOT NULL,
                createdAt TEXT NOT NULL
            )
        `, (err) => {
            if (err) console.error('Error creating returns table:', err);
            else console.log('✓ returns table created');
        });

        // Migrate data from the JSON seed file
        setTimeout(() => migrateData(db), 500);
    });
}

function migrateData(db) {
    if (!fs.existsSync(JSON_FILE)) {
        console.log('No seed-data.json found, skipping migration.');
        db.close();
        return;
    }

    try {
        const data = JSON.parse(fs.readFileSync(JSON_FILE, 'utf-8'));

        db.serialize(() => {
            // Migrate inventory
            if (data.inventory) {
                const stmt = db.prepare('REPLACE INTO inventory (productId, stock) VALUES (?, ?)');
                for (const [productId, stock] of Object.entries(data.inventory)) {
                    stmt.run(productId, stock);
                }
                stmt.finalize(() => {
                    console.log('✓ Migrated inventory');
                });
            }

            // Migrate orders
            if (data.orders && Array.isArray(data.orders)) {
                const orderStmt = db.prepare(
                    'REPLACE INTO orders (id, customerName, provider, total, status, locker, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
                );
                const itemStmt = db.prepare(
                    'REPLACE INTO order_items (orderId, productId, quantity, rentDays, unitPrice) VALUES (?, ?, ?, ?, ?)'
                );

                data.orders.forEach((order) => {
                    orderStmt.run(
                        order.id,
                        order.customerName || 'Unknown',
                        order.provider || 'Unknown',
                        order.total || 0,
                        order.status || 'pending',
                        order.locker || null,
                        order.createdAt || new Date().toISOString(),
                        order.updatedAt || new Date().toISOString()
                    );

                    if (order.items && Array.isArray(order.items)) {
                        order.items.forEach((item) => {
                            itemStmt.run(
                                order.id,
                                item.productId,
                                item.quantity || 1,
                                item.rentDays || 1,
                                item.unitPrice || 0
                            );
                        });
                    }
                });

                orderStmt.finalize();
                itemStmt.finalize(() => {
                    console.log('✓ Migrated orders and order_items');
                });
            }

            // Migrate returns
            if (data.returns && Array.isArray(data.returns)) {
                const stmt = db.prepare(
                    'REPLACE INTO returns (id, firstName, lastName, productId, productName, createdAt) VALUES (?, ?, ?, ?, ?, ?)'
                );
                data.returns.forEach((ret) => {
                    stmt.run(
                        ret.id || `ret_${Date.now()}`,
                        ret.firstName || '',
                        ret.lastName || '',
                        ret.productId || '',
                        ret.productName || '',
                        ret.createdAt || new Date().toISOString()
                    );
                });
                stmt.finalize(() => {
                    console.log('✓ Migrated returns');
                });
            }
        });

        setTimeout(() => {
            console.log('\n✅ Database initialized and migrated successfully!');
            db.close(() => {
                console.log('Database connection closed.');
            });
        }, 1000);
    } catch (err) {
        console.error('Error migrating data:', err.message);
        db.close();
        process.exit(1);
    }
}

initDatabase();
