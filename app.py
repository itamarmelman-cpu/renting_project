"""
===========================================================================
app.py  -  GrabIt Renting System
===========================================================================
Main Flask application for the GrabIt renting system.

Serves the JavaScript frontend as a Single-Page Application and exposes
every REST API endpoint.

Data is managed exclusively in Python via inventory.database.Database.

Lock control is delegated to lock.controller.LockerController, which
forwards commands to the Node.js Arduino bridge on port 5001.

Run:
    python app.py
"""
from __future__ import annotations

import functools
import hmac
import os
import secrets
from pathlib import Path

from flask import Flask, jsonify, request, send_from_directory, session

from inventory.database import Database
from lock.controller import LockerController
from dashboard.routes import dashboard_bp


# ===========================================================================
# App Setup
# ===========================================================================

BASE_DIR   = Path(__file__).parent
STATIC_DIR = BASE_DIR / "frontend"

app = Flask(__name__, static_folder=STATIC_DIR, static_url_path="")
# Falls back to a random key if SECRET_KEY environment variable is not set.
app.secret_key = os.environ.get("SECRET_KEY") or secrets.token_hex(32)
app.register_blueprint(dashboard_bp)


def _require_admin(f):
    """Decorator: reject requests that don't carry a valid admin session."""
    @functools.wraps(f)
    def _guarded(*args, **kwargs):
        if not session.get("is_admin"):
            return jsonify(error="Unauthorized"), 401
        return f(*args, **kwargs)
    return _guarded

# Singletons - initialised once at startup
_db     = Database.get_instance()
_locker = LockerController()


# ===========================================================================
# Health Check
# ===========================================================================

@app.get("/api/ping")
def ping():
    """Check that the server is alive and reachable.

    Returns:
        JSON: ``{"ok": true}`` with HTTP 200.
    """
    return jsonify(ok=True)


# ===========================================================================
# Auth
# ===========================================================================

_ADMIN_USERNAME = os.environ.get("ADMIN_USERNAME", "Admin")
_ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "Admin123!")


@app.post("/api/auth")
def check_auth():
    """Validate admin credentials and open a server-side session.

    Uses constant-time comparison (``hmac.compare_digest``) to prevent
    timing-based credential enumeration.

    Request Body (JSON):
        username (str) - Admin username.
        password (str) - Admin password.

    Returns:
        JSON: ``{"ok": true}`` on success, ``{"ok": false}`` with HTTP 401 on failure.
    """
    body     = request.get_json() or {}
    username = body.get("username", "")
    password = body.get("password", "")
    ok = hmac.compare_digest(username, _ADMIN_USERNAME) and \
         hmac.compare_digest(password, _ADMIN_PASSWORD)
    if ok:
        session["is_admin"] = True
        return jsonify(ok=True)
    return jsonify(ok=False), 401


@app.post("/api/auth/logout")
def logout():
    """Destroy the current admin session.

    Returns:
        JSON: ``{"ok": true}``
    """
    session.clear()
    return jsonify(ok=True)


# ===========================================================================
# Inventory
# ===========================================================================

@app.get("/api/inventory")
def get_inventory():
    """Retrieve the current stock level for every product.

    Returns:
        JSON: Mapping of ``{productId: stock}`` for all products.
    """
    return jsonify(_db.get_inventory())


@app.post("/api/inventory")
@_require_admin
def set_inventory():
    """Overwrite stock values for one or more products (admin only).

    Accepts a partial mapping - only the supplied product IDs are updated.

    Request Body (JSON):
        ``{productId: stock, ...}``

    Returns:
        JSON: ``{"ok": true, "inventory": {productId: stock, ...}}``

    Raises:
        400: If the request body is not a JSON object.
    """
    data = request.get_json()
    if not isinstance(data, dict):
        return jsonify(error="Invalid inventory payload"), 400
    _db.update_inventory(data)
    return jsonify(ok=True, inventory=_db.get_inventory())


