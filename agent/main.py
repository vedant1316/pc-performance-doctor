"""Main entrypoint for PC Performance Doctor Python Agent."""

from __future__ import annotations

import asyncio
import logging
import sys

from config import settings
from server import run_server


def setup_logging() -> None:
    """Configure structured logging format."""
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
        handlers=[logging.StreamHandler(sys.stdout)],
    )


def main() -> None:
    """Run the PC Performance Doctor agent process."""
    setup_logging()
    logger = logging.getLogger("agent.main")
    logger.info("Starting PC Performance Doctor Agent...")
    logger.info("WebSocket Host: %s, Port: %d", settings.WEBSOCKET_HOST, settings.WEBSOCKET_PORT)
    logger.info("Polling Interval: %d ms", settings.POLLING_INTERVAL_MS)

    try:
        asyncio.run(run_server())
    except KeyboardInterrupt:
        logger.info("Agent process interrupted by user. Exiting.")


if __name__ == "__main__":
    main()
