import time

from tests.conftest import MODEL, make_request, make_settings
from app.copilot_session import CopilotUnavailableError
from app.crew import LlmNotConfiguredError, LlmOutputError
from app.mock_client import MockUnavailableError
from app.schemas import (
    HEADLINE_MAX_LENGTH,
    SOURCE_FALLBACK,
    SOURCE_LLM,
    BriefingEvent,
    LlmBriefing,
    Priority,
)
from app.service import BriefingService
import asyncio

import pytest



class FakeMockClient:
    def __init__(self, snapshot=None, error=None):
        self.snapshot = snapshot
        self.error = error
        self.wallet_ids = []

    async def fetch_snapshot(self, wallet_id):
        self.wallet_ids.append(wallet_id)
        if self.error:
            raise self.error
        return self.snapshot


class FakeCrewRunner:
    def __init__(self, briefing=None, error=None, delay=0.0):
        self.briefing = briefing
        self.error = error
        self.delay = delay
        self.calls = []

    def __call__(self, settings, request, evidence):
        self.calls.append((request, evidence))
        time.sleep(self.delay)
        if self.error:
            raise self.error
        return self.briefing


def llm_briefing(**overrides) -> LlmBriefing:
    values = {
        "priority": Priority.HIGH,
        "headline": "  Diferencia de monto  ",
        "problem": "Billetera S/ 15.00 vs proveedor S/ 9.99.",
        "evidence": ["a", " ", "b", "c", "d", "e"],
        "recommendation": "Revisar el monto.",
    }
    values.update(overrides)
    return LlmBriefing(**values)


def run(service, request):
    return asyncio.run(service.create_briefing(request))


def make_service(snapshot, runner, **settings_overrides):
    settings = make_settings(**settings_overrides)
    return BriefingService(settings, FakeMockClient(snapshot), runner)


def test_llm_path_normalizes_and_marks_source(snapshot):
    runner = FakeCrewRunner(llm_briefing(headline="  " + "h" * 150))
    service = make_service(snapshot, runner)

    response = run(service, make_request("AMOUNT_MISMATCH", "pay_amount"))

    assert response.source == SOURCE_LLM
    assert response.model == MODEL
    assert response.incident_id == "incident_1"
    assert len(response.headline) == HEADLINE_MAX_LENGTH
    assert response.evidence == ["a", "b", "c", "d"]
    assert response.generated_at.endswith("Z")


def test_llm_receives_request_and_compact_evidence(snapshot):
    runner = FakeCrewRunner(llm_briefing())
    service = make_service(snapshot, runner)

    run(service, make_request("AMOUNT_MISMATCH", "pay_amount", event=BriefingEvent.SUBMITTED))

    request, evidence = runner.calls[0]
    assert request.event == BriefingEvent.SUBMITTED
    assert evidence["paymentId"] == "pay_amount"
    assert evidence["wallet"]["count"] == 1
    assert evidence["totals"]["walletPayments"] == 5


def test_reads_mock_for_the_requested_wallet(snapshot):
    mock = FakeMockClient(snapshot)
    service = BriefingService(make_settings(), mock, FakeCrewRunner())

    run(service, make_request("AMOUNT_MISMATCH", "pay_amount", wallet_id="wallet-x"))

    assert mock.wallet_ids == ["wallet-x"]


def test_without_github_token_uses_fallback(snapshot):
    runner = FakeCrewRunner(error=LlmNotConfiguredError("sin token"))
    service = make_service(snapshot, runner)

    response = run(service, make_request("DUPLICATE_PROVIDER", "pay_dup"))

    assert response.source == SOURCE_FALLBACK
    assert response.model is None
    assert response.priority == Priority.HIGH
    assert len(runner.calls) == 1


@pytest.mark.parametrize(
    "runner",
    [
        FakeCrewRunner(error=CopilotUnavailableError("copilot caído")),
        FakeCrewRunner(error=LlmOutputError("salida inválida")),
        FakeCrewRunner(error=RuntimeError("inesperado")),
        FakeCrewRunner(delay=0.5),
    ],
)
def test_llm_failure_or_timeout_falls_back(snapshot, runner):
    service = make_service(snapshot, runner, llm_timeout_seconds=0.1)

    response = run(service, make_request("AMOUNT_MISMATCH", "pay_amount"))

    assert response.source == SOURCE_FALLBACK
    assert response.model is None


def test_mock_error_propagates(snapshot):
    service = BriefingService(
        make_settings(),
        FakeMockClient(error=MockUnavailableError("mock caído")),
        FakeCrewRunner(llm_briefing()),
    )

    with pytest.raises(MockUnavailableError):
        run(service, make_request("AMOUNT_MISMATCH", "pay_amount"))
