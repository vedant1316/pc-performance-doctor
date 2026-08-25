"""Unit and integration tests for Phase 5 AI Explanation Layer.

Covers:
- Prompt generation with structured diagnosis as sole authority
- Client creation, endpoint routing, and header handling
- Successful LLM response parsing and schema validation
- Malformed JSON handling
- Missing fields schema validation failure
- Network, timeout, auth, and rate-limit error handling
- Missing API configuration handling
- Deterministic diagnosis preservation on AI failure
- SQLite persistence of AI explanations
- WebSocket end-to-end flow with AI explanation
"""

from __future__ import annotations

import asyncio
import json
import socket
import urllib.error
import pytest
from unittest.mock import MagicMock, patch

from ai.client import (
    AIClientError,
    APIResponseError,
    AuthenticationError,
    ConnectionError,
    MissingConfigurationError,
    OpenAICompatibleClient,
    RateLimitError,
    TimeoutError,
)
from ai.explainer import (
    AIExplainer,
    ExplanationResult,
    FALLBACK_NOTE,
    SchemaValidationError,
)
from ai.prompts import SYSTEM_PROMPT, USER_MESSAGE_TEMPLATE, build_user_prompt
from diagnostics.models import Diagnosis
from server.ws_server import AgentWebSocketServer
from storage.db import DatabaseManager


# ---------------------------------------------------------------------------
# 1. Prompt Generation & Authority Verification Tests
# ---------------------------------------------------------------------------

def test_prompt_generation_receives_structured_diagnosis_not_raw_metrics():
    """Verify LLM prompt is constructed strictly from the structured diagnosis."""
    diagnosis = Diagnosis(
        label="memory_pressure",
        rule_id="memory_pressure",
        severity="high",
        health_score=60,
        contributing_processes=["chrome.exe", "Teams.exe"],
        rule_description="RAM is critically high and swapping to pagefile.",
    )

    user_prompt = build_user_prompt(diagnosis.to_dict())

    # Verify structured fields are in prompt
    assert "memory_pressure" in user_prompt
    assert "chrome.exe" in user_prompt
    assert "Teams.exe" in user_prompt
    assert "high" in user_prompt
    assert "60" in user_prompt
    # Verify raw collector telemetry counters are NOT in user prompt
    assert "disk_read_bps" not in user_prompt
    assert "net_recv_bps" not in user_prompt
    assert "cpu_freq_mhz" not in user_prompt


def test_system_prompt_enforces_sole_authority_rule():
    """Verify system prompt explicitly instructs the LLM not to override the diagnosis."""
    assert "A rule-based diagnostic" in SYSTEM_PROMPT
    assert "engine has ALREADY determined the root cause" in SYSTEM_PROMPT
    assert "You are NOT diagnosing anything yourself" in SYSTEM_PROMPT
    assert "never guess,\noverride, or second-guess" in SYSTEM_PROMPT or "never guess" in SYSTEM_PROMPT
    assert "Treat this JSON as ground truth. Do not contradict it." in SYSTEM_PROMPT


# ---------------------------------------------------------------------------
# 2. Client & Error Handling Tests
# ---------------------------------------------------------------------------

def test_client_missing_configuration_error():
    """Client raises MissingConfigurationError if API key is missing for remote base URL."""
    client = OpenAICompatibleClient(
        base_url="https://api.openai.com/v1",
        api_key="",
        model="gpt-4o-mini",
    )
    assert not client.is_configured()
    with pytest.raises(MissingConfigurationError):
        client.create_chat_completion([{"role": "user", "content": "hello"}])


def test_client_authentication_error():
    """Client translates HTTP 401/403 into AuthenticationError."""
    client = OpenAICompatibleClient(
        base_url="https://api.openai.com/v1",
        api_key="invalid-key",
    )

    with patch("urllib.request.urlopen") as mock_urlopen:
        mock_err = urllib.error.HTTPError(
            url="https://api.openai.com/v1/chat/completions",
            code=401,
            msg="Unauthorized",
            hdrs={},
            fp=MagicMock(read=lambda: b'{"error": "Invalid API key"}'),
        )
        mock_urlopen.side_effect = mock_err

        with pytest.raises(AuthenticationError):
            client.create_chat_completion([{"role": "user", "content": "hi"}])


