"""Tests for PDF export generator and WebSocket integration."""

import asyncio
import base64
import json
import os
from pathlib import Path
import tempfile
import pytest

from report import HealthReportPDFGenerator, generate_health_report_pdf
from server.ws_server import AgentWebSocketServer


def test_pdf_generation_with_ai_explanation():
    """Verify PDF generator produces a valid readable PDF when AI explanation is present."""
    generator = HealthReportPDFGenerator()

    mock_snapshot = {
        "timestamp": "2026-08-26T10:00:00Z",
        "cpu_percent": 88.5,
        "cpu_temp_c": 72.0,
        "ram_percent": 78.4,
        "ram_available_mb": 2048,
        "disk_percent_busy": 45.0,
        "disk_read_bps": 15000000,
        "disk_write_bps": 8000000,
        "gpu_percent": 25.0,
        "gpu_temp_c": 55.0,
        "gpu_vram_percent": 30.0,
        "gpu_name": "NVIDIA GeForce RTX 4070",
        "net_sent_bps": 120000,
        "net_recv_bps": 450000,
    }

    mock_diagnosis = {
        "label": "memory_pressure",
        "rule_id": "memory_pressure",
        "severity": "high",
        "health_score": 60,
        "contributing_processes": ["chrome.exe", "node.exe"],
    }

    mock_explanation = {
        "summary": "Your PC is under high memory pressure with swapping active.",
        "root_cause": "Multiple browser tabs and dev servers have consumed available physical RAM.",
        "fixes": [
            {"action": "Close unused background Chrome tabs", "difficulty": "easy", "impact": "high"},
            {"action": "Restart active node server processes", "difficulty": "medium", "impact": "medium"},
        ],
        "expected_improvement": "RAM usage should drop to ~50% and eliminate paging lag.",
    }

    mock_timeline = {"snapshot_count": 120, "diagnosis_count": 3}
    mock_benchmark = {"score": 780, "breakdown": {"cpu": 820, "disk": 750, "gpu": 770}}

    temp_pdf = os.path.join(tempfile.gettempdir(), f"test_report_ai_{os.getpid()}.pdf")
    try:
        path, pdf_bytes = generator.generate_pdf(
            snapshot=mock_snapshot,
            diagnosis=mock_diagnosis,
            explanation=mock_explanation,
            timeline_summary=mock_timeline,
            benchmark=mock_benchmark,
            output_path=temp_pdf,
        )

        assert os.path.exists(temp_pdf)
        assert len(pdf_bytes) > 2000
        # Valid PDF magic header
        assert pdf_bytes.startswith(b"%PDF-")
        assert path == temp_pdf
    finally:
        if os.path.exists(temp_pdf):
            os.remove(temp_pdf)


def test_pdf_generation_fallback_without_ai():
    """Verify PDF generator works gracefully when no AI explanation is available."""
    generator = HealthReportPDFGenerator()

    mock_snapshot = {
        "timestamp": "2026-08-26T10:00:00Z",
        "cpu_percent": 25.0,
        "cpu_temp_c": None,
        "ram_percent": 45.0,
        "ram_available_mb": 8192,
        "disk_percent_busy": 5.0,
        "gpu_percent": None,
        "net_sent_bps": 1000,
        "net_recv_bps": 2000,
    }

    mock_diagnosis = {
        "label": "nominal",
        "rule_id": "nominal",
        "severity": "none",
        "health_score": 100,
        "contributing_processes": [],
    }

    temp_pdf = os.path.join(tempfile.gettempdir(), f"test_report_fallback_{os.getpid()}.pdf")
    try:
        path, pdf_bytes = generator.generate_pdf(
            snapshot=mock_snapshot,
            diagnosis=mock_diagnosis,
            explanation=None,
            output_path=temp_pdf,
        )

        assert os.path.exists(temp_pdf)
        assert len(pdf_bytes) > 1500
        assert pdf_bytes.startswith(b"%PDF-")
    finally:
        if os.path.exists(temp_pdf):
            os.remove(temp_pdf)


def test_pdf_security_and_secret_redaction():
    """Verify PDF generator strictly sanitizes and prevents leakage of API keys."""
    generator = HealthReportPDFGenerator()

    secret_key = "sk-live-99887766554433221100aabbccddeeff"
    sanitized = generator._sanitize_string(f"GPU with key {secret_key}")
    assert secret_key not in sanitized
    assert "[REDACTED_API_KEY]" in sanitized

    mock_snapshot = {
        "gpu_name": f"Mock GPU with key {secret_key}",
    }

    mock_diagnosis = {
        "label": "nominal",
        "rule_id": "nominal",
        "severity": "none",
        "health_score": 100,
        "contributing_processes": [f"process_{secret_key}"],
    }

    mock_explanation = {
        "summary": f"Summary referencing {secret_key}",
        "root_cause": "Normal root cause",
        "fixes": [],
        "expected_improvement": "Improvement text",
    }

    _, pdf_bytes = generator.generate_pdf(
        snapshot=mock_snapshot,
        diagnosis=mock_diagnosis,
        explanation=mock_explanation,
    )

    # Verify that raw secret key never appears in plain text anywhere in the PDF bytes
    assert secret_key.encode("ascii") not in pdf_bytes
    assert pdf_bytes.startswith(b"%PDF-")



@pytest.mark.asyncio
async def test_websocket_export_pdf_request_flow():
    """Verify WebSocket server handles export_pdf_request and returns valid PDF payload."""
    server = AgentWebSocketServer(
        host="127.0.0.1",
        port=8793,
        polling_interval_ms=500,
    )
    await server.start()

    try:
        import websockets
        async with websockets.connect("ws://127.0.0.1:8793") as ws:
            # Consume initial greeting / tick
            await ws.recv()

            # Send export_pdf_request
            req = {"type": "export_pdf_request"}
            await ws.send(json.dumps(req))

            pdf_res = None
            for _ in range(15):
                raw = await asyncio.wait_for(ws.recv(), timeout=10.0)
                data = json.loads(raw)
                if data.get("type") == "export_pdf_result":
                    pdf_res = data
                    break

            assert pdf_res is not None, "Did not receive export_pdf_result"
            assert pdf_res["success"] is True
            assert pdf_res["pdf_path"] != ""
            assert os.path.exists(pdf_res["pdf_path"])
            assert pdf_res["filename"].endswith(".pdf")
            assert pdf_res["pdf_base64"] is not None

            # Verify base64 decode yields valid PDF header
            decoded = base64.b64decode(pdf_res["pdf_base64"])
            assert decoded.startswith(b"%PDF-")
    finally:
        await server.stop()

