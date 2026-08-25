"""Provider-agnostic OpenAI-compatible API client for PC Performance Doctor.

Works with OpenAI, local Ollama, Anthropic shims, vLLM, LM Studio, or any
OpenAI-compatible chat completions endpoint.
"""

from __future__ import annotations

import json
import logging
import socket
import urllib.error
import urllib.request
from typing import Any

from config import settings

logger = logging.getLogger(__name__)


class AIClientError(Exception):
    """Base exception for all AI client errors."""
    pass


class MissingConfigurationError(AIClientError):
    """Raised when API key or base URL is not configured."""
    pass


class AuthenticationError(AIClientError):
    """Raised when API returns HTTP 401 or 403 authentication error."""
    pass


class RateLimitError(AIClientError):
    """Raised when API returns HTTP 429 rate limit exceeded error."""
    pass


class TimeoutError(AIClientError):
    """Raised when API request exceeds configured timeout."""
    pass


class ConnectionError(AIClientError):
    """Raised when network connection fails or endpoint is unreachable."""
    pass


class APIResponseError(AIClientError):
    """Raised when API returns a non-2xx status code or invalid payload."""
    def __init__(self, status_code: int, message: str) -> None:
        super().__init__(f"API returned HTTP {status_code}: {message}")
        self.status_code = status_code


class OpenAICompatibleClient:
    """Provider-agnostic client for OpenAI-compatible chat completion endpoints."""

    def __init__(
        self,
        base_url: str | None = None,
        api_key: str | None = None,
        model: str | None = None,
        timeout_seconds: int | None = None,
    ) -> None:
        self.base_url = (base_url if base_url is not None else settings.LLM_BASE_URL).rstrip("/")
        self.api_key = api_key if api_key is not None else settings.LLM_API_KEY
        self.model = model if model is not None else settings.LLM_MODEL
        self.timeout_seconds = (
            timeout_seconds if timeout_seconds is not None else settings.LLM_TIMEOUT_SECONDS
        )

    def _get_endpoint_url(self) -> str:
        """Construct the chat completions endpoint URL."""
        if self.base_url.endswith("/chat/completions"):
            return self.base_url
        return f"{self.base_url}/chat/completions"

    def is_configured(self) -> bool:
        """Check if essential API configuration is available."""
        # Some local OpenAI-compatible endpoints (like local Ollama / LM Studio) may work without an API key,
        # but if using cloud providers (like api.openai.com), an API key is required.
        # If the base_url points to a cloud service or has no key, check if key is set or localhost.
        if not self.base_url:
            return False
        # If localhost/127.0.0.1, key is optional; otherwise key must be non-empty
        is_local = "127.0.0.1" in self.base_url or "localhost" in self.base_url
        if not is_local and (not self.api_key or self.api_key.strip() == ""):
            return False
        return True

    def create_chat_completion(
        self,
        messages: list[dict[str, str]],
        temperature: float = 0.2,
        model: str | None = None,
        timeout: int | None = None,
    ) -> str:
        """Send chat completion request to the OpenAI-compatible endpoint.

        Args:
            messages: List of message objects with 'role' and 'content'.
            temperature: Sampling temperature (default 0.2 for deterministic formatting).
            model: Optional model override.
            timeout: Optional timeout override in seconds.

        Returns:
            The raw text content from the assistant's message.

        Raises:
            MissingConfigurationError: If required API config is missing.
            AuthenticationError: If authentication fails (401/403).
            RateLimitError: If rate limit exceeded (429).
            TimeoutError: If request times out.
            ConnectionError: If network connection fails.
            APIResponseError: For other non-200 HTTP responses.
        """
        if not self.is_configured():
            raise MissingConfigurationError(
                "LLM API key is not configured in environment or .env file."
            )

        endpoint = self._get_endpoint_url()
        selected_model = model or self.model
        req_timeout = timeout if timeout is not None else self.timeout_seconds

        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": "PC-Performance-Doctor/1.0",
        }
        if self.api_key and self.api_key.strip():
            headers["Authorization"] = f"Bearer {self.api_key.strip()}"

        payload = {
            "model": selected_model,
            "messages": messages,
            "temperature": temperature,
        }

        data_bytes = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            url=endpoint,
            data=data_bytes,
            headers=headers,
            method="POST",
        )

        logger.info(
            "Sending AI completion request to %s (model: %s, timeout: %ds)",
            endpoint,
            selected_model,
            req_timeout,
        )

        try:
            with urllib.request.urlopen(req, timeout=req_timeout) as response:
                status_code = response.getcode()
                response_body = response.read().decode("utf-8")

                if status_code != 200:
                    raise APIResponseError(status_code, response_body)

                data = json.loads(response_body)
                choices = data.get("choices", [])
                if not choices:
                    raise APIResponseError(status_code, "No choices returned in API response.")

                first_choice = choices[0]
                message = first_choice.get("message", {})
                content = message.get("content", "")
                return str(content)

        except urllib.error.HTTPError as e:
            error_body = ""
            try:
                error_body = e.read().decode("utf-8")
            except Exception:
                pass

            logger.error("LLM API HTTP Error: %s %s - %s", e.code, e.reason, error_body)

            if e.code in (401, 403):
                raise AuthenticationError(f"LLM API Authentication failed (HTTP {e.code}): {e.reason}") from e
            elif e.code == 429:
                raise RateLimitError(f"LLM API Rate limit exceeded (HTTP 429): {e.reason}") from e
            else:
                raise APIResponseError(e.code, f"{e.reason} - {error_body}") from e

        except (socket.timeout, TimeoutError, urllib.error.URLError) as e:
            if isinstance(e, urllib.error.URLError) and isinstance(e.reason, socket.timeout):
                logger.error("LLM API Request timed out after %ds", req_timeout)
                raise TimeoutError(f"LLM API request timed out after {req_timeout}s") from e
            elif isinstance(e, socket.timeout):
                logger.error("LLM API Socket timed out after %ds", req_timeout)
                raise TimeoutError(f"LLM API socket timed out after {req_timeout}s") from e
            else:
                logger.error("LLM API Connection error: %s", e)
                raise ConnectionError(f"Failed to connect to LLM API endpoint: {e}") from e

        except json.JSONDecodeError as e:
            logger.error("Failed to decode JSON response from LLM API: %s", e)
            raise APIResponseError(200, f"Malformed response payload from API: {e}") from e

        except Exception as e:
            logger.error("Unexpected error in LLM API client: %s", e, exc_info=True)
            raise AIClientError(f"Unexpected AI client error: {e}") from e
