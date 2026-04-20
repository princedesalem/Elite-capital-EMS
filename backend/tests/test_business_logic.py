"""
Tests pour app/utils/business_logic.py
(calculer_jours_ouvrables, verifier_eligibilite_conges, verifier_solde_conges)
"""
import pytest
from datetime import date, timedelta
from decimal import Decimal
from unittest.mock import MagicMock

from app.utils.business_logic import (
    calculer_jours_ouvrables,
    verifier_eligibilite_conges,
    verifier_solde_conges,
)


# ── calculer_jours_ouvrables ──────────────────────────────────────────────────

def test_same_day_weekday():
    # Lundi = 1 jour ouvrable
    monday = date(2026, 4, 13)  # un lundi
    assert calculer_jours_ouvrables(monday, monday) == 1


def test_same_day_saturday_excluded():
    saturday = date(2026, 4, 11)  # samedi
    assert calculer_jours_ouvrables(saturday, saturday) == 0


def test_same_day_sunday_excluded():
    sunday = date(2026, 4, 12)  # dimanche
    assert calculer_jours_ouvrables(sunday, sunday) == 0


def test_full_week_monday_to_friday():
    # lun 13 avril → ven 17 avril = 5 jours ouvrables
    monday = date(2026, 4, 13)
    friday = date(2026, 4, 17)
    assert calculer_jours_ouvrables(monday, friday) == 5


def test_week_with_weekend():
    # lun 13 → dim 19 = 5 jours ouvrables (pas sam ni dim)
    monday = date(2026, 4, 13)
    sunday = date(2026, 4, 19)
    assert calculer_jours_ouvrables(monday, sunday) == 5


def test_inverted_dates_returns_zero():
    assert calculer_jours_ouvrables(date(2026, 5, 10), date(2026, 5, 1)) == 0


def test_exclure_false_counts_all():
    monday = date(2026, 4, 13)
    sunday = date(2026, 4, 19)
    assert calculer_jours_ouvrables(monday, sunday, exclure_vendredi_samedi=False) == 7


# ── verifier_eligibilite_conges ───────────────────────────────────────────────

def _mock_employe(date_embauche=None):
    emp = MagicMock()
    emp.date_embauche = date_embauche
    return emp


def test_eligibilite_no_date_embauche():
    emp = _mock_employe(date_embauche=None)
    ok, msg = verifier_eligibilite_conges(emp)
    assert ok is False
    assert 'embauche' in msg.lower()


def test_eligibilite_less_than_one_year():
    emp = _mock_employe(date_embauche=date.today() - timedelta(days=100))
    ok, msg = verifier_eligibilite_conges(emp)
    assert ok is False
    assert 'insuffisante' in msg.lower() or 'eligib' in msg.lower()


def test_eligibilite_more_than_one_year():
    emp = _mock_employe(date_embauche=date.today() - timedelta(days=400))
    ok, msg = verifier_eligibilite_conges(emp)
    assert ok is True
    assert 'confirmée' in msg or 'confirm' in msg.lower()


# ── verifier_solde_conges ─────────────────────────────────────────────────────

def _mock_employe_solde(solde):
    emp = MagicMock()
    emp.solde_conges = solde
    return emp


def test_solde_suffisant():
    emp = _mock_employe_solde(Decimal('20'))
    ok, msg, solde = verifier_solde_conges(emp, 5)
    assert ok is True
    assert solde == Decimal('20')


def test_solde_exact():
    emp = _mock_employe_solde(Decimal('5'))
    ok, msg, solde = verifier_solde_conges(emp, 5)
    assert ok is True


def test_solde_insuffisant():
    emp = _mock_employe_solde(Decimal('3'))
    ok, msg, solde = verifier_solde_conges(emp, 5)
    assert ok is False
    assert 'insuffisant' in msg.lower()
    assert solde == Decimal('3')


def test_solde_zero():
    emp = _mock_employe_solde(None)
    ok, msg, solde = verifier_solde_conges(emp, 1)
    assert ok is False
    assert solde == Decimal('0')
