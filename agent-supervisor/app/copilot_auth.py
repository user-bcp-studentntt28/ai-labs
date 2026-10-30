"""Resolucion del token de GitHub para el Copilot SDK (nunca se persiste ni se registra)."""

import os
import shutil
import subprocess
from collections.abc import Callable, Mapping

TOKEN_ENV_PRIORITY = ("COPILOT_GITHUB_TOKEN", "GH_TOKEN", "GITHUB_TOKEN")
GH_EXECUTABLE = "gh"
GH_TOKEN_ARGS = ("auth", "token")
GH_TIMEOUT_SECONDS = 10

GhTokenReader = Callable[[], str | None]


def read_token_from_environment(env: Mapping[str, str]) -> str | None:
    for name in TOKEN_ENV_PRIORITY:
        token = env.get(name, "").strip()
        if token:
            return token
    return None


def read_token_from_gh_cli() -> str | None:
    """Pide el token a `gh auth token`; devuelve None si gh no existe o falla."""
    executable = shutil.which(GH_EXECUTABLE)
    if executable is None:
        return None
    try:
        completed = subprocess.run(
            [executable, *GH_TOKEN_ARGS],
            capture_output=True,
            text=True,
            timeout=GH_TIMEOUT_SECONDS,
            check=False,
        )
    except (OSError, subprocess.SubprocessError):
        return None
    if completed.returncode != 0:
        return None
    return completed.stdout.strip() or None


def resolve_github_token(
    env: Mapping[str, str] | None = None, gh_reader: GhTokenReader = read_token_from_gh_cli
) -> str | None:
    """Variables de entorno (COPILOT_GITHUB_TOKEN > GH_TOKEN > GITHUB_TOKEN) y luego gh."""
    environment = os.environ if env is None else env
    return read_token_from_environment(environment) or gh_reader()
