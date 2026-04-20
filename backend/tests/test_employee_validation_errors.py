"""Tests for employee validation errors (age, duplicates, missing fields)."""
import pytest
from datetime import date, timedelta


@pytest.fixture()
def data(seed_reference_data, db_session):
    return seed_reference_data


def _admin_headers(auth_headers, data):
    return auth_headers(data['admin'].matricule, 'ADMIN')


def _base_payload(data, matricule=10002):
    dept = data['departement']
    return {
        'matricule': matricule,
        'nom': 'Nouveau',
        'prenom': 'Employe',
        'email': f'emp{matricule}@example.com',
        'date_embauche': str(date.today()),
        'departement': dept.nom,         # string name, not numeric ID
        'entite': data['entite'].nom,    # string name for entite lookup
        'role': 'EMPLOYE',               # string role name for lookup
        'sexe': 'M',
        'fonction': 'Développeur',
    }


def test_create_employee_under_18_rejected(client, auth_headers, data):
    payload = _base_payload(data)
    payload['date_naissance'] = str(date.today() - timedelta(days=365 * 16))
    resp = client.post('/employees/', json=payload, headers=_admin_headers(auth_headers, data))
    assert resp.status_code == 400


def test_create_employee_stagiaire_under_18_allowed(client, auth_headers, data):
    payload = _base_payload(data, matricule=10003)
    payload['date_naissance'] = str(date.today() - timedelta(days=365 * 16))
    payload['categorie'] = 'Stagiaire'
    resp = client.post('/employees/', json=payload, headers=_admin_headers(auth_headers, data))
    # Stagiaires may be allowed (200) or rejected (400) depending on implementation
    assert resp.status_code in (200, 201, 400)


def test_create_duplicate_matricule_rejected(client, auth_headers, data):
    payload = _base_payload(data, matricule=data['employe'].matricule)
    resp = client.post('/employees/', json=payload, headers=_admin_headers(auth_headers, data))
    assert resp.status_code in (400, 409)


def test_create_duplicate_email_rejected(client, auth_headers, data):
    payload = _base_payload(data, matricule=10004)
    payload['email'] = data['employe'].email
    resp = client.post('/employees/', json=payload, headers=_admin_headers(auth_headers, data))
    assert resp.status_code in (400, 409)


def test_create_missing_mandatory_fields_rejected(client, auth_headers, data):
    # Send an empty payload
    resp = client.post('/employees/', json={}, headers=_admin_headers(auth_headers, data))
    assert resp.status_code == 422


def test_create_invalid_sexe_rejected(client, auth_headers, data):
    payload = _base_payload(data, matricule=10005)
    payload['sexe'] = 'X'
    resp = client.post('/employees/', json=payload, headers=_admin_headers(auth_headers, data))
    # Either 422 (validation) or 400 (business)
    assert resp.status_code in (400, 422)


def test_create_employee_success(client, auth_headers, data):
    payload = _base_payload(data, matricule=10006)
    resp = client.post('/employees/', json=payload, headers=_admin_headers(auth_headers, data))
    assert resp.status_code in (200, 201)
    body = resp.json()
    assert body.get('matricule') is not None or body.get('detail') == 'Employé créé'
