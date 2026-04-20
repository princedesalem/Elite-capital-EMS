"""Tests for coherence between Employe and Utilisateur records."""
import pytest
from app import models


@pytest.fixture()
def data(seed_reference_data, db_session):
    return seed_reference_data


def test_employee_has_matching_user(data, db_session):
    emp = data['employe']
    user = db_session.query(models.Utilisateur).filter_by(matricule=emp.matricule).first()
    assert user is not None
    assert user.email == emp.email


def test_soft_delete_deactivates_user(client, auth_headers, data, db_session):
    mat = data['employe'].matricule
    client.delete(f'/employees/{mat}', headers=auth_headers(data['admin'].matricule, 'ADMIN'))

    db_session.expire_all()
    user = db_session.query(models.Utilisateur).filter_by(matricule=mat).first()
    if user is not None:
        assert user.bloque_jusqua is not None


def test_employee_role_matches_user_role(data, db_session):
    emp = data['employe']
    user = db_session.query(models.Utilisateur).filter_by(matricule=emp.matricule).first()
    assert user is not None
    # Both should reference same role
    assert user.role_id == emp.id_role
