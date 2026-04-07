"""
Tests for departements filtering by id_localisation.

Root cause tested: GET /employees/departements?id_localisation=X used to
accept but IGNORE the parameter — always returning all departments.
"""
import pytest
from app import models
from app.utils.security import create_access_token


def _auth_headers():
    token = create_access_token({'sub': '9001', 'matricule': '9001', 'role': 'ADMIN'})
    return {'Authorization': f'Bearer {token}'}


@pytest.fixture()
def seed_multi_city(db_session, seed_reference_data):
    """Seed two cities with different entities and departments."""
    refs = seed_reference_data

    # City 1 already exists (Douala) with ELCAM entity and Operations dept
    loc_douala = refs['localisation']
    entite_elcam = refs['entite']

    # Create implantation for Douala ↔ ELCAM
    impl1 = models.Implantation(
        id_localisation=loc_douala.id_localisation,
        id_entite=entite_elcam.id_entite,
    )
    db_session.add(impl1)
    db_session.flush()

    # City 2: Yaoundé
    loc_yaounde = models.Localisation(ville='Yaoundé', id_pays=refs['pays'].id_pays)
    db_session.add(loc_yaounde)
    db_session.flush()

    # Another entity in Yaoundé
    entite_ecg = models.Entite(nom='ECG')
    db_session.add(entite_ecg)
    db_session.flush()

    impl2 = models.Implantation(
        id_localisation=loc_yaounde.id_localisation,
        id_entite=entite_ecg.id_entite,
    )
    db_session.add(impl2)
    db_session.flush()

    # Department in Yaoundé/ECG
    dept_yaounde = models.Departement(
        nom='Finance', id_entite=entite_ecg.id_entite,
    )
    db_session.add(dept_yaounde)
    db_session.flush()

    db_session.commit()
    return {
        **refs,
        'loc_douala': loc_douala,
        'loc_yaounde': loc_yaounde,
        'entite_ecg': entite_ecg,
        'dept_yaounde': dept_yaounde,
    }


class TestDepartementsFilterByLocalisation:
    def test_no_filter_returns_all(self, client, db_session, seed_multi_city):
        """GET /employees/departements without filter returns all departments."""
        headers = _auth_headers()
        resp = client.get('/employees/departements', headers=headers)
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) >= 2, f"Expected at least 2 departments, got {len(data)}"

    def test_filter_douala_returns_only_douala_depts(self, client, db_session, seed_multi_city):
        """GET /employees/departements?id_localisation=<douala> returns only Douala's depts."""
        refs = seed_multi_city
        headers = _auth_headers()
        resp = client.get(
            f'/employees/departements?id_localisation={refs["loc_douala"].id_localisation}',
            headers=headers,
        )
        assert resp.status_code == 200
        data = resp.json()
        dept_names = [d['nom'] for d in data]
        assert 'Operations' in dept_names, f"Douala should have Operations dept: {dept_names}"
        assert 'Finance' not in dept_names, f"Douala should NOT have Finance: {dept_names}"

    def test_filter_yaounde_returns_only_yaounde_depts(self, client, db_session, seed_multi_city):
        """GET /employees/departements?id_localisation=<yaounde> returns only Yaoundé's depts."""
        refs = seed_multi_city
        headers = _auth_headers()
        resp = client.get(
            f'/employees/departements?id_localisation={refs["loc_yaounde"].id_localisation}',
            headers=headers,
        )
        assert resp.status_code == 200
        data = resp.json()
        dept_names = [d['nom'] for d in data]
        assert 'Finance' in dept_names, f"Yaoundé should have Finance dept: {dept_names}"
        assert 'Operations' not in dept_names, f"Yaoundé should NOT have Operations: {dept_names}"

    def test_filter_unknown_city_returns_empty(self, client, db_session, seed_multi_city):
        """GET /employees/departements?id_localisation=99999 returns empty list."""
        headers = _auth_headers()
        resp = client.get('/employees/departements?id_localisation=99999', headers=headers)
        assert resp.status_code == 200
        assert resp.json() == []
