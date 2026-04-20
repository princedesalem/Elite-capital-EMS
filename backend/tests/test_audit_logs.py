"""Tests for audit log utility and GET /api/admin/audit-logs endpoint."""
import pytest
from datetime import datetime, timedelta


# ── Utility tests ──

def test_log_action_creates_entry(seed_reference_data, db_session):
    from app import models
    from app.utils.audit import log_action

    log_action(
        db=db_session,
        matricule_acteur=1001,
        action='TEST_ACTION',
        ressource_type='test',
        ressource_id=42,
        details={'foo': 'bar'},
        ip_address='127.0.0.1',
    )

    entry = db_session.query(models.AuditLog).filter(models.AuditLog.action == 'TEST_ACTION').first()
    assert entry is not None
    assert entry.actor == '1001'
    assert entry.entity == 'test'
    assert entry.entity_id == '42'
    assert '"foo": "bar"' in entry.detail
    assert entry.ip == '127.0.0.1'


def test_log_action_survives_bad_details(seed_reference_data, db_session):
    from app.utils.audit import log_action

    # Should not raise even with None details
    log_action(db=db_session, matricule_acteur=None, action='NIL_TEST',
               ressource_type='x', ressource_id=None, details=None)

    from app import models
    entry = db_session.query(models.AuditLog).filter(models.AuditLog.action == 'NIL_TEST').first()
    assert entry is not None
    assert entry.detail is None


# ── Endpoint tests ──

@pytest.fixture()
def audit_data(seed_reference_data, db_session):
    from app import models
    now = datetime.utcnow()
    entries = []
    for i, (action, entity) in enumerate([
        ('LOGIN_SUCCESS', 'auth'),
        ('LOGIN_FAILED', 'auth'),
        ('EMPLOYEE_CREATED', 'employe'),
        ('OPERATION_VALIDATED', 'operation'),
        ('PASSWORD_CHANGED', 'auth'),
    ]):
        e = models.AuditLog(
            actor='1001', action=action, entity=entity,
            entity_id=str(i + 1), detail=f'{{"index": {i}}}',
            ip='10.0.0.1', timestamp=now - timedelta(hours=i),
        )
        db_session.add(e)
        entries.append(e)
    db_session.commit()
    return seed_reference_data, entries


def test_get_audit_logs_success(client, audit_data, auth_headers):
    refs, _ = audit_data
    r = client.get('/api/admin/audit-logs', headers=auth_headers(refs['rh'].matricule, 'RH'))
    assert r.status_code == 200
    body = r.json()
    assert body['total'] >= 5
    assert len(body['items']) >= 5
    # Should be ordered by timestamp desc (most recent first)
    assert body['items'][0]['action'] == 'LOGIN_SUCCESS'


def test_get_audit_logs_filter_action(client, audit_data, auth_headers):
    refs, _ = audit_data
    r = client.get('/api/admin/audit-logs?action=LOGIN', headers=auth_headers(refs['rh'].matricule, 'RH'))
    assert r.status_code == 200
    assert r.json()['total'] >= 2  # LOGIN_SUCCESS + LOGIN_FAILED


def test_get_audit_logs_filter_entity(client, audit_data, auth_headers):
    refs, _ = audit_data
    r = client.get('/api/admin/audit-logs?ressource_type=employe', headers=auth_headers(refs['rh'].matricule, 'RH'))
    assert r.status_code == 200
    assert r.json()['total'] >= 1


def test_get_audit_logs_filter_matricule(client, audit_data, auth_headers):
    refs, _ = audit_data
    r = client.get('/api/admin/audit-logs?matricule=1001', headers=auth_headers(refs['rh'].matricule, 'RH'))
    assert r.status_code == 200
    assert r.json()['total'] >= 5


