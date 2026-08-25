"""SQLite Database Manager for PC Performance Doctor.

Implements schema creation, migrations, snapshot persistence, process snapshots,
diagnosis records, and timeline historical range queries strictly matching
Section 6 of the project reference.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
import json
import logging
import os
from pathlib import Path
import sqlite3
import threading
from typing import Any

from collectors import MetricsSnapshot
from config import settings
from diagnostics import Diagnosis
from .models import DiagnosisRow, MetricsSnapshotRow, ProcessSnapshotRow

logger = logging.getLogger(__name__)


SCHEMA_SQL = """
-- Raw metrics snapshots, one row per polling tick
CREATE TABLE IF NOT EXISTS metrics_snapshots (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp     TEXT NOT NULL,            -- ISO 8601 UTC
    cpu_percent   REAL NOT NULL,
    cpu_temp_c    REAL,                     -- nullable, not all systems expose this
    ram_percent   REAL NOT NULL,
    ram_available_mb INTEGER NOT NULL,
    pagefile_percent REAL,
    disk_percent_busy REAL NOT NULL,
    disk_read_bps INTEGER,
    disk_write_bps INTEGER,
    gpu_percent   REAL,
    gpu_temp_c    REAL,
    gpu_vram_percent REAL,
    net_sent_bps  INTEGER,
    net_recv_bps  INTEGER
);
CREATE INDEX IF NOT EXISTS idx_snapshots_timestamp ON metrics_snapshots(timestamp);

-- Per-process breakdown tied to a snapshot (top N processes by resource use)
CREATE TABLE IF NOT EXISTS process_snapshots (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    snapshot_id   INTEGER NOT NULL REFERENCES metrics_snapshots(id) ON DELETE CASCADE,
    pid           INTEGER NOT NULL,
    name          TEXT NOT NULL,
    cpu_percent   REAL,
    ram_mb        INTEGER,
    io_percent    REAL,
    is_elevated   INTEGER DEFAULT 0         -- 1 if admin-required data was available
);
CREATE INDEX IF NOT EXISTS idx_process_snapshot_id ON process_snapshots(snapshot_id);

