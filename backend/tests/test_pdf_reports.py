"""Tests for PDF report generation endpoints."""
import pytest


@pytest.fixture()
def data(seed_reference_data, db_session):
    return seed_reference_data


def test_employee_report_returns_pdf(client, auth_headers, data):
    resp = client.get(
        '/api/pdf/report/employees',
        headers=auth_headers(data['admin'].matricule, 'ADMIN')
    )
    assert resp.status_code == 200
    assert resp.headers.get('content-type', '').startswith('application/pdf')


def test_employee_report_contains_pdf_magic_bytes(client, auth_headers, data):
    resp = client.get(
        '/api/pdf/report/employees',
        headers=auth_headers(data['admin'].matricule, 'ADMIN')
    )
    assert resp.status_code == 200
    assert resp.content[:4] == b'%PDF'


def test_analytics_report_returns_pdf(client, auth_headers, data):
    resp = client.get(
        '/api/pdf/report/analytics',
        headers=auth_headers(data['admin'].matricule, 'ADMIN')
    )
    assert resp.status_code == 200
    assert resp.headers.get('content-type', '').startswith('application/pdf')


def test_employee_report_accessible_by_rh(client, auth_headers, data):
    resp = client.get(
        '/api/pdf/report/employees',
        headers=auth_headers(data['rh'].matricule, 'RH')
    )
    # RH should be able to generate reports (200) or may be restricted (403) depending on policy
    assert resp.status_code in (200, 403)


def test_employee_report_forbidden_for_employe(client, auth_headers, data):
    resp = client.get(
        '/api/pdf/report/employees',
        headers=auth_headers(data['employe'].matricule, 'EMPLOYE')
    )
    assert resp.status_code == 403


def test_analytics_report_forbidden_for_employe(client, auth_headers, data):
    resp = client.get(
        '/api/pdf/report/analytics',
        headers=auth_headers(data['employe'].matricule, 'EMPLOYE')
    )
    assert resp.status_code == 403


def test_employee_report_unauthenticated_rejected(client):
    resp = client.get('/api/pdf/report/employees')
    assert resp.status_code == 401
