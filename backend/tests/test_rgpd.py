"""Tests for RGPD endpoints: export personal data, anonymize, audit log cleanup."""
import pytest
from app import models


@pytest.fixture()
def data(seed_reference_data, db_session):
    return seed_reference_data


def _make_congedie(client, auth_headers, data):
    mat = data['employe'].matricule
    client.delete(f'/employees/{mat}', headers=auth_headers(data['admin'].matricule, 'ADMIN'))
    return mat


# ---- Export personal data -----------------------------------------------

def test_employee_can_export_own_data(client, auth_headers, data):
    mat = data['employe'].matricule
    resp = client.get(
        f'/employees/{mat}/export-personal-data',
        headers=auth_headers(mat, 'EMPLOYE')
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body['employe']['matricule'] == mat


def test_admin_can_export_any_employee_data(client, auth_headers, data):
    mat = data['employe'].matricule
    resp = client.get(
        f'/employees/{mat}/export-personal-data',
        headers=auth_headers(data['admin'].matricule, 'ADMIN')
    )
    assert resp.status_code == 200
    assert resp.json()['employe']['matricule'] == mat


def test_other_employe_cannot_export_peers_data(client, auth_headers, data):
    mat = data['employe'].matricule
    resp = client.get(
        f'/employees/{mat}/export-personal-data',
        headers=auth_headers(data['responsable'].matricule, 'RESPONSABLE')
    )
    # Only self or privileged roles — should be 403 for peer
    assert resp.status_code == 403


def test_export_logs_rgpd_action(client, auth_headers, data, db_session):
    mat = data['employe'].matricule
    client.get(
        f'/employees/{mat}/export-personal-data',
        headers=auth_headers(mat, 'EMPLOYE')
    )
    db_session.expire_all()
    log = db_session.query(models.AuditLog).filter_by(action='RGPD_EXPORT').first()
    assert log is not None


# ---- Anonymize -----------------------------------------------------------

def test_anonymize_requires_congedie_status(client, auth_headers, data):
    mat = data['employe'].matricule
    # Employee is ACTIF — should fail with 409
    resp = client.post(
        f'/employees/{mat}/anonymize',
        headers=auth_headers(data['admin'].matricule, 'ADMIN')
    )
    assert resp.status_code == 409


def test_admin_can_anonymize_congedie_employee(client, auth_headers, data, db_session):
    mat = _make_congedie(client, auth_headers, data)

    resp = client.post(
        f'/employees/{mat}/anonymize',
        headers=auth_headers(data['admin'].matricule, 'ADMIN')
    )
    assert resp.status_code == 200

    db_session.expire_all()
    emp = db_session.query(models.Employe).filter_by(matricule=mat).first()
    assert 'ANONYME' in (emp.nom or '')


def test_anonymize_non_admin_forbidden(client, auth_headers, data):
    mat = data['employe'].matricule
    resp = client.post(
        f'/employees/{mat}/anonymize',
        headers=auth_headers(data['rh'].matricule, 'RH')
    )
    assert resp.status_code == 403


def test_anonymize_logs_rgpd_action(client, auth_headers, data, db_session):
    mat = _make_congedie(client, auth_headers, data)
    client.post(
        f'/employees/{mat}/anonymize',
        headers=auth_headers(data['admin'].matricule, 'ADMIN')
    )
    db_session.expire_all()
    log = db_session.query(models.AuditLog).filter_by(action='RGPD_ANONYMIZE').first()
    assert log is not None


# ---- Audit log cleanup ---------------------------------------------------

def test_audit_cleanup_deletes_old_logs(client, auth_headers, data, db_session):
    from datetime import datetime, timedelta
    old_log = models.AuditLog(
        action='OLD_ACTION',
        detail='old',
        actor=str(data['admin'].matricule),
    )
    db_session.add(old_log)
    db_session.commit()

    # Manually set timestamp to old date
    from datetime import datetime, timedelta
    old_log.timestamp = datetime.utcnow() - timedelta(days=400)
    db_session.commit()

    resp = client.delete(
        '/api/admin/audit-logs/cleanup?older_than_days=365',
        headers=auth_headers(data['admin'].matricule, 'ADMIN')
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body['deleted_count'] >= 1


def test_audit_cleanup_preserves_recent_logs(client, auth_headers, data, db_session):
    from datetime import datetime, timedelta
    recent_log = models.AuditLog(
        action='RECENT_ACTION',
        detail='recent',
        actor=str(data['admin'].matricule),
    )
    db_session.add(recent_log)
    db_session.commit()

    client.delete(
        '/api/admin/audit-logs/cleanup?older_than_days=365',
        headers=auth_headers(data['admin'].matricule, 'ADMIN')
    )
    db_session.expire_all()
    log = db_session.query(models.AuditLog).filter_by(action='RECENT_ACTION').first()
    assert log is not None
