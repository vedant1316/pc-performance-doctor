"""Test suite for Phase 4 SQLite Persistence & Historical Timeline.

Tests database initialization, schema creation, metrics snapshots persistence,
process breakdowns, diagnosis records, timeline time-range queries,
database reopen/restart durability, and WebSocket timeline_query RPC integration.
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone
import json
from pathlib import Path
import tempfile
import pytest
import websockets

from collectors import MetricsSnapshot
from diagnostics import Diagnosis
from server.ws_server import AgentWebSocketServer
from storage import DatabaseManager, MetricsSnapshotRow, DiagnosisRow


def make_snapshot(
    ts: str | None = None,
    cpu_percent: float = 25.0,
    ram_percent: float = 45.0,
    ram_available_mb: int = 8192,
    disk_percent_busy: float = 10.0,
    gpu_percent: float | None = 15.0,
    net_sent_bps: int = 50000,
    net_recv_bps: int = 100000,
    top_processes: list[dict] | None = None,
) -> MetricsSnapshot:
    """Helper to create a test MetricsSnapshot."""
    timestamp = ts or datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    top_procs = top_processes if top_processes is not None else [
        {"pid": 101, "name": "system.exe", "cpu_percent": 2.5, "ram_mb": 120.0, "io_percent": 0.0, "is_elevated": 1},
        {"pid": 102, "name": "app.exe", "cpu_percent": 5.0, "ram_mb": 350.0, "io_percent": 1.2, "is_elevated": 0},
    ]

    return MetricsSnapshot(
        timestamp=timestamp,
        cpu_percent=cpu_percent,
        cpu_temp_c=55.0,
        ram_percent=ram_percent,
        ram_available_mb=ram_available_mb,
        pagefile_percent=15.0,
        disk_percent_busy=disk_percent_busy,
        disk_read_bps=1024,
        disk_write_bps=2048,
        gpu_percent=gpu_percent,
        gpu_temp_c=50.0,
        gpu_vram_percent=20.0,
        gpu_name="Test GPU",
        net_sent_bps=net_sent_bps,
        net_recv_bps=net_recv_bps,
        top_processes=top_procs,
    )


def test_database_initialization_and_schema():
    """Verify SQLite database creates all required tables, indexes, and versioning."""
    db = DatabaseManager(db_path=":memory:")
    conn = db._get_connection()

    # Verify tables
    tables = [
        row[0]
        for row in conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table';"
        ).fetchall()
    ]
    assert "metrics_snapshots" in tables
    assert "process_snapshots" in tables
    assert "diagnoses" in tables
    assert "schema_migrations" in tables

    # Verify index creation
    indexes = [
        row[0]
        for row in conn.execute(
            "SELECT name FROM sqlite_master WHERE type='index';"
        ).fetchall()
    ]
    assert "idx_snapshots_timestamp" in indexes
    assert "idx_process_snapshot_id" in indexes
    assert "idx_diagnoses_timestamp" in indexes

    # Verify migration version
    ver_row = conn.execute("SELECT MAX(version) FROM schema_migrations;").fetchone()
    assert ver_row[0] == 1
    db.close()


def test_save_snapshot_and_process_snapshots():
    """Verify inserting metrics_snapshots and associated process_snapshots."""
    db = DatabaseManager(db_path=":memory:")
    snap = make_snapshot()

    snapshot_id = db.save_snapshot(snap)
    assert snapshot_id is not None
    assert snapshot_id > 0

    db.save_process_snapshots(snapshot_id, snap.top_processes)

    # Query back snapshot
    res = db.query_timeline()
    assert len(res["snapshots"]) == 1
    stored = res["snapshots"][0]
    assert stored["id"] == snapshot_id
    assert stored["cpu_percent"] == snap.cpu_percent
    assert stored["ram_percent"] == snap.ram_percent
    assert stored["ram_available_mb"] == snap.ram_available_mb
    assert stored["disk_percent_busy"] == snap.disk_percent_busy
    assert stored["net_sent_bps"] == snap.net_sent_bps

    # Direct check of process_snapshots
    conn = db._get_connection()
    proc_rows = conn.execute(
        "SELECT * FROM process_snapshots WHERE snapshot_id = ?", (snapshot_id,)
    ).fetchall()
    assert len(proc_rows) == 2
    assert proc_rows[0]["name"] == "system.exe"
    assert proc_rows[1]["name"] == "app.exe"
    db.close()


def test_save_diagnosis_and_deserialization():
    """Verify persisting and querying diagnosis records with contributing processes JSON."""
    db = DatabaseManager(db_path=":memory:")
    snap = make_snapshot()
    snapshot_id = db.save_snapshot(snap)

    diag = Diagnosis(
        label="memory_pressure",
        rule_id="memory_pressure",
        severity="high",
        health_score=60,
        contributing_processes=["chrome.exe", "slack.exe"],
        rule_description="RAM is critically high and swapping to disk.",
    )

    diag_id = db.save_diagnosis(snapshot_id, diag)
    assert diag_id is not None
    assert diag_id > 0

    # Query back
    res = db.query_timeline()
    assert len(res["diagnoses"]) == 1
    stored = res["diagnoses"][0]
    assert stored["id"] == diag_id
    assert stored["snapshot_id"] == snapshot_id
    assert stored["label"] == "memory_pressure"
    assert stored["rule_id"] == "memory_pressure"
    assert stored["severity"] == "high"
    assert stored["health_score"] == 60
    assert stored["contributing_processes"] == ["chrome.exe", "slack.exe"]
    assert stored["llm_call_succeeded"] is False
    db.close()


def test_query_timeline_range_filtering():
    """Verify timeline query filters accurately by start and end timestamps."""
    db = DatabaseManager(db_path=":memory:")

    # Create snapshots at T0, T+30m, T+60m, T+90m
    t0 = datetime(2026, 8, 25, 10, 0, 0, tzinfo=timezone.utc)
    t1 = t0 + timedelta(minutes=30)
    t2 = t0 + timedelta(minutes=60)
    t3 = t0 + timedelta(minutes=90)

    s0_id = db.save_snapshot(make_snapshot(ts=t0.isoformat().replace("+00:00", "Z"), cpu_percent=10.0))
    s1_id = db.save_snapshot(make_snapshot(ts=t1.isoformat().replace("+00:00", "Z"), cpu_percent=20.0))
    s2_id = db.save_snapshot(make_snapshot(ts=t2.isoformat().replace("+00:00", "Z"), cpu_percent=30.0))
    s3_id = db.save_snapshot(make_snapshot(ts=t3.isoformat().replace("+00:00", "Z"), cpu_percent=40.0))

    diag = Diagnosis(label="nominal", rule_id="nominal", severity="none", health_score=100)
    db.save_diagnosis(s1_id, diag, timestamp=t1.isoformat().replace("+00:00", "Z"))
    db.save_diagnosis(s3_id, diag, timestamp=t3.isoformat().replace("+00:00", "Z"))

    # Query range between 10:15 and 11:15 (should match s1 and s2 only)
    start_q = (t0 + timedelta(minutes=15)).isoformat().replace("+00:00", "Z")
    end_q = (t0 + timedelta(minutes=75)).isoformat().replace("+00:00", "Z")

    res = db.query_timeline(start_iso=start_q, end_iso=end_q)
    assert len(res["snapshots"]) == 2
    assert [s["id"] for s in res["snapshots"]] == [s1_id, s2_id]
    assert len(res["diagnoses"]) == 1
    assert res["diagnoses"][0]["snapshot_id"] == s1_id

    # Query all
    all_res = db.query_timeline()
    assert len(all_res["snapshots"]) == 4
    assert len(all_res["diagnoses"]) == 2
    db.close()


def test_query_timeline_empty():
    """Verify querying an empty database or non-matching time range returns empty lists."""
    db = DatabaseManager(db_path=":memory:")
    res = db.query_timeline(start_iso="2020-01-01T00:00:00Z", end_iso="2020-01-02T00:00:00Z")
    assert res["snapshots"] == []
    assert res["diagnoses"] == []
    db.close()


def test_database_restart_and_durability():
    """Verify SQLite persistence across connection close and re-initialization on disk."""
    with tempfile.TemporaryDirectory() as tmpdir:
        db_file = Path(tmpdir) / "test_perf.db"

        # 1. First session
        db1 = DatabaseManager(db_path=db_file)
        s_id = db1.save_snapshot(make_snapshot(cpu_percent=42.0))
        diag = Diagnosis(
            label="gpu_bound",
            rule_id="gpu_bound",
            severity="low",
            health_score=90,
            contributing_processes=["game.exe"],
        )
        db1.save_diagnosis(s_id, diag)
        db1.close()

        # 2. Second session (simulating app restart)
        db2 = DatabaseManager(db_path=db_file)
        res = db2.query_timeline()
        assert len(res["snapshots"]) == 1
        assert res["snapshots"][0]["cpu_percent"] == 42.0
        assert len(res["diagnoses"]) == 1
        assert res["diagnoses"][0]["label"] == "gpu_bound"
        assert res["diagnoses"][0]["contributing_processes"] == ["game.exe"]
        db2.close()


def test_prune_old_snapshots():
    """Verify pruning snapshots older than retention threshold."""
    db = DatabaseManager(db_path=":memory:")
    now = datetime.now(timezone.utc)
    old_ts = (now - timedelta(days=20)).isoformat().replace("+00:00", "Z")
    new_ts = now.isoformat().replace("+00:00", "Z")

    db.save_snapshot(make_snapshot(ts=old_ts, cpu_percent=10.0))
    db.save_snapshot(make_snapshot(ts=new_ts, cpu_percent=90.0))

    assert len(db.query_timeline()["snapshots"]) == 2

    # Prune with 14-day retention
    deleted = db.prune_old_snapshots(retention_days=14)
    assert deleted == 1

    remaining = db.query_timeline()["snapshots"]
    assert len(remaining) == 1
    assert remaining[0]["cpu_percent"] == 90.0
    db.close()


@pytest.mark.asyncio
async def test_websocket_timeline_query_flow():
    """Integration test: connect to WebSocket server, query timeline, receive historical data."""
    test_port = 8792
    with tempfile.TemporaryDirectory() as tmpdir:
        db_file = Path(tmpdir) / "ws_test.db"
        db = DatabaseManager(db_path=db_file)

        # Pre-seed historical snapshot and diagnosis
        s_id = db.save_snapshot(make_snapshot(cpu_percent=33.3))
        diag = Diagnosis(
            label="nominal",
            rule_id="nominal",
            severity="none",
            health_score=100,
            contributing_processes=[],
        )
        db.save_diagnosis(s_id, diag)

        server = AgentWebSocketServer(
            host="127.0.0.1",
            port=test_port,
            polling_interval_ms=300,
            db=db,
        )
        server._last_snapshot = make_snapshot()
        await server.start()

        try:
            uri = f"ws://127.0.0.1:{test_port}"
            async with websockets.connect(uri) as ws:
                # 1. Read initial status/tick
                await asyncio.wait_for(ws.recv(), timeout=4.0)

                # 2. Send timeline_query
                query_msg = {"type": "timeline_query", "start": "", "end": ""}
                await ws.send(json.dumps(query_msg))

                # 3. Read until timeline_result arrives
                timeline_resp = None
                for _ in range(5):
                    raw = await asyncio.wait_for(ws.recv(), timeout=4.0)
                    data = json.loads(raw)
                    if data.get("type") == "timeline_result":
                        timeline_resp = data
                        break

                assert timeline_resp is not None
                assert timeline_resp["type"] == "timeline_result"
                assert "snapshots" in timeline_resp
                assert "diagnoses" in timeline_resp
                assert len(timeline_resp["snapshots"]) >= 1
                assert len(timeline_resp["diagnoses"]) >= 1
                assert timeline_resp["snapshots"][0]["cpu_percent"] == 33.3
        finally:
            await server.stop()
