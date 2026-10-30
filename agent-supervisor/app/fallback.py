"""Briefing determinista construido solo con los datos (sin LLM)."""

import re
from dataclasses import dataclass
from typing import Any

from app.evidence import NO_DATA_LABEL, format_money
from app.schemas import (
    EVIDENCE_MAX_ITEMS,
    HEADLINE_MAX_LENGTH,
    BriefingEvent,
    BriefingRequest,
    LlmBriefing,
    Priority,
)

HIGH_DIFFERENCE_CENTS = 10_000
LOW_DIFFERENCE_CENTS = 100
ELLIPSIS = "…"
NOTE_PREVIEW_LENGTH = 80

REASON_BASE_PRIORITY = {
    "DUPLICATE_PROVIDER": Priority.HIGH,
    "MISSING_WALLET": Priority.HIGH,
    "LEDGER_UNBALANCED": Priority.HIGH,
    "BALANCE_MISMATCH": Priority.HIGH,
    "AMOUNT_MISMATCH": Priority.MEDIUM,
    "MISSING_PROVIDER": Priority.MEDIUM,
    "STATUS_MISMATCH": Priority.MEDIUM,
    "LEDGER_MISMATCH": Priority.MEDIUM,
}
DEFAULT_PRIORITY = Priority.MEDIUM


@dataclass(frozen=True)
class ReasonText:
    headline: str
    problem: str
    check: str
    note_keywords: str


@dataclass(frozen=True)
class PaymentFacts:
    payment_id: str
    wallet_amount: str
    wallet_status: str
    provider_count: int
    provider_amount: str
    provider_status: str
    difference: str
    ledger_count: int
    ledger_net: str


REASON_TEXTS = {
    "AMOUNT_MISMATCH": ReasonText(
        "Monto distinto entre billetera y proveedor ({difference})",
        "El pago {payment_id} figura por {wallet_amount} en la billetera, pero el proveedor "
        "lo liquidó por {provider_amount}. La diferencia es de {difference}.",
        "confirme cuál monto es el correcto y que se corrija el registro erróneo",
        r"monto|importe|diferencia|corrig|ajust",
    ),
    "MISSING_PROVIDER": ReasonText(
        "Pago sin liquidación del proveedor",
        "El pago {payment_id} por {wallet_amount} existe en la billetera, pero el reporte del "
        "proveedor no lo incluye. Puede no haberse liquidado todavía o haberse perdido.",
        "confirme con el proveedor si el pago fue procesado antes de darlo por resuelto",
        r"proveedor|liquidaci|settlement|reporte",
    ),
    "DUPLICATE_PROVIDER": ReasonText(
        "Pago liquidado más de una vez por el proveedor",
        "El proveedor reporta {provider_count} liquidaciones para el pago {payment_id}, que en "
        "la billetera figura una sola vez por {wallet_amount}. Existe riesgo de cobro duplicado.",
        "verifique que se reclame o reverse la liquidación repetida con el proveedor",
        r"duplic|repetid|revers|reclam|proveedor",
    ),
    "MISSING_WALLET": ReasonText(
        "Liquidación del proveedor sin pago en la billetera",
        "El proveedor liquidó el pago {payment_id} por {provider_amount}, pero la billetera no "
        "tiene ese pago registrado. Es un pago huérfano de origen desconocido.",
        "confirme el origen del pago y si corresponde registrarlo o reclamar su devolución",
        r"hu[eé]rfan|billetera|wallet|origen|registr",
    ),
    "STATUS_MISMATCH": ReasonText(
        "Estado distinto entre billetera y proveedor",
        "El pago {payment_id} está en estado {wallet_status} en la billetera y en "
        "{provider_status} según el proveedor. El monto en la billetera es {wallet_amount}.",
        "confirme cuál estado es el vigente y que ambos sistemas queden alineados",
        r"estado|status|alinea|actualiz",
    ),
    "LEDGER_MISMATCH": ReasonText(
        "Asientos del ledger no coinciden con el pago",
        "Los asientos contables del pago {payment_id} no coinciden con el monto registrado de "
        "{wallet_amount}. El ledger tiene {ledger_count} asientos con neto {ledger_net}.",
        "confirme que los asientos reflejen el monto real del pago",
        r"ledger|asiento|contab|libro",
    ),
    "LEDGER_UNBALANCED": ReasonText(
        "Ledger descuadrado: débitos y créditos no suman cero",
        "Los asientos del pago {payment_id} no suman cero: el neto es {ledger_net}. "
        "Un ledger descuadrado indica dinero que aparece o desaparece sin contrapartida.",
        "verifique que se registre el asiento faltante o se corrija el existente",
        r"ledger|asiento|cuadr|contab|libro",
    ),
    "BALANCE_MISMATCH": ReasonText(
        "El saldo de la billetera no cuadra con el ledger",
        "El saldo de la billetera asociado al pago {payment_id} no coincide con lo que indica "
        "el ledger. El neto del ledger para este pago es {ledger_net}.",
        "confirme el saldo correcto antes de aprobar cualquier ajuste",
        r"saldo|balance|ledger|ajust",
    ),
}
UNKNOWN_REASON_TEXT = ReasonText(
    "Incidente de conciliación por revisar",
    "El pago {payment_id} tiene un incidente de conciliación abierto. En la billetera figura "
    "por {wallet_amount} y el proveedor lo reporta por {provider_amount}.",
    "revise los datos de billetera, proveedor y ledger antes de decidir",
    r"",
)