# ===========================================================================
# Products
# ===========================================================================

@app.get("/api/products")
def list_products():
    """List every product in the catalogue.

    Used by the admin inventory-management UI to display and edit products.

    Returns:
        JSON: Array of all product objects stored in the database.
    """
    return jsonify(_db.get_all_products())


@app.post("/api/products")
@_require_admin
def add_product():
    """Create a new product and add it to the inventory.

    Request Body (JSON):
        name  (str, required) - Display name of the product.
        type  (str)           - Product category / type.
        price (float)         - Rental price per unit per day.
        stock (int)           - Initial stock quantity.

    Returns:
        JSON: ``{"ok": true, "product": {...}}`` with HTTP 201.

    Raises:
        400: If ``name`` is missing or empty.
    """
    data = request.get_json() or {}
    if not data.get("name"):
        return jsonify(error="Product name is required"), 400
    product = _db.add_product(data)
    return jsonify(ok=True, product=product), 201


@app.put("/api/products/<product_id>")
@_require_admin
def update_product(product_id: str):
    """Edit an existing product's fields (partial update).

    Only the fields present in the request body are modified; all other
    fields retain their current values.

    Args:
        product_id: Unique identifier of the product to update.

    Request Body (JSON):
        Any subset of product fields (name, type, price, stock, …).

    Returns:
        JSON: ``{"ok": true, "product": {...}}`` with the updated product.

    Raises:
        404: If no product with ``product_id`` exists.
    """
    data    = request.get_json() or {}
    updated = _db.update_product(product_id, data)
    if updated is None:
        return jsonify(error="Product not found"), 404
    return jsonify(ok=True, product=updated)


@app.delete("/api/products/<product_id>")
@_require_admin
def delete_product(product_id: str):
    """Permanently remove a product from the catalogue.

    Args:
        product_id: Unique identifier of the product to delete.

    Returns:
        JSON: ``{"ok": true}``

    Raises:
        404: If no product with ``product_id`` exists.
    """
    success = _db.delete_product(product_id)
    if not success:
        return jsonify(error="Product not found"), 404
    return jsonify(ok=True)


# ===========================================================================
# Orders
# ===========================================================================

@app.post("/api/orders")
def create_order():
    """Place a new rental order and decrement the corresponding stock levels.

    Request Body (JSON):
        customerName (str)   - Full name of the customer.
        provider     (str)   - Payment / service provider.
        total        (float) - Total cost of the entire order.
        items        (list)  - Line items, each containing:
            productId  (str)   - Product identifier.
            quantity   (int)   - Number of units rented.
            rentDays   (int)   - Duration of the rental in days.
            unitPrice  (float) - Price per unit per day.

    Returns:
        JSON: ``{"ok": true, "order": {...}}`` with the persisted order.

    Raises:
        400: If ``items`` is missing or is not a list.
    """
    body = request.get_json() or {}
    if not isinstance(body.get("items"), list):
        return jsonify(error="Invalid order"), 400

    try:
        order = _db.create_order(
            customer_name=body.get("customerName", ""),
            provider=body.get("provider", "Unknown"),
            total=float(body.get("total", 0)),
            items=body["items"],
        )
    except ValueError as exc:
        return jsonify(ok=False, error=str(exc)), 400
    return jsonify(ok=True, order=order)


# ===========================================================================
# Reservations
# ===========================================================================

