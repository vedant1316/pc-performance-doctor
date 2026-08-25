"""RAM and Pagefile/Swap metrics collector.

Collects real-time memory usage, available RAM in MB, and pagefile metrics.
"""

from __future__ import annotations

import logging
from typing import Any

import psutil

logger = logging.getLogger(__name__)

BYTES_PER_MB = 1024 * 1024


class RAMCollector:
    """Collector for RAM and Pagefile/Swap metrics."""

    def collect(self) -> dict[str, Any]:
        """Collect RAM and pagefile metrics.

        Returns:
            dict containing:
                - ram_percent: float
                - ram_available_mb: int
                - ram_total_mb: int
                - ram_used_mb: int
                - pagefile_percent: float
                - pagefile_used_mb: int
                - pagefile_total_mb: int
        """
        try:
            vmem = psutil.virtual_memory()
            ram_percent = round(float(vmem.percent), 1)
            ram_available_mb = int(vmem.available / BYTES_PER_MB)
            ram_total_mb = int(vmem.total / BYTES_PER_MB)
            ram_used_mb = int(vmem.used / BYTES_PER_MB)
        except Exception as e:
            logger.error("Failed to collect virtual memory: %s", e)
            ram_percent = 0.0
            ram_available_mb = 0
            ram_total_mb = 0
            ram_used_mb = 0

        try:
            swap = psutil.swap_memory()
            pagefile_percent = round(float(swap.percent), 1)
            pagefile_used_mb = int(swap.used / BYTES_PER_MB)
            pagefile_total_mb = int(swap.total / BYTES_PER_MB)
        except Exception as e:
            logger.warning("Failed to collect swap/pagefile memory: %s", e)
            pagefile_percent = 0.0
            pagefile_used_mb = 0
            pagefile_total_mb = 0

        return {
            "ram_percent": ram_percent,
            "ram_available_mb": ram_available_mb,
            "ram_total_mb": ram_total_mb,
            "ram_used_mb": ram_used_mb,
            "pagefile_percent": pagefile_percent,
            "pagefile_used_mb": pagefile_used_mb,
            "pagefile_total_mb": pagefile_total_mb,
        }


_ram_collector_instance = RAMCollector()


def collect_ram() -> dict[str, Any]:
    """Convenience function to collect RAM metrics using shared instance."""
    return _ram_collector_instance.collect()
