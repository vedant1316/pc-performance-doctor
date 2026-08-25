"""Storage models for PC Performance Doctor SQLite database.

Represents rows stored in metrics_snapshots, process_snapshots, and diagnoses tables
matching Section 6 of the project reference.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
import json
from typing import Any


@dataclass
class MetricsSnapshotRow:
    """Represents a single row from metrics_snapshots table."""

    id: int
    timestamp: str  # ISO 8601 UTC
    cpu_percent: float
    cpu_temp_c: float | None
    ram_percent: float
    ram_available_mb: int
    pagefile_percent: float | None
    disk_percent_busy: float
    disk_read_bps: int | None
    disk_write_bps: int | None
    gpu_percent: float | None
    gpu_temp_c: float | None
    gpu_vram_percent: float | None
    net_sent_bps: int | None
    net_recv_bps: int | None

    def to_dict(self) -> dict[str, Any]:
        """Convert snapshot row to standard dictionary."""
        return asdict(self)


@dataclass
class ProcessSnapshotRow:
    """Represents a single row from process_snapshots table."""

    id: int
    snapshot_id: int
    pid: int
    name: str
    cpu_percent: float | None
    ram_mb: int | None
    io_percent: float | None
    is_elevated: int = 0

    def to_dict(self) -> dict[str, Any]:
        """Convert process snapshot row to dictionary."""
        return asdict(self)


@dataclass
class DiagnosisRow:
    """Represents a single row from diagnoses table."""

    id: int
    snapshot_id: int
    timestamp: str  # ISO 8601 UTC
    label: str
    rule_id: str
    severity: str
    health_score: int
    contributing_processes: list[str] = field(default_factory=list)
    llm_summary: str | None = None
    llm_root_cause: str | None = None
    llm_fixes: list[dict[str, Any]] | None = None
    llm_expected_improvement: str | None = None
    llm_call_succeeded: int = 0

    def to_dict(self) -> dict[str, Any]:
        """Convert diagnosis row to standard dictionary with decoded JSON fields."""
        return {
            "id": self.id,
            "snapshot_id": self.snapshot_id,
            "timestamp": self.timestamp,
            "label": self.label,
            "rule_id": self.rule_id,
            "severity": self.severity,
            "health_score": self.health_score,
            "contributing_processes": self.contributing_processes,
            "llm_summary": self.llm_summary,
            "llm_root_cause": self.llm_root_cause,
            "llm_fixes": self.llm_fixes,
            "llm_expected_improvement": self.llm_expected_improvement,
            "llm_call_succeeded": bool(self.llm_call_succeeded),
        }

    @classmethod
    def from_row(cls, row: dict[str, Any] | tuple) -> DiagnosisRow:
        """Construct a DiagnosisRow parsing JSON fields safely."""
        if isinstance(row, dict):
            raw_procs = row.get("contributing_processes")
            raw_fixes = row.get("llm_fixes")
            procs = []
            if raw_procs:
                try:
                    procs = json.loads(raw_procs) if isinstance(raw_procs, str) else list(raw_procs)
                except Exception:
                    procs = []

            fixes = None
            if raw_fixes:
                try:
                    fixes = json.loads(raw_fixes) if isinstance(raw_fixes, str) else list(raw_fixes)
                except Exception:
                    fixes = None

            return cls(
                id=row["id"],
                snapshot_id=row["snapshot_id"],
                timestamp=row["timestamp"],
                label=row["label"],
                rule_id=row["rule_id"],
                severity=row["severity"],
                health_score=row["health_score"],
                contributing_processes=procs,
                llm_summary=row.get("llm_summary"),
                llm_root_cause=row.get("llm_root_cause"),
                llm_fixes=fixes,
                llm_expected_improvement=row.get("llm_expected_improvement"),
                llm_call_succeeded=int(row.get("llm_call_succeeded", 0)),
            )
        else:
            raise ValueError("Row must be dictionary-like.")
