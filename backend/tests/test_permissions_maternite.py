"""Phase F — B4 : durées maternité (98j simple, 140j pathologique)."""
from app.utils.permissions import DUREES_PERMISSIONS_CONVENTIONNELLES


def test_duree_maternite_simple_14_semaines():
    assert DUREES_PERMISSIONS_CONVENTIONNELLES['maternelle']['simple'] == 98


def test_duree_maternite_pathologique_20_semaines():
    assert DUREES_PERMISSIONS_CONVENTIONNELLES['maternelle']['pathologique'] == 140
