"""Phase F — B1 : matricule alphanumérique validé via regex."""
import pytest
from app.schemas import EmployeBase, _validate_matricule_value


def test_matricule_alphanum_accept_letters_digits_dash():
    out = _validate_matricule_value('emp-001a')
    assert out == 'EMP-001A'


def test_matricule_uppercase_normalisation():
    out = _validate_matricule_value('  abc123  ')
    assert out == 'ABC123'


def test_matricule_reject_traversal():
    with pytest.raises(ValueError):
        _validate_matricule_value('../bad')


def test_matricule_reject_space_inside():
    with pytest.raises(ValueError):
        _validate_matricule_value('A B')


def test_matricule_reject_special_chars():
    with pytest.raises(ValueError):
        _validate_matricule_value('emp@001')


def test_matricule_reject_empty():
    with pytest.raises(ValueError):
        _validate_matricule_value('   ')


def test_employe_base_validator_runs():
    from datetime import date
    e = EmployeBase(
        matricule='emp-007',
        nom='Bond',
        prenom='James',
        email='bond@example.com',
        date_embauche=date(2024, 1, 1),
        sexe='M',
    )
    assert e.matricule == 'EMP-007'
