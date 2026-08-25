"""AI Explanation Layer for PC Performance Doctor.

Consumes already-computed structured diagnoses from the deterministic Phase 3 engine,
constructs the standardized prompts, calls the OpenAI-compatible API, and validates
the structured response schema.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
import json
import logging
import re
from typing import Any, Literal

from diagnostics.models import Diagnosis
from .client import (
    AIClientError,
    MissingConfigurationError,
    OpenAICompatibleClient,
)
from .prompts import SYSTEM_PROMPT, build_user_prompt

logger = logging.getLogger(__name__)

FALLBACK_NOTE = "AI explanation unavailable — showing rules-engine diagnosis only."

VALID_DIFFICULTIES = {"easy", "medium", "advanced"}
VALID_IMPACTS = {"low", "medium", "high"}


class SchemaValidationError(AIClientError):
    """Raised when LLM response does not adhere to required JSON schema."""
    pass


@dataclass
class FixItem:
    """Individual actionable remediation step."""
    action: str
    difficulty: Literal["easy", "medium", "advanced"] = "easy"
    impact: Literal["low", "medium", "high"] = "medium"

    def to_dict(self) -> dict[str, str]:
        return {
            "action": self.action,
            "difficulty": self.difficulty,
            "impact": self.impact,
        }


@dataclass
class ValidatedExplanation:
    """Validated structured explanation payload matching Section 9 schema."""
    summary: str
    root_cause: str
    contributing_processes: list[str] = field(default_factory=list)
    fixes: list[FixItem] = field(default_factory=list)
    expected_improvement: str = ""

    def to_dict(self) -> dict[str, Any]:
        return {
            "summary": self.summary,
            "root_cause": self.root_cause,
            "contributing_processes": self.contributing_processes,
            "fixes": [f.to_dict() for f in self.fixes],
            "expected_improvement": self.expected_improvement,
        }


@dataclass
class ExplanationResult:
    """Result container from an AI explanation attempt."""
    succeeded: bool
    explanation: dict[str, Any] | None = None
    error_message: str | None = None
    raw_response: str | None = None

    def get_fallback_explanation(self, diagnosis: Diagnosis | dict[str, Any]) -> dict[str, Any]:
        """Return fallback explanation payload when LLM call is unavailable."""
        label = diagnosis.label if isinstance(diagnosis, Diagnosis) else diagnosis.get("label", "Unknown")
        rule_desc = (
            diagnosis.rule_description
            if isinstance(diagnosis, Diagnosis)
            else diagnosis.get("rule_description", "")
        )
        return {
            "summary": FALLBACK_NOTE,
            "root_cause": rule_desc or f"Bottleneck identified as {label} by local diagnostic engine.",
            "contributing_processes": (
                diagnosis.contributing_processes
                if isinstance(diagnosis, Diagnosis)
                else diagnosis.get("contributing_processes", [])
            ),
            "fixes": [],
            "expected_improvement": "Rules-engine diagnosis without AI enhancement.",
        }


class AIExplainer:
    """Orchestrates AI explanations from deterministic diagnoses."""

    def __init__(self, client: OpenAICompatibleClient | None = None) -> None:
        self.client = client or OpenAICompatibleClient()

    def _clean_json_string(self, text: str) -> str:
        """Extract valid JSON from LLM output, stripping markdown fences if present."""
        cleaned = text.strip()
        # Strip ```json ... ``` or ``` ... ``` code blocks
        if cleaned.startswith("```"):
            lines = cleaned.splitlines()
            if lines[0].startswith("```"):
                lines = lines[1:]
            if lines and lines[-1].startswith("```"):
                lines = lines[:-1]
            cleaned = "\n".join(lines).strip()
        return cleaned

    def validate_schema(self, data: dict[str, Any]) -> ValidatedExplanation:
        """Validate parsed dictionary against required Section 9 schema.

        Schema:
        {
          "summary": str (1-2 sentences),
          "root_cause": str (mechanism),
          "contributing_processes": list[str],
          "fixes": [
            {
              "action": str,
              "difficulty": "easy" | "medium" | "advanced",
              "impact": "low" | "medium" | "high"
            }
          ],
          "expected_improvement": str
        }
        """
        if not isinstance(data, dict):
            raise SchemaValidationError("Root response is not a JSON object.")

        # 1. Summary
        summary = data.get("summary")
        if not isinstance(summary, str) or not summary.strip():
            raise SchemaValidationError("Field 'summary' must be a non-empty string.")

        # 2. Root cause
        root_cause = data.get("root_cause")
        if not isinstance(root_cause, str) or not root_cause.strip():
            raise SchemaValidationError("Field 'root_cause' must be a non-empty string.")

        # 3. Contributing processes
        raw_procs = data.get("contributing_processes", [])
        if not isinstance(raw_procs, list):
            raise SchemaValidationError("Field 'contributing_processes' must be a list of strings.")
        contributing_processes = [str(p) for p in raw_procs if p is not None]

        # 4. Fixes
        raw_fixes = data.get("fixes", [])
        if not isinstance(raw_fixes, list):
            raise SchemaValidationError("Field 'fixes' must be a list of fix objects.")

        validated_fixes: list[FixItem] = []
        for i, fix in enumerate(raw_fixes):
            if not isinstance(fix, dict):
                raise SchemaValidationError(f"Fix item at index {i} must be an object.")

            action = fix.get("action")
            if not isinstance(action, str) or not action.strip():
                raise SchemaValidationError(f"Fix item at index {i} missing non-empty 'action' string.")

            raw_diff = str(fix.get("difficulty", "easy")).lower().strip()
            difficulty = raw_diff if raw_diff in VALID_DIFFICULTIES else "medium"

            raw_impact = str(fix.get("impact", "medium")).lower().strip()
            impact = raw_impact if raw_impact in VALID_IMPACTS else "medium"

            validated_fixes.append(FixItem(
                action=action.strip(),
                difficulty=difficulty,  # type: ignore
                impact=impact,          # type: ignore
            ))

        # 5. Expected improvement
        expected_improvement = data.get("expected_improvement")
        if not isinstance(expected_improvement, str) or not expected_improvement.strip():
            raise SchemaValidationError("Field 'expected_improvement' must be a non-empty string.")

        return ValidatedExplanation(
            summary=summary.strip(),
            root_cause=root_cause.strip(),
            contributing_processes=contributing_processes,
            fixes=validated_fixes,
            expected_improvement=expected_improvement.strip(),
        )

    def explain(
        self, diagnosis: Diagnosis | dict[str, Any]
    ) -> ExplanationResult:
        """Translate structured deterministic diagnosis into human-friendly explanation + fixes.

        The deterministic diagnosis is the SOLE input. Raw system metrics are never sent
        to prevent LLM from hallucinating or overriding the diagnosis.

        Args:
            diagnosis: The structured Diagnosis instance or dict from the rule engine.

        Returns:
            ExplanationResult containing success status and validated payload or fallback info.
        """
        # Convert diagnosis to structured dictionary
        if isinstance(diagnosis, Diagnosis):
            diag_dict = diagnosis.to_dict()
        elif isinstance(diagnosis, dict):
            # If wrapped in diagnosis_result shape, extract inner diagnosis
            diag_dict = diagnosis.get("diagnosis", diagnosis)
        else:
            return ExplanationResult(
                succeeded=False,
                error_message="Invalid diagnosis input type.",
            )

        # Build prompts
        user_prompt = build_user_prompt(diag_dict)
        messages = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ]

        logger.info(
            "Calling AI Explainer for diagnosis label: '%s', rule: '%s', severity: '%s'",
            diag_dict.get("label"),
            diag_dict.get("rule_id"),
            diag_dict.get("severity"),
        )

        try:
            raw_response = self.client.create_chat_completion(messages=messages)
            logger.debug("Raw LLM response received: %s", raw_response)

            cleaned_json_str = self._clean_json_string(raw_response)
            parsed_json = json.loads(cleaned_json_str)

            validated = self.validate_schema(parsed_json)
            explanation_payload = validated.to_dict()

            logger.info("Successfully validated AI explanation with %d fixes", len(validated.fixes))
            return ExplanationResult(
                succeeded=True,
                explanation=explanation_payload,
                raw_response=raw_response,
            )

        except MissingConfigurationError as e:
            logger.info("AI Explanation skipped: %s", e)
            return ExplanationResult(
                succeeded=False,
                error_message=f"Missing API configuration: {e}",
            )

        except SchemaValidationError as e:
            logger.warning("AI Explanation schema validation failed: %s", e)
            return ExplanationResult(
                succeeded=False,
                error_message=f"Schema validation error: {e}",
            )

        except json.JSONDecodeError as e:
            logger.warning("AI Explanation returned invalid JSON: %s", e)
            return ExplanationResult(
                succeeded=False,
                error_message=f"Malformed JSON from AI model: {e}",
            )

        except AIClientError as e:
            logger.warning("AI client call failed: %s", e)
            return ExplanationResult(
                succeeded=False,
                error_message=str(e),
            )

        except Exception as e:
            logger.error("Unexpected error in AI Explainer: %s", e, exc_info=True)
            return ExplanationResult(
                succeeded=False,
                error_message=f"Unexpected error: {e}",
            )
