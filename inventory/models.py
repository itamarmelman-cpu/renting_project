"""
inventory/models.py
-------------------
Pure-Python data models for the GrabIt renting system.
No SQL — all data lives in Python dicts and is persisted to JSON files.
"""

from __future__ import annotations
from dataclasses import dataclass, field, asdict
from typing import List


# ── Product ───────────────────────────────────────────────────────────────────

@dataclass
class Product:
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
        return asdict(self)


# ── Order line-item ───────────────────────────────────────────────────────────

@dataclass
class OrderItem:
    product_id: str
    quantity:   int
    rent_days:  int
    unit_price: float

    def to_dict(self) -> dict:
        return asdict(self)


# ── Order ─────────────────────────────────────────────────────────────────────

@dataclass
class Order:
    id:               str
    customer_name:    str
    payment_provider: str
    total:            float
    status:           str
    created_at:       str
    updated_at:       str
    items:            List[OrderItem] = field(default_factory=list)

    def to_dict(self) -> dict:
        d = asdict(self)
        # Expose camelCase aliases that the frontend expects
        d['customerName'] = d.pop('customer_name')
        d['provider']     = d.pop('payment_provider')
        d['createdAt']    = d.pop('created_at')
        d['updatedAt']    = d.pop('updated_at')
        for item in d['items']:
            item['productId'] = item.pop('product_id')
            item['rentDays']  = item.pop('rent_days')
            item['unitPrice'] = item.pop('unit_price')
        return d


# ── Reservation ───────────────────────────────────────────────────────────────

@dataclass
class ReservationItem:
    product_id: str
    quantity:   int

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class Reservation:
    id:            str
    customer_name: str
    status:        str   # 'active' | 'expired' | 'cancelled'
    created_at:    str
    expires_at:    str
    items:         List[ReservationItem] = field(default_factory=list)

    def to_dict(self) -> dict:
        return asdict(self)


# ── Return ────────────────────────────────────────────────────────────────────

@dataclass
class Return:
    id:           str
    first_name:   str
    last_name:    str
    product_id:   str
    product_name: str
    quantity:     int
    returned_at:  str

    def to_dict(self) -> dict:
        d = asdict(self)
        # camelCase aliases for the frontend
        d['firstName']   = d.pop('first_name')
        d['lastName']    = d.pop('last_name')
        d['productId']   = d.pop('product_id')
        d['productName'] = d.pop('product_name')
        d['createdAt']   = d.pop('returned_at')
        return d
