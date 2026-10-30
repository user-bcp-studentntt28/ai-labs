"""Lectura (solo GET) del API mock de pagos."""

import asyncio
from dataclasses import dataclass, field
from typing import Any

import httpx

PAYMENTS_PATH = "/payments"
SETTLEMENTS_PATH = "/settlements"
LEDGER_PATH = "/ledger"
INCIDENTS_PATH = "/reconciliations/incidents"
WALLET_ID_PARAM = "walletId"
WRAPPER_KEYS = ("items", "data", "results")

Record = dict[str, Any]


class MockUnavailableError(Exception):
    """El API mock no respondio o devolvio un cuerpo inutilizable."""


@dataclass(frozen=True)
class MockSnapshot:
    payments: list[Record] = field(default_factory=list)
    settlements: list[Record] = field(default_factory=list)
    ledger: list[Record] = field(default_factory=list)
    incidents: list[Record] = field(default_factory=list)


def extract_records(payload: Any) -> list[Record]:
    """Acepta una lista directa o un objeto que envuelve la lista."""
    if isinstance(payload, list):
        return [record for record in payload if isinstance(record, dict)]
    if not isinstance(payload, dict):
        raise MockUnavailableError("Formato de respuesta inesperado del mock")
    for key in WRAPPER_KEYS:
        if isinstance(payload.get(key), list):
            return extract_records(payload[key])
    raise MockUnavailableError("El mock no devolvio una lista de registros")


class MockClient:
    def __init__(
        self,
        base_url: str,
        timeout_seconds: float,
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        self._base_url = base_url
        self._timeout_seconds = timeout_seconds
        self._transport = transport

    async def fetch_snapshot(self, wallet_id: str) -> MockSnapshot:
        async with httpx.AsyncClient(
            base_url=self._base_url,
            timeout=self._timeout_seconds,
            transport=self._transport,
        ) as client:
            payments, settlements, ledger, incidents = await asyncio.gather(
                self._get_records(client, PAYMENTS_PATH, {WALLET_ID_PARAM: wallet_id}),
                self._get_records(client, SETTLEMENTS_PATH),
                self._get_records(client, LEDGER_PATH),
                self._get_records(client, INCIDENTS_PATH),
            )
        return MockSnapshot(payments, settlements, ledger, incidents)

    @staticmethod
    async def _get_records(
        client: httpx.AsyncClient, path: str, params: dict[str, str] | None = None
    ) -> list[Record]:
        try:
            response = await client.get(path, params=params)
            response.raise_for_status()
            return extract_records(response.json())
        except (httpx.HTTPError, ValueError) as error:
            raise MockUnavailableError(f"No se pudo leer {path} del mock: {error}") from error
