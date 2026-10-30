import subprocess
from types import SimpleNamespace

import pytest

from app import copilot_auth
from app.copilot_auth import (
    read_token_from_environment,
    read_token_from_gh_cli,
    resolve_github_token,
)

FAKE_COPILOT = "fake-copilot-token"
FAKE_GH = "fake-gh-token"
FAKE_GITHUB = "fake-github-token"
FAKE_CLI = "fake-cli-token"


def never_called_reader():
    raise AssertionError("gh no debe consultarse cuando hay variable de entorno")


def test_environment_priority_copilot_then_gh_then_github():
    env = {"GITHUB_TOKEN": FAKE_GITHUB, "GH_TOKEN": FAKE_GH, "COPILOT_GITHUB_TOKEN": FAKE_COPILOT}

    assert read_token_from_environment(env) == FAKE_COPILOT
    del env["COPILOT_GITHUB_TOKEN"]
    assert read_token_from_environment(env) == FAKE_GH
    del env["GH_TOKEN"]
    assert read_token_from_environment(env) == FAKE_GITHUB


def test_blank_variables_are_ignored():
    assert read_token_from_environment({"COPILOT_GITHUB_TOKEN": "  ", "GH_TOKEN": ""}) is None


def test_resolve_prefers_environment_over_gh():
    token = resolve_github_token({"GH_TOKEN": FAKE_GH}, gh_reader=never_called_reader)

    assert token == FAKE_GH


def test_resolve_falls_back_to_gh_cli():
    assert resolve_github_token({}, gh_reader=lambda: FAKE_CLI) == FAKE_CLI


def test_resolve_without_any_token_returns_none():
    assert resolve_github_token({}, gh_reader=lambda: None) is None


def test_resolve_uses_process_environment_by_default(monkeypatch):
    monkeypatch.setenv("COPILOT_GITHUB_TOKEN", FAKE_COPILOT)

    assert resolve_github_token(gh_reader=never_called_reader) == FAKE_COPILOT


def test_gh_reader_returns_trimmed_stdout(monkeypatch):
    calls = []

    def fake_run(command, **kwargs):
        calls.append((command, kwargs))
        return SimpleNamespace(returncode=0, stdout=f"{FAKE_CLI}\n")

    monkeypatch.setattr(copilot_auth.shutil, "which", lambda name: "gh-path")
    monkeypatch.setattr(copilot_auth.subprocess, "run", fake_run)

    assert read_token_from_gh_cli() == FAKE_CLI
    assert calls[0][0] == ["gh-path", "auth", "token"]
    assert calls[0][1]["timeout"] == copilot_auth.GH_TIMEOUT_SECONDS


def test_gh_reader_without_gh_installed(monkeypatch):
    monkeypatch.setattr(copilot_auth.shutil, "which", lambda name: None)

    assert read_token_from_gh_cli() is None


@pytest.mark.parametrize(
    "outcome",
    [
        SimpleNamespace(returncode=1, stdout=""),
        SimpleNamespace(returncode=0, stdout="  \n"),
        OSError("no ejecutable"),
        subprocess.TimeoutExpired("gh", 10),
    ],
)
def test_gh_reader_failures_return_none(monkeypatch, outcome):
    def fake_run(command, **kwargs):
        if isinstance(outcome, Exception):
            raise outcome
        return outcome

    monkeypatch.setattr(copilot_auth.shutil, "which", lambda name: "gh-path")
    monkeypatch.setattr(copilot_auth.subprocess, "run", fake_run)

    assert read_token_from_gh_cli() is None
