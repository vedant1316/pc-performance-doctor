"""AI Explanation package for PC Performance Doctor."""

from .client import (
    AIClientError,
    APIResponseError,
    AuthenticationError,
    ConnectionError,
    MissingConfigurationError,
    OpenAICompatibleClient,
    RateLimitError,
    TimeoutError,
)
from .explainer import (
    AIExplainer,
    ExplanationResult,
    FALLBACK_NOTE,
    FixItem,
    SchemaValidationError,
    ValidatedExplanation,
)
from .prompts import SYSTEM_PROMPT, USER_MESSAGE_TEMPLATE, build_user_prompt

__all__ = [
    "AIClientError",
    "APIResponseError",
    "AuthenticationError",
    "ConnectionError",
    "MissingConfigurationError",
    "OpenAICompatibleClient",
    "RateLimitError",
    "TimeoutError",
    "AIExplainer",
    "ExplanationResult",
    "FALLBACK_NOTE",
    "FixItem",
    "SchemaValidationError",
    "ValidatedExplanation",
    "SYSTEM_PROMPT",
    "USER_MESSAGE_TEMPLATE",
    "build_user_prompt",
]
