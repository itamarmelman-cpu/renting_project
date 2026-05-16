-- AguGo Campus Locker — SQLite Schema
-- Run: sqlite3 app.db < database/schema.sql
-- Requires SQLite 3.26+ for FK support via PRAGMA.

PRAGMA foreign_keys = ON;

-- ── products ─────────────────────────────────────────────────────────────────
-- Combines the hardcoded PRODUCTS array (app.js) and the separate inventory
-- table (server.js) into a single source of truth.
-- categoryLabel and rentLabel are dropped: both are fully derived from `type`.

CREATE TABLE IF NOT EXISTS products (
    id           TEXT    PRIMARY KEY,
    name         TEXT    NOT NULL,
    description  TEXT    NOT NULL DEFAULT '',
    type         TEXT    NOT NULL CHECK(type IN ('rent', 'buy')),
    price        REAL    NOT NULL CHECK(price >= 0),
    stock        INTEGER NOT NULL DEFAULT 0 CHECK(stock >= 0),
    visual       TEXT    NOT NULL DEFAULT '',
    image        TEXT    NOT NULL DEFAULT '',
    search_terms TEXT    NOT NULL DEFAULT ''
);

-- ── orders ───────────────────────────────────────────────────────────────────
-- One row per completed checkout transaction.
-- id is generated server-side in ord_NNNN format before insert:
--   SELECT 'ord_' || printf('%04d', COALESCE(MAX(CAST(substr(id,5) AS INTEGER)), 0) + 1)
--   FROM orders;
-- customer_name stores firstName + ' ' + lastName from the checkout form.

CREATE TABLE IF NOT EXISTS orders (
    id               TEXT PRIMARY KEY,
    customer_name    TEXT NOT NULL,
    payment_provider TEXT NOT NULL,
    total            REAL NOT NULL CHECK(total >= 0),
    status           TEXT NOT NULL DEFAULT 'completed'
                         CHECK(status IN ('pending', 'completed')),
    created_at       TEXT NOT NULL,
    updated_at       TEXT NOT NULL
);

-- ── order_items ───────────────────────────────────────────────────────────────
-- Line items within an order.
-- rent_days is 1 for buy-type products (no rental period; price = unit_price × quantity × 1).
--
-- Overdue detection — never stored, always derived:
--   due_at  = datetime(orders.created_at, order_items.rent_days || ' days')
--   overdue = due_at < datetime('now')  AND no matching row in returns
--
-- Example query (active overdue rentals):
--   SELECT oi.*, o.customer_name,
--          datetime(o.created_at, oi.rent_days || ' days') AS due_at
--   FROM order_items oi
--   JOIN orders o ON o.id = oi.order_id
--   JOIN products p ON p.id = oi.product_id
--   WHERE p.type = 'rent'
--     AND datetime(o.created_at, oi.rent_days || ' days') < datetime('now')
--     AND NOT EXISTS (
--           SELECT 1 FROM returns r
--           WHERE r.product_id = oi.product_id
--             AND r.first_name || ' ' || r.last_name = o.customer_name
--         );

CREATE TABLE IF NOT EXISTS order_items (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id     TEXT    NOT NULL REFERENCES orders(id),
    product_id   TEXT    NOT NULL REFERENCES products(id),
    quantity     INTEGER NOT NULL DEFAULT 1 CHECK(quantity >= 1),
    rent_days    INTEGER NOT NULL DEFAULT 1 CHECK(rent_days >= 1),
    unit_price   REAL    NOT NULL DEFAULT 0 CHECK(unit_price >= 0)
);

-- ── returns ───────────────────────────────────────────────────────────────────
-- One row per return event.
-- No order_id FK — authentication uses first_name + last_name + product
-- selection, matching the current ReturnPage flow exactly.
-- product_name is denormalized so the record is self-contained if the
-- product is later removed from the catalog.

CREATE TABLE IF NOT EXISTS returns (
    id           TEXT PRIMARY KEY,
    first_name   TEXT NOT NULL,
    last_name    TEXT NOT NULL,
    product_id   TEXT NOT NULL REFERENCES products(id),
    product_name TEXT NOT NULL,
    returned_at  TEXT NOT NULL
);

-- ── indexes ───────────────────────────────────────────────────────────────────

-- Fetching all items for an order (used on every order read)
CREATE INDEX IF NOT EXISTS idx_order_items_order_id
    ON order_items(order_id);

-- Rental activity and product popularity stats
CREATE INDEX IF NOT EXISTS idx_order_items_product_id
    ON order_items(product_id);

-- Date-range filtering in the order history view
CREATE INDEX IF NOT EXISTS idx_orders_created_at
    ON orders(created_at DESC);

-- Return history lookup by product
CREATE INDEX IF NOT EXISTS idx_returns_product_id
    ON returns(product_id);
