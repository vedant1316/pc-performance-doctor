"""Pydantic schemas for WebSocket message communication."""

from __future__ import annotations

from typing import Any, Literal
from pydantic import BaseModel, Field


class ProcessTickItem(BaseModel):
    """Process summary item within a metrics tick."""
    pid: int
    name: str
    cpu_percent: float
    ram_mb: float
    io_percent: float = 0.0
    is_elevated: int = 0


class MetricsTickMessage(BaseModel):
    """Periodic metrics tick pushed from Agent to Frontend."""
    type: Literal["metrics_tick"] = "metrics_tick"
    timestamp: str
    cpu_percent: float
    ram_percent: float
    ram_available_mb: int
    disk_percent_busy: float
    gpu_percent: float | None = None
    net_sent_bps: int
    net_recv_bps: int
    top_processes: list[ProcessTickItem]

    # Enriched hardware telemetry
    cpu_temp_c: float | None = None
    per_core_percent: list[float] = Field(default_factory=list)
    cpu_freq_mhz: float | None = None
    ram_total_mb: int = 0
    ram_used_mb: int = 0
    pagefile_percent: float | None = None
    disk_read_bps: int = 0
    disk_write_bps: int = 0
    gpu_temp_c: float | None = None
    gpu_vram_percent: float | None = None
    gpu_name: str | None = None
    top_process_cpu_percent: float = 0.0
    top_process_io_percent: float = 0.0


class PingMessage(BaseModel):
    """Ping message from client."""
    type: Literal["ping"] = "ping"


class PongMessage(BaseModel):
    """Pong response from server."""
    type: Literal["pong"] = "pong"
    timestamp: str


class ServerStatusMessage(BaseModel):
    """Server status notification."""
    type: Literal["status"] = "status"
    status: str
    message: str
    phase: int = 2


class ErrorMessage(BaseModel):
    """Error notification message."""
    type: Literal["error"] = "error"
    message: str
    code: str = "SERVER_ERROR"


class DiagnoseRequestMessage(BaseModel):
    """Diagnose request from frontend."""
    type: Literal["diagnose_request"] = "diagnose_request"


class DiagnosisPayload(BaseModel):
    """Structured diagnosis sub-object from the rule engine."""
    label: str
    rule_id: str
    severity: Literal["none", "low", "medium", "high"]
    health_score: int
    contributing_processes: list[str] = Field(default_factory=list)


class DiagnosisFixItem(BaseModel):
    """Fix recommendation item."""
    action: str
    difficulty: Literal["easy", "medium", "advanced"] = "easy"
    impact: Literal["low", "medium", "high"] = "medium"


class DiagnosisExplanationPayload(BaseModel):
    """Explanation and fix container."""
    summary: str
    root_cause: str
    fixes: list[DiagnosisFixItem] = Field(default_factory=list)
    expected_improvement: str


class DiagnosisResultMessage(BaseModel):
    """Diagnosis result message pushed to frontend matching Section 10 contract."""
    type: Literal["diagnosis_result"] = "diagnosis_result"
    diagnosis: DiagnosisPayload
    explanation: DiagnosisExplanationPayload | None = None
    llm_call_succeeded: bool = False


class TimelineQueryMessage(BaseModel):
    """Timeline query request from frontend."""
    type: Literal["timeline_query"] = "timeline_query"
    start: str
    end: str


class BenchmarkRequestMessage(BaseModel):
    """Benchmark execution request from frontend."""
    type: Literal["benchmark_request"] = "benchmark_request"

