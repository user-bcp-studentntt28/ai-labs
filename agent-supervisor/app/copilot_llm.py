"""LLM personalizado de CrewAI que delega en el GitHub Copilot SDK."""

import asyncio
from collections.abc import Awaitable, Callable
from typing import Any

from crewai.llms.base_llm import BaseLLM
from pydantic import Field, SecretStr

from app.copilot_session import ask_copilot

PROVIDER_NAME = "github-copilot"
LLM_TYPE = "copilot"
CONTEXT_WINDOW_TOKENS = 128_000
SYSTEM_ROLE = "system"
JSON_ONLY_REMINDER = "Responde únicamente con el objeto JSON solicitado, sin texto adicional."

CopilotAsk = Callable[[str, str, str, str, float], Awaitable[str]]


def split_messages(messages: str | list[dict[str, Any]]) -> tuple[str, str]:
    """Separa los mensajes de CrewAI en (system, conversacion)."""
    if isinstance(messages, str):
        return "", messages
    system_parts = [_text_of(m) for m in messages if m.get("role") == SYSTEM_ROLE]
    turns = [_text_of(m) for m in messages if m.get("role") != SYSTEM_ROLE]
    return "\n\n".join(system_parts), "\n\n".join(turns)


def _text_of(message: dict[str, Any]) -> str:
    content = message.get("content")
    if isinstance(content, list):
        return "\n".join(str(part.get("text", "")) for part in content if isinstance(part, dict))
    return str(content or "")


class CopilotLLM(BaseLLM):
    llm_type: str = LLM_TYPE
    github_token: SecretStr = Field(repr=False, exclude=True)
    timeout_seconds: float
    ask: CopilotAsk = Field(default=ask_copilot, exclude=True)

    def call(
        self,
        messages: str | list[dict[str, Any]],
        tools: list[dict[str, Any]] | None = None,
        callbacks: list[Any] | None = None,
        available_functions: dict[str, Any] | None = None,
        from_task: Any | None = None,
        from_agent: Any | None = None,
        response_model: Any | None = None,
    ) -> str:
        """Bloqueante: se ejecuta en un hilo sin event loop (ver service)."""
        system_prompt, user_prompt = split_messages(messages)
        system_prompt = f"{system_prompt}\n\n{JSON_ONLY_REMINDER}".strip()
        return asyncio.run(
            self.ask(
                self.github_token.get_secret_value(),
                self.model,
                system_prompt,
                user_prompt,
                self.timeout_seconds,
            )
        )

    def supports_function_calling(self) -> bool:
        return False

    def get_context_window_size(self) -> int:
        return CONTEXT_WINDOW_TOKENS
