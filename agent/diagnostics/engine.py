"""Deterministic Diagnostic Engine for PC Performance Doctor.

Evaluates live system performance snapshots against declarative rules defined
in rules.yaml to identify hardware bottlenecks, determine root causes, assess
severity, calculate health scores, and pinpoint contributing processes.
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

import psutil
import yaml

from collectors import MetricsSnapshot
from config import settings
from .models import Diagnosis, DiagnosticRule, RuleCondition

logger = logging.getLogger(__name__)

# Default estimated link capacity (100 Mbps in bytes/sec) if interface speed is not reported
DEFAULT_LINK_CAPACITY_BYTES_PER_SEC = 12_500_000  # 100 Mbps / 8


class DiagnosticEngine:
    """Rule-based, deterministic diagnostic engine."""

    def __init__(self, rules_path: str | Path | None = None) -> None:
        self.rules_path = self._resolve_rules_path(rules_path)
        self.rules: list[DiagnosticRule] = []
        self._cached_link_capacity_bps: int | None = None
        self.load_rules()

    def _resolve_rules_path(self, path: str | Path | None) -> Path:
        """Resolve absolute path to rules.yaml file."""
        if path:
            candidate = Path(path)
            if candidate.is_absolute() and candidate.exists():
                return candidate
            # Try relative to repo root / agent root
            rel_candidate = (Path(__file__).resolve().parent.parent / path).resolve()
            if rel_candidate.exists():
                return rel_candidate
            if candidate.exists():
                return candidate.resolve()

        # Try settings.RULES_PATH
        config_path = Path(settings.RULES_PATH)
        if config_path.is_absolute() and config_path.exists():
            return config_path
        
        agent_dir = Path(__file__).resolve().parent.parent
        agent_candidate = (agent_dir / settings.RULES_PATH).resolve()
        if agent_candidate.exists():
            return agent_candidate

        # Fallback to local diagnostics/rules.yaml
        local_candidate = Path(__file__).resolve().parent / "rules.yaml"
        return local_candidate

    def load_rules(self, path: str | Path | None = None) -> list[DiagnosticRule]:
        """Load and parse diagnostic rules from YAML file."""
        if path:
            self.rules_path = self._resolve_rules_path(path)

        if not self.rules_path.exists():
            logger.error("Diagnostic rules file not found at: %s", self.rules_path)
            raise FileNotFoundError(f"Diagnostic rules file not found: {self.rules_path}")

        try:
            with open(self.rules_path, "r", encoding="utf-8") as f:
                data = yaml.safe_load(f)

            raw_rules = data.get("rules", [])
            self.rules = [DiagnosticRule.from_dict(r) for r in raw_rules]
            logger.info("Loaded %d diagnostic rules from %s", len(self.rules), self.rules_path)
            return self.rules
        except Exception as e:
            logger.error("Failed to parse diagnostic rules from %s: %s", self.rules_path, e)
            raise

    def get_estimated_link_capacity_bps(self) -> int:
        """Estimate the maximum network interface link capacity in bytes per second."""
        if self._cached_link_capacity_bps is not None:
            return self._cached_link_capacity_bps

        max_speed_mbps = 0
        try:
            stats = psutil.net_if_stats()
            for iface_name, iface_stat in stats.items():
                if iface_stat.isup and iface_stat.speed > max_speed_mbps:
                    max_speed_mbps = iface_stat.speed
        except Exception as e:
            logger.debug("Failed to query net_if_stats for link capacity: %s", e)

        if max_speed_mbps > 0:
            # speed in Mbps -> Bytes per second
            capacity = int(max_speed_mbps * 1_000_000 / 8)
        else:
            capacity = DEFAULT_LINK_CAPACITY_BYTES_PER_SEC

        self._cached_link_capacity_bps = capacity
        return capacity

    def _extract_metric_value(
        self, snapshot: MetricsSnapshot | dict[str, Any], metric_name: str
    ) -> Any:
        """Extract named metric from snapshot object or dictionary."""
        if isinstance(snapshot, dict):
            return snapshot.get(metric_name)
        return getattr(snapshot, metric_name, None)

    def _compare_values(self, actual: float | int, op: str, expected: float | int) -> bool:
        """Perform comparison operation between actual metric value and expected threshold."""
        if op == ">":
            return actual > expected
        elif op == "<":
            return actual < expected
        elif op == ">=":
            return actual >= expected
        elif op == "<=":
            return actual <= expected
        elif op == "==":
            # For 100% saturation metrics, accept >= 100.0 or exact match
            if expected == 100 and actual >= 100.0:
                return True
            return abs(actual - expected) < 1e-5 or actual == expected
        elif op == "!=":
            return actual != expected
        else:
            logger.warning("Unsupported comparison operator: %s", op)
            return False

    def _evaluate_condition(
        self, condition: RuleCondition, snapshot: MetricsSnapshot | dict[str, Any]
    ) -> bool:
        """Evaluate a single rule condition against the metrics snapshot."""
        # 1. Process count above threshold condition
        if condition.metric == "process_count_above_threshold":
            threshold_metric = condition.threshold_metric or "cpu_percent"
            threshold_value = condition.threshold_value if condition.threshold_value is not None else 0.0

            processes = (
                snapshot.all_processes
                if hasattr(snapshot, "all_processes") and snapshot.all_processes
                else self._extract_metric_value(snapshot, "top_processes") or []
            )

            count = sum(
                1
                for p in processes
                if p.get(threshold_metric) is not None and p.get(threshold_metric, 0.0) > threshold_value
            )
            return self._compare_values(count, condition.operator, condition.value)

        # 2. Extract standard metric value
        actual_val = self._extract_metric_value(snapshot, condition.metric)
        if actual_val is None:
            # Missing or unsupported hardware metric (e.g. no GPU or temp sensor unavailable)
            return False

        # 3. Relative metric evaluation (e.g. net_recv_bps relative to link capacity)
        if condition.relative:
            link_capacity = self.get_estimated_link_capacity_bps()
            if link_capacity <= 0:
                return False
            actual_ratio = float(actual_val) / float(link_capacity)
            return self._compare_values(actual_ratio, condition.operator, float(condition.value))

        # 4. Standard absolute comparison
        try:
            return self._compare_values(float(actual_val), condition.operator, float(condition.value))
        except (ValueError, TypeError):
            return False

    def _extract_contributing_processes(
        self, rule_id: str, snapshot: MetricsSnapshot | dict[str, Any]
    ) -> list[str]:
        """Extract names of processes primarily responsible for the matched bottleneck."""
        if rule_id == "nominal":
            return []

        top_procs: list[dict[str, Any]] = (
            snapshot.top_processes
            if hasattr(snapshot, "top_processes")
            else self._extract_metric_value(snapshot, "top_processes") or []
        )
        all_procs: list[dict[str, Any]] = (
            snapshot.all_processes
            if hasattr(snapshot, "all_processes") and snapshot.all_processes
            else top_procs
        )

        candidates: list[str] = []

        if rule_id == "memory_pressure":
            # Sort by RAM usage descending
            sorted_mem = sorted(all_procs, key=lambda x: x.get("ram_mb", 0.0), reverse=True)
            for p in sorted_mem[:3]:
                name = p.get("name")
                if name and name not in candidates:
                    candidates.append(name)

        elif rule_id == "disk_bottleneck":
            # Dominating I/O process causing disk bottleneck (rule requires top_process_io_percent > 70)
            sorted_io = sorted(all_procs, key=lambda x: x.get("io_percent", 0.0), reverse=True)
            for p in sorted_io:
                name = p.get("name")
                if name and p.get("io_percent", 0.0) >= 50.0:
                    candidates.append(name)
                    break
            if not candidates and sorted_io:
                top_name = sorted_io[0].get("name")
                if top_name:
                    candidates.append(top_name)

        elif rule_id == "thermal_throttling":
            # Dominating CPU process causing high workload (rule requires top_process_cpu_percent > 70)
            sorted_cpu = sorted(all_procs, key=lambda x: x.get("cpu_percent", 0.0), reverse=True)
            for p in sorted_cpu:
                name = p.get("name")
                if name and p.get("cpu_percent", 0.0) >= 50.0:
                    candidates.append(name)
                    break
            if not candidates and sorted_cpu:
                top_name = sorted_cpu[0].get("name")
                if top_name:
                    candidates.append(top_name)

        elif rule_id == "background_process_sprawl":
            # Processes consuming > 5% CPU
            for p in all_procs:
                if p.get("cpu_percent", 0.0) > 5.0:
                    name = p.get("name")
                    if name and name not in candidates:
                        candidates.append(name)
            if len(candidates) > 5:
                candidates = candidates[:5]

        elif rule_id in ("gpu_bound", "network_saturation"):
            # Top active processes
            for p in top_procs[:2]:
                name = p.get("name")
                if name and name not in candidates:
                    candidates.append(name)

        return candidates

    def evaluate(self, snapshot: MetricsSnapshot | dict[str, Any]) -> Diagnosis:
        """Evaluate a metrics snapshot against all rules and return structured diagnosis.

        Rules are evaluated sequentially from top to bottom. The first rule whose
        conditions are all satisfied wins. If no bottleneck rule fires, 'nominal'
        serves as the default fallback.
        """
        for rule in self.rules:
            # An empty condition list (e.g. nominal rule) matches unconditionally
            if not rule.conditions:
                penalty = rule.output.health_score_penalty
                health_score = max(0, min(100, 100 - penalty))
                return Diagnosis(
                    label=rule.output.label,
                    rule_id=rule.id,
                    severity=rule.output.severity,
                    health_score=health_score,
                    contributing_processes=[],
                    rule_description=rule.description,
                )

            # Evaluate all conditions in the rule
            all_matched = True
            for condition in rule.conditions:
                if not self._evaluate_condition(condition, snapshot):
                    all_matched = False
                    break

            if all_matched:
                penalty = rule.output.health_score_penalty
                health_score = max(0, min(100, 100 - penalty))
                contributing = self._extract_contributing_processes(rule.id, snapshot)

                return Diagnosis(
                    label=rule.output.label,
                    rule_id=rule.id,
                    severity=rule.output.severity,
                    health_score=health_score,
                    contributing_processes=contributing,
                    rule_description=rule.description,
                )

        # Fallback nominal diagnosis in case rules list is empty
        return Diagnosis(
            label="nominal",
            rule_id="nominal",
            severity="none",
            health_score=100,
            contributing_processes=[],
            rule_description="All metrics within healthy ranges — no bottleneck detected.",
        )


_default_engine: DiagnosticEngine | None = None


def get_diagnostic_engine() -> DiagnosticEngine:
    """Get or create singleton DiagnosticEngine instance."""
    global _default_engine
    if _default_engine is None:
        _default_engine = DiagnosticEngine()
    return _default_engine


def diagnose_snapshot(snapshot: MetricsSnapshot | dict[str, Any]) -> Diagnosis:
    """Convenience function to evaluate a snapshot using the default engine instance."""
    return get_diagnostic_engine().evaluate(snapshot)