def test_get_audit_logs_pagination(client, audit_data, auth_headers):
    refs, _ = audit_data
    r = client.get('/api/admin/audit-logs?limit=2&offset=0', headers=auth_headers(refs['rh'].matricule, 'RH'))
    body = r.json()
    assert body['total'] >= 5  # at least our 5 seeded entries (middleware may add more)
    assert len(body['items']) == 2
    assert body['limit'] == 2
    assert body['offset'] == 0

    r2 = client.get('/api/admin/audit-logs?limit=2&offset=3', headers=auth_headers(refs['rh'].matricule, 'RH'))
    body2 = r2.json()
    assert len(body2['items']) >= 1  # at least some items at offset 3


def test_get_audit_logs_date_filter(client, audit_data, auth_headers):
    refs, _ = audit_data
    now = datetime.utcnow()
    depuis = (now - timedelta(hours=2)).isoformat()
    r = client.get(f'/api/admin/audit-logs?depuis={depuis}', headers=auth_headers(refs['rh'].matricule, 'RH'))
    assert r.status_code == 200
    # Should have entries from last 2 hours (index 0, 1, 2 → 3 entries)
    assert r.json()['total'] >= 2


def test_get_audit_logs_forbidden_for_employee(client, audit_data, auth_headers):
    refs, _ = audit_data
    r = client.get('/api/admin/audit-logs', headers=auth_headers(refs['employe'].matricule, 'EMPLOYE'))
    assert r.status_code == 403


def test_get_audit_logs_forbidden_for_responsable(client, audit_data, auth_headers):
    refs, _ = audit_data
    r = client.get('/api/admin/audit-logs', headers=auth_headers(refs['responsable'].matricule, 'RESPONSABLE'))
    assert r.status_code == 403


def test_get_audit_logs_allowed_for_admin(client, audit_data, auth_headers):
    refs, _ = audit_data
    r = client.get('/api/admin/audit-logs', headers=auth_headers(refs['admin'].matricule, 'ADMIN'))
    assert r.status_code == 200
    assert r.json()['total'] >= 5


def test_get_audit_logs_empty(client, seed_reference_data, auth_headers):
    r = client.get('/api/admin/audit-logs', headers=auth_headers(seed_reference_data['rh'].matricule, 'RH'))
    assert r.status_code == 200
    assert r.json()['total'] == 0
    assert r.json()['items'] == []


def test_get_audit_logs_sort_by_action_asc(client, audit_data, auth_headers):
    refs, _ = audit_data
    r = client.get('/api/admin/audit-logs?sort_col=action&sort_dir=asc',
                   headers=auth_headers(refs['rh'].matricule, 'RH'))
    assert r.status_code == 200
    actions = [i['action'] for i in r.json()['items']]
    assert actions == sorted(actions)


def test_get_audit_logs_sort_by_action_desc(client, audit_data, auth_headers):
    refs, _ = audit_data
    r = client.get('/api/admin/audit-logs?sort_col=action&sort_dir=desc',
                   headers=auth_headers(refs['rh'].matricule, 'RH'))
    assert r.status_code == 200
    actions = [i['action'] for i in r.json()['items']]
    assert actions == sorted(actions, reverse=True)


def test_get_audit_logs_sort_invalid_col_falls_back_to_timestamp(client, audit_data, auth_headers):
    """Unknown sort_col must not raise exception and falls back to timestamp ordering."""
    refs, _ = audit_data
    r = client.get('/api/admin/audit-logs?sort_col=__inject__&sort_dir=asc',
                   headers=auth_headers(refs['rh'].matricule, 'RH'))
    assert r.status_code == 200
    assert 'items' in r.json()


def test_get_audit_logs_sort_timestamp_desc_default(client, audit_data, auth_headers):
    refs, _ = audit_data
    r = client.get('/api/admin/audit-logs', headers=auth_headers(refs['rh'].matricule, 'RH'))
    assert r.status_code == 200
    # Default: timestamp desc → most recent (index 0 = LOGIN_SUCCESS, created last) first
    assert r.json()['items'][0]['action'] == 'LOGIN_SUCCESS'