-- Diagnosis results (one per "Diagnose My PC" run, or periodic auto-run)
CREATE TABLE IF NOT EXISTS diagnoses (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    snapshot_id       INTEGER NOT NULL REFERENCES metrics_snapshots(id) ON DELETE CASCADE,
    timestamp         TEXT NOT NULL,
    label             TEXT NOT NULL,        -- e.g. "memory_pressure"
    rule_id           TEXT NOT NULL,        -- which rule fired (rules.yaml id)
    severity          TEXT NOT NULL,        -- low | medium | high
    health_score      INTEGER NOT NULL,     -- 0-100, from rules engine alone
    contributing_processes TEXT,            -- JSON array of pids/names
    llm_summary       TEXT,                 -- nullable — filled if LLM call succeeded
    llm_root_cause    TEXT,
    llm_fixes         TEXT,                 -- JSON array
    llm_expected_improvement TEXT,
    llm_call_succeeded INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_diagnoses_timestamp ON diagnoses(timestamp);

-- Internal schema version tracking
CREATE TABLE IF NOT EXISTS schema_migrations (
    version       INTEGER PRIMARY KEY,
    applied_at    TEXT NOT NULL
);
"""


class DatabaseManager:
    """Thread-safe SQLite database manager for metrics and diagnosis persistence."""

    def __init__(self, db_path: str | Path | None = None) -> None:
        self.db_path_str = str(db_path or settings.SQLITE_PATH)
        self.db_path = self._resolve_db_path(self.db_path_str)
        self._lock = threading.Lock()
        self._conn: sqlite3.Connection | None = None
        self._initialize()

    def _resolve_db_path(self, path_str: str) -> str:
        """Resolve database path, creating parent directory if on disk."""
        if path_str == ":memory:":
            return ":memory:"

        p = Path(path_str)
        if not p.is_absolute():
            # Resolve relative to repo root (parent of agent)
            repo_root = Path(__file__).resolve().parent.parent.parent
            resolved = (repo_root / p).resolve()
        else:
            resolved = p.resolve()

        resolved.parent.mkdir(parents=True, exist_ok=True)
        return str(resolved)

    def _get_connection(self) -> sqlite3.Connection:
        """Get or create the SQLite connection."""
        if self._conn is None:
            self._conn = sqlite3.connect(
                self.db_path,
                check_same_thread=False,
                timeout=10.0,
            )
            self._conn.row_factory = sqlite3.Row
            # Enable foreign keys and WAL mode if on disk
            with self._conn:
                self._conn.execute("PRAGMA foreign_keys = ON;")
                if self.db_path != ":memory:":
                    self._conn.execute("PRAGMA journal_mode = WAL;")
        return self._conn

    def _initialize(self) -> None:
        """Create database tables and apply initial schema."""
        with self._lock:
            conn = self._get_connection()
            with conn:
                conn.executescript(SCHEMA_SQL)
                # Check migration version
                cur = conn.execute("SELECT MAX(version) FROM schema_migrations")
                row = cur.fetchone()
                current_ver = row[0] if row and row[0] is not None else 0
                if current_ver < 1:
                    now_iso = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
                    conn.execute(
                        "INSERT OR IGNORE INTO schema_migrations (version, applied_at) VALUES (?, ?)",
                        (1, now_iso),
                    )
            logger.info("SQLite database initialized at: %s", self.db_path)

    def save_snapshot(self, snapshot: MetricsSnapshot | dict[str, Any]) -> int:
        """Persist a single metrics snapshot to SQLite.

        Returns:
            int: The generated snapshot_id (primary key).
        """
        if isinstance(snapshot, MetricsSnapshot):
            data = {
                "timestamp": snapshot.timestamp,
                "cpu_percent": snapshot.cpu_percent,
                "cpu_temp_c": snapshot.cpu_temp_c,
                "ram_percent": snapshot.ram_percent,
                "ram_available_mb": snapshot.ram_available_mb,
                "pagefile_percent": snapshot.pagefile_percent,
                "disk_percent_busy": snapshot.disk_percent_busy,
                "disk_read_bps": snapshot.disk_read_bps,
                "disk_write_bps": snapshot.disk_write_bps,
                "gpu_percent": snapshot.gpu_percent,
                "gpu_temp_c": snapshot.gpu_temp_c,
                "gpu_vram_percent": snapshot.gpu_vram_percent,
                "net_sent_bps": snapshot.net_sent_bps,
                "net_recv_bps": snapshot.net_recv_bps,
            }
        else:
            data = {
                "timestamp": snapshot.get("timestamp") or datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
                "cpu_percent": float(snapshot.get("cpu_percent", 0.0)),
                "cpu_temp_c": snapshot.get("cpu_temp_c"),
                "ram_percent": float(snapshot.get("ram_percent", 0.0)),
                "ram_available_mb": int(snapshot.get("ram_available_mb", 0)),
                "pagefile_percent": snapshot.get("pagefile_percent"),
                "disk_percent_busy": float(snapshot.get("disk_percent_busy", 0.0)),
                "disk_read_bps": snapshot.get("disk_read_bps"),
                "disk_write_bps": snapshot.get("disk_write_bps"),
                "gpu_percent": snapshot.get("gpu_percent"),
                "gpu_temp_c": snapshot.get("gpu_temp_c"),
                "gpu_vram_percent": snapshot.get("gpu_vram_percent"),
                "net_sent_bps": snapshot.get("net_sent_bps"),
                "net_recv_bps": snapshot.get("net_recv_bps"),
            }

        sql = """
        INSERT INTO metrics_snapshots (
            timestamp, cpu_percent, cpu_temp_c, ram_percent, ram_available_mb,
            pagefile_percent, disk_percent_busy, disk_read_bps, disk_write_bps,
            gpu_percent, gpu_temp_c, gpu_vram_percent, net_sent_bps, net_recv_bps
        ) VALUES (
            :timestamp, :cpu_percent, :cpu_temp_c, :ram_percent, :ram_available_mb,
            :pagefile_percent, :disk_percent_busy, :disk_read_bps, :disk_write_bps,
            :gpu_percent, :gpu_temp_c, :gpu_vram_percent, :net_sent_bps, :net_recv_bps
        );
        """
        with self._lock:
            conn = self._get_connection()
            with conn:
                cur = conn.execute(sql, data)
                return cur.lastrowid

    def save_process_snapshots(
        self, snapshot_id: int, processes: list[dict[str, Any]]
    ) -> None:
        """Persist process breakdown items associated with a snapshot."""
        if not processes:
            return

        rows = []
        for p in processes:
            rows.append((
                snapshot_id,
                int(p.get("pid", 0)),
                str(p.get("name", "Unknown")),
                p.get("cpu_percent"),
                int(p.get("ram_mb", 0)) if p.get("ram_mb") is not None else None,
                p.get("io_percent", 0.0),
                int(p.get("is_elevated", 0)),
            ))

        sql = """
        INSERT INTO process_snapshots (
            snapshot_id, pid, name, cpu_percent, ram_mb, io_percent, is_elevated
        ) VALUES (?, ?, ?, ?, ?, ?, ?);
        """
        with self._lock:
            conn = self._get_connection()
            with conn:
                conn.executemany(sql, rows)

    def save_diagnosis(
        self,
        snapshot_id: int,
        diagnosis: Diagnosis | dict[str, Any],
        timestamp: str | None = None,
    ) -> int:
        """Persist a diagnosis result record to SQLite.

        Returns:
            int: The generated diagnosis record id.
        """
        now_iso = timestamp or datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

        if isinstance(diagnosis, Diagnosis):
            label = diagnosis.label
            rule_id = diagnosis.rule_id
            severity = diagnosis.severity
            health_score = diagnosis.health_score
            contributing = json.dumps(diagnosis.contributing_processes)
            llm_summary = None
            llm_root_cause = None
            llm_fixes = None
            llm_expected_improvement = None
            llm_call_succeeded = 0
        else:
            diag_inner = diagnosis.get("diagnosis", diagnosis)
            label = diag_inner.get("label", "nominal")
            rule_id = diag_inner.get("rule_id", "nominal")
            severity = diag_inner.get("severity", "none")
            health_score = int(diag_inner.get("health_score", 100))
            procs = diag_inner.get("contributing_processes", [])
            contributing = json.dumps(procs) if isinstance(procs, list) else str(procs)

            expl = diagnosis.get("explanation")
            llm_summary = expl.get("summary") if expl else None
            llm_root_cause = expl.get("root_cause") if expl else None
            llm_fixes = json.dumps(expl.get("fixes")) if expl and "fixes" in expl else None
            llm_expected_improvement = expl.get("expected_improvement") if expl else None
            llm_call_succeeded = 1 if diagnosis.get("llm_call_succeeded") else 0

        sql = """
        INSERT INTO diagnoses (
            snapshot_id, timestamp, label, rule_id, severity, health_score,
            contributing_processes, llm_summary, llm_root_cause, llm_fixes,
            llm_expected_improvement, llm_call_succeeded
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        """
        with self._lock:
            conn = self._get_connection()
            with conn:
                cur = conn.execute(
                    sql,
                    (
                        snapshot_id,
                        now_iso,
                        label,
                        rule_id,
                        severity,
                        health_score,
                        contributing,
                        llm_summary,
                        llm_root_cause,
                        llm_fixes,
                        llm_expected_improvement,
                        llm_call_succeeded,
                    ),
                )
                return cur.lastrowid

    def update_diagnosis_explanation(
        self,
        diagnosis_id: int,
        explanation: dict[str, Any] | None,
        llm_call_succeeded: bool = True,
    ) -> bool:
        """Update a diagnosis record with the AI explanation and success status.

        Args:
            diagnosis_id: The primary key of the diagnosis record.
            explanation: The validated explanation dictionary (or None).
            llm_call_succeeded: Whether the LLM call succeeded.

        Returns:
            bool: True if row was updated, False otherwise.
        """
        llm_summary = explanation.get("summary") if explanation else None
        llm_root_cause = explanation.get("root_cause") if explanation else None
        llm_fixes = (
            json.dumps(explanation.get("fixes"))
            if explanation and "fixes" in explanation
            else None
        )
        llm_expected_improvement = (
            explanation.get("expected_improvement") if explanation else None
        )
        succeeded_int = 1 if llm_call_succeeded else 0

        sql = """
        UPDATE diagnoses
        SET llm_summary = ?,
            llm_root_cause = ?,
            llm_fixes = ?,
            llm_expected_improvement = ?,
            llm_call_succeeded = ?
        WHERE id = ?;
        """
        with self._lock:
            conn = self._get_connection()
            with conn:
                cur = conn.execute(
                    sql,
                    (
                        llm_summary,
                        llm_root_cause,
                        llm_fixes,
                        llm_expected_improvement,
                        succeeded_int,
                        diagnosis_id,
                    ),
                )
                return cur.rowcount > 0

    def query_timeline(
        self,
        start_iso: str | None = None,
        end_iso: str | None = None,
        limit: int = 1500,
    ) -> dict[str, list[dict[str, Any]]]:
        """Query historical metrics snapshots and diagnoses between start_iso and end_iso.

        Returns:
            dict with 'snapshots' and 'diagnoses' lists matching Section 10 contract.
        """
        params_snapshots: list[Any] = []
        params_diagnoses: list[Any] = []

        where_snapshots = []
        where_diagnoses = []

        if start_iso:
            where_snapshots.append("timestamp >= ?")
            params_snapshots.append(start_iso)
            where_diagnoses.append("timestamp >= ?")
            params_diagnoses.append(start_iso)

        if end_iso:
            where_snapshots.append("timestamp <= ?")
            params_snapshots.append(end_iso)
            where_diagnoses.append("timestamp <= ?")
            params_diagnoses.append(end_iso)

        clause_snap = f"WHERE {' AND '.join(where_snapshots)}" if where_snapshots else ""
        clause_diag = f"WHERE {' AND '.join(where_diagnoses)}" if where_diagnoses else ""

        sql_snapshots = f"""
        SELECT * FROM metrics_snapshots
        {clause_snap}
        ORDER BY timestamp ASC
        LIMIT ?;
        """
        params_snapshots.append(limit)

        sql_diagnoses = f"""
        SELECT * FROM diagnoses
        {clause_diag}
        ORDER BY timestamp ASC
        LIMIT ?;
        """
        params_diagnoses.append(limit)

        with self._lock:
            conn = self._get_connection()
            cur_snap = conn.execute(sql_snapshots, params_snapshots)
            raw_snaps = cur_snap.fetchall()

            cur_diag = conn.execute(sql_diagnoses, params_diagnoses)
            raw_diags = cur_diag.fetchall()

        snapshot_rows = [
            MetricsSnapshotRow(
                id=r["id"],
                timestamp=r["timestamp"],
                cpu_percent=r["cpu_percent"],
                cpu_temp_c=r["cpu_temp_c"],
                ram_percent=r["ram_percent"],
                ram_available_mb=r["ram_available_mb"],
                pagefile_percent=r["pagefile_percent"],
                disk_percent_busy=r["disk_percent_busy"],
                disk_read_bps=r["disk_read_bps"],
                disk_write_bps=r["disk_write_bps"],
                gpu_percent=r["gpu_percent"],
                gpu_temp_c=r["gpu_temp_c"],
                gpu_vram_percent=r["gpu_vram_percent"],
                net_sent_bps=r["net_sent_bps"],
                net_recv_bps=r["net_recv_bps"],
            ).to_dict()
            for r in raw_snaps
        ]

        diagnosis_rows = [
            DiagnosisRow.from_row(dict(r)).to_dict()
            for r in raw_diags
        ]

        return {
            "snapshots": snapshot_rows,
            "diagnoses": diagnosis_rows,
        }

    def prune_old_snapshots(self, retention_days: int | None = None) -> int:
        """Prune records older than retention_days (defaults to settings.SNAPSHOT_RETENTION_DAYS).

        Returns:
            int: Number of deleted snapshot rows.
        """
        days = retention_days if retention_days is not None else settings.SNAPSHOT_RETENTION_DAYS
        cutoff_dt = datetime.now(timezone.utc) - timedelta(days=days)
        cutoff_iso = cutoff_dt.isoformat().replace("+00:00", "Z")

        with self._lock:
            conn = self._get_connection()
            with conn:
                cur = conn.execute("DELETE FROM metrics_snapshots WHERE timestamp < ?", (cutoff_iso,))
                deleted = cur.rowcount
                logger.info("Pruned %d historical snapshots older than %s", deleted, cutoff_iso)
                return deleted

    def close(self) -> None:
        """Close the SQLite database connection."""
        with self._lock:
            if self._conn is not None:
                self._conn.close()
                self._conn = None
                logger.info("Closed SQLite connection.")


_default_db: DatabaseManager | None = None


def get_db() -> DatabaseManager:
    """Get or initialize singleton DatabaseManager instance."""
    global _default_db
    if _default_db is None:
        _default_db = DatabaseManager()
    return _default_db
