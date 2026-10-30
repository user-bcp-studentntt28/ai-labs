import pytest

from app.evidence import build_evidence
from app.fallback import (
    HIGH_DIFFERENCE_CENTS,
    build_fallback_briefing,
    describe_note_consistency,
    truncate,
)
from app.schemas import (
    EVIDENCE_MAX_ITEMS,
    HEADLINE_MAX_LENGTH,
    BriefingEvent,
    Priority,
)
from tests.conftest import WALLET_ID, make_request


def briefing_for(snapshot, reason, payment_id, **overrides):
    request = make_request(reason, payment_id, **overrides)
    evidence = build_evidence(payment_id, reason, WALLET_ID, snapshot)
    return build_fallback_briefing(request, evidence)


@pytest.mark.parametrize(
    ("reason", "payment_id", "expected_priority", "problem_fragment"),
    [
        ("AMOUNT_MISMATCH", "pay_amount", Priority.MEDIUM, "S/ 15.00"),
        ("MISSING_PROVIDER", "pay_nolink", Priority.MEDIUM, "no lo incluye"),
        ("DUPLICATE_PROVIDER", "pay_dup", Priority.HIGH, "2 liquidaciones"),
        ("MISSING_WALLET", "pay_orphan", Priority.HIGH, "S/ 12.34"),
        ("STATUS_MISMATCH", "pay_status", Priority.MEDIUM, "FAILED"),
        ("LEDGER_MISMATCH", "pay_amount", Priority.MEDIUM, "S/ 15.00"),
        ("LEDGER_UNBALANCED", "pay_unbalanced", Priority.HIGH, "-S/ 7.00"),
        ("BALANCE_MISMATCH", "pay_ok", Priority.HIGH, "saldo"),
        ("SOMETHING_NEW", "pay_ok", Priority.MEDIUM, "incidente de conciliación"),
    ],
)
def test_fallback_for_each_reason(snapshot, reason, payment_id, expected_priority, problem_fragment):
    briefing = briefing_for(snapshot, reason, payment_id)

    assert briefing.priority == expected_priority
    assert problem_fragment in briefing.problem
    assert 0 < len(briefing.headline) <= HEADLINE_MAX_LENGTH
    assert 1 <= len(briefing.evidence) <= EVIDENCE_MAX_ITEMS
    assert briefing.recommendation.startswith("Sin acción inmediata")


def test_amount_mismatch_evidence_shows_difference(snapshot):
    briefing = briefing_for(snapshot, "AMOUNT_MISMATCH", "pay_amount")

    assert briefing.evidence == [
        "Billetera: S/ 15.00 (SUCCEEDED)",
        "Proveedor: S/ 9.99 (SUCCEEDED)",
        "Ledger: 2 asientos, neto S/ 0.00",
        "Diferencia entre billetera y proveedor: S/ 5.01",
    ]


def test_duplicate_and_missing_evidence_lines(snapshot):
    duplicate = briefing_for(snapshot, "DUPLICATE_PROVIDER", "pay_dup")
    orphan = briefing_for(snapshot, "MISSING_WALLET", "pay_orphan")

    assert "Proveedor: 2 liquidaciones de S/ 3.75 cada una" in duplicate.evidence
    assert not any("Diferencia" in line for line in duplicate.evidence)
    assert "Billetera: no tiene registro de este pago" in orphan.evidence
    assert "Ledger: sin asientos para este pago" in orphan.evidence
    assert "Proveedor: no reporta liquidación de este pago" in briefing_for(
        snapshot, "MISSING_PROVIDER", "pay_nolink"
    ).evidence


def test_large_difference_raises_priority_to_high(snapshot):
    snapshot.settlements[1]["amount"] = 1500 - HIGH_DIFFERENCE_CENTS

    assert briefing_for(snapshot, "AMOUNT_MISMATCH", "pay_amount").priority == Priority.HIGH


def test_tiny_difference_lowers_priority_to_low(snapshot):
    snapshot.settlements[1]["amount"] = 1499

    assert briefing_for(snapshot, "AMOUNT_MISMATCH", "pay_amount").priority == Priority.LOW


def test_submitted_with_consistent_note(snapshot):
    briefing = briefing_for(
        snapshot,
        "AMOUNT_MISMATCH",
        "pay_amount",
        event=BriefingEvent.SUBMITTED,
        analyst_note="Corregí el monto según el reporte del proveedor",
    )

    assert briefing.recommendation.startswith("La respuesta del analista es coherente")


def test_submitted_with_inconsistent_note(snapshot):
    briefing = briefing_for(
        snapshot,
        "AMOUNT_MISMATCH",
        "pay_amount",
        event=BriefingEvent.SUBMITTED,
        analyst_note="Todo bien, cerrar.",
    )

    assert "no menciona la causa detectada" in briefing.recommendation


def test_note_consistency_edge_cases():
    assert "vacía" in describe_note_consistency(None, "monto")
    assert "vacía" in describe_note_consistency("   ", "monto")
    assert "no pudo contrastarse" in describe_note_consistency("algo", "")


def test_truncate_adds_ellipsis():
    assert truncate("corto", 10) == "corto"
    shortened = truncate("x" * 50, 10)
    assert len(shortened) == 10
    assert shortened.endswith("…")
