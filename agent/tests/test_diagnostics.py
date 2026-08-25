"""Test suite for Phase 3 Diagnostic Engine.

Tests declarative rule loading, condition evaluation, priority ordering,
safety handling of missing metrics, contributing process extraction,
health score penalty calculations, and WebSocket diagnose_request integration.
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone
import json
import pytest
import websockets

from collectors import MetricsSnapshot
from diagnostics import (
    DiagnosticEngine,
    Diagnosis,
    DiagnosticRule,
    get_diagnostic_engine,
)
from server.ws_server import AgentWebSocketServer


def make_snapshot(
    cpu_percent: float = 25.0,
    cpu_temp_c: float | None = 55.0,
    ram_percent: float = 45.0,
    ram_available_mb: int = 8192,
    pagefile_percent: float | None = 15.0,
    disk_percent_busy: float = 10.0,
    disk_read_bps: int = 1024,
    disk_write_bps: int = 2048,
    gpu_percent: float | None = 15.0,
    gpu_temp_c: float | None = 50.0,
    gpu_vram_percent: float | None = 20.0,
    net_sent_bps: int = 50000,
    net_recv_bps: int = 100000,
    top_processes: list[dict] | None = None,
    top_process_cpu_percent: float = 10.0,
    top_process_io_percent: float = 5.0,
    all_processes: list[dict] | None = None,
) -> MetricsSnapshot:
    """Helper to construct synthetic MetricsSnapshot for deterministic engine tests."""
    top_procs = top_processes if top_processes is not None else [
        {"pid": 1001, "name": "explorer.exe", "cpu_percent": 5.0, "ram_mb": 150.0, "io_percent": 1.0, "is_elevated": 0},
        {"pid": 1002, "name": "code.exe", "cpu_percent": 4.0, "ram_mb": 400.0, "io_percent": 2.0, "is_elevated": 0},
    ]
    all_procs = all_processes if all_processes is not None else top_procs

    return MetricsSnapshot(
        timestamp=datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        cpu_percent=cpu_percent,
        cpu_temp_c=cpu_temp_c,
        ram_percent=ram_percent,
        ram_available_mb=ram_available_mb,
        pagefile_percent=pagefile_percent,
        disk_percent_busy=disk_percent_busy,
        disk_read_bps=disk_read_bps,
        disk_write_bps=disk_write_bps,
        gpu_percent=gpu_percent,
        gpu_temp_c=gpu_temp_c,
        gpu_vram_percent=gpu_vram_percent,
        gpu_name="Test GPU",
        net_sent_bps=net_sent_bps,
        net_recv_bps=net_recv_bps,
        top_processes=top_procs,
        top_process_cpu_percent=top_process_cpu_percent,
        top_process_io_percent=top_process_io_percent,
        all_processes=all_procs,
    )


def test_rules_yaml_loading_and_structure():
    """Verify rules.yaml loads and contains all 7 required rules with proper structure."""
    engine = DiagnosticEngine()
    assert len(engine.rules) == 7

    rule_ids = [r.id for r in engine.rules]
    expected_ids = [
        "memory_pressure",
        "disk_bottleneck",
        "thermal_throttling",
        "network_saturation",
        "gpu_bound",
        "background_process_sprawl",
        "nominal",
    ]
    assert rule_ids == expected_ids

    # Verify nominal is the last fallback rule with empty conditions
    nominal_rule = engine.rules[-1]
    assert nominal_rule.id == "nominal"
    assert len(nominal_rule.conditions) == 0
    assert nominal_rule.output.health_score_penalty == 0


def test_nominal_healthy_evaluation():
    """Verify normal telemetry evaluates to 'nominal' with health_score 100 and severity 'none'."""
    engine = DiagnosticEngine()
    snapshot = make_snapshot()
    diagnosis = engine.evaluate(snapshot)

    assert diagnosis.label == "nominal"
    assert diagnosis.rule_id == "nominal"
    assert diagnosis.severity == "none"
    assert diagnosis.health_score == 100
    assert diagnosis.contributing_processes == []


def test_memory_pressure_bottleneck():
    """Verify memory_pressure rule matches when RAM > 90%, pagefile > 50%, and available < 500MB."""
    engine = DiagnosticEngine()
    top_procs = [
        {"pid": 201, "name": "chrome.exe", "cpu_percent": 12.0, "ram_mb": 4200.0, "io_percent": 0.0},
        {"pid": 202, "name": "Teams.exe", "cpu_percent": 6.0, "ram_mb": 2800.0, "io_percent": 0.0},
        {"pid": 203, "name": "node.exe", "cpu_percent": 4.0, "ram_mb": 1500.0, "io_percent": 0.0},
    ]
    snapshot = make_snapshot(
        ram_percent=94.5,
        pagefile_percent=68.0,
        ram_available_mb=320,
        top_processes=top_procs,
        all_processes=top_procs,
    )
    diagnosis = engine.evaluate(snapshot)

    assert diagnosis.label == "memory_pressure"
    assert diagnosis.rule_id == "memory_pressure"
    assert diagnosis.severity == "high"
    assert diagnosis.health_score == 60  # 100 - 40
    assert "chrome.exe" in diagnosis.contributing_processes
    assert "Teams.exe" in diagnosis.contributing_processes


def test_disk_bottleneck():
    """Verify disk_bottleneck matches when disk is 100% busy and top process I/O > 70%."""
    engine = DiagnosticEngine()
    top_procs = [
        {"pid": 301, "name": "backup_service.exe", "cpu_percent": 10.0, "ram_mb": 200.0, "io_percent": 88.5},
        {"pid": 302, "name": "explorer.exe", "cpu_percent": 2.0, "ram_mb": 100.0, "io_percent": 1.5},
    ]
    snapshot = make_snapshot(
        disk_percent_busy=100.0,
        top_process_io_percent=88.5,
        top_processes=top_procs,
        all_processes=top_procs,
    )
    diagnosis = engine.evaluate(snapshot)

    assert diagnosis.label == "disk_bottleneck"
    assert diagnosis.rule_id == "disk_bottleneck"
    assert diagnosis.severity == "high"
    assert diagnosis.health_score == 65  # 100 - 35
    assert diagnosis.contributing_processes == ["backup_service.exe"]


def test_thermal_throttling_bottleneck():
    """Verify thermal_throttling matches when CPU > 90%, top process CPU > 70%, and temp > 85C."""
    engine = DiagnosticEngine()
    top_procs = [
        {"pid": 401, "name": "blender_render.exe", "cpu_percent": 85.0, "ram_mb": 1200.0, "io_percent": 0.0},
        {"pid": 402, "name": "system.exe", "cpu_percent": 5.0, "ram_mb": 100.0, "io_percent": 0.0},
    ]
    snapshot = make_snapshot(
        cpu_percent=94.0,
        top_process_cpu_percent=85.0,
        cpu_temp_c=91.5,
        top_processes=top_procs,
        all_processes=top_procs,
    )
    diagnosis = engine.evaluate(snapshot)

    assert diagnosis.label == "thermal_throttling"
    assert diagnosis.rule_id == "thermal_throttling"
    assert diagnosis.severity == "high"
    assert diagnosis.health_score == 55  # 100 - 45
    assert "blender_render.exe" in diagnosis.contributing_processes


def test_network_saturation_bottleneck():
    """Verify network_saturation matches when throughput is > 90% of link capacity."""
    engine = DiagnosticEngine()
    # Force estimated capacity to 10 MB/s (80 Mbps) for testing relative condition
    engine._cached_link_capacity_bps = 10_000_000
    snapshot = make_snapshot(
        net_recv_bps=9_500_000,  # 95% of link capacity > 90%
    )
    diagnosis = engine.evaluate(snapshot)

    assert diagnosis.label == "network_saturation"
    assert diagnosis.rule_id == "network_saturation"
    assert diagnosis.severity == "medium"
    assert diagnosis.health_score == 80  # 100 - 20


def test_gpu_bound_bottleneck():
    """Verify gpu_bound matches when GPU > 95% and CPU < 60%."""
    engine = DiagnosticEngine()
    top_procs = [
        {"pid": 501, "name": "unreal_engine.exe", "cpu_percent": 30.0, "ram_mb": 3000.0, "io_percent": 0.0},
    ]
    snapshot = make_snapshot(
        gpu_percent=98.0,
        cpu_percent=35.0,
        top_processes=top_procs,
        all_processes=top_procs,
    )
    diagnosis = engine.evaluate(snapshot)

    assert diagnosis.label == "gpu_bound"
    assert diagnosis.rule_id == "gpu_bound"
    assert diagnosis.severity == "low"
    assert diagnosis.health_score == 90  # 100 - 10
    assert "unreal_engine.exe" in diagnosis.contributing_processes


def test_background_process_sprawl():
    """Verify background_process_sprawl matches when > 15 processes each consume > 5% CPU."""
    engine = DiagnosticEngine()
    # Create 18 processes with 6% CPU each
    sprawl_procs = [
        {"pid": 1000 + i, "name": f"worker_{i}.exe", "cpu_percent": 6.0, "ram_mb": 80.0, "io_percent": 0.0}
        for i in range(18)
    ]
    snapshot = make_snapshot(
        cpu_percent=65.0,
        top_processes=sprawl_procs[:10],
        all_processes=sprawl_procs,
    )
    diagnosis = engine.evaluate(snapshot)

    assert diagnosis.label == "background_process_sprawl"
    assert diagnosis.rule_id == "background_process_sprawl"
    assert diagnosis.severity == "medium"
    assert diagnosis.health_score == 85  # 100 - 15
    assert len(diagnosis.contributing_processes) > 0


def test_rule_priority_ordering():
    """Verify top-to-bottom rule precedence when multiple conditions could apply."""
    engine = DiagnosticEngine()
    # If memory_pressure conditions match, it fires before lower severity rules
    top_procs = [
        {"pid": 601, "name": "heavy_app.exe", "cpu_percent": 10.0, "ram_mb": 5000.0, "io_percent": 0.0}
    ]
    snapshot = make_snapshot(
        ram_percent=95.0,
        pagefile_percent=70.0,
        ram_available_mb=200,
        gpu_percent=99.0,  # gpu_bound is also true, but memory_pressure is higher in YAML
        cpu_percent=40.0,
        top_processes=top_procs,
        all_processes=top_procs,
    )
    diagnosis = engine.evaluate(snapshot)

    assert diagnosis.label == "memory_pressure"
    assert diagnosis.rule_id == "memory_pressure"
    assert diagnosis.severity == "high"
    assert diagnosis.health_score == 60


def test_missing_hardware_telemetry_safety():
    """Verify engine handles None values (no GPU, no CPU temp, no pagefile) gracefully without error."""
    engine = DiagnosticEngine()
    snapshot = make_snapshot(
        cpu_temp_c=None,
        gpu_percent=None,
        gpu_temp_c=None,
        gpu_vram_percent=None,
        pagefile_percent=None,
    )
    # Should not throw and should safely evaluate to nominal
    diagnosis = engine.evaluate(snapshot)
    assert diagnosis.label == "nominal"
    assert diagnosis.severity == "none"
    assert diagnosis.health_score == 100


def test_diagnosis_to_response_format():
    """Verify diagnosis response schema matches Section 10 contract exactly."""
    diagnosis = Diagnosis(
        label="memory_pressure",
        rule_id="memory_pressure",
        severity="high",
        health_score=60,
        contributing_processes=["chrome.exe", "slack.exe"],
        rule_description="RAM critically high and swapping to disk.",
    )
    resp = diagnosis.to_diagnosis_response(llm_call_succeeded=False)

    assert resp["type"] == "diagnosis_result"
    assert resp["llm_call_succeeded"] is False
    assert resp["diagnosis"]["label"] == "memory_pressure"
    assert resp["diagnosis"]["rule_id"] == "memory_pressure"
    assert resp["diagnosis"]["severity"] == "high"
    assert resp["diagnosis"]["health_score"] == 60
    assert resp["diagnosis"]["contributing_processes"] == ["chrome.exe", "slack.exe"]
    assert "summary" in resp["explanation"]


@pytest.mark.asyncio
async def test_websocket_diagnose_request_flow():
    """Integration test: connect to WebSocket server, send diagnose_request, receive real rule engine diagnosis."""
    test_port = 8788
    server = AgentWebSocketServer(
        host="127.0.0.1",
        port=test_port,
        polling_interval_ms=300,
    )
    # Pre-seed last snapshot to test immediate rule evaluation
    server._last_snapshot = make_snapshot()
    await server.start()

    try:
        uri = f"ws://127.0.0.1:{test_port}"
        async with websockets.connect(uri) as ws:
            # 1. Read initial status or tick message
            initial_raw = await asyncio.wait_for(ws.recv(), timeout=4.0)
            assert initial_raw is not None

            # 2. Send diagnose_request
            req = {"type": "diagnose_request"}
            await ws.send(json.dumps(req))

            # 3. Receive and validate diagnosis_result
            # Wait for diagnosis_result (skipping any intermediate metrics_tick if necessary)
            diag_resp = None
            for _ in range(5):
                raw_msg = await asyncio.wait_for(ws.recv(), timeout=4.0)
                data = json.loads(raw_msg)
                if data.get("type") == "diagnosis_result":
                    diag_resp = data
                    break

            assert diag_resp is not None
            assert diag_resp["type"] == "diagnosis_result"
            assert "diagnosis" in diag_resp
            assert "label" in diag_resp["diagnosis"]
            assert "rule_id" in diag_resp["diagnosis"]
            assert "severity" in diag_resp["diagnosis"]
            assert "health_score" in diag_resp["diagnosis"]
            assert isinstance(diag_resp["diagnosis"]["health_score"], int)
            assert 0 <= diag_resp["diagnosis"]["health_score"] <= 100
            assert isinstance(diag_resp["diagnosis"]["contributing_processes"], list)
            assert diag_resp["llm_call_succeeded"] is False
    finally:
        await server.stop()