STARTED_TEMPLATE = "Sin acción inmediata: cuando el analista responda, {check}."
SUBMITTED_TEMPLATE = "La respuesta del analista {consistency}; {check}."
CONSISTENT_CLAUSE = "es coherente con los datos"
INCONSISTENT_CLAUSE = "no menciona la causa detectada en los datos"
EMPTY_NOTE_CLAUSE = "no se recibió o está vacía"
UNVERIFIABLE_CLAUSE = "no pudo contrastarse automáticamente con los datos"


def build_facts(evidence: dict[str, Any]) -> PaymentFacts:
    wallet = _first_or_empty(evidence["wallet"]["records"])
    provider = _first_or_empty(evidence["provider"]["records"])
    difference = evidence["amountDifferenceCents"]
    return PaymentFacts(
        payment_id=evidence["paymentId"],
        wallet_amount=format_money(wallet.get("amount")),
        wallet_status=wallet.get("status") or NO_DATA_LABEL,
        provider_count=evidence["provider"]["count"],
        provider_amount=format_money(provider.get("amount")),
        provider_status=provider.get("status") or NO_DATA_LABEL,
        difference=format_money(difference) if difference is not None else NO_DATA_LABEL,
        ledger_count=evidence["ledger"]["count"],
        ledger_net=format_money(evidence["ledger"]["netCents"]),
    )


def _first_or_empty(records: list[dict[str, Any]]) -> dict[str, Any]:
    return records[0] if records else {}


def decide_priority(reason: str, evidence: dict[str, Any]) -> Priority:
    priority = REASON_BASE_PRIORITY.get(reason, DEFAULT_PRIORITY)
    difference = evidence["amountDifferenceCents"]
    if difference is None:
        return priority
    if difference >= HIGH_DIFFERENCE_CENTS:
        return Priority.HIGH
    if reason == "AMOUNT_MISMATCH" and difference <= LOW_DIFFERENCE_CENTS:
        return Priority.LOW
    return priority


def truncate(text: str, max_length: int) -> str:
    if len(text) <= max_length:
        return text
    return text[: max_length - len(ELLIPSIS)].rstrip() + ELLIPSIS


def build_evidence_lines(facts: PaymentFacts, evidence: dict[str, Any]) -> list[str]:
    lines = [
        _wallet_line(evidence["wallet"]["count"], facts),
        _provider_line(facts),
        _ledger_line(facts),
    ]
    if evidence["amountDifferenceCents"]:
        lines.append(f"Diferencia entre billetera y proveedor: {facts.difference}")
    return lines[:EVIDENCE_MAX_ITEMS]


def _wallet_line(wallet_count: int, facts: PaymentFacts) -> str:
    if wallet_count == 0:
        return "Billetera: no tiene registro de este pago"
    return f"Billetera: {facts.wallet_amount} ({facts.wallet_status})"


def _provider_line(facts: PaymentFacts) -> str:
    if facts.provider_count == 0:
        return "Proveedor: no reporta liquidación de este pago"
    if facts.provider_count > 1:
        return f"Proveedor: {facts.provider_count} liquidaciones de {facts.provider_amount} cada una"
    return f"Proveedor: {facts.provider_amount} ({facts.provider_status})"


def _ledger_line(facts: PaymentFacts) -> str:
    if facts.ledger_count == 0:
        return "Ledger: sin asientos para este pago"
    return f"Ledger: {facts.ledger_count} asientos, neto {facts.ledger_net}"


def describe_note_consistency(note: str | None, keywords: str) -> str:
    if not note or not note.strip():
        return EMPTY_NOTE_CLAUSE
    if not keywords:
        return UNVERIFIABLE_CLAUSE
    if re.search(keywords, note, re.IGNORECASE):
        return CONSISTENT_CLAUSE
    return INCONSISTENT_CLAUSE


def build_recommendation(request: BriefingRequest, text: ReasonText) -> str:
    if request.event == BriefingEvent.STARTED:
        return STARTED_TEMPLATE.format(check=text.check)
    consistency = describe_note_consistency(request.analyst_note, text.note_keywords)
    return SUBMITTED_TEMPLATE.format(consistency=consistency, check=text.check)


def build_fallback_briefing(request: BriefingRequest, evidence: dict[str, Any]) -> LlmBriefing:
    facts = build_facts(evidence)
    text = REASON_TEXTS.get(request.reason, UNKNOWN_REASON_TEXT)
    values = vars(facts)
    return LlmBriefing(
        priority=decide_priority(request.reason, evidence),
        headline=truncate(text.headline.format(**values), HEADLINE_MAX_LENGTH),
        problem=text.problem.format(**values),
        evidence=build_evidence_lines(facts, evidence),
        recommendation=build_recommendation(request, text),
    )
