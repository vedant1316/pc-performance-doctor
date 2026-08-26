"""Metrics collectors package for PC Performance Doctor.

Exposes individual collectors and a unified SystemCollector / collect_snapshot()
for streaming real-time hardware telemetry and populating diagnostic snapshots.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
import logging
from typing import Any

from .cpu_collector import CPUCollector, collect_cpu
from .disk_collector import DiskCollector, collect_disk
from .gpu_collector import GPUCollector, collect_gpu
from .network_collector import NetworkCollector, collect_network
from .process_collector import ProcessCollector, collect_processes
from .ram_collector import RAMCollector, collect_ram

logger = logging.getLogger(__name__)


@dataclass
class ProcessInfo:
    """Telemetry information for a single process."""
    pid: int
    name: str
    cpu_percent: float
    ram_mb: float
    io_percent: float = 0.0
    is_elevated: int = 0


@dataclass
class MetricsSnapshot:
    """Unified system performance snapshot."""
    timestamp: str  # ISO 8601 UTC
    cpu_percent: float
    cpu_temp_c: float | None
    ram_percent: float
    ram_available_mb: int
    pagefile_percent: float | None
    disk_percent_busy: float
    disk_read_bps: int
    disk_write_bps: int
    gpu_percent: float | None
    gpu_temp_c: float | None
    gpu_vram_percent: float | None
    gpu_name: str | None
    net_sent_bps: int
    net_recv_bps: int
    top_processes: list[dict[str, Any]] = field(default_factory=list)

    # Diagnostic helper fields
    top_process_cpu_percent: float = 0.0
    top_process_io_percent: float = 0.0
    per_core_percent: list[float] = field(default_factory=list)
    cpu_freq_mhz: float | None = None
    ram_total_mb: int = 0
    ram_used_mb: int = 0
    pagefile_used_mb: int = 0
    pagefile_total_mb: int = 0
    all_processes: list[dict[str, Any]] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        """Convert snapshot to standard dictionary."""
        return asdict(self)

    def to_metrics_tick(self) -> dict[str, Any]:
        """Convert snapshot to WebSocket metrics_tick message format."""
        return {
            "type": "metrics_tick",
            "timestamp": self.timestamp,
            "cpu_percent": self.cpu_percent,
            "ram_percent": self.ram_percent,
            "ram_available_mb": self.ram_available_mb,
            "disk_percent_busy": self.disk_percent_busy,
            "gpu_percent": self.gpu_percent,
            "net_sent_bps": self.net_sent_bps,
            "net_recv_bps": self.net_recv_bps,
            "top_processes": [
                {
                    "pid": p["pid"],
                    "name": p["name"],
                    "cpu_percent": p["cpu_percent"],
                    "ram_mb": p["ram_mb"],
                }
                for p in self.top_processes
            ],
        }


class SystemCollector:
    """Unified coordinator for all hardware and process metrics collectors."""

    def __init__(self, top_processes_count: int = 10) -> None:
        self.cpu_collector = CPUCollector()
        self.ram_collector = RAMCollector()
        self.disk_collector = DiskCollector()
        self.gpu_collector = GPUCollector()
        self.network_collector = NetworkCollector()
        self.process_collector = ProcessCollector(top_n=top_processes_count)

    def collect_snapshot(self) -> MetricsSnapshot:
        """Execute all collectors and return a consolidated MetricsSnapshot."""
        com_init = False
        try:
            import pythoncom
            pythoncom.CoInitialize()
            com_init = True
        except Exception:
            pass

        try:
            timestamp = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

            cpu = self.cpu_collector.collect()
            ram = self.ram_collector.collect()
            disk = self.disk_collector.collect()
            gpu = self.gpu_collector.collect()
            net = self.network_collector.collect()
            procs = self.process_collector.collect()

            return MetricsSnapshot(
                timestamp=timestamp,
                cpu_percent=cpu["cpu_percent"],
                cpu_temp_c=cpu["cpu_temp_c"],
                per_core_percent=cpu["per_core_percent"],
                cpu_freq_mhz=cpu["cpu_freq_mhz"],
                ram_percent=ram["ram_percent"],
                ram_available_mb=ram["ram_available_mb"],
                ram_total_mb=ram["ram_total_mb"],
                ram_used_mb=ram["ram_used_mb"],
                pagefile_percent=ram["pagefile_percent"],
                pagefile_used_mb=ram["pagefile_used_mb"],
                pagefile_total_mb=ram["pagefile_total_mb"],
                disk_percent_busy=disk["disk_percent_busy"],
                disk_read_bps=disk["disk_read_bps"],
                disk_write_bps=disk["disk_write_bps"],
                gpu_percent=gpu["gpu_percent"],
                gpu_temp_c=gpu["gpu_temp_c"],
                gpu_vram_percent=gpu["gpu_vram_percent"],
                gpu_name=gpu["gpu_name"],
                net_sent_bps=net["net_sent_bps"],
                net_recv_bps=net["net_recv_bps"],
                top_processes=procs["top_processes"],
                top_process_cpu_percent=procs["top_process_cpu_percent"],
                top_process_io_percent=procs["top_process_io_percent"],
            )
        finally:
            if com_init:
                try:
                    import pythoncom
                    pythoncom.CoUninitialize()
                except Exception:
                    pass



_system_collector_instance = SystemCollector()


def collect_snapshot() -> MetricsSnapshot:
    """Convenience function to capture a complete MetricsSnapshot."""
    return _system_collector_instance.collect_snapshot()


__all__ = [
    "CPUCollector",
    "DiskCollector",
    "GPUCollector",
    "MetricsSnapshot",
    "NetworkCollector",
    "ProcessCollector",
    "ProcessInfo",
    "RAMCollector",
    "SystemCollector",
    "collect_cpu",
    "collect_disk",
    "collect_gpu",
    "collect_network",
    "collect_processes",
    "collect_ram",
    "collect_snapshot",
]
