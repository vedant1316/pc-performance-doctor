"""GPU metrics collector.

Collects real-time GPU load, temperature, VRAM utilization, and device name using
GPUtil (for NVIDIA GPUs) with graceful WMI / fallback for AMD, Intel, or systems without dedicated GPUs.
"""

from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger(__name__)


class GPUCollector:
    """Collector for GPU utilization, temperature, and memory metrics."""

    def __init__(self) -> None:
        self._wmi_instance = None
        self._cached_gpu_name: str | None = None

    def _get_wmi(self) -> Any:
        """Lazily initialize WMI client."""
        if self._wmi_instance is None:
            try:
                import wmi
                self._wmi_instance = wmi.WMI()
            except Exception as e:
                logger.debug("WMI GPU initialization failed: %s", e)
                self._wmi_instance = None
        return self._wmi_instance

    def _collect_gputil(self) -> dict[str, Any] | None:
        """Attempt to read metrics from GPUtil (NVIDIA)."""
        try:
            import GPUtil
            gpus = GPUtil.getGPUs()
            if gpus:
                primary_gpu = gpus[0]
                return {
                    "gpu_percent": round(float(primary_gpu.load * 100.0), 1),
                    "gpu_temp_c": round(float(primary_gpu.temperature), 1) if primary_gpu.temperature is not None else None,
                    "gpu_vram_percent": round(float(primary_gpu.memoryUtil * 100.0), 1),
                    "gpu_name": str(primary_gpu.name),
                }
        except Exception as e:
            logger.debug("GPUtil collection unavailable: %s", e)
        return None

    def _get_wmi_gpu_info(self) -> dict[str, Any]:
        """Fallback to WMI for GPU hardware info and performance counters."""
        gpu_name: str | None = self._cached_gpu_name
        gpu_percent: float | None = None
        gpu_temp_c: float | None = None
        gpu_vram_percent: float | None = None

        try:
            w = self._get_wmi()
            if w:
                if gpu_name is None:
                    controllers = w.Win32_VideoController()
                    names = [c.Name for c in controllers if getattr(c, "Name", None)]
                    if names:
                        # Prefer dedicated GPU names over basic/virtual display adapters
                        dedicated = [n for n in names if any(k in n.lower() for k in ("nvidia", "amd", "radeon", "geforce", "rtx", "gtx"))]
                        gpu_name = dedicated[0] if dedicated else names[0]
                        self._cached_gpu_name = gpu_name

                # Try reading GPU engine performance counters if available
                try:
                    engine_counters = w.Win32_PerfFormattedData_GPUPerformanceCounters_GPUEngine()
                    utilizations = [
                        float(c.UtilizationPercentage)
                        for c in engine_counters
                        if hasattr(c, "UtilizationPercentage") and float(c.UtilizationPercentage) > 0
                    ]
                    if utilizations:
                        gpu_percent = min(100.0, round(max(utilizations), 1))
                except Exception:
                    pass
        except Exception as e:
            logger.debug("WMI GPU query error: %s", e)

        return {
            "gpu_percent": gpu_percent,
            "gpu_temp_c": gpu_temp_c,
            "gpu_vram_percent": gpu_vram_percent,
            "gpu_name": gpu_name,
        }

    def collect(self) -> dict[str, Any]:
        """Collect GPU metrics.

        Returns:
            dict containing:
                - gpu_percent: float | None
                - gpu_temp_c: float | None
                - gpu_vram_percent: float | None
                - gpu_name: str | None
        """
        # 1. Try GPUtil first (best for NVIDIA)
        gputil_result = self._collect_gputil()
        if gputil_result is not None:
            return gputil_result

        # 2. Fallback to WMI
        return self._get_wmi_gpu_info()


_gpu_collector_instance = GPUCollector()


def collect_gpu() -> dict[str, Any]:
    """Convenience function to collect GPU metrics using shared instance."""
    return _gpu_collector_instance.collect()