def test_client_rate_limit_error():
    """Client translates HTTP 429 into RateLimitError."""
    client = OpenAICompatibleClient(
        base_url="https://api.openai.com/v1",
        api_key="valid-key",
    )

    with patch("urllib.request.urlopen") as mock_urlopen:
        mock_err = urllib.error.HTTPError(
            url="https://api.openai.com/v1/chat/completions",
            code=429,
            msg="Too Many Requests",
            hdrs={},
            fp=MagicMock(read=lambda: b'{"error": "Rate limit exceeded"}'),
        )
        mock_urlopen.side_effect = mock_err

        with pytest.raises(RateLimitError):
            client.create_chat_completion([{"role": "user", "content": "hi"}])


def test_client_timeout_error():
    """Client translates socket / request timeout into TimeoutError."""
    client = OpenAICompatibleClient(
        base_url="https://api.openai.com/v1",
        api_key="valid-key",
    )

    with patch("urllib.request.urlopen") as mock_urlopen:
        mock_urlopen.side_effect = socket.timeout("Operation timed out")

        with pytest.raises(TimeoutError):
            client.create_chat_completion([{"role": "user", "content": "hi"}])


def test_client_connection_error():
    """Client translates URLError network failure into ConnectionError."""
    client = OpenAICompatibleClient(
        base_url="https://api.openai.com/v1",
        api_key="valid-key",
    )

    with patch("urllib.request.urlopen") as mock_urlopen:
        mock_urlopen.side_effect = urllib.error.URLError("Connection refused")

        with pytest.raises(ConnectionError):
            client.create_chat_completion([{"role": "user", "content": "hi"}])


# ---------------------------------------------------------------------------
# 3. AI Explainer & Schema Validation Tests
# ---------------------------------------------------------------------------

SAMPLE_VALID_LLM_RESPONSE = json.dumps({
    "summary": "Your system is under severe memory pressure because active applications have exhausted physical RAM.",
    "root_cause": "Chrome and Teams are consuming excess memory, forcing Windows to swap memory pages to the slower pagefile.",
    "contributing_processes": ["chrome.exe", "Teams.exe"],
    "fixes": [
        {
            "action": "Close unused browser tabs in Google Chrome.",
            "difficulty": "easy",
            "impact": "high"
        },
        {
            "action": "Restart Microsoft Teams or disable hardware acceleration in Teams settings.",
            "difficulty": "medium",
            "impact": "medium"
        }
    ],
    "expected_improvement": "RAM usage should drop to ~55%, restoring instant window switching and eliminating disk swapping lag."
})


def test_ai_explainer_valid_response():
    """AIExplainer correctly parses and validates a conforming LLM JSON response."""
    mock_client = MagicMock(spec=OpenAICompatibleClient)
    mock_client.create_chat_completion.return_value = SAMPLE_VALID_LLM_RESPONSE

    explainer = AIExplainer(client=mock_client)
    diagnosis = Diagnosis(
        label="memory_pressure",
        rule_id="memory_pressure",
        severity="high",
        health_score=55,
        contributing_processes=["chrome.exe", "Teams.exe"],
    )

    result = explainer.explain(diagnosis)
    assert result.succeeded is True
    assert result.explanation is not None
    assert "memory pressure" in result.explanation["summary"].lower()
    assert result.explanation["contributing_processes"] == ["chrome.exe", "Teams.exe"]
    assert len(result.explanation["fixes"]) == 2
    assert result.explanation["fixes"][0]["difficulty"] == "easy"
    assert result.explanation["fixes"][0]["impact"] == "high"
    assert "RAM usage should drop" in result.explanation["expected_improvement"]


def test_ai_explainer_handles_markdown_code_fences():
    """AIExplainer cleanly strips ```json ... ``` code fences from LLM responses."""
    wrapped_response = f"```json\n{SAMPLE_VALID_LLM_RESPONSE}\n```"
    mock_client = MagicMock(spec=OpenAICompatibleClient)
    mock_client.create_chat_completion.return_value = wrapped_response

    explainer = AIExplainer(client=mock_client)
    diagnosis = Diagnosis(label="memory_pressure", rule_id="memory_pressure", severity="high", health_score=55)

    result = explainer.explain(diagnosis)
    assert result.succeeded is True
    assert result.explanation is not None
    assert len(result.explanation["fixes"]) == 2


