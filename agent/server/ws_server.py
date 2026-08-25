"""WebSocket server for PC Performance Doctor agent.

Streams real-time metrics_tick messages to connected frontend clients and handles
client requests according to the reference protocol.
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone
import json
import logging
from typing import Any

import websockets
from websockets.asyncio.server import ServerConnection, serve

from collectors import MetricsSnapshot, SystemCollector
from config import settings
from diagnostics import DiagnosticEngine, Diagnosis
from ai import AIExplainer, ExplanationResult, FALLBACK_NOTE
from server.schemas import (
    ErrorMessage,
    MetricsTickMessage,
    PongMessage,
    ProcessTickItem,
    ServerStatusMessage,
)
from storage import DatabaseManager

logger = logging.getLogger(__name__)


class AgentWebSocketServer:
    """Async WebSocket server managing real-time metrics streaming, SQLite persistence, and client RPCs."""

    def __init__(
        self,
        host: str = settings.WEBSOCKET_HOST,
        port: int = settings.WEBSOCKET_PORT,
        polling_interval_ms: int = settings.POLLING_INTERVAL_MS,
        diagnostic_engine: DiagnosticEngine | None = None,
        db: DatabaseManager | None = None,
        ai_explainer: AIExplainer | None = None,
    ) -> None:
        self.host = host
        self.port = port
        self.polling_interval_s = max(0.2, polling_interval_ms / 1000.0)
        self.clients: dict[ServerConnection, asyncio.Lock] = {}
        self.system_collector = SystemCollector(top_processes_count=15)
        self.diagnostic_engine = diagnostic_engine or DiagnosticEngine()
        self.db = db or DatabaseManager()
        self.ai_explainer = ai_explainer or AIExplainer()
        self._running = False
        self._server = None
        self._broadcast_task: asyncio.Task | None = None
        self._last_snapshot: MetricsSnapshot | None = None
        self._last_snapshot_id: int | None = None

    def snapshot_to_message(self, snapshot: MetricsSnapshot) -> MetricsTickMessage:
        """Convert a MetricsSnapshot into a validated MetricsTickMessage."""
        top_procs = [
            ProcessTickItem(
                pid=p["pid"],
                name=p["name"],
                cpu_percent=p["cpu_percent"],
                ram_mb=p["ram_mb"],
                io_percent=p.get("io_percent", 0.0),
                is_elevated=p.get("is_elevated", 0),
            )
            for p in snapshot.top_processes
        ]

        return MetricsTickMessage(
            timestamp=snapshot.timestamp,
            cpu_percent=snapshot.cpu_percent,
            ram_percent=snapshot.ram_percent,
            ram_available_mb=snapshot.ram_available_mb,
            disk_percent_busy=snapshot.disk_percent_busy,
            gpu_percent=snapshot.gpu_percent,
            net_sent_bps=snapshot.net_sent_bps,
            net_recv_bps=snapshot.net_recv_bps,
            top_processes=top_procs,
            cpu_temp_c=snapshot.cpu_temp_c,
            per_core_percent=snapshot.per_core_percent,
            cpu_freq_mhz=snapshot.cpu_freq_mhz,
            ram_total_mb=snapshot.ram_total_mb,
            ram_used_mb=snapshot.ram_used_mb,
            pagefile_percent=snapshot.pagefile_percent,
            disk_read_bps=snapshot.disk_read_bps,
            disk_write_bps=snapshot.disk_write_bps,
            gpu_temp_c=snapshot.gpu_temp_c,
            gpu_vram_percent=snapshot.gpu_vram_percent,
            gpu_name=snapshot.gpu_name,
            top_process_cpu_percent=snapshot.top_process_cpu_percent,
            top_process_io_percent=snapshot.top_process_io_percent,
        )

    async def safe_send(self, websocket: ServerConnection, message: str) -> None:
        """Send a string payload to a websocket client safely using its dedicated lock."""
        lock = self.clients.get(websocket)
        if lock is None:
            return
        try:
            async with lock:
                await websocket.send(message)
        except Exception as e:
            logger.debug("Failed safe_send to %s: %s", getattr(websocket, "remote_address", "unknown"), e)

    async def _broadcast_loop(self) -> None:
        """Background loop continuously polling hardware metrics, persisting to SQLite, and pushing to clients."""
        logger.info(
            "Metrics polling loop started (interval: %sms)",
            int(self.polling_interval_s * 1000),
        )
        while self._running:
            try:
                loop = asyncio.get_running_loop()
                snapshot: MetricsSnapshot = await loop.run_in_executor(
                    None, self.system_collector.collect_snapshot
                )
                self._last_snapshot = snapshot

                # Persist snapshot and process breakdown to SQLite
                def _persist_tick(snap: MetricsSnapshot) -> int:
                    s_id = self.db.save_snapshot(snap)
                    if snap.top_processes:
                        self.db.save_process_snapshots(s_id, snap.top_processes)
                    return s_id

                snapshot_id = await loop.run_in_executor(None, _persist_tick, snapshot)
                self._last_snapshot_id = snapshot_id

                msg = self.snapshot_to_message(snapshot)
                payload = msg.model_dump_json()

                if self.clients:
                    websockets_to_remove = set()
                    for ws, lock in list(self.clients.items()):
                        try:
                            async with lock:
                                await ws.send(payload)
                        except Exception as e:
                            logger.debug(
                                "Failed sending tick to client %s: %s",
                                getattr(ws, "remote_address", "unknown"),
                                e,
                            )
                            websockets_to_remove.add(ws)

                    for ws in websockets_to_remove:
                        self.clients.pop(ws, None)

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error("Error in metrics broadcast loop: %s", e, exc_info=True)

            await asyncio.sleep(self.polling_interval_s)

    async def _handle_message(self, websocket: ServerConnection, raw_message: str) -> None:
        """Route incoming WebSocket messages from frontend."""
        try:
            data = json.loads(raw_message)
            msg_type = data.get("type")
        except json.JSONDecodeError:
            err = ErrorMessage(message="Invalid JSON payload", code="INVALID_JSON")
            await self.safe_send(websocket, err.model_dump_json())
            return

        if msg_type == "ping":
            now_iso = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
            pong = PongMessage(timestamp=now_iso)
            await self.safe_send(websocket, pong.model_dump_json())

        elif msg_type == "diagnose_request":
            # Real deterministic rule-based evaluation (Phase 3 & Phase 4 persistence)
            loop = asyncio.get_running_loop()
            current_snapshot = self._last_snapshot
            if current_snapshot is None:
                current_snapshot = await loop.run_in_executor(
                    None, self.system_collector.collect_snapshot
                )
                self._last_snapshot = current_snapshot

            diagnosis = self.diagnostic_engine.evaluate(current_snapshot)
            logger.info(
                "Diagnostic engine evaluated snapshot -> label: %s, rule: %s, severity: %s, health_score: %d, processes: %s",
                diagnosis.label,
                diagnosis.rule_id,
                diagnosis.severity,
                diagnosis.health_score,
                diagnosis.contributing_processes,
            )

            # Persist diagnosis in SQLite linked to snapshot
            snap_id = self._last_snapshot_id
            if snap_id is None:
                snap_id = await loop.run_in_executor(None, self.db.save_snapshot, current_snapshot)
                self._last_snapshot_id = snap_id

            diag_id = await loop.run_in_executor(
                None, self.db.save_diagnosis, snap_id, diagnosis, diagnosis.timestamp
            )
            logger.info("Persisted initial diagnosis record id: %d (snapshot_id: %d)", diag_id, snap_id)

            # Step 1: Immediately push deterministic diagnosis to UI (no blocking on LLM)
            resp = diagnosis.to_diagnosis_response(llm_call_succeeded=False)
            await self.safe_send(websocket, json.dumps(resp))

            # Step 2: Asynchronously invoke AI explanation layer and enrich UI & database
            asyncio.create_task(self._process_ai_explanation(websocket, diag_id, diagnosis))

        elif msg_type == "timeline_query":
            # Query SQLite for historical snapshots and diagnoses (Phase 4)
            start_ts = data.get("start")
            end_ts = data.get("end")
            loop = asyncio.get_running_loop()
            history_data = await loop.run_in_executor(
                None, self.db.query_timeline, start_ts, end_ts
            )
            resp = {
                "type": "timeline_result",
                "snapshots": history_data["snapshots"],
                "diagnoses": history_data["diagnoses"],
            }
            await self.safe_send(websocket, json.dumps(resp))

        elif msg_type == "benchmark_request":
            # Phase 6 placeholder
            resp = {
                "type": "benchmark_result",
                "score": 0,
                "breakdown": {"cpu": 0, "disk": 0, "gpu": 0},
            }
            await self.safe_send(websocket, json.dumps(resp))

        else:
            logger.warning("Unknown message type received: %s", msg_type)
            err = ErrorMessage(
                message=f"Unknown message type: '{msg_type}'",
                code="UNKNOWN_MESSAGE_TYPE",
            )
            await self.safe_send(websocket, err.model_dump_json())

    async def _process_ai_explanation(
        self, websocket: ServerConnection, diag_id: int, diagnosis: Diagnosis
    ) -> None:
        """Background worker invoking AI Explainer, updating SQLite, and pushing result to frontend."""
        try:
            loop = asyncio.get_running_loop()
            ai_result: ExplanationResult = await loop.run_in_executor(
                None, self.ai_explainer.explain, diagnosis
            )

            if ai_result.succeeded and ai_result.explanation:
                # Update SQLite with full LLM findings
                await loop.run_in_executor(
                    None,
                    self.db.update_diagnosis_explanation,
                    diag_id,
                    ai_result.explanation,
                    True,
                )
                logger.info(
                    "AI explanation successfully generated for diagnosis %d (%s)",
                    diag_id,
                    diagnosis.label,
                )
                enriched_resp = diagnosis.to_diagnosis_response(
                    explanation=ai_result.explanation,
                    llm_call_succeeded=True,
                )
                await self.safe_send(websocket, json.dumps(enriched_resp))
            else:
                # Fallback: update SQLite with failure status and push fallback message
                fallback_expl = ai_result.get_fallback_explanation(diagnosis)
                await loop.run_in_executor(
                    None,
                    self.db.update_diagnosis_explanation,
                    diag_id,
                    None,
                    False,
                )
                logger.info(
                    "AI explanation unavailable for diagnosis %d (%s): %s",
                    diag_id,
                    diagnosis.label,
                    ai_result.error_message,
                )
                fallback_resp = diagnosis.to_diagnosis_response(
                    explanation=fallback_expl,
                    llm_call_succeeded=False,
                )
                await self.safe_send(websocket, json.dumps(fallback_resp))

        except asyncio.CancelledError:
            pass
        except Exception as e:
            logger.error("Error in _process_ai_explanation: %s", e, exc_info=True)

    async def _connection_handler(self, websocket: ServerConnection) -> None:
        """Handle lifecycle of a single WebSocket client connection."""
        lock = asyncio.Lock()
        self.clients[websocket] = lock
        client_addr = getattr(websocket, "remote_address", "unknown")
        logger.info("Client connected: %s (Total clients: %d)", client_addr, len(self.clients))

        try:
            # Send immediate initial state if available
            if self._last_snapshot is not None:
                initial_msg = self.snapshot_to_message(self._last_snapshot)
                await self.safe_send(websocket, initial_msg.model_dump_json())
            else:
                status_msg = ServerStatusMessage(
                    status="connected",
                    message="Connected to PC Performance Doctor Agent",
                    phase=3,
                )
                await self.safe_send(websocket, status_msg.model_dump_json())

            async for raw_msg in websocket:
                await self._handle_message(websocket, str(raw_msg))

        except websockets.exceptions.ConnectionClosed:
            logger.info("Client connection closed normally: %s", client_addr)
        except Exception as e:
            logger.error("Error handling client %s: %s", client_addr, e)
        finally:
            self.clients.pop(websocket, None)
            logger.info("Client disconnected: %s (Remaining: %d)", client_addr, len(self.clients))

    async def start(self) -> None:
        """Start the WebSocket server and background metrics loop."""
        self._running = True
        self._broadcast_task = asyncio.create_task(self._broadcast_loop())
        self._server = await serve(
            self._connection_handler,
            self.host,
            self.port,
        )
        logger.info("Agent WebSocket server running at ws://%s:%d", self.host, self.port)

    async def stop(self) -> None:
        """Stop the WebSocket server and background tasks."""
        logger.info("Shutting down Agent WebSocket server...")
        self._running = False
        if self._broadcast_task:
            self._broadcast_task.cancel()
            try:
                await self._broadcast_task
            except asyncio.CancelledError:
                pass

        if self._server:
            self._server.close()
            await self._server.wait_closed()

        self.db.close()
        logger.info("Agent WebSocket server stopped.")


async def run_server() -> None:
    """Entrypoint function to run the agent WebSocket server indefinitely."""
    server = AgentWebSocketServer()
    await server.start()
    try:
        # Keep running until interrupted
        while True:
            await asyncio.sleep(3600)
    except (asyncio.CancelledError, KeyboardInterrupt):
        pass
    finally:
        await server.stop()
