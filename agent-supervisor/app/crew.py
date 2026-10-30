"""Agente CrewAI que redacta el briefing y parseo defensivo de su salida."""

import json
import re
from collections.abc import Callable
from typing import Any

from pydantic import ValidationError

from app.config import Settings
from app.copilot_auth import resolve_github_token
from app.copilot_llm import PROVIDER_NAME, CopilotLLM
from app.schemas import BriefingEvent, BriefingRequest, LlmBriefing

AGENT_ROLE = "Asistente del supervisor de conciliación"
AGENT_GOAL = (
    "Resumir en pocas líneas el problema de un incidente de conciliación para que el "
    "supervisor lo lea en menos de 30 segundos y decida qué revisar."
)
AGENT_BACKSTORY = (
    "Eres un analista senior de conciliación de pagos de una billetera digital. "
    "Comparas billetera, reporte del proveedor y ledger, y explicas las diferencias "
    "con lenguaje de negocio, sin tecnicismos y sin inventar datos."
)
MAX_AGENT_ITERATIONS = 3

TASK_DESCRIPTION = """Prepara un briefing para el SUPERVISOR sobre este incidente.

Evento: {event_meaning}
Motivo del incidente: {reason}
Estado del flujo: {workflow_state}
Nota del analista: {analyst_note}

Evidencia (JSON; montos en centavos de PEN y su texto formateado en amountFormatted):
{evidence_json}

Reglas:
- Usa SOLO los datos de la evidencia; no inventes cifras.
- Montos con formato S/ 15.00 (soles).
- priority: HIGH, MEDIUM o LOW según el riesgo económico y el tipo de incidente.
- headline: máximo 100 caracteres.
- problem: 2 a 3 oraciones en lenguaje de negocio.
- evidence: máximo 4 viñetas cortas comparando billetera / proveedor / ledger.
- recommendation: una sola oración con lo que el supervisor debe revisar o decidir. Si el
  evento es SUBMITTED, considera la nota del analista e indica si es coherente con los datos.
- Responde en español."""

TASK_EXPECTED_OUTPUT = (
    "Un único objeto JSON válido, sin texto adicional, con las claves: "
    '"priority" (HIGH|MEDIUM|LOW), "headline" (string), "problem" (string), '
    '"evidence" (lista de strings) y "recommendation" (string).'
)

EVENT_MEANING = {
    BriefingEvent.STARTED: "el analista inició la atención del incidente (aún sin respuesta)",
    BriefingEvent.SUBMITTED: "el analista envió el incidente a revisión con una respuesta escrita",
}
NOT_PROVIDED = "no informado"
MISSING_TOKEN_MESSAGE = (
    "Sin token de GitHub (COPILOT_GITHUB_TOKEN, GH_TOKEN, GITHUB_TOKEN o `gh auth login`)"
)
CODE_FENCE_PATTERN = re.compile(r"^```(?:json)?\s*|\s*```$", re.IGNORECASE)


class LlmOutputError(Exception):
    """La salida del modelo no se pudo convertir en un briefing valido."""


class LlmNotConfiguredError(Exception):
    """No hay credencial de GitHub disponible para usar Copilot."""


def build_task_inputs(request: BriefingRequest, evidence: dict[str, Any]) -> dict[str, str]:
    return {
        "event_meaning": EVENT_MEANING[request.event],
        "reason": request.reason,
        "workflow_state": request.workflow_state or NOT_PROVIDED,
        "analyst_note": request.analyst_note or NOT_PROVIDED,
        "evidence_json": json.dumps(evidence, ensure_ascii=False),
    }


def parse_llm_output(raw_output: Any) -> LlmBriefing:
    """Acepta un LlmBriefing, un dict o texto JSON (con o sin cercos de codigo)."""
    if isinstance(raw_output, LlmBriefing):
        return raw_output
    payload = raw_output if isinstance(raw_output, dict) else _load_json_object(str(raw_output))
    try:
        return LlmBriefing.model_validate(payload)
    except ValidationError as error:
        raise LlmOutputError(f"El modelo devolvio campos invalidos: {error}") from error


def _load_json_object(text: str) -> dict[str, Any]:
    cleaned = CODE_FENCE_PATTERN.sub("", text.strip())
    start, end = cleaned.find("{"), cleaned.rfind("}")
    if start == -1 or end <= start:
        raise LlmOutputError("El modelo no devolvio un objeto JSON")
    try:
        payload = json.loads(cleaned[start : end + 1])
    except json.JSONDecodeError as error:
        raise LlmOutputError(f"JSON invalido en la salida del modelo: {error}") from error
    return payload


def build_llm(settings: Settings, github_token: str) -> CopilotLLM:
    return CopilotLLM(
        model=settings.model,
        provider=PROVIDER_NAME,
        github_token=github_token,
        timeout_seconds=settings.llm_timeout_seconds,
    )


def build_crew(settings: Settings, github_token: str):
    from crewai import Agent, Crew, Task

    agent = Agent(
        role=AGENT_ROLE,
        goal=AGENT_GOAL,
        backstory=AGENT_BACKSTORY,
        llm=build_llm(settings, github_token),
        allow_delegation=False,
        verbose=False,
        max_iter=MAX_AGENT_ITERATIONS,
    )
    task = Task(
        description=TASK_DESCRIPTION,
        expected_output=TASK_EXPECTED_OUTPUT,
        agent=agent,
        output_pydantic=LlmBriefing,
    )
    return Crew(agents=[agent], tasks=[task], verbose=False, tracing=False)


def run_crew(
    settings: Settings,
    request: BriefingRequest,
    evidence: dict[str, Any],
    token_resolver: Callable[[], str | None] = resolve_github_token,
) -> LlmBriefing:
    """Llamada bloqueante: ejecutar fuera del event loop."""
    github_token = token_resolver()
    if not github_token:
        raise LlmNotConfiguredError(MISSING_TOKEN_MESSAGE)
    crew = build_crew(settings, github_token)
    result = crew.kickoff(inputs=build_task_inputs(request, evidence))
    return parse_llm_output(result.pydantic or result.raw)
