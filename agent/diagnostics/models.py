"""Data models for PC Performance Doctor diagnostic engine.

Defines structures for diagnostic rules, evaluation conditions, rule outputs,
and structured diagnosis results matching the project reference specification.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from typing import Any, Literal


@dataclass
class RuleCondition:
    """Individual metric evaluation condition within a diagnostic rule."""

    metric: str
    operator: str  # '>', '<', '==', '>=', '<=', '!='
    value: float | int
    label: str | None = None
    relative: bool = False
    threshold_metric: str | None = None
    threshold_value: float | int | None = None

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> RuleCondition:
        return cls(
            metric=data["metric"],
            operator=data["operator"],
            value=data["value"],
            label=data.get("label"),
            relative=bool(data.get("relative", False)),
            threshold_metric=data.get("threshold_metric"),
            threshold_value=data.get("threshold_value"),
        )


@dataclass
class RuleOutput:
    """Output specification when a diagnostic rule matches."""

    label: str
    severity: Literal["none", "low", "medium", "high"]
    health_score_penalty: int = 0

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> RuleOutput:
        return cls(
            label=data["label"],
            severity=data["severity"],
            health_score_penalty=int(data.get("health_score_penalty", 0)),
        )


@dataclass
class DiagnosticRule:
    """Declarative rule specification loaded from rules.yaml."""

    id: str
    description: str
    conditions: list[RuleCondition] = field(default_factory=list)
    output: RuleOutput = field(default_factory=lambda: RuleOutput("nominal", "none", 0))

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> DiagnosticRule:
        conditions = [RuleCondition.from_dict(c) for c in data.get("conditions", [])]
        output = RuleOutput.from_dict(data.get("output", {}))
        return cls(
            id=data["id"],
            description=data.get("description", "").strip(),
            conditions=conditions,
            output=output,
        )


@dataclass
class Diagnosis:
    """Structured diagnosis result produced deterministically by the rule engine."""

    label: str
    rule_id: str
    severity: Literal["none", "low", "medium", "high"]
    health_score: int
    contributing_processes: list[str] = field(default_factory=list)
    rule_description: str = ""
    timestamp: str = field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    )

    def to_dict(self) -> dict[str, Any]:
        """Convert diagnosis into the structured dictionary required by the reference schema."""
        return {
            "label": self.label,
            "rule_id": self.rule_id,
            "severity": self.severity,
            "health_score": self.health_score,
            "contributing_processes": self.contributing_processes,
        }

    def to_full_dict(self) -> dict[str, Any]:
        """Convert diagnosis including metadata fields."""
        return {
            "timestamp": self.timestamp,
            "label": self.label,
            "rule_id": self.rule_id,
            "severity": self.severity,
            "health_score": self.health_score,
            "contributing_processes": self.contributing_processes,
            "rule_description": self.rule_description,
        }

    def to_diagnosis_response(
        self,
        explanation: dict[str, Any] | None = None,
        llm_call_succeeded: bool = False,
    ) -> dict[str, Any]:
        """Format as WebSocket diagnosis_result response matching Section 10 contract."""
        default_explanation = {
            "summary": self.rule_description or f"Diagnostic rule '{self.rule_id}' matched.",
            "root_cause": f"Identified bottleneck: {self.label}",
            "fixes": [],
            "expected_improvement": "Rule-based diagnosis without AI enhancement.",
        }

        return {
            "type": "diagnosis_result",
            "diagnosis": self.to_dict(),
            "explanation": explanation or default_explanation,
            "llm_call_succeeded": llm_call_succeeded,
        }
