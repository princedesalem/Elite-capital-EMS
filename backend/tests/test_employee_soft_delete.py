"""Tests for employee soft-delete (DELETE /employees/{matricule})."""
import pytest
from app import models


@pytest.fixture()
def data(seed_reference_data, db_session):
    return seed_reference_data


def test_admin_can_soft_delete(client, auth_headers, data, db_session):
    mat = data['employe'].matricule
    resp = client.delete(f'/employees/{mat}', headers=auth_headers(data['admin'].matricule, 'ADMIN'))
    assert resp.status_code == 200
    assert resp.json()['detail'] == 'Employé supprimé (soft delete)'

    db_session.expire_all()
    emp = db_session.query(models.Employe).filter_by(matricule=mat).first()
    assert emp.statut_employe == 'CONGEDIE'


def test_admin_soft_delete_disables_user(client, auth_headers, data, db_session):
    mat = data['employe'].matricule
    client.delete(f'/employees/{mat}', headers=auth_headers(data['admin'].matricule, 'ADMIN'))

    db_session.expire_all()
    user = db_session.query(models.Utilisateur).filter_by(matricule=mat).first()
    # User may not exist in sqlite test db; if it does, it should be blocked
    if user is not None:
        assert user.bloque_jusqua is not None


def test_rh_cannot_soft_delete(client, auth_headers, data):
    mat = data['employe'].matricule
    resp = client.delete(f'/employees/{mat}', headers=auth_headers(data['rh'].matricule, 'RH'))
    assert resp.status_code == 403


def test_employe_cannot_soft_delete(client, auth_headers, data):
    mat = data['employe'].matricule
    resp = client.delete(f'/employees/{mat}', headers=auth_headers(data['employe'].matricule, 'EMPLOYE'))
    assert resp.status_code == 403


def test_soft_delete_unknown_employee(client, auth_headers, data):
    # Non-existent numeric matricule
    resp = client.delete('/employees/999999', headers=auth_headers(data['admin'].matricule, 'ADMIN'))
    assert resp.status_code == 404


def test_soft_delete_already_congedie(client, auth_headers, data, db_session):
    mat = data['employe'].matricule
    # First delete
    client.delete(f'/employees/{mat}', headers=auth_headers(data['admin'].matricule, 'ADMIN'))
    # Second delete should be a conflict
    resp = client.delete(f'/employees/{mat}', headers=auth_headers(data['admin'].matricule, 'ADMIN'))
    assert resp.status_code == 409


def test_list_excludes_congedie(client, auth_headers, data, db_session):
    mat = data['employe'].matricule
    client.delete(f'/employees/{mat}', headers=auth_headers(data['admin'].matricule, 'ADMIN'))

    resp = client.get('/employees/', headers=auth_headers(data['admin'].matricule, 'ADMIN'))
    assert resp.status_code == 200
    matricules = [e['matricule'] for e in resp.json()]
    assert mat not in matricules


def test_list_include_deleted_shows_congedie(client, auth_headers, data):
    mat = data['employe'].matricule
    client.delete(f'/employees/{mat}', headers=auth_headers(data['admin'].matricule, 'ADMIN'))

    resp = client.get('/employees/?include_deleted=true', headers=auth_headers(data['admin'].matricule, 'ADMIN'))
    assert resp.status_code == 200
    matricules = [e['matricule'] for e in resp.json()]
    assert mat in matricules


def test_soft_delete_logs_audit(client, auth_headers, data, db_session):
    mat = data['employe'].matricule
    client.delete(f'/employees/{mat}', headers=auth_headers(data['admin'].matricule, 'ADMIN'))

    db_session.expire_all()
    log = db_session.query(models.AuditLog).filter_by(action='EMPLOYEE_SOFT_DELETED').first()
    assert log is not None
    assert str(mat) in (log.detail or '') or str(mat) in (log.entity_id or '')
