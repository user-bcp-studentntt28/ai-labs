"""Funciones puras que seleccionan los registros de un pago y arman la evidencia."""

from decimal import Decimal
from typing import Any

from app.mock_client import MockSnapshot, Record

CENTS_PER_SOL = 100
CURRENCY_SYMBOL = "S/"
NO_DATA_LABEL = "sin dato"
OPEN_STATUS = "OPEN"
LEDGER_OPERATION_FIELD = "operation"
PAYMENT_ID_FIELD = "id"
INCIDENT_PAYMENT_FIELD = "payment_id"


def format_money(cents: Any) -> str:
    """Convierte centavos de PEN en texto: 1500 -> 'S/ 15.00'."""
    if isinstance(cents, bool) or not isinstance(cents, (int, float)):
        return NO_DATA_LABEL
    soles = Decimal(int(cents)) / CENTS_PER_SOL
    sign = "-" if soles < 0 else ""
    return f"{sign}{CURRENCY_SYMBOL} {abs(soles):,.2f}"


def _with_amount_text(record: Record, fields: tuple[str, ...]) -> Record:
    selected = {name: record.get(name) for name in fields}
    selected["amountFormatted"] = format_money(record.get("amount"))
    return selected


def _records_for_payment(records: list[Record], key: str, payment_id: str) -> list[Record]:
    return [record for record in records if record.get(key) == payment_id]


def _amount_difference(wallet_records: list[Record], provider_records: list[Record]) -> int | None:
    if not wallet_records or not provider_records:
        return None
    wallet_amount = wallet_records[0].get("amount")
    provider_amount = provider_records[0].get("amount")
    if not isinstance(wallet_amount, int) or not isinstance(provider_amount, int):
        return None
    return abs(wallet_amount - provider_amount)


def _ledger_section(entries: list[Record]) -> dict[str, Any]:
    amounts = [entry.get("amount") for entry in entries if isinstance(entry.get("amount"), int)]
    net_cents = sum(amounts)
    return {
        "count": len(entries),
        "entries": [
            _with_amount_text(entry, ("id", "kind", "account", "amount")) for entry in entries
        ],
        "creditCents": sum(amount for amount in amounts if amount > 0),
        "netCents": net_cents,
        "balanced": net_cents == 0,
    }


def _totals(snapshot: MockSnapshot) -> dict[str, Any]:
    ledger_amounts = [e.get("amount") for e in snapshot.ledger if isinstance(e.get("amount"), int)]
    return {
        "walletPayments": len(snapshot.payments),
        "providerSettlements": len(snapshot.settlements),
        "ledgerEntries": len(snapshot.ledger),
        "ledgerNetCents": sum(ledger_amounts),
        "openIncidents": sum(1 for i in snapshot.incidents if i.get("status") == OPEN_STATUS),
    }


def build_evidence(
    payment_id: str, reason: str, wallet_id: str, snapshot: MockSnapshot
) -> dict[str, Any]:
    """Evidencia compacta: solo registros del pago mas conteos globales."""
    wallet_records = _records_for_payment(snapshot.payments, PAYMENT_ID_FIELD, payment_id)
    provider_records = _records_for_payment(snapshot.settlements, PAYMENT_ID_FIELD, payment_id)
    ledger_entries = _records_for_payment(snapshot.ledger, LEDGER_OPERATION_FIELD, payment_id)
    incidents = _records_for_payment(snapshot.incidents, INCIDENT_PAYMENT_FIELD, payment_id)
    return {
        "paymentId": payment_id,
        "reason": reason,
        "walletId": wallet_id,
        "wallet": {
            "count": len(wallet_records),
            "records": [
                _with_amount_text(r, ("id", "recipient", "amount", "status")) for r in wallet_records
            ],
        },
        "provider": {
            "count": len(provider_records),
            "records": [_with_amount_text(r, ("id", "amount", "status")) for r in provider_records],
        },
        "ledger": _ledger_section(ledger_entries),
        "amountDifferenceCents": _amount_difference(wallet_records, provider_records),
        "incidents": [_incident_summary(i) for i in incidents],
        "totals": _totals(snapshot),
    }


def _incident_summary(incident: Record) -> Record:
    return {name: incident.get(name) for name in ("id", "reason", "status")}
