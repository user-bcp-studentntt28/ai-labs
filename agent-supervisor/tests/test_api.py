import pytest
from fastapi.testclient import TestClient

from app.crew import LlmNotConfiguredError
from app.main import create_app
from app.mock_client import MockUnavailableError
from app.schemas import LlmBriefing, Priority
from app.service import BriefingService
from tests.conftest import ORIGIN, make_settings
from tests.test_service import FakeCrewRunner, FakeMockClient

BODY = {
    "incidentId": "incident_1",
    "paymentId": "pay_amount",
    "reason": "AMOUNT_MISMATCH",
    "walletId": "wallet-demo",
    "event": "STARTED",
    "analystNote": None,
    "workflowState": "IN_PROGRESS",
}
RESPONSE_KEYS = {
    "incidentId", "event", "priority", "headline", "problem",
    "evidence", "recommendation", "source", "model", "generatedAt",
}  # fmt: skip


def make_client(snapshot, runner=None, mock_error=None) -> TestClient:
    settings = make_settings()
    default_runner = FakeCrewRunner(error=LlmNotConfiguredError("sin token"))
    service = BriefingService(
        settings, FakeMockClient(snapshot, error=mock_error), runner or default_runner
    )
    return TestClient(create_app(settings, service))


def test_health(snapshot):
    response = make_client(snapshot).get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_briefing_llm_path(snapshot):
    briefing = LlmBriefing(
        priority=Priority.LOW,
        headline="Titular",
        problem="Problema.",
        evidence=["uno"],
        recommendation="Revisar.",
    )
    client = make_client(snapshot, runner=FakeCrewRunner(briefing))

    response = client.post("/briefings", json=BODY)

    assert response.status_code == 200
    payload = response.json()
    assert set(payload) == RESPONSE_KEYS
    assert payload["source"] == "llm"
    assert payload["model"] == "claude-sonnet-5.5"
    assert payload["priority"] == "LOW"
    assert payload["incidentId"] == "incident_1"


def test_briefing_fallback_without_github_token(snapshot):
    runner = FakeCrewRunner(error=LlmNotConfiguredError("sin token"))

    response = make_client(snapshot, runner=runner).post("/briefings", json=BODY)

    assert response.status_code == 200
    payload = response.json()
    assert set(payload) == RESPONSE_KEYS
    assert payload["source"] == "fallback"
    assert payload["model"] is None
    assert "S/ 15.00" in payload["problem"]
    assert len(payload["headline"]) <= 100
    assert len(payload["evidence"]) <= 4


def test_briefing_submitted_with_note(snapshot):
    body = {**BODY, "event": "SUBMITTED", "analystNote": "Se corrigió el monto"}

    response = make_client(snapshot).post("/briefings", json=body)

    assert response.status_code == 200
    assert response.json()["event"] == "SUBMITTED"
    assert "coherente" in response.json()["recommendation"]


@pytest.mark.parametrize(
    "body",
    [
        {},
        {**BODY, "event": "CLOSED"},
        {**BODY, "incidentId": ""},
        {key: value for key, value in BODY.items() if key != "paymentId"},
        {**BODY, "analystNote": "x" * 5000},
    ],
)
def test_briefing_invalid_body_is_422(snapshot, body):
    assert make_client(snapshot).post("/briefings", json=body).status_code == 422


def test_briefing_mock_error_is_502(snapshot):
    client = make_client(snapshot, mock_error=MockUnavailableError("mock caído"))

    response = client.post("/briefings", json=BODY)

    assert response.status_code == 502
    assert response.json() == {"detail": "mock caído"}


def test_cors_preflight_allowed_origin(snapshot):
    response = make_client(snapshot).options(
        "/briefings",
        headers={
            "Origin": ORIGIN,
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "Content-Type",
        },
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == ORIGIN
    assert "POST" in response.headers["access-control-allow-methods"]
    assert "content-type" in response.headers["access-control-allow-headers"].lower()


def test_cors_preflight_rejects_other_origin(snapshot):
    response = make_client(snapshot).options(
        "/briefings",
        headers={"Origin": "http://evil.test", "Access-Control-Request-Method": "POST"},
    )

    assert "access-control-allow-origin" not in response.headers
