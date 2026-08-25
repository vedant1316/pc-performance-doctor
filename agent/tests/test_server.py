import asyncio
import json
import pytest
from websockets.asyncio.client import connect

from server.ws_server import AgentWebSocketServer


@pytest.mark.asyncio
async def test_websocket_server_streaming_and_messages() -> None:
    # Use test port 8769 to avoid port conflicts
    test_port = 8769
    server = AgentWebSocketServer(host="127.0.0.1", port=test_port, polling_interval_ms=300)
    await server.start()

    try:
        uri = f"ws://127.0.0.1:{test_port}"
        async with connect(uri) as client:
            # 1. First message should arrive (either status or initial metrics_tick)
            raw_msg_1 = await asyncio.wait_for(client.recv(), timeout=3.0)
            data_1 = json.loads(raw_msg_1)
            assert data_1["type"] in ("metrics_tick", "status")

            # 2. Wait for a metrics_tick message
            data_tick = None
            for _ in range(5):
                raw_tick = await asyncio.wait_for(client.recv(), timeout=3.0)
                msg_json = json.loads(raw_tick)
                if msg_json.get("type") == "metrics_tick":
                    data_tick = msg_json
                    break

            assert data_tick is not None
            assert data_tick["type"] == "metrics_tick"
            assert "timestamp" in data_tick
            assert "cpu_percent" in data_tick
            assert "ram_percent" in data_tick
            assert "ram_available_mb" in data_tick
            assert "disk_percent_busy" in data_tick
            assert "gpu_percent" in data_tick
            assert "net_sent_bps" in data_tick
            assert "net_recv_bps" in data_tick
            assert "top_processes" in data_tick
            assert isinstance(data_tick["top_processes"], list)

            # 3. Test ping -> pong
            await client.send(json.dumps({"type": "ping"}))
            # Might receive tick in between, filter until pong
            pong_received = False
            for _ in range(5):
                raw_resp = await asyncio.wait_for(client.recv(), timeout=3.0)
                resp_json = json.loads(raw_resp)
                if resp_json.get("type") == "pong":
                    pong_received = True
                    assert "timestamp" in resp_json
                    break
            assert pong_received

            # 4. Test invalid JSON error handling
            await client.send("not-valid-json{{{")
            error_received = False
            for _ in range(5):
                raw_resp = await asyncio.wait_for(client.recv(), timeout=3.0)
                resp_json = json.loads(raw_resp)
                if resp_json.get("type") == "error":
                    error_received = True
                    assert resp_json.get("code") == "INVALID_JSON"
                    break
            assert error_received

            # 5. Test diagnose_request
            await client.send(json.dumps({"type": "diagnose_request"}))
            diag_received = False
            for _ in range(5):
                raw_resp = await asyncio.wait_for(client.recv(), timeout=3.0)
                resp_json = json.loads(raw_resp)
                if resp_json.get("type") == "diagnosis_result":
                    diag_received = True
                    assert "diagnosis" in resp_json
                    break
            assert diag_received

    finally:
        await server.stop()
