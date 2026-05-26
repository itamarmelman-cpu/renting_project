import os
import sqlite3
import time
import threading
from datetime import datetime, timezone
from pathlib import Path

from flask import Flask, jsonify, request, send_file

BASE_DIR   = Path(__file__).parent.parent
DB_PATH    = BASE_DIR / "app.db"
STATIC_DIR = BASE_DIR / "frontend"
ARDUINO_BRIDGE_URL = "http://localhost:5001"

app = Flask(__name__, static_folder=str(STATIC_DIR), static_url_path="")


# ── Database helpers ──────────────────────────────────────────────────────────

def get_db():
    con = sqlite3.connect(str(DB_PATH))
    con.row_factory = sqlite3.Row
    con.execute("PRAGMA foreign_keys = ON")
    return con


def _migrate():
    with get_db() as con:
        try:
            con.execute("ALTER TABLE returns ADD COLUMN quantity INTEGER NOT NULL DEFAULT 1")
            con.commit()
        except sqlite3.OperationalError:
            pass  # column already exists


_migrate()


# ── Ping ──────────────────────────────────────────────────────────────────────

@app.get("/api/ping")
def ping():
    return jsonify(ok=True)


# ── Inventory ─────────────────────────────────────────────────────────────────

@app.get("/api/inventory")
def get_inventory():
    with get_db() as con:
        rows = con.execute("SELECT id AS productId, stock FROM products").fetchall()
    return jsonify({row["productId"]: row["stock"] for row in rows})


@app.post("/api/inventory")
def set_inventory():
    inventory = request.get_json()
    if not isinstance(inventory, dict):
        return jsonify(error="Invalid inventory payload"), 400
    with get_db() as con:
        for product_id, stock in inventory.items():
            con.execute("UPDATE products SET stock = ? WHERE id = ?", (stock, product_id))
        con.commit()
    return jsonify(ok=True, inventory=inventory)


# ── Orders ────────────────────────────────────────────────────────────────────

def _order_with_items(con, order_id):
    row = con.execute(
        """SELECT id, customer_name AS customerName, payment_provider AS provider,
                  total, status, created_at AS createdAt, updated_at AS updatedAt
           FROM orders WHERE id = ?""",
        (order_id,),
    ).fetchone()
    if row is None:
        return None
    order = dict(row)
    order["items"] = [
        dict(r)
        for r in con.execute(
            """SELECT id, order_id AS orderId, product_id AS productId,
                      quantity, rent_days AS rentDays, unit_price AS unitPrice
               FROM order_items WHERE order_id = ?""",
            (order_id,),
        ).fetchall()
    ]
    return order


