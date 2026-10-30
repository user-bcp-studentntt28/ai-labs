import pytest

from app.config import Settings
from app.mock_client import MockSnapshot
from app.schemas import BriefingEvent, BriefingRequest

WALLET_ID = "wallet-demo"
ORIGIN = "http://localhost:4200"


MODEL = "claude-sonnet-5.5"


def make_settings(**overrides) -> Settings:
    values = {
        "mock_base_url": "http://mock.test/groups/3",
        "model": MODEL,
        "allowed_origins": (ORIGIN,),
        "mock_timeout_seconds": 1.0,
        "llm_timeout_seconds": 1.0,
    }
    values.update(overrides)
    return Settings(**values)


def make_request(reason: str, payment_id: str, **overrides) -> BriefingRequest:
    values = {
        "incident_id": "incident_1",
        "payment_id": payment_id,
        "reason": reason,
        "wallet_id": WALLET_ID,
        "event": BriefingEvent.STARTED,
    }
    values.update(overrides)
    return BriefingRequest(**values)


def payment(payment_id: str, amount: int, status: str = "SUCCEEDED") -> dict:
    return {
        "id": payment_id,
        "wallet_id": WALLET_ID,
        "recipient": "contact-demo",
        "amount": amount,
        "status": status,
        "scenario": "APPROVED",
    }


def settlement(payment_id: str, amount: int, status: str = "SUCCEEDED") -> dict:
    return {"id": payment_id, "amount": amount, "status": status}


def ledger_pair(first_id: int, payment_id: str, amount: int) -> list[dict]:
    return [
        {"id": first_id, "operation": payment_id, "kind": "PAYMENT", "account": WALLET_ID, "amount": -amount},
        {"id": first_id + 1, "operation": payment_id, "kind": "PAYMENT", "account": "clearing", "amount": amount},
    ]


@pytest.fixture
def snapshot() -> MockSnapshot:
    return MockSnapshot(
        payments=[
            payment("pay_ok", 2000),
            payment("pay_amount", 1500),
            payment("pay_nolink", 800),
            payment("pay_dup", 375),
            payment("pay_status", 500, "SUCCEEDED"),
        ],
        settlements=[
            settlement("pay_ok", 2000),
            settlement("pay_amount", 999),
            settlement("pay_dup", 375),
            settlement("pay_dup", 375),
            settlement("pay_status", 500, "FAILED"),
            settlement("pay_orphan", 1234),
        ],
        ledger=[
            *ledger_pair(1, "pay_ok", 2000),
            *ledger_pair(3, "pay_amount", 1500),
            {"id": 5, "operation": "pay_unbalanced", "kind": "PAYMENT", "account": WALLET_ID, "amount": -700},
        ],
        incidents=[
            {"id": "incident_1", "payment_id": "pay_amount", "reason": "AMOUNT_MISMATCH", "status": "OPEN"},
            {"id": "incident_2", "payment_id": "pay_ok", "reason": "STATUS_MISMATCH", "status": "RESOLVED"},
        ],
    )
