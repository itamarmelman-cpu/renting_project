"""
dashboard/routes.py
-------------------
Flask Blueprint for the admin/association-facing API endpoints:
  GET  /api/stats
  GET  /api/orders
  GET  /api/orders/<id>
  PATCH /api/orders/<id>
  GET  /api/returns
  GET  /api/active-rentals

All business logic is delegated to inventory.database.Database.
"""

from flask import Blueprint, jsonify, request, session
from inventory.database import Database
from dashboard.stats import compute_stats

dashboard_bp = Blueprint("dashboard", __name__)


def _db() -> Database:
    return Database.get_instance()


@dashboard_bp.before_request
def _require_admin():
    """Reject any request to the dashboard blueprint that lacks an admin session."""
    if not session.get("is_admin"):
        return jsonify(error="Unauthorized"), 401


# ── Stats ─────────────────────────────────────────────────────────────────────

@dashboard_bp.get("/api/stats")
def stats():
    return jsonify(compute_stats(_db()))


# ── Orders ────────────────────────────────────────────────────────────────────

@dashboard_bp.get("/api/orders")
def list_orders():
    return jsonify(_db().get_all_orders())


@dashboard_bp.get("/api/orders/<order_id>")
def get_order(order_id: str):
    order = _db().get_order(order_id)
    if order is None:
        return jsonify(error="Order not found"), 404
    return jsonify(order)


@dashboard_bp.patch("/api/orders/<order_id>")
def patch_order(order_id: str):
    body   = request.get_json() or {}
    status = body.get("status")
    if status is None:
        return jsonify(error="Missing 'status' field"), 400
    updated = _db().update_order_status(order_id, status)
    if updated is None:
        return jsonify(error="Order not found"), 404
    return jsonify(ok=True, order=updated)


# ── Returns ───────────────────────────────────────────────────────────────────

@dashboard_bp.get("/api/returns")
def list_returns():
    return jsonify(_db().get_all_returns())


@dashboard_bp.get("/api/active-rentals")
def active_rentals():
    return jsonify(_db().get_active_rentals())


# ── Reservations ──────────────────────────────────────────────────────────────

@dashboard_bp.get("/api/reservations")
def list_reservations():
    """Return all reservations (newest first), auto-expiring stale ones."""
    return jsonify(_db().get_all_reservations())


@dashboard_bp.delete("/api/reservations/<reservation_id>")
def cancel_reservation(reservation_id: str):
    """Admin: cancel an active reservation and restore its stock."""
    result = _db().cancel_reservation(reservation_id)
    if not result.get("ok"):
        return jsonify(result), 404
    return jsonify(result)
