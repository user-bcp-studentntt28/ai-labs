import os

import pytest

from app import config
from app.config import load_settings, normalize_model_name, parse_origins, read_positive_float

MANAGED_VARIABLES = (
    config.ENV_MOCK_BASE_URL, config.ENV_MODEL, config.ENV_ALLOWED_ORIGINS,
    config.ENV_MOCK_TIMEOUT, config.ENV_LLM_TIMEOUT,
)  # fmt: skip


@pytest.fixture(autouse=True)
def clean_environment(monkeypatch):
    for name in MANAGED_VARIABLES:
        monkeypatch.delenv(name, raising=False)


def test_defaults_without_environment():
    settings = load_settings()

    assert settings.mock_base_url == config.DEFAULT_MOCK_BASE_URL
    assert settings.model == "claude-sonnet-5.5"
    assert settings.allowed_origins == ("http://localhost:4200",)
    assert settings.llm_timeout_seconds == config.DEFAULT_LLM_TIMEOUT_SECONDS


def test_reads_values_from_environment(monkeypatch):
    monkeypatch.setenv(config.ENV_MOCK_BASE_URL, "http://x.test/groups/9/")
    monkeypatch.setenv(config.ENV_MODEL, " claude-sonnet-5 ")
    monkeypatch.setenv(config.ENV_ALLOWED_ORIGINS, "http://a.test, http://b.test,")
    monkeypatch.setenv(config.ENV_LLM_TIMEOUT, "12.5")

    settings = load_settings()

    assert settings.mock_base_url == "http://x.test/groups/9"
    assert settings.model == "claude-sonnet-5"
    assert settings.allowed_origins == ("http://a.test", "http://b.test")
    assert settings.llm_timeout_seconds == 12.5


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("claude-sonnet-5.5", "claude-sonnet-5.5"),
        ("  claude-haiku-5.5 ", "claude-haiku-5.5"),
        ("  ", "claude-sonnet-5.5"),
    ],
)
def test_normalize_model_name(raw, expected):
    assert normalize_model_name(raw) == expected


def test_parse_origins_ignores_blanks():
    assert parse_origins(" a , ,b ") == ("a", "b")


@pytest.mark.parametrize("raw", ["", "abc", "0", "-3"])
def test_invalid_timeouts_use_default(monkeypatch, raw):
    monkeypatch.setenv("TIMEOUT_TEST", raw)

    assert read_positive_float("TIMEOUT_TEST", 7.0) == 7.0


def test_configure_environment_disables_telemetry(monkeypatch):
    for name in config.TELEMETRY_OFF_VARIABLES:
        monkeypatch.delenv(name, raising=False)

    config.configure_environment()

    assert os.environ["OTEL_SDK_DISABLED"] == "true"
    assert os.environ["CREWAI_DISABLE_TELEMETRY"] == "true"
