"""Storage package for PC Performance Doctor.

Exposes SQLite DatabaseManager, data models, and persistence helpers for
metrics snapshots, process breakdowns, diagnoses, and timeline history.
"""

from __future__ import annotations

from .db import (
    DatabaseManager,
    get_db,
)
from .models import (
    DiagnosisRow,
    MetricsSnapshotRow,
    ProcessSnapshotRow,
)

__all__ = [
    "DatabaseManager",
    "DiagnosisRow",
    "MetricsSnapshotRow",
    "ProcessSnapshotRow",
    "get_db",
]
