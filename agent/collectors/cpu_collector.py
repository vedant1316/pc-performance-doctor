"""CPU metrics collector.

Collects real-time CPU usage, per-core metrics, frequency, and CPU temperature
(via WMI/ACPI on Windows when available with graceful fallback).
"""

from __future__ import annotations

import logging
from typing import Any

import psutil

logger = logging.getLogger(__name__)


class CPUCollector:
    """Collector for CPU metrics."""

    def __init__(self) -> None:
        # Prime psutil CPU calculation on initialization
        try:
            psutil.cpu_percent(interval=None)
            psutil.cpu_percent(percpu=True, interval=None)
        except Exception as e:
            logger.debug("Initial CPU percent prime failed: %s", e)

        self._wmi_instance = None
        self._wmi_thermal_checked = False
        self._wmi_thermal_available = False

    def _get_wmi(self) -> Any:
        """Lazily initialize WMI client."""
        if self._wmi_instance is None:
            try:
                import wmi
                self._wmi_instance = wmi.WMI()
            except Exception as e:
                logger.debug("WMI initialization failed: %s", e)
                self._wmi_instance = None
        return self._wmi_instance

    def get_cpu_temperature(self) -> float | None:
        """Attempt to read CPU temperature in Celsius.

        Falls back gracefully to None if unsupported, restricted by permissions,
        or WMI counters are unavailable.
        """
        # 1. Try LibreHardwareMonitor / OpenHardwareMonitor WMI namespace if running
        try:
            import wmi
            ohm = wmi.WMI(namespace=r"root\OpenHardwareMonitor")
            sensors = ohm.Sensor()
            cpu_temps = [
                s.Value for s in sensors
                if getattr(s, "SensorType", "") == "Temperature" and "CPU" in getattr(s, "Name", "")
            ]
            if cpu_temps:
                return round(float(sum(cpu_temps) / len(cpu_temps)), 1)
        except Exception:
            pass

        # 2. Try MSAcpi_ThermalZoneTemperature (ACPI thermal zone, tenths of Kelvin)
        try:
            import wmi
            w_wmi = wmi.WMI(namespace=r"root\wmi")
            zones = w_wmi.MSAcpi_ThermalZoneTemperature()
            for zone in zones:
                temp_raw = getattr(zone, "CurrentTemperature", None)
                if temp_raw and temp_raw > 0:
                    temp_c = (temp_raw / 10.0) - 273.15
                    if 0.0 <= temp_c <= 125.0:
                        return round(temp_c, 1)
        except Exception:
            pass

        # 3. Try Win32_PerfFormattedData_Counters_ThermalZoneInformation
        try:
            w = self._get_wmi()
            if w:
                for zone in w.Win32_PerfFormattedData_Counters_ThermalZoneInformation():
                    temp_raw = getattr(zone, "Temperature", None)
                    if temp_raw and temp_raw > 0:
                        # Temperature is in Kelvin
                        temp_c = float(temp_raw) - 273.15
                        if 0.0 <= temp_c <= 125.0:
                            return round(temp_c, 1)
        except Exception:
            pass

        # 4. Try psutil sensors if platform supports it
        try:
            if hasattr(psutil, "sensors_temperatures"):
                temps = psutil.sensors_temperatures()
                if temps:
                    for name, entries in temps.items():
                        if "cpu" in name.lower() or "core" in name.lower():
                            for entry in entries:
                                if entry.current:
                                    return round(float(entry.current), 1)
        except Exception:
            pass

        return None

    def get_cpu_frequency(self) -> float | None:
        """Get current CPU frequency in MHz."""
        try:
            freq = psutil.cpu_freq()
            if freq and freq.current:
                return round(float(freq.current), 1)
        except Exception as e:
            logger.debug("Failed to get CPU frequency: %s", e)
        return None

    def get_per_core_percent(self) -> list[float]:
        """Get CPU usage percent for each core."""
        try:
            cores = psutil.cpu_percent(percpu=True, interval=None)
            return [round(float(c), 1) for c in cores]
        except Exception as e:
            logger.debug("Failed to get per-core CPU percent: %s", e)
            return []

    def collect(self) -> dict[str, Any]:
        """Collect all CPU metrics.

        Returns:
            dict containing:
                - cpu_percent: float
                - cpu_temp_c: float | None
                - per_core_percent: list[float]
                - cpu_freq_mhz: float | None
        """
        try:
            cpu_pct = float(psutil.cpu_percent(interval=None))
        except Exception as e:
            logger.warning("Failed to collect cpu_percent: %s", e)
            cpu_pct = 0.0

        return {
            "cpu_percent": round(cpu_pct, 1),
            "cpu_temp_c": self.get_cpu_temperature(),
            "per_core_percent": self.get_per_core_percent(),
            "cpu_freq_mhz": self.get_cpu_frequency(),
        }


_cpu_collector_instance = CPUCollector()


def collect_cpu() -> dict[str, Any]:
    """Convenience function to collect CPU metrics using shared instance."""
    return _cpu_collector_instance.collect()
