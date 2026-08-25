"""Network throughput metrics collector.

Collects real-time network throughput (bytes sent / received per second).
"""

from __future__ import annotations

import logging
import time
from typing import Any

import psutil

logger = logging.getLogger(__name__)


class NetworkCollector:
    """Collector for Network I/O throughput metrics."""

    def __init__(self) -> None:
        self._last_time: float = time.time()
        self._last_bytes_sent: int = 0
        self._last_bytes_recv: int = 0

        try:
            counters = psutil.net_io_counters()
            if counters:
                self._last_bytes_sent = counters.bytes_sent
                self._last_bytes_recv = counters.bytes_recv
        except Exception as e:
            logger.debug("Failed to initialize network I/O baseline: %s", e)

    def collect(self) -> dict[str, Any]:
        """Collect network throughput metrics.

        Returns:
            dict containing:
                - net_sent_bps: int
                - net_recv_bps: int
        """
        now = time.time()
        dt = now - self._last_time

        sent_bps = 0
        recv_bps = 0

        try:
            counters = psutil.net_io_counters()
            if counters and dt > 0:
                delta_sent = counters.bytes_sent - self._last_bytes_sent
                delta_recv = counters.bytes_recv - self._last_bytes_recv

                sent_bps = max(0, int(delta_sent / dt))
                recv_bps = max(0, int(delta_recv / dt))

                self._last_bytes_sent = counters.bytes_sent
                self._last_bytes_recv = counters.bytes_recv
        except Exception as e:
            logger.error("Failed to query psutil net_io_counters: %s", e)

        self._last_time = now

        return {
            "net_sent_bps": sent_bps,
            "net_recv_bps": recv_bps,
        }


_network_collector_instance = NetworkCollector()


def collect_network() -> dict[str, Any]:
    """Convenience function to collect network metrics using shared instance."""
    return _network_collector_instance.collect()