@app.post("/api/reservations")
def create_reservation():
    """Reserve products in advance and immediately deduct them from stock.

    A reservation is valid for up to 5 days.  If the student does not
    convert it into a purchase within that window it expires automatically
    and the stock is restored.

    Request Body (JSON):
        customerName (str)  - Full name of the student making the reservation.
        items        (list) - Items to reserve, each containing:
            productId (str) - Product identifier.
            quantity  (int) - Number of units to reserve.

    Returns:
        JSON: ``{"ok": true, "reservation": {...}}`` with HTTP 201 on success.
        JSON: ``{"ok": false, "errors": [...]}`` with HTTP 409 if stock is
              insufficient for any requested item.

    Raises:
        400: If ``customerName`` or ``items`` is missing / malformed.
    """
    body = request.get_json() or {}
    customer_name = body.get("customerName", "").strip()
    items         = body.get("items")

    if not customer_name or not isinstance(items, list) or not items:
        return jsonify(error="Customer name and item list are required"), 400

    result = _db.create_reservation(customer_name, items)
    if not result.get("ok"):
        return jsonify(result), 409
    return jsonify(result), 201


@app.post("/api/reservations/<reservation_id>/collect")
def collect_reservation(reservation_id: str):
    """Convert an active reservation into a completed order.

    Stock is NOT deducted again - it was already deducted when the reservation
    was created.

    Request Body (JSON):
        provider  (str)  - Payment provider label (e.g. "Apple Pay").
        rentDays  (dict) - Mapping of ``{productId: days}`` for each item.

    Returns:
        JSON: ``{"ok": true, "order": {...}}`` on success.
        JSON: ``{"ok": false, "error": "..."}`` with HTTP 409 if the reservation
              is not active or not found.
    """
    body      = request.get_json() or {}
    provider  = body.get("provider", "Unknown")
    rent_days = body.get("rentDays", {})

    if not isinstance(rent_days, dict):
        return jsonify(error="rentDays must be a {productId: days} object"), 400

    result = _db.collect_reservation(reservation_id, provider, rent_days)
    if not result.get("ok"):
        return jsonify(result), 409
    return jsonify(result)


# ===========================================================================
# Returns
# ===========================================================================

@app.post("/api/validate-return")
def validate_return():
    """Verify a return request before opening the locker.

    Checks that the customer exists and that the items they claim to be
    returning match their active rental records.  Call this endpoint
    first; only open the locker after receiving a successful response.

    Request Body (JSON):
        firstName (str)  - Customer's first name.
        lastName  (str)  - Customer's last name.
        items     (list) - Items to return, each containing:
            productId (str) - Product identifier.
            quantity  (int) - Number of units being returned.

    Returns:
        JSON: Validation result from the database (valid / error details).

    Raises:
        400: If any required field is absent or ``items`` is empty.
    """
    body       = request.get_json() or {}
    first_name = body.get("firstName")
    last_name  = body.get("lastName")
    items      = body.get("items")

    if not first_name or not last_name or not isinstance(items, list) or not items:
        return jsonify(error="Invalid request"), 400

    result = _db.validate_return(first_name, last_name, items)
    return jsonify(result)


@app.post("/api/returns")
def create_return():
    """Record a confirmed return and restore the items to available stock.

    Should only be called after ``/api/validate-return`` succeeds and
    the locker has been physically opened for the customer.

    Request Body (JSON):
        firstName (str)  - Customer's first name.
        lastName  (str)  - Customer's last name.
        items     (list) - Items being returned, each containing:
            productId   (str) - Product identifier.
            productName (str) - Human-readable product name.
            quantity    (int) - Number of units returned.

    Returns:
        JSON: Return record from the database.

    Raises:
        400: If any required field is absent or ``items`` is empty.
    """
    body       = request.get_json() or {}
    first_name = body.get("firstName")
    last_name  = body.get("lastName")
    items      = body.get("items")

    if not first_name or not last_name or not isinstance(items, list) or not items:
        return jsonify(error="Invalid return"), 400

    result = _db.create_return(first_name, last_name, items)
    return jsonify(result)