def test_ai_explainer_handles_malformed_json():
    """AIExplainer gracefully catches malformed JSON without raising uncaught exceptions."""
    mock_client = MagicMock(spec=OpenAICompatibleClient)
    mock_client.create_chat_completion.return_value = "This is not JSON: {summary: broken"

    explainer = AIExplainer(client=mock_client)
    diagnosis = Diagnosis(label="disk_bottleneck", rule_id="disk_bottleneck", severity="high", health_score=65)

    result = explainer.explain(diagnosis)
    assert result.succeeded is False
    assert result.explanation is None
    assert "Malformed JSON" in str(result.error_message)

    # Fallback explanation is generated correctly
    fallback = result.get_fallback_explanation(diagnosis)
    assert fallback["summary"] == FALLBACK_NOTE
    assert fallback["fixes"] == []


def test_ai_explainer_handles_missing_required_fields():
    """AIExplainer catches missing required fields (e.g. missing 'fixes')."""
    incomplete_json = json.dumps({
        "summary": "High CPU workload detected.",
        "root_cause": "System is processing heavy tasks."
        # Missing contributing_processes, fixes, expected_improvement
    })
    mock_client = MagicMock(spec=OpenAICompatibleClient)
    mock_client.create_chat_completion.return_value = incomplete_json

    explainer = AIExplainer(client=mock_client)
    diagnosis = Diagnosis(label="thermal_throttling", rule_id="thermal_throttling", severity="high", health_score=55)

    result = explainer.explain(diagnosis)
    assert result.succeeded is False
    assert "Schema validation error" in str(result.error_message)


def test_ai_explainer_handles_api_exception_gracefully():
    """AIExplainer handles client exceptions (e.g. TimeoutError, AuthError) gracefully."""
    mock_client = MagicMock(spec=OpenAICompatibleClient)
    mock_client.create_chat_completion.side_effect = TimeoutError("Request timed out after 15s")

    explainer = AIExplainer(client=mock_client)
    diagnosis = Diagnosis(label="gpu_bound", rule_id="gpu_bound", severity="low", health_score=90)

    result = explainer.explain(diagnosis)
    assert result.succeeded is False
    assert "timed out" in str(result.error_message)
    fallback = result.get_fallback_explanation(diagnosis)
    assert fallback["summary"] == FALLBACK_NOTE


def test_deterministic_diagnosis_remains_intact_when_ai_fails():
    """Verify deterministic rule-engine fields remain 100% intact when AI fails."""
    diagnosis = Diagnosis(
        label="disk_bottleneck",
        rule_id="disk_bottleneck",
        severity="high",
        health_score=65,
        contributing_processes=["SearchIndexer.exe"],
    )

    mock_client = MagicMock(spec=OpenAICompatibleClient)
    mock_client.create_chat_completion.side_effect = AuthenticationError("Unauthorized")

    explainer = AIExplainer(client=mock_client)
    result = explainer.explain(diagnosis)
    assert result.succeeded is False

    # Check that deterministic fields are completely preserved
    assert diagnosis.label == "disk_bottleneck"
    assert diagnosis.rule_id == "disk_bottleneck"
    assert diagnosis.severity == "high"
    assert diagnosis.health_score == 65
    assert diagnosis.contributing_processes == ["SearchIndexer.exe"]


# ---------------------------------------------------------------------------
# 4. Storage Persistence & Update Tests
# ---------------------------------------------------------------------------

