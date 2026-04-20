"""
Tests for department city-scoping via DEPARTEMENT_IMPLANTATION table.

Departments are visible in a city only if there is an explicit row in
DEPARTEMENT_IMPLANTATION for (dept_id, id_localisation).
Enity implantation alone is NOT sufficient — the liaison must be created
explicitly (via Organisation UI or POST /departements with id_localisation).
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
    - Dept "Ventes" (ELCAM) → explicitly linked to Douala ONLY
    - Dept "Compta" (ECG)   → explicitly linked to Yaoundé ONLY

    Even though ELCAM is implanted in Yaoundé, "Ventes" has NO
    DEPARTEMENT_IMPLANTATION row for Yaoundé, so it must NOT appear there.
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

    # Explicit city liaisons — Ventes → Douala only, Compta → Yaoundé only
    db_session.add(models.DepartementImplantation(
        dept_id=dept_ventes.dept_id, id_localisation=douala.id_localisation
    ))
    db_session.add(models.DepartementImplantation(
        dept_id=dept_compta.dept_id, id_localisation=yaounde.id_localisation
    ))
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


class TestDepartementImplantationFiltering:
    """Departments appear only in cities to which they are explicitly linked."""

    def test_douala_shows_elcam_dept_only(self, client, db_session, org_two_cities):
        """Douala: Ventes linked → visible. Compta not linked → absent."""
        douala_id = org_two_cities['douala'].id_localisation
        resp = client.get(f'/employees/departements?id_localisation={douala_id}', headers=_headers())
        assert resp.status_code == 200
        noms = [d['nom'] for d in resp.json()]
        assert 'Ventes' in noms
        assert 'Compta' not in noms

    def test_yaounde_shows_compta_only(self, client, db_session, org_two_cities):
        """Yaoundé: Compta linked → visible. Ventes NOT linked (even though ELCAM implanted there) → absent."""
        yaounde_id = org_two_cities['yaounde'].id_localisation
        resp = client.get(f'/employees/departements?id_localisation={yaounde_id}', headers=_headers())
        assert resp.status_code == 200
        noms = [d['nom'] for d in resp.json()]
        assert 'Compta' in noms
        assert 'Ventes' not in noms

    def test_dept_invisible_even_if_entity_implanted(self, client, db_session, org_two_cities):
        """ELCAM is implanted in Yaoundé but Ventes has no DI row for Yaoundé → absent."""
        yaounde_id = org_two_cities['yaounde'].id_localisation
        resp = client.get(f'/employees/departements?id_localisation={yaounde_id}', headers=_headers())
        assert resp.status_code == 200
        entites = [d['entite_nom'] for d in resp.json()]
        # ELCAM is implanted, but its department 'Ventes' has no explicit liaison
        assert 'Ventes' not in [d['nom'] for d in resp.json()]

    def test_no_filter_returns_all(self, client, db_session, org_two_cities):
        """No filter (Administration view) returns all departments regardless of liaisons."""
        resp = client.get('/employees/departements', headers=_headers())
        assert resp.status_code == 200
        noms = [d['nom'] for d in resp.json()]
        assert 'Ventes' in noms
        assert 'Compta' in noms

    def test_filter_by_pays(self, client, db_session, org_two_cities):
        """Filter by pays returns all departments linked to any city in that country."""
        pays_id = org_two_cities['pays'].id_pays
        resp = client.get(f'/employees/departements?id_pays={pays_id}', headers=_headers())
        assert resp.status_code == 200
        noms = [d['nom'] for d in resp.json()]
        assert 'Ventes' in noms
        assert 'Compta' in noms

    def test_villes_endpoint_douala(self, client, db_session, org_two_cities):
        """GET /villes/<douala>/departements returns only explicitly linked departments."""
        douala_id = org_two_cities['douala'].id_localisation
        resp = client.get(f'/employees/villes/{douala_id}/departements', headers=_headers())
        assert resp.status_code == 200
        noms = [d['nom'] for d in resp.json()]
        assert 'Ventes' in noms
        assert 'Compta' not in noms

    def test_villes_endpoint_yaounde(self, client, db_session, org_two_cities):
        """GET /villes/<yaoundé>/departements returns only Compta (not Ventes)."""
        yaounde_id = org_two_cities['yaounde'].id_localisation
        resp = client.get(f'/employees/villes/{yaounde_id}/departements', headers=_headers())
        assert resp.status_code == 200
        noms = [d['nom'] for d in resp.json()]
        assert 'Compta' in noms
        assert 'Ventes' not in noms

    def test_nonexistent_city_returns_empty(self, client, db_session, org_two_cities):
        """Filter by a city with no liaisons returns empty list."""
        resp = client.get('/employees/departements?id_localisation=99999', headers=_headers())
        assert resp.status_code == 200
        assert resp.json() == []

    def test_entity_not_implanted_in_city_hidden(self, client, db_session, org_two_cities):
        """A department whose entity is NOT implanted in a city must NOT appear there."""
        douala_id = org_two_cities['douala'].id_localisation
        resp = client.get(f'/employees/departements?id_localisation={douala_id}', headers=_headers())
        dept_entites = [d['entite_nom'] for d in resp.json()]
        assert 'ECG' not in dept_entites


class TestDepartementLinkUnlink:
    """POST/DELETE /departements/{id}/villes/{id_loc} — link and unlink endpoints."""

    def test_link_dept_to_city(self, client, db_session, org_two_cities):
        """POST /departements/{id}/villes/{id_loc} creates a liaison."""
        # Link Ventes to Yaoundé (ELCAM is implanted there)
        dept_id = org_two_cities['dept_ventes'].dept_id
        yaounde_id = org_two_cities['yaounde'].id_localisation

        resp = client.post(
            f'/employees/departements/{dept_id}/villes/{yaounde_id}',
            headers=_headers()
        )
        assert resp.status_code == 200

        # Now Ventes should appear in Yaoundé
        resp2 = client.get(f'/employees/departements?id_localisation={yaounde_id}', headers=_headers())
        noms = [d['nom'] for d in resp2.json()]
        assert 'Ventes' in noms

    def test_unlink_dept_from_city(self, client, db_session, org_two_cities):
        """DELETE /departements/{id}/villes/{id_loc} removes liaison; dept remains in DB."""
        dept_id = org_two_cities['dept_ventes'].dept_id
        douala_id = org_two_cities['douala'].id_localisation

        resp = client.delete(
            f'/employees/departements/{dept_id}/villes/{douala_id}',
            headers=_headers()
        )
        assert resp.status_code == 200

        # Ventes must no longer appear in Douala
        resp2 = client.get(f'/employees/departements?id_localisation={douala_id}', headers=_headers())
        noms = [d['nom'] for d in resp2.json()]
        assert 'Ventes' not in noms

        # But Ventes still exists globally
        resp3 = client.get('/employees/departements', headers=_headers())
        noms_all = [d['nom'] for d in resp3.json()]
        assert 'Ventes' in noms_all

    def test_link_requires_entity_implanted(self, client, db_session, org_two_cities):
        """Cannot link a dept to a city where its entity is not implanted (400)."""
        # ECG is NOT implanted in Douala
        dept_id = org_two_cities['dept_compta'].dept_id
        douala_id = org_two_cities['douala'].id_localisation

        resp = client.post(
            f'/employees/departements/{dept_id}/villes/{douala_id}',
            headers=_headers()
        )
        assert resp.status_code == 400

    def test_link_already_linked_returns_400(self, client, db_session, org_two_cities):
        """Linking an already-linked dept/city pair returns 400."""
        dept_id = org_two_cities['dept_ventes'].dept_id
        douala_id = org_two_cities['douala'].id_localisation

        # Already linked in fixture
        resp = client.post(
            f'/employees/departements/{dept_id}/villes/{douala_id}',
            headers=_headers()
        )
        assert resp.status_code == 400

    def test_unlink_nonexistent_returns_404(self, client, db_session, org_two_cities):
        """Unlinking a non-existent liaison returns 404."""
        dept_id = org_two_cities['dept_ventes'].dept_id
        yaounde_id = org_two_cities['yaounde'].id_localisation  # not linked

        resp = client.delete(
            f'/employees/departements/{dept_id}/villes/{yaounde_id}',
            headers=_headers()
        )
        assert resp.status_code == 404


class TestCreateDepartementWithCity:
    """POST /departements with id_localisation or villes_ids creates the liaisons."""

    def test_create_with_id_localisation(self, client, db_session, org_two_cities):
        """POST /departements with id_localisation → dept created and linked to that city."""
        elcam = org_two_cities['elcam']
        douala_id = org_two_cities['douala'].id_localisation

        resp = client.post('/employees/departements', json={
            'nom': 'Marketing',
            'id_entite': elcam.id_entite,
            'id_localisation': douala_id,
        }, headers=_headers())
        assert resp.status_code == 200
        dept_id = resp.json()['dept_id']

        resp2 = client.get(f'/employees/departements?id_localisation={douala_id}', headers=_headers())
        noms = [d['nom'] for d in resp2.json()]
        assert 'Marketing' in noms

    def test_create_with_villes_ids(self, client, db_session, org_two_cities):
        """POST /departements with villes_ids → dept linked to multiple cities."""
        elcam = org_two_cities['elcam']
        douala_id = org_two_cities['douala'].id_localisation
        yaounde_id = org_two_cities['yaounde'].id_localisation

        resp = client.post('/employees/departements', json={
            'nom': 'Logistique',
            'id_entite': elcam.id_entite,
            'villes_ids': [douala_id, yaounde_id],
        }, headers=_headers())
        assert resp.status_code == 200

        for loc_id in [douala_id, yaounde_id]:
            resp2 = client.get(f'/employees/departements?id_localisation={loc_id}', headers=_headers())
            noms = [d['nom'] for d in resp2.json()]
            assert 'Logistique' in noms, f'Logistique should appear in loc={loc_id}'

    def test_create_without_city_not_visible_by_filter(self, client, db_session, org_two_cities):
        """POST without id_localisation or villes_ids → dept exists but not visible per city."""
        elcam = org_two_cities['elcam']
        douala_id = org_two_cities['douala'].id_localisation

        resp = client.post('/employees/departements', json={
            'nom': 'Sans Ville',
            'id_entite': elcam.id_entite,
        }, headers=_headers())
        assert resp.status_code == 200

        resp2 = client.get(f'/employees/departements?id_localisation={douala_id}', headers=_headers())
        noms = [d['nom'] for d in resp2.json()]
        assert 'Sans Ville' not in noms

        # But visible globally (no filter)
        resp3 = client.get('/employees/departements', headers=_headers())
        noms_all = [d['nom'] for d in resp3.json()]
        assert 'Sans Ville' in noms_all

    def test_create_with_invalid_city_returns_400(self, client, db_session, org_two_cities):
        """POST with id_localisation where entity is NOT implanted → 400."""
        # ECG is only in Yaoundé
        ecg = org_two_cities['ecg']
        douala_id = org_two_cities['douala'].id_localisation

        resp = client.post('/employees/departements', json={
            'nom': 'Dep Invalide',
            'id_entite': ecg.id_entite,
            'id_localisation': douala_id,
        }, headers=_headers())
        assert resp.status_code == 400


class TestGetVillesParEntite:
    """GET /employees/villes?id_entite=X returns cities where the entity is implanted."""

    def test_returns_correct_cities(self, client, db_session, org_two_cities):
        elcam = org_two_cities['elcam']
        resp = client.get(f'/employees/villes?id_entite={elcam.id_entite}', headers=_headers())
        assert resp.status_code == 200
        villes = resp.json()
        noms = [v['ville'] for v in villes]
        assert 'Douala' in noms
        assert 'Yaoundé' in noms

    def test_entity_single_city(self, client, db_session, org_two_cities):
        ecg = org_two_cities['ecg']
        resp = client.get(f'/employees/villes?id_entite={ecg.id_entite}', headers=_headers())
        assert resp.status_code == 200
        villes = resp.json()
        noms = [v['ville'] for v in villes]
        assert 'Yaoundé' in noms
        assert 'Douala' not in noms

    def test_missing_id_entite_returns_400(self, client, db_session, org_two_cities):
        resp = client.get('/employees/villes', headers=_headers())
        assert resp.status_code == 400
