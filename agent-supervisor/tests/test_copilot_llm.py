import pytest

from app.copilot_llm import PROVIDER_NAME, CopilotLLM, split_messages
from app.copilot_session import CopilotUnavailableError

FAKE_TOKEN = "fake-token-123"


class RecordingAsk:
    def __init__(self, text='{"ok": true}', error=None):
        self.text = text
        self.error = error
        self.calls = []

    async def __call__(self, token, model, system_prompt, user_prompt, timeout_seconds):
        self.calls.append((token, model, system_prompt, user_prompt, timeout_seconds))
        if self.error:
            raise self.error
        return self.text


def make_llm(ask) -> CopilotLLM:
    return CopilotLLM(
        model="claude-sonnet-5.5",
        provider=PROVIDER_NAME,
        github_token=FAKE_TOKEN,
        timeout_seconds=7.0,
        ask=ask,
    )


def test_call_sends_system_and_user_prompts_and_returns_text():
    ask = RecordingAsk()
    messages = [
        {"role": "system", "content": "Eres un asistente"},
        {"role": "user", "content": "Analiza el incidente"},
    ]

    text = make_llm(ask).call(messages)

    token, model, system_prompt, user_prompt, timeout = ask.calls[0]
    assert text == '{"ok": true}'
    assert (token, model, user_prompt, timeout) == (
        FAKE_TOKEN, "claude-sonnet-5.5", "Analiza el incidente", 7.0,
    )  # fmt: skip
    assert system_prompt.startswith("Eres un asistente")
    assert "JSON" in system_prompt


def test_call_accepts_plain_string_message():
    ask = RecordingAsk()

    make_llm(ask).call("hola")

    assert ask.calls[0][3] == "hola"
    assert ask.calls[0][2].startswith("Responde únicamente")


def test_sdk_error_propagates_as_controlled_exception():
    llm = make_llm(RecordingAsk(error=CopilotUnavailableError("sin acceso")))

    with pytest.raises(CopilotUnavailableError):
        llm.call("hola")


def test_token_is_never_exposed_in_repr_or_dump():
    llm = make_llm(RecordingAsk())

    assert FAKE_TOKEN not in repr(llm)
    assert FAKE_TOKEN not in str(llm.model_dump())


def test_llm_metadata():
    llm = make_llm(RecordingAsk())

    assert llm.supports_function_calling() is False
    assert llm.get_context_window_size() > 0
    assert llm.provider == "github-copilot"


def test_split_messages_handles_list_content_parts():
    messages = [
        {"role": "system", "content": "a"},
        {"role": "user", "content": [{"type": "text", "text": "b"}, "ruido"]},
        {"role": "assistant", "content": None},
    ]

    assert split_messages(messages) == ("a", "b\n\n")
