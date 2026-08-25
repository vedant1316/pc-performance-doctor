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
from server.schemas import (
    ErrorMessage,
    MetricsTickMessage,
    PongMessage,
    ProcessTickItem,
    ServerStatusMessage,
)

logger = logging.getLogger(__name__)


class AgentWebSocketServer:
    """Async WebSocket server managing real-time metrics streaming and client RPCs."""

    def __init__(
        self,
        host: str = settings.WEBSOCKET_HOST,
        port: int = settings.WEBSOCKET_PORT,
        polling_interval_ms: int = settings.POLLING_INTERVAL_MS,
    ) -> None:
        self.host = host
        self.port = port
        self.polling_interval_s = max(0.2, polling_interval_ms / 1000.0)
        self.clients: set[ServerConnection] = set()
        self.system_collector = SystemCollector(top_processes_count=15)
        self._running = False
        self._server = None
        self._broadcast_task: asyncio.Task | None = None
        self._last_snapshot: MetricsSnapshot | None = None

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

    async def _broadcast_loop(self) -> None:
        """Background loop continuously polling hardware metrics and pushing to clients."""
        logger.info(
            "Metrics polling loop started (interval: %sms)",
            int(self.polling_interval_s * 1000),
        )
        while self._running:
            try:
                # Capture snapshot synchronously in executor if desired, or directly
                loop = asyncio.get_running_loop()
                snapshot: MetricsSnapshot = await loop.run_in_executor(
                    None, self.system_collector.collect_snapshot
                )
                self._last_snapshot = snapshot

                msg = self.snapshot_to_message(snapshot)
                payload = msg.model_dump_json()

                if self.clients:
                    # Broadcast payload to all active clients
                    websockets_to_remove = set()
                    for ws in list(self.clients):
                        try:
                            await ws.send(payload)
                        except Exception as e:
                            logger.debug("Failed sending tick to client %s: %s", ws.remote_address, e)
                            websockets_to_remove.add(ws)

                    self.clients.difference_update(websockets_to_remove)

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
            await websocket.send(err.model_dump_json())
            return

        if msg_type == "ping":
            now_iso = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
            pong = PongMessage(timestamp=now_iso)
            await websocket.send(pong.model_dump_json())

        elif msg_type == "diagnose_request":
            # Phase 2 status acknowledgment (Phase 3 will wire in diagnostic engine)
            resp = {
                "type": "diagnosis_result",
                "diagnosis": {
                    "label": "nominal",
                    "rule_id": "phase_2_live_monitoring",
                    "severity": "none",
                    "health_score": 100,
                    "contributing_processes": [],
                },
                "explanation": {
                    "summary": "Phase 2 Live Telemetry is operational. Diagnostic engine will be active in Phase 3.",
                    "root_cause": "System monitor active.",
                    "fixes": [],
                    "expected_improvement": "All systems operating normally.",
                },
                "llm_call_succeeded": False,
            }
            await websocket.send(json.dumps(resp))

        elif msg_type == "timeline_query":
            # Phase 4 placeholder
            resp = {
                "type": "timeline_result",
                "snapshots": [],
                "diagnoses": [],
            }
            await websocket.send(json.dumps(resp))

        elif msg_type == "benchmark_request":
            # Phase 6 placeholder
            resp = {
                "type": "benchmark_result",
                "score": 0,
                "breakdown": {"cpu": 0, "disk": 0, "gpu": 0},
            }
            await websocket.send(json.dumps(resp))

        else:
            logger.warning("Unknown message type received: %s", msg_type)
            err = ErrorMessage(
                message=f"Unknown message type: '{msg_type}'",
                code="UNKNOWN_MESSAGE_TYPE",
            )
            await websocket.send(err.model_dump_json())

    async def _connection_handler(self, websocket: ServerConnection) -> None:
        """Handle lifecycle of a single WebSocket client connection."""
        self.clients.add(websocket)
        client_addr = getattr(websocket, "remote_address", "unknown")
        logger.info("Client connected: %s (Total clients: %d)", client_addr, len(self.clients))

        # Send immediate initial state if available
        try:
            if self._last_snapshot is not None:
                initial_msg = self.snapshot_to_message(self._last_snapshot)
                await websocket.send(initial_msg.model_dump_json())
            else:
                status_msg = ServerStatusMessage(
                    status="connected",
                    message="Connected to PC Performance Doctor Agent",
                    phase=2,
                )
                await websocket.send(status_msg.model_dump_json())

            async for raw_msg in websocket:
                await self._handle_message(websocket, str(raw_msg))

        except websockets.exceptions.ConnectionClosed:
            logger.info("Client connection closed normally: %s", client_addr)
        except Exception as e:
            logger.error("Error handling client %s: %s", client_addr, e)
        finally:
            self.clients.discard(websocket)
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
