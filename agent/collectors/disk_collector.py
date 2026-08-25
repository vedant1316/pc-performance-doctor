"""Disk I/O metrics collector.

Collects real-time disk read/write throughput (bytes per second) and disk activity percentage.
"""

from __future__ import annotations

import logging
import time
from typing import Any

import psutil

logger = logging.getLogger(__name__)


class DiskCollector:
    """Collector for Disk I/O and busy percentage metrics."""

    def __init__(self) -> None:
        self._last_time: float = time.time()
        self._last_read_bytes: int = 0
        self._last_write_bytes: int = 0
        self._last_read_time_ms: int = 0
        self._last_write_time_ms: int = 0
        self._wmi_instance = None

        try:
            counters = psutil.disk_io_counters()
            if counters:
                self._last_read_bytes = counters.read_bytes
                self._last_write_bytes = counters.write_bytes
                self._last_read_time_ms = getattr(counters, "read_time", 0)
                self._last_write_time_ms = getattr(counters, "write_time", 0)
        except Exception as e:
            logger.debug("Failed to initialize disk I/O baseline: %s", e)

    def _get_wmi(self) -> Any:
        """Lazily initialize WMI client."""
        if self._wmi_instance is None:
            try:
                import wmi
                self._wmi_instance = wmi.WMI()
            except Exception as e:
                logger.debug("WMI disk initialization failed: %s", e)
                self._wmi_instance = None
        return self._wmi_instance

    def _get_wmi_disk_busy_percent(self) -> float | None:
        """Attempt to read disk busy percentage from WMI Performance Counters."""
        try:
            w = self._get_wmi()
            if w:
                for disk in w.Win32_PerfFormattedData_PerfDisk_PhysicalDisk(Name="_Total"):
                    raw_val = getattr(disk, "PercentDiskTime", None)
                    if raw_val is not None:
                        pct = float(raw_val)
                        return min(100.0, max(0.0, pct))
        except Exception:
            pass
        return None

    def collect(self) -> dict[str, Any]:
        """Collect disk metrics.

        Returns:
            dict containing:
                - disk_percent_busy: float
                - disk_read_bps: int
                - disk_write_bps: int
        """
        now = time.time()
        dt = now - self._last_time

        read_bps = 0
        write_bps = 0
        busy_pct = 0.0

        try:
            counters = psutil.disk_io_counters()
            if counters and dt > 0:
                delta_read = counters.read_bytes - self._last_read_bytes
                delta_write = counters.write_bytes - self._last_write_bytes
                read_bps = max(0, int(delta_read / dt))
                write_bps = max(0, int(delta_write / dt))

                # Compute I/O busy time estimation from psutil ms counters
                current_read_time = getattr(counters, "read_time", 0)
                current_write_time = getattr(counters, "write_time", 0)
                delta_io_ms = (current_read_time - self._last_read_time_ms) + (
                    current_write_time - self._last_write_time_ms
                )
                wall_ms = dt * 1000.0
                if wall_ms > 0 and delta_io_ms >= 0:
                    busy_pct = min(100.0, max(0.0, (delta_io_ms / wall_ms) * 100.0))

                self._last_read_bytes = counters.read_bytes
                self._last_write_bytes = counters.write_bytes
                self._last_read_time_ms = current_read_time
                self._last_write_time_ms = current_write_time
        except Exception as e:
            logger.error("Failed to query psutil disk_io_counters: %s", e)

        self._last_time = now

        # Attempt to get WMI busy percent if available
        wmi_busy = self._get_wmi_disk_busy_percent()
        if wmi_busy is not None:
            busy_pct = wmi_busy

        return {
            "disk_percent_busy": round(busy_pct, 1),
            "disk_read_bps": read_bps,
            "disk_write_bps": write_bps,
        }


_disk_collector_instance = DiskCollector()


def collect_disk() -> dict[str, Any]:
    """Convenience function to collect disk metrics using shared instance."""
    return _disk_collector_instance.collect()
