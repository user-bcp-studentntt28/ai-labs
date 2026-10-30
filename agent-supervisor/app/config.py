"""Configuracion del servicio leida desde variables de entorno."""

import os
from dataclasses import dataclass

try:
    from dotenv import load_dotenv
except ImportError:  # pragma: no cover - python-dotenv es opcional
    load_dotenv = None

DEFAULT_MOCK_BASE_URL = "https://bcp-wallet-mock.yefri.workers.dev/groups/3"
DEFAULT_MODEL = "claude-sonnet-5.5"
DEFAULT_ALLOWED_ORIGINS = "http://localhost:4200"
DEFAULT_MOCK_TIMEOUT_SECONDS = 10.0
DEFAULT_LLM_TIMEOUT_SECONDS = 60.0

ENV_MOCK_BASE_URL = "MOCK_BASE_URL"
ENV_MODEL = "AGENT_MODEL"
ENV_ALLOWED_ORIGINS = "ALLOWED_ORIGINS"
ENV_MOCK_TIMEOUT = "MOCK_TIMEOUT_SECONDS"
ENV_LLM_TIMEOUT = "LLM_TIMEOUT_SECONDS"

TELEMETRY_OFF_VARIABLES = {
    "OTEL_SDK_DISABLED": "true",
    "CREWAI_DISABLE_TELEMETRY": "true",
    "CREWAI_DISABLE_TRACKING": "true",
}


@dataclass(frozen=True)
class Settings:
    mock_base_url: str
    model: str
    allowed_origins: tuple[str, ...]
    mock_timeout_seconds: float
    llm_timeout_seconds: float


def normalize_model_name(model: str) -> str:
    """Id de modelo de Copilot (p. ej. claude-sonnet-5.5); vacio usa el valor por defecto."""
    return model.strip() or DEFAULT_MODEL


def parse_origins(raw_origins: str) -> tuple[str, ...]:
    return tuple(origin.strip() for origin in raw_origins.split(",") if origin.strip())


def read_positive_float(name: str, default: float) -> float:
    raw_value = os.getenv(name, "").strip()
    if not raw_value:
        return default
    try:
        value = float(raw_value)
    except ValueError:
        return default
    return value if value > 0 else default


def configure_environment() -> None:
    """Carga .env (si existe) y desactiva la telemetria de CrewAI."""
    if load_dotenv is not None:
        load_dotenv()
    for name, value in TELEMETRY_OFF_VARIABLES.items():
        os.environ.setdefault(name, value)


def load_settings() -> Settings:
    return Settings(
        mock_base_url=os.getenv(ENV_MOCK_BASE_URL, DEFAULT_MOCK_BASE_URL).strip().rstrip("/"),
        model=normalize_model_name(os.getenv(ENV_MODEL, DEFAULT_MODEL)),
        allowed_origins=parse_origins(os.getenv(ENV_ALLOWED_ORIGINS, DEFAULT_ALLOWED_ORIGINS)),
        mock_timeout_seconds=read_positive_float(ENV_MOCK_TIMEOUT, DEFAULT_MOCK_TIMEOUT_SECONDS),
        llm_timeout_seconds=read_positive_float(ENV_LLM_TIMEOUT, DEFAULT_LLM_TIMEOUT_SECONDS),
    )
