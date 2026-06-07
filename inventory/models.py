"""
===========================================================================
inventory/models.py  -  GrabIt Renting System
===========================================================================
Pure-Python data models for the GrabIt renting system.
No SQL - all data lives in Python dicts and is persisted to JSON files.
"""

from __future__ import annotations
from dataclasses import dataclass, field, asdict
from typing import List


# =============================================================================
# Product
# =============================================================================

@dataclass
class Product:
    """A single item in the rental/purchase catalogue.

    Attributes:
        id:             Unique identifier (e.g. ``p001``).
        name:           Human-readable display name.
        description:    Short description shown in the UI.
        type:           ``"rent"`` for rentable items, ``"buy"`` for purchase-only.
        price:          Unit price (per day for rentals, flat for purchases).
        stock:          Number of units currently available.
        visual:         Emoji or icon character used in the UI (optional).
        image:          URL or path to a product image (optional).
        search_terms:   Space-separated lowercase keywords for search (optional).
        category_label: Localised category label shown in the UI (optional).
        rent_label:     Localised rental-period label, e.g. ``"ליום"`` (optional).
    """

    id:             str
    name:           str
    description:    str
    type:           str          # 'rent' | 'buy'
    price:          float
    stock:          int
    visual:         str  = ''
    image:          str  = ''
    search_terms:   str  = ''
    category_label: str  = ''
    rent_label:     str  = ''

    def to_dict(self) -> dict:
        """Serialise the product to a plain dict suitable for JSON persistence.

        Returns:
            Dict with all fields using their original snake_case names.
        """
        return asdict(self)


# =============================================================================
# Order line-item
# =============================================================================

@dataclass
class OrderItem:
    """A single line item within an order.

    Attributes:
        product_id: Reference to the rented/purchased product.
        quantity:   Number of units in this line item.
        rent_days:  Duration of the rental in days (1 for purchases).
        unit_price: Price per unit per day at the time of order creation.
    """

    product_id: str
    quantity:   int
    rent_days:  int
    unit_price: float

    def to_dict(self) -> dict:
        """Serialise the order item to a plain dict suitable for JSON persistence.

        Returns:
            Dict with all fields using their original snake_case names.
        """
        return asdict(self)


# =============================================================================
# Order
# =============================================================================

@dataclass
class Order:
    """A completed rental or purchase transaction.

    Attributes:
        id:               Unique order identifier (e.g. ``ord_0001``).
        customer_name:    Full name of the customer who placed the order.
        payment_provider: Label of the payment method used (e.g. ``"Apple Pay"``).
        total:            Total cost of the order in the store's currency.
        status:           Current lifecycle state (e.g. ``"completed"``).
        created_at:       ISO-8601 UTC timestamp of order creation.
        updated_at:       ISO-8601 UTC timestamp of the last status change.
        items:            Line items included in this order.
    """

    id:               str
    customer_name:    str
    payment_provider: str
    total:            float
    status:           str
    created_at:       str
    updated_at:       str
    items:            List[OrderItem] = field(default_factory=list)

    def to_dict(self) -> dict:
        """Serialise the order to a camelCase dict for the frontend API.

        Renames snake_case keys to the camelCase equivalents the frontend
        expects: ``customer_name`` → ``customerName``,
        ``payment_provider`` → ``provider``, ``created_at`` → ``createdAt``,
        ``updated_at`` → ``updatedAt``, and the same for each item's fields.

        Returns:
            Dict with camelCase keys ready to be JSON-serialised.
        """
        d = asdict(self)
        d['customerName'] = d.pop('customer_name')
        d['provider']     = d.pop('payment_provider')
        d['createdAt']    = d.pop('created_at')
        d['updatedAt']    = d.pop('updated_at')
        for item in d['items']:
            item['productId'] = item.pop('product_id')
            item['rentDays']  = item.pop('rent_days')
            item['unitPrice'] = item.pop('unit_price')
        return d


# =============================================================================
# Reservation
# =============================================================================

@dataclass
class ReservationItem:
    """A single product entry within a reservation.

    Attributes:
        product_id: Reference to the reserved product.
        quantity:   Number of units being held.
    """

    product_id: str
    quantity:   int

    def to_dict(self) -> dict:
        """Serialise the reservation item to a plain dict for JSON persistence.

        Returns:
            Dict with all fields using their original snake_case names.
        """
        return asdict(self)


@dataclass
class Reservation:
    """An advance reservation that holds stock for a customer for up to 5 days.

    Attributes:
        id:            Unique reservation identifier (e.g. ``res_0001``).
        customer_name: Full name of the student who made the reservation.
        status:        Lifecycle state: ``"active"``, ``"expired"``,
                       ``"cancelled"``, or ``"collected"``.
        created_at:    ISO-8601 UTC timestamp of reservation creation.
        expires_at:    ISO-8601 UTC timestamp after which the reservation
                       is automatically expired and stock restored.
        items:         Products being held by this reservation.
    """

    id:            str
    customer_name: str
    status:        str   # 'active' | 'expired' | 'cancelled' | 'collected'
    created_at:    str
    expires_at:    str
    items:         List[ReservationItem] = field(default_factory=list)

    def to_dict(self) -> dict:
        """Serialise the reservation to a plain dict for JSON persistence.

        Returns:
            Dict with all fields using their original snake_case names.
        """
        return asdict(self)


# =============================================================================
# Return
# =============================================================================

@dataclass
class Return:
    """A record of a customer returning one or more units of a rented product.

    Attributes:
        id:           Unique return identifier (e.g. ``ret_1717000000000_p001``).
        first_name:   Customer's first name.
        last_name:    Customer's last name.
        product_id:   Reference to the returned product.
        product_name: Human-readable product name at the time of return.
        quantity:     Number of units returned in this record.
        returned_at:  ISO-8601 UTC timestamp of the return.
    """

    id:           str
    first_name:   str
    last_name:    str
    product_id:   str
    product_name: str
    quantity:     int
    returned_at:  str

    def to_dict(self) -> dict:
        """Serialise the return record to a camelCase dict for the frontend API.

        Renames snake_case keys to the camelCase equivalents the frontend
        expects: ``first_name`` → ``firstName``, ``last_name`` → ``lastName``,
        ``product_id`` → ``productId``, ``product_name`` → ``productName``,
        and ``returned_at`` → ``createdAt``.

        Returns:
            Dict with camelCase keys ready to be JSON-serialised.
        """
        d = asdict(self)
        d['firstName']   = d.pop('first_name')
        d['lastName']    = d.pop('last_name')
        d['productId']   = d.pop('product_id')
        d['productName'] = d.pop('product_name')
        d['createdAt']   = d.pop('returned_at')
        return d
