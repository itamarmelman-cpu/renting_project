"""
===========================================================================
dashboard/stats.py  -  GrabIt Renting System
===========================================================================
Statistics aggregation for the admin dashboard.
Reads exclusively from the Database singleton - no direct file access.
"""

from __future__ import annotations
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from inventory.database import Database


def compute_stats(db: "Database") -> dict:
    """
    Return all KPI metrics used by the admin summary page.
    Delegates entirely to the Database singleton for data access.
    """
    return db.get_stats()
