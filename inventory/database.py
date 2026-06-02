"""
inventory/database.py
---------------------
Thread-safe Python "database" for the GrabIt renting system.

Data is held in memory as plain Python dicts/lists and persisted to three
JSON files in inventory/data/:
  - products.json   {productId: {...product fields...}}
  - orders.json     {"_counter": int, "orders": {orderId: {...}}}
  - returns.json    [{...return fields...}, ...]

No SQL.  All queries are pure Python list/dict comprehensions.
"""

from __future__ import annotations

import json
import threading
import time
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Dict, List, Optional

DATA_DIR = Path(__file__).parent / "data"

_PRODUCTS_FILE      = DATA_DIR / "products.json"
_ORDERS_FILE        = DATA_DIR / "orders.json"
_RETURNS_FILE       = DATA_DIR / "returns.json"
_RESERVATIONS_FILE  = DATA_DIR / "reservations.json"

MAX_RESERVATION_DAYS = 5


# ── Helpers ───────────────────────────────────────────────────────────────────

def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _atomic_write(path: Path, data) -> None:
    """Write JSON atomically via a temp file so no half-written file is ever left."""
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    tmp.replace(path)


# ── Database singleton ────────────────────────────────────────────────────────

class Database:
    """
    Single shared in-memory store.
    All public methods are thread-safe (protected by RLock).
    Call Database.get_instance() to obtain the singleton.
    """

    _instance: Optional["Database"] = None
    _class_lock = threading.Lock()

    # ── Construction ──────────────────────────────────────────────────────────

    def __init__(self):
        self._lock         = threading.RLock()
        self._products:     Dict[str, dict] = {}   # pid -> product dict
        self._orders:       Dict[str, dict] = {}   # oid -> order dict (items embedded)
        self._returns:      List[dict]      = []   # list of return dicts
        self._counter:      int             = 0    # next order number
        self._reservations: Dict[str, dict] = {}   # rid -> reservation dict
        self._res_counter:  int             = 0    # next reservation number
        self._load()

    @classmethod
    def get_instance(cls) -> "Database":
        with cls._class_lock:
            if cls._instance is None:
                cls._instance = cls()
        return cls._instance

    # ── Persistence ───────────────────────────────────────────────────────────

    def _load(self):
        if _PRODUCTS_FILE.exists():
            self._products = json.loads(_PRODUCTS_FILE.read_text(encoding="utf-8"))

        if _ORDERS_FILE.exists():
            raw = json.loads(_ORDERS_FILE.read_text(encoding="utf-8"))
            self._counter = raw.get("_counter", 0)
            self._orders  = raw.get("orders", {})

        if _RETURNS_FILE.exists():
            self._returns = json.loads(_RETURNS_FILE.read_text(encoding="utf-8"))

        if _RESERVATIONS_FILE.exists():
            raw = json.loads(_RESERVATIONS_FILE.read_text(encoding="utf-8"))
            self._res_counter  = raw.get("_counter", 0)
            self._reservations = raw.get("reservations", {})

    def _save_products(self):
        _atomic_write(_PRODUCTS_FILE, self._products)

    def _save_orders(self):
        _atomic_write(_ORDERS_FILE, {"_counter": self._counter, "orders": self._orders})

    def _save_returns(self):
        _atomic_write(_RETURNS_FILE, self._returns)

    def _save_reservations(self):
        _atomic_write(_RESERVATIONS_FILE, {
            "_counter":     self._res_counter,
            "reservations": self._reservations,
        })

    # ── Internal helpers ──────────────────────────────────────────────────────

    def _adjust_stock(self, product_id: str, delta: int):
        """Add delta to a product's stock (delta can be negative for decrement)."""
        p = self._products.get(product_id)
        if p is None:
            return
        p["stock"] = max(0, p["stock"] + delta)

    def _order_to_api(self, o: dict) -> dict:
        """Return a camelCase copy of an order dict for the frontend."""
        items = [
            {
                "productId": item["product_id"],
                "quantity":  item["quantity"],
                "rentDays":  item["rent_days"],
                "unitPrice": item["unit_price"],
            }
            for item in o.get("items", [])
        ]
        return {
            "id":           o["id"],
            "customerName": o["customer_name"],
            "provider":     o["payment_provider"],
            "total":        o["total"],
            "status":       o["status"],
            "createdAt":    o["created_at"],
            "updatedAt":    o["updated_at"],
            "items":        items,
        }

    def _reservation_to_api(self, r: dict) -> dict:
        """Return a camelCase copy of a reservation dict for the frontend."""
        return {
            "id":           r["id"],
            "customerName": r["customer_name"],
            "status":       r["status"],
            "createdAt":    r["created_at"],
            "expiresAt":    r["expires_at"],
            "items": [
                {"productId": item["product_id"], "quantity": item["quantity"]}
                for item in r.get("items", [])
            ],
        }

    def _expire_old_reservations(self) -> bool:
        """
        Mark active reservations past their expiry as 'expired' and restore stock.
        Must be called while self._lock is already held.
        Returns True if any reservations were expired.
        """
        now     = datetime.now(timezone.utc).isoformat()
        changed = False
        for r in self._reservations.values():
            if r["status"] == "active" and r["expires_at"] < now:
                r["status"] = "expired"
                for item in r.get("items", []):
                    self._adjust_stock(item["product_id"], item["quantity"])
                changed = True
        if changed:
            self._save_reservations()
            self._save_products()
        return changed

    def _return_to_api(self, r: dict) -> dict:
        return {
            "id":          r["id"],
            "firstName":   r["first_name"],
            "lastName":    r["last_name"],
            "productId":   r["product_id"],
            "productName": r["product_name"],
            "quantity":    r["quantity"],
            "createdAt":   r["returned_at"],
        }

    def _available_for_return(self, customer_name: str, product_id: str) -> int:
        """
        How many units of product_id can this customer still return?
        = total rented by customer - total already returned by customer.
        Pure Python — replaces the SQL SUM/JOIN query.
        """
        rented = sum(
            item["quantity"]
            for o in self._orders.values()
            if o["customer_name"] == customer_name
            for item in o.get("items", [])
            if item["product_id"] == product_id
        )
        returned = sum(
            r["quantity"]
            for r in self._returns
            if f"{r['first_name']} {r['last_name']}" == customer_name
            and r["product_id"] == product_id
        )
        return rented - returned

    # ── Products ──────────────────────────────────────────────────────────────

    def get_inventory(self) -> Dict[str, int]:
        """Return {productId: stock} mapping for the frontend."""
        with self._lock:
            return {pid: p["stock"] for pid, p in self._products.items()}

    def update_inventory(self, updates: Dict[str, int]):
        """Admin direct-set of stock values (POST /api/inventory)."""
        with self._lock:
            for pid, stock in updates.items():
                if pid in self._products:
                    self._products[pid]["stock"] = max(0, int(stock))
            self._save_products()

    def get_all_products(self) -> List[dict]:
        with self._lock:
            return list(self._products.values())

    def get_product(self, product_id: str) -> Optional[dict]:
        with self._lock:
            return self._products.get(product_id)

    def add_product(self, data: dict) -> dict:
        """Add a new product; auto-generates an ID if not provided."""
        with self._lock:
            if "id" not in data or not data["id"]:
                # Generate next pNNN id
                existing_nums = [
                    int(pid[1:]) for pid in self._products
                    if pid.startswith("p") and pid[1:].isdigit()
                ]
                next_num = (max(existing_nums) + 1) if existing_nums else 1
                data["id"] = f"p{str(next_num).zfill(3)}"

            product = {
                "id":             data["id"],
                "name":           data.get("name", ""),
                "description":    data.get("description", f"{data.get('name','')} - נוסף {_now_iso()[:10]}"),
                "type":           data.get("type", "buy"),
                "price":          float(data.get("price", 0)),
                "stock":          max(0, int(data.get("stock", 0))),
                "visual":         data.get("visual", "📦"),
                "image":          data.get("image", ""),
                "search_terms":   data.get("search_terms", data.get("name", "").lower()),
                "category_label": "השכרה" if data.get("type") == "rent" else "רכישה",
                "rent_label":     "ליום"  if data.get("type") == "rent" else "",
            }
            self._products[product["id"]] = product
            self._save_products()
            return product

    def update_product(self, product_id: str, updates: dict) -> Optional[dict]:
        with self._lock:
            p = self._products.get(product_id)
            if p is None:
                return None
            allowed = {"name", "description", "type", "price", "stock",
                       "visual", "image", "search_terms", "category_label", "rent_label"}
            for key, val in updates.items():
                if key in allowed:
                    p[key] = val
            self._save_products()
            return p

    def delete_product(self, product_id: str) -> bool:
        with self._lock:
            if product_id not in self._products:
                return False
            del self._products[product_id]
            self._save_products()
            return True

    # ── Orders ────────────────────────────────────────────────────────────────

    def create_order(self, customer_name: str, provider: str, total: float,
                     items: List[dict]) -> dict:
        """
        Create an order, decrement stock for each item, and persist.
        items: [{productId, quantity, rentDays, unitPrice}, ...]
        """
        with self._lock:
            self._counter += 1
            order_id = f"ord_{str(self._counter).zfill(4)}"
            now = _now_iso()

            stored_items = [
                {
                    "product_id": item["productId"],
                    "quantity":   item.get("quantity", 1),
                    "rent_days":  item.get("rentDays", 1),
                    "unit_price": item.get("unitPrice", 0),
                }
                for item in items
            ]

            order = {
                "id":               order_id,
                "customer_name":    customer_name,
                "payment_provider": provider,
                "total":            total,
                "status":           "completed",
                "created_at":       now,
                "updated_at":       now,
                "items":            stored_items,
            }
            self._orders[order_id] = order

            # Decrement stock
            for item in stored_items:
                self._adjust_stock(item["product_id"], -item["quantity"])

            self._save_orders()
            self._save_products()
            return self._order_to_api(order)

    def get_all_orders(self) -> List[dict]:
        with self._lock:
            return [
                self._order_to_api(o)
                for o in sorted(
                    self._orders.values(),
                    key=lambda o: o["created_at"],
                    reverse=True,
                )
            ]

    def get_order(self, order_id: str) -> Optional[dict]:
        with self._lock:
            o = self._orders.get(order_id)
            return self._order_to_api(o) if o else None

    def update_order_status(self, order_id: str, status: str) -> Optional[dict]:
        with self._lock:
            o = self._orders.get(order_id)
            if o is None:
                return None
            o["status"]     = status
            o["updated_at"] = _now_iso()
            self._save_orders()
            return self._order_to_api(o)

    # ── Returns ───────────────────────────────────────────────────────────────

    def validate_return(self, first_name: str, last_name: str,
                        items: List[dict]) -> dict:
        """
        Check that the customer can return the requested items.
        Returns {valid: bool, items/errors}.
        items: [{productId, quantity}, ...]
        """
        with self._lock:
            customer_name = f"{first_name} {last_name}"
            errors, valid_items = [], []

            for entry in items:
                pid = entry.get("productId", "")
                qty = int(entry.get("quantity", 1))
                product = self._products.get(pid)

                if not product or product.get("type") != "rent":
                    errors.append("מוצר לא נמצא או אינו מוצר להשכרה")
                    continue

                available = self._available_for_return(customer_name, pid)

                if available <= 0:
                    errors.append(f"{product['name']}: לא נמצאה השכרה פעילה על שמך")
                elif qty > available:
                    errors.append(
                        f"{product['name']}: ביקשת להחזיר {qty} "
                        f"אך יש לך רק {available} בהשכרה פעילה"
                    )
                else:
                    valid_items.append({
                        "productId":   pid,
                        "quantity":    qty,
                        "productName": product["name"],
                    })

            if errors:
                return {"valid": False, "errors": errors}
            return {"valid": True, "items": valid_items}

    def create_return(self, first_name: str, last_name: str,
                      items: List[dict]) -> dict:
        """
        Record a return, increment stock for each item, and persist.
        items: [{productId, productName, quantity}, ...]
        """
        with self._lock:
            now = _now_iso()
            returned_items = []

            for entry in items:
                pid   = entry["productId"]
                pname = entry.get("productName", "")
                qty   = int(entry.get("quantity", 1))
                ret_id = f"ret_{int(time.time() * 1000)}_{pid}"

                record = {
                    "id":           ret_id,
                    "first_name":   first_name,
                    "last_name":    last_name,
                    "product_id":   pid,
                    "product_name": pname,
                    "quantity":     qty,
                    "returned_at":  now,
                }
                self._returns.append(record)
                self._adjust_stock(pid, qty)
                returned_items.append({"returnId": ret_id, "productId": pid, "quantity": qty})

            self._save_returns()
            self._save_products()
            return {"ok": True, "returns": returned_items}

    def get_all_returns(self) -> List[dict]:
        with self._lock:
            return [
                self._return_to_api(r)
                for r in sorted(
                    self._returns,
                    key=lambda r: r["returned_at"],
                    reverse=True,
                )
            ]

    def get_active_rentals(self) -> List[dict]:
        """
        Products of type='rent' where total rented > total returned.
        Replaces the SQL aggregation query.
        """
        with self._lock:
            result = []
            for pid, product in self._products.items():
                if product.get("type") != "rent":
                    continue
                rented = sum(
                    item["quantity"]
                    for o in self._orders.values()
                    for item in o.get("items", [])
                    if item["product_id"] == pid
                )
                returned = sum(
                    r["quantity"]
                    for r in self._returns
                    if r["product_id"] == pid
                )
                if rented > returned:
                    result.append({"productId": pid, "productName": product["name"]})
            return result

    # ── Reservations ──────────────────────────────────────────────────────────

    def create_reservation(self, customer_name: str, items: List[dict]) -> dict:
        """
        Create a reservation and immediately deduct the reserved stock.
        items: [{productId, quantity}, ...]
        Returns {ok, reservation} on success or {ok: False, errors: [...]} on failure.
        """
        with self._lock:
            self._expire_old_reservations()

            # Validate stock for every requested item before touching anything
            errors = []
            for item in items:
                pid = item.get("productId", "")
                qty = int(item.get("quantity", 1))
                product = self._products.get(pid)
                if not product:
                    errors.append(f"מוצר {pid} לא נמצא")
                    continue
                if product["stock"] < qty:
                    errors.append(
                        f"{product['name']}: אין מספיק מלאי "
                        f"(נדרש {qty}, זמין {product['stock']})"
                    )
            if errors:
                return {"ok": False, "errors": errors}

            self._res_counter += 1
            res_id  = f"res_{str(self._res_counter).zfill(4)}"
            now     = datetime.now(timezone.utc)
            expires = (now + timedelta(days=MAX_RESERVATION_DAYS)).isoformat()
            now_iso = now.isoformat()

            stored_items = [
                {
                    "product_id": item["productId"],
                    "quantity":   int(item.get("quantity", 1)),
                }
                for item in items
            ]

            reservation = {
                "id":            res_id,
                "customer_name": customer_name,
                "status":        "active",
                "created_at":    now_iso,
                "expires_at":    expires,
                "items":         stored_items,
            }
            self._reservations[res_id] = reservation

            # Deduct stock immediately — reservation holds these units
            for item in stored_items:
                self._adjust_stock(item["product_id"], -item["quantity"])

            self._save_reservations()
            self._save_products()
            return {"ok": True, "reservation": self._reservation_to_api(reservation)}

    def cancel_reservation(self, reservation_id: str) -> dict:
        """
        Cancel an active reservation and restore its stock to the pool.
        Returns {ok, reservation} or {ok: False, error}.
        """
        with self._lock:
            r = self._reservations.get(reservation_id)
            if r is None:
                return {"ok": False, "error": "הזמנה לא נמצאה"}
            if r["status"] != "active":
                return {"ok": False, "error": f"לא ניתן לבטל הזמנה בסטטוס '{r['status']}'"}

            r["status"] = "cancelled"
            for item in r.get("items", []):
                self._adjust_stock(item["product_id"], item["quantity"])

            self._save_reservations()
            self._save_products()
            return {"ok": True, "reservation": self._reservation_to_api(r)}

    def get_all_reservations(self) -> List[dict]:
        """Return all reservations (newest first), auto-expiring stale ones first."""
        with self._lock:
            self._expire_old_reservations()
            return [
                self._reservation_to_api(r)
                for r in sorted(
                    self._reservations.values(),
                    key=lambda r: r["created_at"],
                    reverse=True,
                )
            ]

    def get_reservation(self, reservation_id: str) -> Optional[dict]:
        with self._lock:
            r = self._reservations.get(reservation_id)
            return self._reservation_to_api(r) if r else None

    def collect_reservation(self, reservation_id: str, provider: str,
                            rent_days: Dict[str, int]) -> dict:
        """
        Convert an active reservation into a completed order.
        Stock is NOT deducted again — it was already deducted at reservation creation.
        rent_days: {productId: days}
        """
        with self._lock:
            self._expire_old_reservations()
            r = self._reservations.get(reservation_id)
            if r is None:
                return {"ok": False, "error": "הזמנה לא נמצאה"}
            if r["status"] != "active":
                return {"ok": False, "error": f"לא ניתן לאסוף הזמנה בסטטוס '{r['status']}'"}

            self._counter += 1
            order_id = f"ord_{str(self._counter).zfill(4)}"
            now = _now_iso()

            stored_items = []
            total = 0.0
            for item in r.get("items", []):
                pid       = item["product_id"]
                qty       = item["quantity"]
                days      = int(rent_days.get(pid, 1))
                product   = self._products.get(pid)
                unit_price = float(product["price"]) if product else 0.0
                total += unit_price * qty * days
                stored_items.append({
                    "product_id": pid,
                    "quantity":   qty,
                    "rent_days":  days,
                    "unit_price": unit_price,
                })

            order = {
                "id":               order_id,
                "customer_name":    r["customer_name"],
                "payment_provider": provider,
                "total":            total,
                "status":           "completed",
                "created_at":       now,
                "updated_at":       now,
                "items":            stored_items,
            }
            self._orders[order_id] = order

            r["status"] = "collected"

            # Stock is not adjusted — was already deducted at reservation creation
            self._save_reservations()
            self._save_orders()
            return {"ok": True, "order": self._order_to_api(order)}

    # ── Stats ─────────────────────────────────────────────────────────────────

    def get_stats(self) -> dict:
        with self._lock:
            total_orders  = len(self._orders)
            total_returns = len(self._returns)
            total_items   = sum(
                item["quantity"]
                for o in self._orders.values()
                for item in o.get("items", [])
            )
            inventory = {pid: p["stock"] for pid, p in self._products.items()}
            return {
                "totalOrders":    total_orders,
                "totalReturns":   total_returns,
                "totalItemsSold": total_items,
                "inventory":      inventory,
            }
