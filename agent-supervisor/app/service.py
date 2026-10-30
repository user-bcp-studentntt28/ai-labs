"""Orquesta lectura del mock, evidencia, agente y fallback."""

import asyncio
import logging
from collections.abc import Callable
from datetime import datetime, timezone
from typing import Any

from starlette.concurrency import run_in_threadpool

from app.config import Settings
from app.crew import LlmNotConfiguredError, run_crew
from app.evidence import build_evidence
from app.fallback import build_fallback_briefing, truncate
from app.mock_client import MockClient
from app.schemas import (
    EVIDENCE_MAX_ITEMS,
    HEADLINE_MAX_LENGTH,
    SOURCE_FALLBACK,
    SOURCE_LLM,
    BriefingRequest,
    BriefingResponse,
    LlmBriefing,
)

logger = logging.getLogger(__name__)

CrewRunner = Callable[[Settings, BriefingRequest, dict[str, Any]], LlmBriefing]


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


class BriefingService:
    def __init__(
        self,
        settings: Settings,
        mock_client: MockClient,
        crew_runner: CrewRunner = run_crew,
    ) -> None:
        self._settings = settings
        self._mock_client = mock_client
        self._crew_runner = crew_runner

    async def create_briefing(self, request: BriefingRequest) -> BriefingResponse:
        snapshot = await self._mock_client.fetch_snapshot(request.wallet_id)
        evidence = build_evidence(request.payment_id, request.reason, request.wallet_id, snapshot)
        llm_briefing = await self._try_llm_briefing(request, evidence)
        if llm_briefing is not None:
            return self._to_response(request, llm_briefing, SOURCE_LLM, self._settings.model)
        fallback = build_fallback_briefing(request, evidence)
        return self._to_response(request, fallback, SOURCE_FALLBACK, None)

    async def _try_llm_briefing(
        self, request: BriefingRequest, evidence: dict[str, Any]
    ) -> LlmBriefing | None:
        try:
            return await asyncio.wait_for(
                run_in_threadpool(self._crew_runner, self._settings, request, evidence),
                timeout=self._settings.llm_timeout_seconds,
            )
        except LlmNotConfiguredError as error:
            logger.info("LLM no configurado; se usa el fallback: %s", error)
        except Exception:  # cualquier falla del LLM debe degradar al fallback, nunca romper
            logger.warning("El agente no produjo un briefing; se usa el fallback", exc_info=True)
        return None

    @staticmethod
    def _to_response(
        request: BriefingRequest, briefing: LlmBriefing, source: str, model: str | None
    ) -> BriefingResponse:
        return BriefingResponse(
            incident_id=request.incident_id,
            event=request.event,
            priority=briefing.priority,
            headline=truncate(briefing.headline.strip(), HEADLINE_MAX_LENGTH),
            problem=briefing.problem.strip(),
            evidence=[line.strip() for line in briefing.evidence if line.strip()][
                :EVIDENCE_MAX_ITEMS
            ],
            recommendation=briefing.recommendation.strip(),
            source=source,
            model=model,
            generated_at=utc_now_iso(),
        )