@app.get("/api/returns/lookup")
def get_active_rentals_by_customer():
    """Look up all active rentals for a given customer.

    Used by the return flow to pre-populate the items the customer currently
    has checked out so they can select what to return.

    Query Parameters:
        firstName (str) - Customer's first name.
        lastName  (str) - Customer's last name.

    Returns:
        JSON: Array of active rental records for the customer.

    Raises:
        400: If ``firstName`` or ``lastName`` is missing.
    """
    first_name = request.args.get("firstName", "").strip()
    last_name  = request.args.get("lastName", "").strip()
    if not first_name or not last_name:
        return jsonify(error="firstName and lastName are required"), 400
    rentals = _db.get_rentals_by_customer(first_name, last_name)
    return jsonify(rentals)


# ===========================================================================
# Locker
# ===========================================================================

@app.post("/api/locker/callback")
def locker_callback():
    """Receive a hardware status update from the Arduino bridge.

    Called by ``bridge/arduino-bridge.js`` after the physical locker
    confirms that it has opened or closed.  Resolves the corresponding
    pending ``LockerController`` request so the caller of
    ``/api/locker/<command>`` can receive the final result.

    Request Body (JSON):
        status (str) - Hardware confirmation: ``"open"`` or ``"closed"``.

    Returns:
        JSON: ``{"ok": true}`` once the pending request is resolved.

    Raises:
        400: If ``status`` is not ``"open"`` or ``"closed"``.
        404: If there is no pending locker request waiting for this status.
    """
    status = (request.get_json() or {}).get("status")
    if status not in ("open", "closed"):
        return jsonify(error='Invalid status. Expected "open" or "closed"'), 400

    resolved = _locker.handle_callback(status)
    if not resolved:
        return jsonify(error="No pending locker request for this status"), 404
    return jsonify(ok=True)


@app.post("/api/locker/open")
def locker_open():
    """Open the physical locker.

    Forwards to the Node.js Arduino bridge and long-polls until the hardware
    callback confirms the locker has opened.

    Returns:
        JSON: Result object returned by ``LockerController.request()``.
    """
    return jsonify(_locker.request("open"))


@app.post("/api/locker/close")
def locker_close():
    """Close the physical locker.

    Forwards to the Node.js Arduino bridge and long-polls until the hardware
    callback confirms the locker has closed.

    Returns:
        JSON: Result object returned by ``LockerController.request()``.
    """
    return jsonify(_locker.request("close"))


# ===========================================================================
# Error Handlers
# ===========================================================================

@app.errorhandler(404)
def not_found(_):
    """Handle 404 Not Found errors.

    API routes return a JSON error response; all other paths fall through
    to the SPA's ``index.html`` so the client-side router can render the
    correct view.

    Returns:
        JSON: ``{"error": "Not found"}`` with HTTP 404 for ``/api/`` paths.
        HTML: ``frontend/index.html`` for all other paths.
    """
    if request.path.startswith("/api/"):
        return jsonify(error="Not found"), 404
    return send_from_directory(str(STATIC_DIR), "index.html")


@app.errorhandler(500)
def server_error(_):
    """Handle 500 Internal Server Error responses.

    Returns:
        JSON: ``{"error": "Internal server error"}`` with HTTP 500.
    """
    return jsonify(error="Internal server error"), 500


# ===========================================================================
# Static / SPA Fallback
# ===========================================================================

@app.get("/")
@app.get("/<path:_path>")
def spa(_path: str = ""):
    """Serve the frontend Single-Page Application for all non-API routes.

    Any path that does not begin with ``/api/`` falls through to this
    handler, which always returns ``frontend/index.html`` so that the
    client-side router can handle the navigation.

    Args:
        _path: The URL path requested by the browser - unused server-side;
               routing is handled entirely by the frontend application.

    Returns:
        The contents of ``frontend/index.html``.
    """
    return send_from_directory(str(STATIC_DIR), "index.html")


# ===========================================================================
# Entry Point
# ===========================================================================

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    print(f"GrabIt Flask server listening on http://localhost:{port}")
    print("Run the Arduino bridge in a second terminal:  node bridge/arduino-bridge.js")
    app.run(host="0.0.0.0", port=port, threaded=True)
