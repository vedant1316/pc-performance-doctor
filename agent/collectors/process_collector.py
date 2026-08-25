"""Process telemetry collector.

Collects per-process breakdown (CPU, RAM, I/O, elevation status) and computes
diagnostic helper statistics (top_process_cpu_percent, top_process_io_percent,
process_count_above_threshold).
"""

from __future__ import annotations

import logging
import time
from typing import Any

import psutil

logger = logging.getLogger(__name__)

BYTES_PER_MB = 1024 * 1024


class ProcessCollector:
    """Collector for per-process telemetry and process-level diagnostic statistics."""

    def __init__(self, top_n: int = 10) -> None:
        self.top_n = top_n
        self.num_cpus: int = psutil.cpu_count() or 1
        self._last_time: float = time.time()
        # pid -> (timestamp, total_io_bytes)
        self._proc_io_history: dict[int, tuple[float, int]] = {}
        # Pre-seed psutil CPU percentages
        self._prime_processes()

    def _prime_processes(self) -> None:
        """Prime CPU counters for existing processes."""
        try:
            for p in psutil.process_iter(["pid", "name"]):
                try:
                    p.cpu_percent(None)
                except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
                    pass
        except Exception as e:
            logger.debug("Failed to prime process list: %s", e)

    def _check_elevation(self, pid: int) -> int:
        """Check if process has elevated administrator token on Windows."""
        if pid <= 4:
            # System Idle Process (0) and System (4)
            return 1

        try:
            import win32api
            import win32con
            import win32security

            handle = win32api.OpenProcess(win32con.PROCESS_QUERY_LIMITED_INFORMATION, False, pid)
            try:
                token = win32security.OpenProcessToken(handle, win32security.TOKEN_QUERY)
                try:
                    elevation = win32security.GetTokenInformation(token, win32security.TokenElevation)
                    return 1 if elevation else 0
                finally:
                    win32api.CloseHandle(token)
            finally:
                win32api.CloseHandle(handle)
        except Exception:
            # If AccessDenied even for query limited info, it may be elevated/protected system process
            return 0

    def collect(self) -> dict[str, Any]:
        """Collect per-process statistics.

        Returns:
            dict containing:
                - top_processes: list[dict] with pid, name, cpu_percent, ram_mb, io_percent, is_elevated
                - top_process_cpu_percent: float
                - top_process_io_percent: float
                - all_processes_summary: list of lightweight process stats
        """
        now = time.time()
        dt = now - self._last_time
        self._last_time = now

        raw_processes: list[dict[str, Any]] = []
        new_io_history: dict[int, tuple[float, int]] = {}

        total_io_delta = 0
        proc_io_deltas: dict[int, int] = {}

        for p in psutil.process_iter(["pid", "name", "memory_info"]):
            try:
                pid = p.info["pid"]
                name = p.info.get("name") or "Unknown"

                # Filter out System Idle Process (PID 0) from active candidate calculations
                if pid == 0:
                    continue

                # Compute normalized CPU % (divided by logical core count, clamped to 100.0)
                raw_cpu = p.cpu_percent(None)
                normalized_cpu = round(min(100.0, raw_cpu / self.num_cpus), 1)

                # Compute RAM in MB
                mem_info = p.info.get("memory_info")
                ram_mb = round(mem_info.rss / BYTES_PER_MB, 1) if mem_info else 0.0

                # Compute I/O bytes and delta
                io_delta = 0
                try:
                    io_counters = p.io_counters()
                    if io_counters:
                        total_bytes = io_counters.read_bytes + io_counters.write_bytes
                        new_io_history[pid] = (now, total_bytes)

                        if pid in self._proc_io_history:
                            prev_t, prev_bytes = self._proc_io_history[pid]
                            if total_bytes >= prev_bytes and (now - prev_t) > 0:
                                io_delta = total_bytes - prev_bytes
                except (psutil.NoSuchProcess, psutil.AccessDenied, AttributeError):
                    pass

                proc_io_deltas[pid] = io_delta
                total_io_delta += io_delta

                raw_processes.append({
                    "pid": pid,
                    "name": name,
                    "cpu_percent": normalized_cpu,
                    "ram_mb": ram_mb,
                    "io_delta": io_delta,
                })
            except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
                continue
            except Exception as e:
                logger.debug("Error inspecting process: %s", e)
                continue

        self._proc_io_history = new_io_history

        # Calculate I/O percent per process and find highests
        top_process_cpu_percent = 0.0
        top_process_io_percent = 0.0

        for proc in raw_processes:
            pid = proc["pid"]
            io_pct = 0.0
            if total_io_delta > 0 and proc["io_delta"] > 0:
                io_pct = round((proc["io_delta"] / total_io_delta) * 100.0, 1)
            proc["io_percent"] = io_pct

            if proc["cpu_percent"] > top_process_cpu_percent:
                top_process_cpu_percent = proc["cpu_percent"]

            if io_pct > top_process_io_percent:
                top_process_io_percent = io_pct

        # Sort processes by composite resource activity (CPU first, then RAM)
        raw_processes.sort(key=lambda x: (x["cpu_percent"], x["ram_mb"]), reverse=True)

        top_processes: list[dict[str, Any]] = []
        for p_item in raw_processes[: self.top_n]:
            pid = p_item["pid"]
            top_processes.append({
                "pid": pid,
                "name": p_item["name"],
                "cpu_percent": p_item["cpu_percent"],
                "ram_mb": p_item["ram_mb"],
                "io_percent": p_item["io_percent"],
                "is_elevated": self._check_elevation(pid),
            })

        return {
            "top_processes": top_processes,
            "top_process_cpu_percent": top_process_cpu_percent,
            "top_process_io_percent": top_process_io_percent,
            "all_processes": raw_processes,
        }

    def get_process_count_above_threshold(
        self, processes: list[dict[str, Any]], metric: str, threshold: float
    ) -> int:
        """Count how many processes have a given metric above a threshold value."""
        count = 0
        for p in processes:
            val = p.get(metric, 0.0)
            if val is not None and val > threshold:
                count += 1
        return count


_process_collector_instance = ProcessCollector()


def collect_processes(top_n: int = 10) -> dict[str, Any]:
    """Convenience function to collect process metrics using shared instance."""
    if top_n != _process_collector_instance.top_n:
        _process_collector_instance.top_n = top_n
    return _process_collector_instance.collect()
