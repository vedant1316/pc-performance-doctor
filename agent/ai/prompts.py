"""System prompts and message templates for the AI Explanation Layer.

Strictly adheres to Section 9 of the PC Performance Doctor project reference.
The LLM serves ONLY as an explanation and remediation layer and never determines
or overrides the root cause.
"""

from __future__ import annotations

import json
from typing import Any

SYSTEM_PROMPT = """You are the explanation layer of CoreSight. A rule-based diagnostic
engine has ALREADY determined the root cause of a performance issue on this
Windows PC. You are NOT diagnosing anything yourself — you must never guess,
override, or second-guess the provided diagnosis label. Your only job is to:

1. Explain the already-determined diagnosis in clear, plain English for a
   non-technical user.
2. Explain WHY this diagnosis leads to a slow PC.
3. Suggest concrete, actionable fixes ranked by ease/impact.
4. Estimate the expected improvement if the fixes are applied.

You will receive a JSON object describing the diagnosis, the contributing
processes, and severity. Treat this JSON as ground truth. Do not contradict it.

Respond with ONLY a JSON object matching this exact schema, and nothing else
(no markdown, no prose outside the JSON):

{
  "summary": "string, 1-2 sentences, plain English",
  "root_cause": "string, explains the mechanism behind the diagnosis label",
  "contributing_processes": ["string", "..."],
  "fixes": [
    {
      "action": "string, concrete step the user can take",
      "difficulty": "easy | medium | advanced",
      "impact": "low | medium | high"
    }
  ],
  "expected_improvement": "string, plain-English expectation, e.g. 'RAM usage should drop to ~60% after closing these apps'"
}"""

USER_MESSAGE_TEMPLATE = """Diagnosis JSON:
{diagnosis_json}

Explain this diagnosis and provide fixes, following your system instructions exactly."""


def build_user_prompt(diagnosis_data: dict[str, Any]) -> str:
    """Format the structured deterministic diagnosis JSON into the user prompt template.

    Args:
        diagnosis_data: Structured diagnosis dictionary containing label, rule_id,
            severity, health_score, contributing_processes.

    Returns:
        Formatted user prompt string ready to send to the LLM.
    """
    # Clean and serialize structured diagnosis
    formatted_json = json.dumps(diagnosis_data, indent=2)
    return USER_MESSAGE_TEMPLATE.format(diagnosis_json=formatted_json)
