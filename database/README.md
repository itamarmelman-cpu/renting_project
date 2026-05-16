# AguGo Database

SQLite schema for the AguGo campus locker rental/sales platform.

## Setup

```bash
sqlite3 app.db < database/schema.sql
sqlite3 app.db < database/seed.sql
```

The backend (`backend/server.js`) connects to `app.db` at the project root.

---

## Tables

### `products`
The full product catalog plus current inventory stock in one table.
Replaces the hardcoded `PRODUCTS` array in `app.js` and the separate `inventory` table from the original `server.js`.

`type` is either `'rent'` (price is per-day) or `'buy'` (flat price). `categoryLabel` and `rentLabel` are omitted — both are derived from `type` in the frontend.

### `orders`
One row per completed checkout. `customer_name` stores first + last name as a single string, matching what `CheckoutPage.submitPayment()` produces. `payment_provider` is `'Apple Pay'` or `'Google Pay'`.

**Order ID generation** — `id` is stored as `TEXT` in `ord_NNNN` format. The server generates it before each insert:
```sql
SELECT 'ord_' || printf('%04d',
    COALESCE(MAX(CAST(substr(id, 5) AS INTEGER)), 0) + 1)
FROM orders;
```

### `order_items`
Line items within an order. Each row holds the quantity, rental duration, and a price snapshot (`unit_price`) at the time of purchase.

`rent_days` is always `1` for `buy`-type products. Line total = `unit_price × quantity × rent_days`.

### `returns`
One row per return event. No foreign key to `orders` — authentication follows the `ReturnPage` UI: `first_name` + `last_name` + product selection. `product_name` is stored denormalized so the record survives catalog changes.

---

## Key relationships

```
products ──< order_items >── orders
products ──< returns
```

---

## Overdue rentals

Overdue status is never stored — it is always computed:

```sql
SELECT
    o.id              AS order_id,
    o.customer_name,
    p.name            AS product_name,
    oi.quantity,
    oi.rent_days,
    datetime(o.created_at, oi.rent_days || ' days') AS due_at
FROM order_items oi
JOIN orders   o ON o.id = oi.order_id
JOIN products p ON p.id = oi.product_id
WHERE p.type = 'rent'
  AND datetime(o.created_at, oi.rent_days || ' days') < datetime('now');
```

---

## Non-obvious decisions

- **`inventory` merged into `products`** — the original `server.js` kept a separate `inventory` table as a migration artifact. A single `stock` column is simpler and removes the join on every catalog read.
- **No `lockers` table** — only one physical locker exists in the prototype. The open/close state is runtime-only and never persisted.
- **`product_name` in `returns`** — denormalized intentionally. If a product is deleted from the catalog, existing return records remain readable.
- **No `is_overdue` column** — derived state belongs in queries, not columns. Storing it would require either a background job to update it or careful update logic on every read.