def test_db_update_diagnosis_explanation(tmp_path):
    """Verify SQLite records can be updated with AI explanations."""
    db_file = tmp_path / "test_perf.db"
    db = DatabaseManager(db_path=db_file)

    # 1. Save dummy snapshot
    snap_data = {
        "timestamp": "2026-08-25T10:00:00Z",
        "cpu_percent": 88.0,
        "ram_percent": 92.0,
        "ram_available_mb": 400,
        "disk_percent_busy": 50.0,
    }
    snap_id = db.save_snapshot(snap_data)

    # 2. Save initial deterministic diagnosis (llm_call_succeeded = 0)
    diagnosis = Diagnosis(
        label="memory_pressure",
        rule_id="memory_pressure",
        severity="high",
        health_score=60,
        contributing_processes=["chrome.exe"],
        timestamp="2026-08-25T10:00:00Z",
    )
    diag_id = db.save_diagnosis(snap_id, diagnosis)

    # 3. Update with AI explanation
    ai_expl = {
        "summary": "Memory pressure caused by browser tabs.",
        "root_cause": "Chrome memory leak.",
        "fixes": [{"action": "Close tabs", "difficulty": "easy", "impact": "high"}],
        "expected_improvement": "RAM usage down to 60%.",
    }
    updated = db.update_diagnosis_explanation(diag_id, ai_expl, llm_call_succeeded=True)
    assert updated is True

    # 4. Query timeline and verify stored explanation
    res = db.query_timeline()
    assert len(res["diagnoses"]) == 1
    stored_diag = res["diagnoses"][0]
    assert stored_diag["label"] == "memory_pressure"
    assert stored_diag["llm_summary"] == "Memory pressure caused by browser tabs."
    assert stored_diag["llm_root_cause"] == "Chrome memory leak."
    assert stored_diag["llm_call_succeeded"] is True
    assert len(stored_diag["llm_fixes"]) == 1
    assert stored_diag["llm_fixes"][0]["action"] == "Close tabs"

    db.close()


# ---------------------------------------------------------------------------
# 5. WebSocket Integration Flow Tests with AI Layer
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_websocket_server_diagnose_request_with_ai(tmp_path):
    """Test WebSocket diagnose_request message handling with mocked AIExplainer."""
    db_file = tmp_path / "test_ws_ai.db"
    db = DatabaseManager(db_path=db_file)

    mock_client = MagicMock(spec=OpenAICompatibleClient)
    mock_client.create_chat_completion.return_value = SAMPLE_VALID_LLM_RESPONSE
    explainer = AIExplainer(client=mock_client)

    server = AgentWebSocketServer(
        host="127.0.0.1",
        port=0,
        polling_interval_ms=500,
        db=db,
        ai_explainer=explainer,
    )

    mock_ws = MagicMock()
    mock_ws.remote_address = ("127.0.0.1", 12345)
    sent_messages = []

    async def mock_send(msg):
        sent_messages.append(json.loads(msg))

    mock_ws.send = mock_send
    server.clients[mock_ws] = asyncio.Lock()

    # Pre-populate a memory_pressure snapshot
    from collectors import MetricsSnapshot
    server._last_snapshot = MetricsSnapshot(
        timestamp="2026-08-25T10:00:00Z",
        cpu_percent=25.0,
        cpu_temp_c=50.0,
        ram_percent=95.0,
        ram_available_mb=300,
        pagefile_percent=65.0,
        disk_percent_busy=10.0,
        disk_read_bps=1000,
        disk_write_bps=2000,
        gpu_percent=None,
        gpu_temp_c=None,
        gpu_vram_percent=None,
        gpu_name=None,
        net_sent_bps=1000,
        net_recv_bps=2000,
        top_processes=[{"pid": 100, "name": "chrome.exe", "cpu_percent": 10.0, "ram_mb": 4000.0}],
    )

    # Handle diagnose_request
    await server._handle_message(mock_ws, json.dumps({"type": "diagnose_request"}))

    # Give the async AI background task a short moment to complete
    await asyncio.sleep(0.1)

    # Should have sent at least 2 messages: immediate deterministic diagnosis, then enriched AI diagnosis
    assert len(sent_messages) >= 1
    # Check that final message has diagnosis_result with memory_pressure
    final_msg = sent_messages[-1]
    assert final_msg["type"] == "diagnosis_result"
    assert final_msg["diagnosis"]["label"] == "memory_pressure"
    assert final_msg["llm_call_succeeded"] is True
    assert "fixes" in final_msg["explanation"]
    assert len(final_msg["explanation"]["fixes"]) == 2

    db.close()
