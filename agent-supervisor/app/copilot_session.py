"""Cliente minimo del GitHub Copilot SDK: una pregunta, una respuesta de texto, sin herramientas."""

import asyncio
import os
from typing import Any

from copilot import CopilotClient
from copilot.rpc import PermissionDecisionReject

TELEMETRY_OFF_ENV = {"COPILOT_GITHUB_TELEMETRY_DISABLED": "true"}
CLIENT_LOG_LEVEL = "error"
NO_TOOLS: list[str] = []
PERMISSION_DENIED_FEEDBACK = "Este asistente solo redacta texto y no puede usar herramientas."
EMPTY_RESPONSE_MESSAGE = "Copilot no devolvió ninguna respuesta"
REDACTED = "***"


class CopilotUnavailableError(Exception):
    """El SDK de Copilot no pudo producir una respuesta (auth, red, modelo o timeout)."""


def deny_all_permissions(_request: Any, _invocation: Any) -> PermissionDecisionReject:
    return PermissionDecisionReject(feedback=PERMISSION_DENIED_FEEDBACK)


def extract_text(event: Any) -> str:
    content = getattr(getattr(event, "data", None), "content", None)
    if not isinstance(content, str) or not content.strip():
        raise CopilotUnavailableError(EMPTY_RESPONSE_MESSAGE)
    return content


def scrub_token(message: str, token: str) -> str:
    return message.replace(token, REDACTED) if token else message


async def _exchange(
    token: str, model: str, system_prompt: str, user_prompt: str, timeout_seconds: float
) -> str:
    async with CopilotClient(
        github_token=token, log_level=CLIENT_LOG_LEVEL, env={**os.environ, **TELEMETRY_OFF_ENV}
    ) as client:
        async with await client.create_session(
            on_permission_request=deny_all_permissions,
            model=model,
            system_message={"mode": "replace", "content": system_prompt},
            available_tools=NO_TOOLS,
            skip_custom_instructions=True,
            enable_config_discovery=False,
            enable_session_telemetry=False,
        ) as session:
            event = await session.send_and_wait(user_prompt, timeout=timeout_seconds)
    return extract_text(event)


async def ask_copilot(
    token: str, model: str, system_prompt: str, user_prompt: str, timeout_seconds: float
) -> str:
    """Abre cliente y sesion, envia el prompt, devuelve el texto y cierra todo."""
    try:
        return await asyncio.wait_for(
            _exchange(token, model, system_prompt, user_prompt, timeout_seconds),
            timeout=timeout_seconds,
        )
    except CopilotUnavailableError:
        raise
    except Exception as error:  # el SDK puede lanzar errores de auth, red o RPC de muchos tipos
        detail = scrub_token(f"{type(error).__name__}: {error}", token)
        raise CopilotUnavailableError(f"Falló la llamada a Copilot: {detail}") from None