@app.post("/api/orders")
def create_order():
    order = request.get_json()
    if not order or not isinstance(order.get("items"), list):
        return jsonify(error="Invalid order"), 400
    now = datetime.now(timezone.utc).isoformat()
    with get_db() as con:
        last = con.execute("SELECT id FROM orders ORDER BY rowid DESC LIMIT 1").fetchone()
        next_num = (int(last["id"].split("_")[1]) if last else 0) + 1
        order_id = f"ord_{str(next_num).zfill(4)}"
        con.execute(
            """INSERT INTO orders (id, customer_name, payment_provider, total, status, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (order_id, order.get("customerName"), order.get("provider", "Unknown"),
             order.get("total", 0), "completed", now, now),
        )
        for item in order["items"]:
            con.execute(
                "INSERT INTO order_items (order_id, product_id, quantity, rent_days, unit_price) VALUES (?, ?, ?, ?, ?)",
                (order_id, item["productId"], item.get("quantity", 1), item.get("rentDays", 1), item.get("unitPrice", 0)),
            )
            current = con.execute("SELECT stock FROM products WHERE id = ?", (item["productId"],)).fetchone()
            new_stock = max(0, (current["stock"] if current else 0) - item.get("quantity", 1))
            con.execute("UPDATE products SET stock = ? WHERE id = ?", (new_stock, item["productId"]))
        con.commit()
        created = _order_with_items(con, order_id)
    return jsonify(ok=True, order=created)


@app.get("/api/orders")
def list_orders():
    with get_db() as con:
        orders = [
            dict(r)
            for r in con.execute(
                """SELECT id, customer_name AS customerName, payment_provider AS provider,
                          total, status, created_at AS createdAt, updated_at AS updatedAt
                   FROM orders ORDER BY created_at DESC"""
            ).fetchall()
        ]
        for o in orders:
            o["items"] = [
                dict(r)
                for r in con.execute(
                    """SELECT id, order_id AS orderId, product_id AS productId,
                              quantity, rent_days AS rentDays, unit_price AS unitPrice
                       FROM order_items WHERE order_id = ?""",
                    (o["id"],),
                ).fetchall()
            ]
    return jsonify(orders)


@app.get("/api/orders/<order_id>")
def get_order(order_id):
    with get_db() as con:
        order = _order_with_items(con, order_id)
    if order is None:
        return jsonify(error="Order not found"), 404
    return jsonify(order)


@app.patch("/api/orders/<order_id>")
def patch_order(order_id):
    body = request.get_json() or {}
    now  = datetime.now(timezone.utc).isoformat()
    with get_db() as con:
        if not con.execute("SELECT 1 FROM orders WHERE id = ?", (order_id,)).fetchone():
            return jsonify(error="Order not found"), 404
        updates, values = [], []
        if "status" in body:
            updates.append("status = ?")
            values.append(body["status"])
        updates.append("updated_at = ?")
        values.append(now)
        values.append(order_id)
        con.execute(f"UPDATE orders SET {', '.join(updates)} WHERE id = ?", values)
        con.commit()
        updated = _order_with_items(con, order_id)
    return jsonify(ok=True, order=updated)


# ── Returns ───────────────────────────────────────────────────────────────────

@app.get("/api/active-rentals")
def active_rentals():
    with get_db() as con:
        rows = con.execute(
            """SELECT p.id AS productId, p.name AS productName
               FROM products p
               WHERE p.type = 'rent'
                 AND (SELECT COALESCE(SUM(oi.quantity), 0) FROM order_items oi WHERE oi.product_id = p.id)
                   > (SELECT COALESCE(SUM(r.quantity),  0) FROM returns r        WHERE r.product_id  = p.id)"""
        ).fetchall()
    return jsonify([dict(r) for r in rows])


@app.post("/api/validate-return")
def validate_return():
    body       = request.get_json() or {}
    first_name = body.get("firstName")
    last_name  = body.get("lastName")
    items      = body.get("items")
    if not first_name or not last_name or not isinstance(items, list) or not items:
        return jsonify(error="Invalid request"), 400
    customer_name = f"{first_name} {last_name}"
    errors, valid_items = [], []
    with get_db() as con:
        for entry in items:
            pid     = entry["productId"]
            qty     = entry.get("quantity", 1)
            product = con.execute('SELECT * FROM products WHERE id = ? AND type = "rent"', (pid,)).fetchone()
            if not product:
                errors.append("מוצר לא נמצא או אינו מוצר להשכרה")
                continue
            rented = con.execute(
                """SELECT COALESCE(SUM(oi.quantity), 0) AS total
                   FROM order_items oi JOIN orders o ON o.id = oi.order_id
                   WHERE o.customer_name = ? AND oi.product_id = ?""",
                (customer_name, pid),
            ).fetchone()["total"]
            returned = con.execute(
                """SELECT COALESCE(SUM(quantity), 0) AS total
                   FROM returns WHERE first_name = ? AND last_name = ? AND product_id = ?""",
                (first_name, last_name, pid),
            ).fetchone()["total"]
            available = rented - returned
            if available <= 0:
                errors.append(f"{product['name']}: לא נמצאה השכרה פעילה על שמך")
            elif qty > available:
                errors.append(f"{product['name']}: ביקשת להחזיר {qty} אך יש לך רק {available} בהשכרה פעילה")
            else:
                valid_items.append({"productId": pid, "quantity": qty, "productName": product["name"]})
    if errors:
        return jsonify(valid=False, errors=errors)
    return jsonify(valid=True, items=valid_items)


@app.post("/api/returns")
def create_return():
    body       = request.get_json() or {}
    first_name = body.get("firstName")
    last_name  = body.get("lastName")
    items      = body.get("items")
    if not first_name or not last_name or not isinstance(items, list) or not items:
        return jsonify(error="Invalid return"), 400
    now = datetime.now(timezone.utc).isoformat()
    returned_items = []
    with get_db() as con:
        for entry in items:
            pid       = entry["productId"]
            pname     = entry.get("productName", "")
            qty       = entry.get("quantity", 1)
            return_id = f"ret_{int(time.time() * 1000)}_{pid}"
            con.execute(
                """INSERT INTO returns (id, first_name, last_name, product_id, product_name, quantity, returned_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?)""",
                (return_id, first_name, last_name, pid, pname, qty, now),
            )
            current = con.execute("SELECT stock FROM products WHERE id = ?", (pid,)).fetchone()
            new_stock = (current["stock"] if current else 0) + qty
            con.execute("UPDATE products SET stock = ? WHERE id = ?", (new_stock, pid))
            returned_items.append({"returnId": return_id, "productId": pid, "quantity": qty})
        con.commit()
    return jsonify(ok=True, returns=returned_items)


@app.get("/api/returns")
def list_returns():
    with get_db() as con:
        rows = con.execute(
            """SELECT id, first_name AS firstName, last_name AS lastName,
                      product_id AS productId, product_name AS productName,
                      quantity, returned_at AS createdAt
               FROM returns ORDER BY returned_at DESC"""
        ).fetchall()
    return jsonify([dict(r) for r in rows])


# ── Stats ─────────────────────────────────────────────────────────────────────

@app.get("/api/stats")
def stats():
    with get_db() as con:
        total_orders  = con.execute("SELECT COUNT(*) AS c FROM orders").fetchone()["c"]
        total_returns = con.execute("SELECT COUNT(*) AS c FROM returns").fetchone()["c"]
        items_sold    = con.execute("SELECT COALESCE(SUM(quantity), 0) AS t FROM order_items").fetchone()["t"]
        inv_rows      = con.execute("SELECT id AS productId, stock FROM products").fetchall()
    return jsonify(
        totalOrders=total_orders,
        totalReturns=total_returns,
        totalItemsSold=items_sold,
        inventory={r["productId"]: r["stock"] for r in inv_rows},
    )


# ── Locker ────────────────────────────────────────────────────────────────────

_locker_pending: dict = {"open": None, "close": None}
_locker_result:  dict = {"open": None, "close": None}


@app.post("/api/locker/callback")
def locker_callback():
    status = (request.get_json() or {}).get("status")
    if status not in ("open", "closed"):
        return jsonify(error='Invalid status. Expected "open" or "closed"'), 400
    command = "open" if status == "open" else "close"
    event   = _locker_pending.get(command)
    if event:
        _locker_result[command] = {"status": status}
        event.set()
        return jsonify(ok=True)
    return jsonify(error="No pending locker request for this status"), 404


@app.post("/api/locker/<command>")
def locker_command(command):
    if command not in ("open", "close"):
        return jsonify(error="Invalid command"), 400
    bridge_response = None
    try:
        import urllib.request, json as _json
        req = urllib.request.Request(
            f"{ARDUINO_BRIDGE_URL}/api/locker/{command}",
            data=_json.dumps({"command": command}).encode(),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=3) as resp:
            bridge_response = _json.loads(resp.read())
    except Exception:
        pass
    if bridge_response is None:
        return jsonify(status="open" if command == "open" else "closed", mocked=True)
    if bridge_response.get("alreadyInState"):
        return jsonify(status=bridge_response["status"])
    event = threading.Event()
    _locker_pending[command] = event
    _locker_result[command]  = None
    timed_out = not event.wait(timeout=30)
    _locker_pending[command] = None
    if timed_out:
        return jsonify(status="open" if command == "open" else "closed", timedOut=True)
    return jsonify(_locker_result[command])


# ── Query explorer ────────────────────────────────────────────────────────────

@app.post("/api/query")
def query_explorer():
    sql = (request.get_json() or {}).get("sql", "")
    if not sql:
        return jsonify(error="No SQL provided"), 400
    if not sql.strip().upper().startswith(("SELECT", "PRAGMA")):
        return jsonify(error="Only SELECT queries are allowed in the explorer"), 400
    try:
        with get_db() as con:
            rows = [dict(r) for r in con.execute(sql).fetchall()]
        return jsonify(rows=rows)
    except sqlite3.Error as exc:
        return jsonify(error=str(exc)), 400


@app.get("/explorer")
def explorer():
    return send_file(str(BASE_DIR / "database" / "query.html"))


@app.get("/er-diagram")
def er_diagram():
    return send_file(str(BASE_DIR / "database" / "er-diagram.html"))


# ── Static fallback (SPA) ─────────────────────────────────────────────────────

@app.get("/")
@app.get("/<path:_>")
def spa(_=""):
    return send_file(str(STATIC_DIR / "index.html"))


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 3000))
    print(f"AguGo dev server listening on http://localhost:{port}")
    app.run(host="0.0.0.0", port=port)
