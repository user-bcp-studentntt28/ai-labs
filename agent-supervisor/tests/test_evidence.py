import pytest

from app.evidence import build_evidence, format_money
from tests.conftest import WALLET_ID


@pytest.mark.parametrize(
    ("cents", "expected"),
    [
        (1500, "S/ 15.00"),
        (0, "S/ 0.00"),
        (5, "S/ 0.05"),
        (999, "S/ 9.99"),
        (123456, "S/ 1,234.56"),
        (-250, "-S/ 2.50"),
        (None, "sin dato"),
        ("abc", "sin dato"),
        (True, "sin dato"),
    ],
)
def test_format_money(cents, expected):
    assert format_money(cents) == expected


def test_amount_mismatch_compares_wallet_provider_and_ledger(snapshot):
    evidence = build_evidence("pay_amount", "AMOUNT_MISMATCH", WALLET_ID, snapshot)

    assert evidence["wallet"]["records"][0]["amountFormatted"] == "S/ 15.00"
    assert evidence["provider"]["records"][0]["amountFormatted"] == "S/ 9.99"
    assert evidence["amountDifferenceCents"] == 501
    assert evidence["ledger"]["count"] == 2
    assert evidence["ledger"]["balanced"] is True
    assert evidence["ledger"]["creditCents"] == 1500
    assert evidence["incidents"] == [
        {"id": "incident_1", "reason": "AMOUNT_MISMATCH", "status": "OPEN"}
    ]


def test_missing_provider_has_no_provider_records(snapshot):
    evidence = build_evidence("pay_nolink", "MISSING_PROVIDER", WALLET_ID, snapshot)

    assert evidence["wallet"]["count"] == 1
    assert evidence["provider"] == {"count": 0, "records": []}
    assert evidence["amountDifferenceCents"] is None


def test_duplicate_provider_counts_both_settlements(snapshot):
    evidence = build_evidence("pay_dup", "DUPLICATE_PROVIDER", WALLET_ID, snapshot)

    assert evidence["provider"]["count"] == 2
    assert evidence["wallet"]["count"] == 1
    assert evidence["amountDifferenceCents"] == 0


def test_missing_wallet_orphan_only_in_provider(snapshot):
    evidence = build_evidence("pay_orphan", "MISSING_WALLET", WALLET_ID, snapshot)

    assert evidence["wallet"] == {"count": 0, "records": []}
    assert evidence["provider"]["records"][0]["amountFormatted"] == "S/ 12.34"
    assert evidence["amountDifferenceCents"] is None


def test_ledger_unbalanced_reports_net(snapshot):
    evidence = build_evidence("pay_unbalanced", "LEDGER_UNBALANCED", WALLET_ID, snapshot)

    assert evidence["ledger"]["netCents"] == -700
    assert evidence["ledger"]["balanced"] is False
    assert evidence["ledger"]["entries"][0]["amountFormatted"] == "-S/ 7.00"


def test_balance_mismatch_includes_global_totals(snapshot):
    evidence = build_evidence("pay_ok", "BALANCE_MISMATCH", WALLET_ID, snapshot)

    assert evidence["totals"] == {
        "walletPayments": 5,
        "providerSettlements": 6,
        "ledgerEntries": 5,
        "ledgerNetCents": -700,
        "openIncidents": 1,
    }


def test_unknown_payment_yields_empty_sections(snapshot):
    evidence = build_evidence("pay_unknown", "LEDGER_MISMATCH", WALLET_ID, snapshot)

    assert evidence["wallet"]["count"] == 0
    assert evidence["provider"]["count"] == 0
    assert evidence["ledger"]["count"] == 0
    assert evidence["incidents"] == []


def test_non_integer_amounts_do_not_break_difference(snapshot):
    snapshot.payments.append({"id": "pay_bad", "amount": "12", "status": "X"})
    snapshot.settlements.append({"id": "pay_bad", "amount": 12, "status": "X"})

    evidence = build_evidence("pay_bad", "AMOUNT_MISMATCH", WALLET_ID, snapshot)

    assert evidence["amountDifferenceCents"] is None
