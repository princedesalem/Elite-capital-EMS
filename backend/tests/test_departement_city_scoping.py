"""
Tests for department city-scoping via Implantation chain.

Departments are visible in all cities where their entity is implanted.
Filtering uses: Ville → Implantation → Entité → Département.
"""
import pytest
from fastapi.testclient import TestClient

from app import models
from app.utils.security import create_access_token


def _headers():
    token = create_access_token({'sub': '9001', 'matricule': '9001', 'role': 'ADMIN'})
    return {'Authorization': f'Bearer {token}'}


@pytest.fixture()
def org_two_cities(db_session):
    """
    Seed:
    - Cameroun
      - Douala  (localisation 1)
      - Yaoundé (localisation 2)
    - ELCAM entity → implanted in BOTH cities
    - ECG entity → implanted in Yaoundé ONLY
    - Dept "Ventes" (ELCAM) → visible in Douala AND Yaoundé
    - Dept "Compta" (ECG)   → visible in Yaoundé ONLY
    """
    pays = models.Pays(nom_pays='Cameroun', code_pays='CM')
    db_session.add(pays)
    db_session.flush()

    douala = models.Localisation(ville='Douala', id_pays=pays.id_pays)
    yaounde = models.Localisation(ville='Yaoundé', id_pays=pays.id_pays)
    db_session.add_all([douala, yaounde])
    db_session.flush()

    elcam = models.Entite(nom='ELCAM')
    ecg = models.Entite(nom='ECG')
    db_session.add_all([elcam, ecg])
    db_session.flush()

    # ELCAM implanted in both cities
    db_session.add(models.Implantation(id_entite=elcam.id_entite, id_localisation=douala.id_localisation))
    db_session.add(models.Implantation(id_entite=elcam.id_entite, id_localisation=yaounde.id_localisation))
    # ECG implanted in Yaoundé only
    db_session.add(models.Implantation(id_entite=ecg.id_entite, id_localisation=yaounde.id_localisation))
    db_session.flush()

    dir_elcam = models.Direction(nom='Distribution', id_entite=elcam.id_entite, id_localisation=douala.id_localisation)
    dir_ecg = models.Direction(nom='Finance', id_entite=ecg.id_entite, id_localisation=yaounde.id_localisation)
    db_session.add_all([dir_elcam, dir_ecg])
    db_session.flush()

    dept_ventes = models.Departement(
        nom='Ventes', id_entite=elcam.id_entite,
        id_direction=dir_elcam.id_direction,
    )
    dept_compta = models.Departement(
        nom='Compta', id_entite=ecg.id_entite,
        id_direction=dir_ecg.id_direction,
    )
    db_session.add_all([dept_ventes, dept_compta])
    db_session.flush()

    role_admin = models.Role(name='ADMIN', description='Admin')
    db_session.add(role_admin)
    db_session.flush()

    db_session.commit()

    return {
        'pays': pays,
        'douala': douala,
        'yaounde': yaounde,
        'elcam': elcam,
        'ecg': ecg,
        'dept_ventes': dept_ventes,
        'dept_compta': dept_compta,
    }


