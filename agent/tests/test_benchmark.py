"""Tests for synthetic benchmark module and WebSocket integration."""

import asyncio
import json
import os
import tempfile
import time
import pytest

from benchmark import BenchmarkRunner
from server.schemas import BenchmarkResultMessage, BenchmarkBreakdown
from server.ws_server import AgentWebSocketServer


def test_benchmark_runner_components_and_safety():
    """Verify BenchmarkRunner executes safely within time bounds and without destructive changes."""
    runner = BenchmarkRunner()

    # 1. CPU Benchmark
    t0 = time.perf_counter()
    cpu_score = runner.run_cpu_benchmark(target_duration_s=0.3)
    elapsed_cpu = time.perf_counter() - t0
    assert 100 <= cpu_score <= 1000
    assert elapsed_cpu < 2.0, "CPU benchmark exceeded safe runtime duration"

    # 2. Disk Benchmark
    t0 = time.perf_counter()
    disk_score = runner.run_disk_benchmark(test_size_mb=4)
    elapsed_disk = time.perf_counter() - t0
    assert 100 <= disk_score <= 1000
    assert elapsed_disk < 3.0, "Disk benchmark exceeded safe runtime duration"

    # Verify no temporary benchmark files remain in temp directory
    temp_dir = tempfile.gettempdir()
    leftovers = [f for f in os.listdir(temp_dir) if f.startswith("pc_doctor_bench_")]
    assert len(leftovers) == 0, f"Found leftover benchmark temp files: {leftovers}"

    # 3. GPU Benchmark
    t0 = time.perf_counter()
    gpu_score = runner.run_gpu_benchmark(target_duration_s=0.2)
    elapsed_gpu = time.perf_counter() - t0
    assert 100 <= gpu_score <= 1000
    assert elapsed_gpu < 2.0, "GPU benchmark exceeded safe runtime duration"

    # 4. Full Benchmark Suite
    result = runner.run_benchmark()
    assert result["type"] == "benchmark_result"
    assert 100 <= result["score"] <= 1000
    assert "cpu" in result["breakdown"]
    assert "disk" in result["breakdown"]
    assert "gpu" in result["breakdown"]
    assert 100 <= result["breakdown"]["cpu"] <= 1000
    assert 100 <= result["breakdown"]["disk"] <= 1000
    assert 100 <= result["breakdown"]["gpu"] <= 1000

    # Validate against Pydantic schema
    msg = BenchmarkResultMessage(**result)
    assert msg.score == result["score"]
    assert msg.breakdown.cpu == result["breakdown"]["cpu"]


@pytest.mark.asyncio
async def test_websocket_benchmark_request_flow():
    """Verify WebSocket server responds to benchmark_request with valid benchmark_result."""
    server = AgentWebSocketServer(
        host="127.0.0.1",
        port=8792,
        polling_interval_ms=500,
    )
    await server.start()

    try:
        import websockets
        async with websockets.connect("ws://127.0.0.1:8792") as ws:
            # Consume initial greeting / tick
            await ws.recv()

            # Send benchmark request
            req = {"type": "benchmark_request"}
            await ws.send(json.dumps(req))

            # Receive result (skip any interim metrics_tick if necessary)
            bench_msg = None
            for _ in range(10):
                raw = await asyncio.wait_for(ws.recv(), timeout=5.0)
                data = json.loads(raw)
                if data.get("type") == "benchmark_result":
                    bench_msg = data
                    break

            assert bench_msg is not None, "Did not receive benchmark_result response"
            assert bench_msg["type"] == "benchmark_result"
            assert isinstance(bench_msg["score"], int)
            assert 100 <= bench_msg["score"] <= 1000
            assert "breakdown" in bench_msg
            assert "cpu" in bench_msg["breakdown"]
            assert "disk" in bench_msg["breakdown"]
            assert "gpu" in bench_msg["breakdown"]
    finally:
        await server.stop()
