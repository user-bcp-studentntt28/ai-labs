import asyncio

import httpx
import pytest

from app.mock_client import MockClient, MockUnavailableError, extract_records

BASE_URL = "http://mock.test/groups/3"


def make_client(handler) -> MockClient:
    return MockClient(BASE_URL, 1.0, transport=httpx.MockTransport(handler))


def test_extract_records_accepts_list_and_wrapped_list():
    assert extract_records([{"id": 1}, "ignorado"]) == [{"id": 1}]
    assert extract_records({"items": [{"id": 2}]}) == [{"id": 2}]
    assert extract_records({"data": [{"id": 3}]}) == [{"id": 3}]


@pytest.mark.parametrize("payload", ["texto", 5, {"otro": 1}])
def test_extract_records_rejects_unusable_payload(payload):
    with pytest.raises(MockUnavailableError):
        extract_records(payload)


def test_fetch_snapshot_reads_four_endpoints_with_wallet_filter():
    seen = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append((request.method, request.url.path, request.url.params.get("walletId")))
        if request.url.path.endswith("/settlements"):
            return httpx.Response(200, json={"items": [{"id": "s1"}]})
        return httpx.Response(200, json=[{"id": request.url.path}])

    snapshot = asyncio.run(make_client(handler).fetch_snapshot("wallet-demo"))

    assert {method for method, _, _ in seen} == {"GET"}
    assert sorted(path for _, path, _ in seen) == [
        "/groups/3/ledger",
        "/groups/3/payments",
        "/groups/3/reconciliations/incidents",
        "/groups/3/settlements",
    ]
    assert ("GET", "/groups/3/payments", "wallet-demo") in seen
    assert snapshot.settlements == [{"id": "s1"}]
    assert len(snapshot.payments) == 1


@pytest.mark.parametrize(
    "handler",
    [
        lambda request: httpx.Response(500, json={}),
        lambda request: httpx.Response(200, content=b"no json"),
        lambda request: (_ for _ in ()).throw(httpx.ConnectError("sin red")),
    ],
)
def test_fetch_snapshot_wraps_failures(handler):
    with pytest.raises(MockUnavailableError):
        asyncio.run(make_client(handler).fetch_snapshot("wallet-demo"))
