import json
from types import SimpleNamespace

import pytest
from crewai.utilities.converter import ConverterError

from app import crew
from app.copilot_llm import PROVIDER_NAME, CopilotLLM
from app.crew import (
    LlmNotConfiguredError,
    LlmOutputError,
    build_task_inputs,
    parse_llm_output,
)
from app.schemas import BriefingEvent, LlmBriefing, Priority
from tests.conftest import make_request, make_settings

FAKE_TOKEN = "fake-token-123"

VALID_PAYLOAD = {
    "priority": "HIGH",
    "headline": "Monto distinto",
    "problem": "Billetera S/ 15.00 vs proveedor S/ 9.99.",
    "evidence": ["Billetera: S/ 15.00"],
    "recommendation": "Revisar el monto.",
}


def test_parse_valid_json_text():
    briefing = parse_llm_output(json.dumps(VALID_PAYLOAD))

    assert briefing.priority == Priority.HIGH
    assert briefing.evidence == ["Billetera: S/ 15.00"]


def test_parse_json_inside_code_fence_with_noise():
    raw = "Aquí está:\n```json\n" + json.dumps(VALID_PAYLOAD) + "\n```"

    assert parse_llm_output(raw).headline == "Monto distinto"


def test_parse_accepts_dict_and_model():
    assert parse_llm_output(VALID_PAYLOAD).problem.startswith("Billetera")
    model = LlmBriefing(**VALID_PAYLOAD)
    assert parse_llm_output(model) is model


@pytest.mark.parametrize(
    "raw",
    [
        "no es json",
        "{ roto }",
        "{ roto",
        "[1, 2]",
        '{"priority": "URGENT", "headline": "x", "problem": "y", "recommendation": "z"}',
        '{"priority": "LOW"}',
        "",
    ],
)
def test_parse_invalid_output_raises(raw):
    with pytest.raises(LlmOutputError):
        parse_llm_output(raw)


def test_task_inputs_contain_compact_evidence():
    request = make_request(
        "AMOUNT_MISMATCH",
        "pay_amount",
        event=BriefingEvent.SUBMITTED,
        analyst_note="Corregido",
        workflow_state="IN_REVIEW",
    )

    inputs = build_task_inputs(request, {"paymentId": "pay_amount", "nota": "ñ"})

    assert inputs["analyst_note"] == "Corregido"
    assert inputs["workflow_state"] == "IN_REVIEW"
    assert "envió el incidente a revisión" in inputs["event_meaning"]
    assert json.loads(inputs["evidence_json"])["nota"] == "ñ"


def test_task_inputs_defaults_when_missing():
    inputs = build_task_inputs(make_request("AMOUNT_MISMATCH", "pay_amount"), {})

    assert inputs["analyst_note"] == "no informado"
    assert inputs["workflow_state"] == "no informado"


def test_build_llm_uses_copilot_model_id_without_network():
    llm = crew.build_llm(make_settings(), FAKE_TOKEN)

    assert isinstance(llm, CopilotLLM)
    assert llm.model == "claude-sonnet-5.5"
    assert llm.timeout_seconds == 1.0
    assert FAKE_TOKEN not in repr(llm)


def test_build_crew_has_one_agent_one_task_without_delegation():
    built = crew.build_crew(make_settings(), FAKE_TOKEN)

    assert len(built.agents) == 1 and len(built.tasks) == 1
    assert built.agents[0].allow_delegation is False
    assert isinstance(built.agents[0].llm, CopilotLLM)
    assert built.tasks[0].output_pydantic is LlmBriefing


def test_run_crew_prefers_pydantic_result(monkeypatch):
    expected = LlmBriefing(**VALID_PAYLOAD)
    fake_crew = SimpleNamespace(kickoff=lambda inputs: SimpleNamespace(pydantic=expected, raw=""))
    monkeypatch.setattr(crew, "build_crew", lambda settings, token: fake_crew)

    result = crew.run_crew(
        make_settings(), make_request("AMOUNT_MISMATCH", "p"), {}, lambda: FAKE_TOKEN
    )

    assert result is expected


def test_run_crew_parses_raw_when_no_pydantic(monkeypatch):
    raw = json.dumps(VALID_PAYLOAD)
    fake_crew = SimpleNamespace(kickoff=lambda inputs: SimpleNamespace(pydantic=None, raw=raw))
    monkeypatch.setattr(crew, "build_crew", lambda settings, token: fake_crew)

    result = crew.run_crew(
        make_settings(), make_request("AMOUNT_MISMATCH", "p"), {}, lambda: FAKE_TOKEN
    )

    assert result.priority == Priority.HIGH


def test_run_crew_without_token_is_not_configured():
    with pytest.raises(LlmNotConfiguredError):
        crew.run_crew(make_settings(), make_request("AMOUNT_MISMATCH", "p"), {}, lambda: None)


class ScriptedAsk:
    def __init__(self, text):
        self.text = text
        self.calls = []

    async def __call__(self, token, model, system_prompt, user_prompt, timeout_seconds):
        self.calls.append((token, model, system_prompt, user_prompt))
        return self.text


def run_real_crewai_with_scripted_llm(monkeypatch, text):
    ask = ScriptedAsk(text)
    monkeypatch.setattr(
        crew,
        "build_llm",
        lambda settings, token: CopilotLLM(
            model=settings.model,
            provider=PROVIDER_NAME,
            github_token=token,
            timeout_seconds=1.0,
            ask=ask,
        ),
    )
    request = make_request("AMOUNT_MISMATCH", "pay_amount", analyst_note="Nota del analista")
    result = crew.run_crew(make_settings(), request, {"paymentId": "pay_amount"}, lambda: FAKE_TOKEN)
    return result, ask


def test_crewai_drives_the_copilot_llm_end_to_end(monkeypatch):
    result, ask = run_real_crewai_with_scripted_llm(monkeypatch, json.dumps(VALID_PAYLOAD))

    token, model, system_prompt, user_prompt = ask.calls[0]
    assert result.headline == "Monto distinto"
    assert (token, model) == (FAKE_TOKEN, "claude-sonnet-5.5")
    assert crew.AGENT_ROLE in system_prompt
    assert "pay_amount" in user_prompt and "Nota del analista" in user_prompt


def test_crewai_with_unparsable_llm_text_raises_output_error(monkeypatch):
    with pytest.raises((LlmOutputError, ConverterError)):
        run_real_crewai_with_scripted_llm(monkeypatch, "esto no es json")