class TestImplantationBasedFiltering:
    """Departments appear in all cities where their entity is implanted."""

    def test_douala_shows_elcam_dept_only(self, client, db_session, org_two_cities):
        """Douala: ELCAM implanted → Ventes visible. ECG not implanted → Compta not visible."""
        douala_id = org_two_cities['douala'].id_localisation
        resp = client.get(f'/employees/departements?id_localisation={douala_id}', headers=_headers())
        assert resp.status_code == 200
        noms = [d['nom'] for d in resp.json()]
        assert 'Ventes' in noms
        assert 'Compta' not in noms

    def test_yaounde_shows_both_entities_depts(self, client, db_session, org_two_cities):
        """Yaoundé: both ELCAM and ECG implanted → both departments visible."""
        yaounde_id = org_two_cities['yaounde'].id_localisation
        resp = client.get(f'/employees/departements?id_localisation={yaounde_id}', headers=_headers())
        assert resp.status_code == 200
        noms = [d['nom'] for d in resp.json()]
        assert 'Ventes' in noms
        assert 'Compta' in noms

    def test_no_filter_returns_all(self, client, db_session, org_two_cities):
        """No filter returns all departments."""
        resp = client.get('/employees/departements', headers=_headers())
        assert resp.status_code == 200
        noms = [d['nom'] for d in resp.json()]
        assert 'Ventes' in noms
        assert 'Compta' in noms

    def test_filter_by_pays(self, client, db_session, org_two_cities):
        """Filter by pays returns all departments of entities implanted in that country."""
        pays_id = org_two_cities['pays'].id_pays
        resp = client.get(f'/employees/departements?id_pays={pays_id}', headers=_headers())
        assert resp.status_code == 200
        noms = [d['nom'] for d in resp.json()]
        assert 'Ventes' in noms
        assert 'Compta' in noms

    def test_villes_endpoint_douala(self, client, db_session, org_two_cities):
        """GET /villes/<douala>/departements returns only ELCAM departments."""
        douala_id = org_two_cities['douala'].id_localisation
        resp = client.get(f'/employees/villes/{douala_id}/departements', headers=_headers())
        assert resp.status_code == 200
        noms = [d['nom'] for d in resp.json()]
        assert 'Ventes' in noms
        assert 'Compta' not in noms

    def test_villes_endpoint_yaounde(self, client, db_session, org_two_cities):
        """GET /villes/<yaoundé>/departements returns both entities' departments."""
        yaounde_id = org_two_cities['yaounde'].id_localisation
        resp = client.get(f'/employees/villes/{yaounde_id}/departements', headers=_headers())
        assert resp.status_code == 200
        noms = [d['nom'] for d in resp.json()]
        assert 'Ventes' in noms
        assert 'Compta' in noms

    def test_nonexistent_city_returns_empty(self, client, db_session, org_two_cities):
        """Filter by a city with no implantations returns empty list."""
        resp = client.get('/employees/departements?id_localisation=99999', headers=_headers())
        assert resp.status_code == 200
        assert resp.json() == []

    def test_entity_not_implanted_in_city_hidden(self, client, db_session, org_two_cities):
        """A department whose entity is NOT implanted in a city must NOT appear there."""
        douala_id = org_two_cities['douala'].id_localisation
        resp = client.get(f'/employees/departements?id_localisation={douala_id}', headers=_headers())
        dept_entites = [d['entite_nom'] for d in resp.json()]
        assert 'ECG' not in dept_entites

    def test_same_dept_appears_in_multiple_cities(self, client, db_session, org_two_cities):
        """ELCAM Ventes dept appears in both Douala and Yaoundé (entity implanted in both)."""
        douala_id = org_two_cities['douala'].id_localisation
        yaounde_id = org_two_cities['yaounde'].id_localisation

        resp_dla = client.get(f'/employees/departements?id_localisation={douala_id}', headers=_headers())
        resp_yde = client.get(f'/employees/departements?id_localisation={yaounde_id}', headers=_headers())

        noms_dla = [d['nom'] for d in resp_dla.json()]
        noms_yde = [d['nom'] for d in resp_yde.json()]

        assert 'Ventes' in noms_dla
        assert 'Ventes' in noms_yde


class TestDepartementCRUD:
    """CRUD operations on departments (no id_localisation storage)."""

    def test_create_departement(self, client, db_session, org_two_cities):
        """POST /employees/departements creates a dept linked to an entity."""
        elcam = org_two_cities['elcam']
        resp = client.post('/employees/departements', json={
            'nom': 'Nouveau Dept',
            'id_entite': elcam.id_entite,
        }, headers=_headers())
        assert resp.status_code == 200
        data = resp.json()
        assert data['nom'] == 'Nouveau Dept'
        assert data['id_entite'] == elcam.id_entite

    def test_update_departement(self, client, db_session, org_two_cities):
        """PUT /employees/departements/<id> updates dept name and entity."""
        dept = org_two_cities['dept_ventes']
        elcam = org_two_cities['elcam']
        resp = client.put(f'/employees/departements/{dept.dept_id}', json={
            'nom': 'Ventes Renamed',
            'id_entite': elcam.id_entite,
        }, headers=_headers())
        assert resp.status_code == 200
        assert resp.json()['nom'] == 'Ventes Renamed'
