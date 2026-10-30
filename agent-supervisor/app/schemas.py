"""Contrato HTTP y modelos del briefing."""

from enum import Enum

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

HEADLINE_MAX_LENGTH = 100
EVIDENCE_MAX_ITEMS = 4
ANALYST_NOTE_MAX_LENGTH = 4000
IDENTIFIER_MAX_LENGTH = 200

SOURCE_LLM = "llm"
SOURCE_FALLBACK = "fallback"


class BriefingEvent(str, Enum):
    STARTED = "STARTED"
    SUBMITTED = "SUBMITTED"


class Priority(str, Enum):
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"


class CamelModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class BriefingRequest(CamelModel):
    incident_id: str = Field(min_length=1, max_length=IDENTIFIER_MAX_LENGTH)
    payment_id: str = Field(min_length=1, max_length=IDENTIFIER_MAX_LENGTH)
    reason: str = Field(min_length=1, max_length=IDENTIFIER_MAX_LENGTH)
    wallet_id: str = Field(min_length=1, max_length=IDENTIFIER_MAX_LENGTH)
    event: BriefingEvent
    analyst_note: str | None = Field(default=None, max_length=ANALYST_NOTE_MAX_LENGTH)
    workflow_state: str | None = Field(default=None, max_length=IDENTIFIER_MAX_LENGTH)


class LlmBriefing(BaseModel):
    """Campos que produce el agente (o el fallback) antes de armar la respuesta."""

    priority: Priority
    headline: str = Field(min_length=1)
    problem: str = Field(min_length=1)
    evidence: list[str] = Field(default_factory=list)
    recommendation: str = Field(min_length=1)


class BriefingResponse(CamelModel):
    incident_id: str
    event: BriefingEvent
    priority: Priority
    headline: str = Field(max_length=HEADLINE_MAX_LENGTH)
    problem: str
    evidence: list[str] = Field(max_length=EVIDENCE_MAX_ITEMS)
    recommendation: str
    source: str
    model: str | None
    generated_at: str
