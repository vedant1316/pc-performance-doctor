"""Unit and integration tests for metrics collectors."""

import time
import pytest

from collectors import (
    CPUCollector,
    DiskCollector,
    GPUCollector,
    MetricsSnapshot,
    NetworkCollector,
    ProcessCollector,
    RAMCollector,
    SystemCollector,
    collect_cpu,
    collect_disk,
    collect_gpu,
    collect_network,
    collect_processes,
    collect_ram,
    collect_snapshot,
)


def test_cpu_collector() -> None:
    collector = CPUCollector()
    # Sleep slightly so psutil has a delta for non-zero CPU
    time.sleep(0.1)
    res = collector.collect()

    assert "cpu_percent" in res
    assert isinstance(res["cpu_percent"], float)
    assert 0.0 <= res["cpu_percent"] <= 100.0

    assert "per_core_percent" in res
    assert isinstance(res["per_core_percent"], list)
    assert len(res["per_core_percent"]) > 0

    assert "cpu_temp_c" in res
    if res["cpu_temp_c"] is not None:
        assert isinstance(res["cpu_temp_c"], float)
        assert 0.0 <= res["cpu_temp_c"] <= 125.0

    assert "cpu_freq_mhz" in res
    if res["cpu_freq_mhz"] is not None:
        assert isinstance(res["cpu_freq_mhz"], float)
        assert res["cpu_freq_mhz"] > 0.0


def test_ram_collector() -> None:
    collector = RAMCollector()
    res = collector.collect()

    assert "ram_percent" in res
    assert isinstance(res["ram_percent"], float)
    assert 0.0 <= res["ram_percent"] <= 100.0

    assert "ram_available_mb" in res
    assert isinstance(res["ram_available_mb"], int)
    assert res["ram_available_mb"] > 0

    assert "ram_total_mb" in res
    assert isinstance(res["ram_total_mb"], int)
    assert res["ram_total_mb"] >= res["ram_available_mb"]

    assert "pagefile_percent" in res
    assert isinstance(res["pagefile_percent"], float)
    assert 0.0 <= res["pagefile_percent"] <= 100.0


def test_disk_collector() -> None:
    collector = DiskCollector()
    time.sleep(0.1)
    res = collector.collect()

    assert "disk_percent_busy" in res
    assert isinstance(res["disk_percent_busy"], float)
    assert 0.0 <= res["disk_percent_busy"] <= 100.0

    assert "disk_read_bps" in res
    assert isinstance(res["disk_read_bps"], int)
    assert res["disk_read_bps"] >= 0

    assert "disk_write_bps" in res
    assert isinstance(res["disk_write_bps"], int)
    assert res["disk_write_bps"] >= 0


def test_gpu_collector() -> None:
    collector = GPUCollector()
    res = collector.collect()

    assert "gpu_percent" in res
    if res["gpu_percent"] is not None:
        assert isinstance(res["gpu_percent"], float)
        assert 0.0 <= res["gpu_percent"] <= 100.0

    assert "gpu_temp_c" in res
    if res["gpu_temp_c"] is not None:
        assert isinstance(res["gpu_temp_c"], float)

    assert "gpu_vram_percent" in res
    if res["gpu_vram_percent"] is not None:
        assert isinstance(res["gpu_vram_percent"], float)
        assert 0.0 <= res["gpu_vram_percent"] <= 100.0


def test_network_collector() -> None:
    collector = NetworkCollector()
    time.sleep(0.1)
    res = collector.collect()

    assert "net_sent_bps" in res
    assert isinstance(res["net_sent_bps"], int)
    assert res["net_sent_bps"] >= 0

    assert "net_recv_bps" in res
    assert isinstance(res["net_recv_bps"], int)
    assert res["net_recv_bps"] >= 0


def test_process_collector() -> None:
    collector = ProcessCollector(top_n=5)
    time.sleep(0.1)
    res = collector.collect()

    assert "top_processes" in res
    assert isinstance(res["top_processes"], list)
    assert len(res["top_processes"]) <= 5

    if res["top_processes"]:
        p = res["top_processes"][0]
        assert "pid" in p and isinstance(p["pid"], int)
        assert "name" in p and isinstance(p["name"], str)
        assert "cpu_percent" in p and isinstance(p["cpu_percent"], float)
        assert "ram_mb" in p and isinstance(p["ram_mb"], (int, float))
        assert "io_percent" in p and isinstance(p["io_percent"], float)
        assert "is_elevated" in p and p["is_elevated"] in (0, 1)

    assert "top_process_cpu_percent" in res
    assert isinstance(res["top_process_cpu_percent"], float)
    assert "top_process_io_percent" in res
    assert isinstance(res["top_process_io_percent"], float)

    # Test threshold helper
    count = collector.get_process_count_above_threshold(
        res["all_processes"], "cpu_percent", -1.0
    )
    assert count >= 0


def test_system_collector_and_snapshot() -> None:
    sys_collector = SystemCollector(top_processes_count=5)
    time.sleep(0.1)
    snapshot = sys_collector.collect_snapshot()

    assert isinstance(snapshot, MetricsSnapshot)
    assert snapshot.timestamp.endswith("Z")

    # Verify metrics_tick structure against Section 10 contract
    tick = snapshot.to_metrics_tick()
    assert tick["type"] == "metrics_tick"
    assert "timestamp" in tick
    assert "cpu_percent" in tick
    assert "ram_percent" in tick
    assert "ram_available_mb" in tick
    assert "disk_percent_busy" in tick
    assert "gpu_percent" in tick
    assert "net_sent_bps" in tick
    assert "net_recv_bps" in tick
    assert "top_processes" in tick
    assert isinstance(tick["top_processes"], list)
