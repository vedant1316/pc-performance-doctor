"""Diagnostics package for PC Performance Doctor.

Exposes the rule-based DiagnosticEngine and models for evaluating system telemetry
against declarative rules without LLM intervention.
"""

from __future__ import annotations

from .engine import (
    DiagnosticEngine,
    diagnose_snapshot,
    get_diagnostic_engine,
)
from .models import (
    Diagnosis,
    DiagnosticRule,
    RuleCondition,
    RuleOutput,
)

__all__ = [
    "Diagnosis",
    "DiagnosticEngine",
    "DiagnosticRule",
    "RuleCondition",
    "RuleOutput",
    "diagnose_snapshot",
    "get_diagnostic_engine",
]
