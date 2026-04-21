"""Tests pour le format FCFA (utils/formatting)."""
from app.utils.formatting import fmt_fcfa


NBSP = '\u00a0'


def test_fmt_fcfa_integer_large():
    assert fmt_fcfa(20000000) == f"20{NBSP}000{NBSP}000{NBSP}FCFA"


def test_fmt_fcfa_zero_and_none():
    assert fmt_fcfa(0) == f"0{NBSP}FCFA"
    assert fmt_fcfa(None) == f"0{NBSP}FCFA"


def test_fmt_fcfa_small():
    assert fmt_fcfa(500) == f"500{NBSP}FCFA"


def test_fmt_fcfa_decimal_truncation():
    # on n'affiche pas les décimales
    assert fmt_fcfa(1234.56) == f"1{NBSP}235{NBSP}FCFA"


def test_fmt_fcfa_string_numeric():
    assert fmt_fcfa('150000') == f"150{NBSP}000{NBSP}FCFA"


def test_fmt_fcfa_invalid_returns_zero():
    assert fmt_fcfa('not-a-number') == f"0{NBSP}FCFA"
