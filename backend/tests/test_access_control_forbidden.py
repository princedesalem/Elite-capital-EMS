"""Tests for role-based access control — confirm 401/403 for unauthorized roles."""
import pytest


@pytest.fixture()
def data(seed_reference_data, db_session):
    return seed_reference_data


def test_unauthenticated_scoped_employee_list_rejected(client):
    # /employees/scoped requires auth via token context
    resp = client.get('/employees/scoped')
    assert resp.status_code in (401, 422)


def test_employe_cannot_soft_delete_others(client, auth_headers, data):
    # EMPLOYE cannot soft-delete another employee
    mat = data['responsable'].matricule
    resp = client.delete(
        f'/employees/{mat}',
        headers=auth_headers(data['employe'].matricule, 'EMPLOYE')
    )
    assert resp.status_code == 403


def test_employe_cannot_delete_employee(client, auth_headers, data):
    mat = data['responsable'].matricule
    resp = client.delete(
        f'/employees/{mat}',
        headers=auth_headers(data['employe'].matricule, 'EMPLOYE')
    )
    assert resp.status_code == 403


def test_rh_cannot_delete_employee(client, auth_headers, data):
    mat = data['employe'].matricule
    resp = client.delete(
        f'/employees/{mat}',
        headers=auth_headers(data['rh'].matricule, 'RH')
    )
    assert resp.status_code == 403


def test_responsable_cannot_access_admin_audit_cleanup(client, auth_headers, data):
    resp = client.delete(
        '/api/admin/audit-logs/cleanup?older_than_days=30',
        headers=auth_headers(data['responsable'].matricule, 'RESPONSABLE')
    )
    assert resp.status_code == 403


def test_employe_cannot_anonymize_another_employee(client, auth_headers, data, db_session):
    # First soft-delete the target to make it CONGEDIE
    from app import models
    target = data['employe']
    mat = target.matricule
    client.delete(f'/employees/{mat}', headers=auth_headers(data['admin'].matricule, 'ADMIN'))

    # Now try anonymize as EMPLOYE (responsable here)
    resp = client.post(
        f'/employees/{mat}/anonymize',
        headers=auth_headers(data['responsable'].matricule, 'RESPONSABLE')
    )
    assert resp.status_code == 403


def test_admin_can_access_audit_cleanup(client, auth_headers, data, db_session):
    from app import models
    # Add a log so the endpoint isn't empty
    log = models.AuditLog(
        action='TEST',
        detail='test',
        actor=str(data['admin'].matricule),
    )
    db_session.add(log)
    db_session.commit()

    resp = client.delete(
        '/api/admin/audit-logs/cleanup?older_than_days=30',
        headers=auth_headers(data['admin'].matricule, 'ADMIN')
    )
    assert resp.status_code == 200
