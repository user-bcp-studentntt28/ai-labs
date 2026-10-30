import asyncio

import pytest

from app import copilot_session
from app.copilot_session import (
    CopilotUnavailableError,
    ask_copilot,
    deny_all_permissions,
    extract_text,
    scrub_token,
)

FAKE_TOKEN = "fake-token-123"


class FakeSession:
    def __init__(self, reply=None, error=None, delay=0.0):
        self.reply = reply
        self.error = error
        self.delay = delay
        self.prompts = []
        self.closed = False

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc_info):
        self.closed = True

    async def send_and_wait(self, prompt, timeout):
        self.prompts.append((prompt, timeout))
        await asyncio.sleep(self.delay)
        if self.error:
            raise self.error
        return self.reply


class FakeClient:
    instances = []
    session = None

    def __init__(self, **options):
        self.options = options
        self.session_options = None
        self.closed = False
        FakeClient.instances.append(self)

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc_info):
        self.closed = True

    async def create_session(self, **options):
        self.session_options = options
        return FakeClient.session


def reply(text):
    return type("Event", (), {"data": type("Data", (), {"content": text})()})()


@pytest.fixture(autouse=True)
def fake_sdk(monkeypatch):
    FakeClient.instances = []
    FakeClient.session = FakeSession(reply=reply('{"ok": true}'))
    monkeypatch.setattr(copilot_session, "CopilotClient", FakeClient)


def ask(timeout=1.0):
    return asyncio.run(ask_copilot(FAKE_TOKEN, "claude-sonnet-5.5", "sistema", "usuario", timeout))


def test_happy_path_returns_text_and_closes_everything():
    text = ask()

    client = FakeClient.instances[0]
    assert text == '{"ok": true}'
    assert client.options["github_token"] == FAKE_TOKEN
    assert client.options["env"]["COPILOT_GITHUB_TELEMETRY_DISABLED"] == "true"
    assert client.closed and FakeClient.session.closed
    assert FakeClient.session.prompts == [("usuario", 1.0)]


def test_session_cannot_use_tools_or_ask_permissions():
    ask()

    options = FakeClient.instances[0].session_options
    assert options["model"] == "claude-sonnet-5.5"
    assert options["available_tools"] == []
    assert options["system_message"] == {"mode": "replace", "content": "sistema"}
    decision = options["on_permission_request"](object(), {})
    assert decision.kind == "reject"


def test_deny_all_permissions_rejects_with_feedback():
    decision = deny_all_permissions(None, None)

    assert decision.kind == "reject"
    assert decision.feedback


def test_sdk_error_becomes_controlled_error_without_token():
    FakeClient.session = FakeSession(error=RuntimeError(f"401 con {FAKE_TOKEN}"))

    with pytest.raises(CopilotUnavailableError) as raised:
        ask()

    assert FAKE_TOKEN not in str(raised.value)
    assert "RuntimeError" in str(raised.value)
    assert raised.value.__cause__ is None


def test_timeout_becomes_controlled_error():
    FakeClient.session = FakeSession(reply=reply("tarde"), delay=1.0)

    with pytest.raises(CopilotUnavailableError, match="TimeoutError"):
        ask(timeout=0.05)


@pytest.mark.parametrize("event", [None, reply(""), reply("   "), reply(None), object()])
def test_empty_response_is_controlled_error(event):
    FakeClient.session = FakeSession(reply=event)

    with pytest.raises(CopilotUnavailableError, match="ninguna respuesta"):
        ask()


def test_extract_text_and_scrub_token():
    assert extract_text(reply("hola")) == "hola"
    assert scrub_token(f"x {FAKE_TOKEN} y", FAKE_TOKEN) == "x *** y"
    assert scrub_token("sin token", "") == "sin token"
