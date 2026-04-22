"""
Tests for /dashboard/* endpoints.

Coverage:
- /dashboard/analytics/{matricule} for all role scopes (EMPLOYE, RESPONSABLE,
  DIRECTEUR, DG, RH, ADMIN) + temporal filter + 404
- /dashboard/absenteisme-par-dept, /solde-conges-par-tranche,
  /formation-rate, /employee-distribution, /trends/{matricule}

Uses the shared `seed_reference_data` fixture from conftest.py which already
provides: entite ELCAM, direction, departement, 6 employees
(EMPLOYE=1001, RESPONSABLE=2001, DIRECTEUR=3001, DG=4001, RH=5001, ADMIN=9001)
and one operation (CONGE for employee 1001, date_debut=2026-03-25).
"""
from datetime import date

import pytest

from app import models


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _add_op(db, matricule, type_demande, statut='en attente', year=2026, month=3, day=1):
    op = models.Operation(
        matricule=matricule,
        type_demande=type_demande,
        titre=type_demande,
        statut=statut,
        date_debut=date(year, month, day),
        date_fin=date(year, month, min(day + 2, 28)),
        duree_jours=3,
        motif='test',
    )
    db.add(op)
    db.flush()
    return op


@pytest.fixture()
def seeded(seed_reference_data, db_session):
    """Extends seed_reference_data with extra operations for richer analytics."""
    # One more operation for EMPLOYE (different year for filtering)
    _add_op(db_session, seed_reference_data['employe'].matricule,
            'Mission', statut='en attente', year=2025, month=6, day=10)
    # One for RESPONSABLE
    _add_op(db_session, seed_reference_data['responsable'].matricule,
            'Permission', statut='validé')
    # One for DIRECTEUR
    _add_op(db_session, seed_reference_data['directeur'].matricule,
            'CONGE', statut='en attente')
    db_session.commit()
    return seed_reference_data


# ---------------------------------------------------------------------------
# /dashboard/analytics/{matricule}
# ---------------------------------------------------------------------------

class TestAnalyticsEmploye:
    def test_scope_personnel(self, client, seeded):
        r = client.get(f'/dashboard/analytics/{seeded["employe"].matricule}')
        assert r.status_code == 200
        data = r.json()
        assert data['scope_level'] == 'personnel'
        # seed gave 1 CONGE + we added 1 Mission = 2 personal ops
        assert data['mes_operations']['total'] == 2
        # EMPLOYE has no perimeter
        assert data['perimetre']['total_employes'] == 0
        assert data['perimetre']['total_operations'] == 0

    def test_by_type_contient_conge_ou_mission(self, client, seeded):
        r = client.get(f'/dashboard/analytics/{seeded["employe"].matricule}')
        types = {it['type'] for it in r.json()['mes_operations']['by_type']}
        assert types & {'CONGE', 'Mission'}

    def test_filtre_annee_valide(self, client, seeded):
        r = client.get(f'/dashboard/analytics/{seeded["employe"].matricule}?annee=2025')
        assert r.status_code == 200


class TestAnalyticsResponsable:
    def test_scope_departement(self, client, seeded):
        r = client.get(f'/dashboard/analytics/{seeded["responsable"].matricule}')
        assert r.status_code == 200
        data = r.json()
        assert data['scope_level'] == 'departement'
        # Responsable + Employe share the same dept (from conftest) → ≥2
        assert data['perimetre']['total_employes'] >= 2

    def test_kpis_sexe_coherent(self, client, seeded):
        r = client.get(f'/dashboard/analytics/{seeded["responsable"].matricule}')
        kpis = r.json()['perimetre']['kpis']
        assert 'effectif_total' in kpis
        assert kpis['hommes'] + kpis['femmes'] + kpis['indetermine'] == kpis['effectif_total']


class TestAnalyticsDirecteur:
    def test_scope_direction(self, client, seeded):
        r = client.get(f'/dashboard/analytics/{seeded["directeur"].matricule}')
        assert r.status_code == 200
        assert r.json()['scope_level'] == 'direction'

    def test_organisation_contient_departements(self, client, seeded):
        r = client.get(f'/dashboard/analytics/{seeded["directeur"].matricule}')
        org = r.json()['organisation']
        assert org is not None
        assert 'employes_by_departement' in org


class TestAnalyticsDG:
    def test_scope_entite(self, client, seeded):
        r = client.get(f'/dashboard/analytics/{seeded["dg"].matricule}')
        assert r.status_code == 200
        assert r.json()['scope_level'] == 'entite'

    def test_organisation_contient_directions(self, client, seeded):
        r = client.get(f'/dashboard/analytics/{seeded["dg"].matricule}')
        org = r.json()['organisation']
        assert org is not None
        assert 'employes_by_direction' in org


class TestAnalyticsAdmin:
    def test_rh_scope_global(self, client, seeded):
        r = client.get(f'/dashboard/analytics/{seeded["rh"].matricule}')
        data = r.json()
        assert data['scope_level'] == 'global'
        assert data['perimetre']['total_employes'] >= 6

    def test_admin_scope_global(self, client, seeded):
        r = client.get(f'/dashboard/analytics/{seeded["admin"].matricule}')
        assert r.json()['scope_level'] == 'global'

    def test_organisation_complete_admin(self, client, seeded):
        r = client.get(f'/dashboard/analytics/{seeded["admin"].matricule}')
        org = r.json()['organisation']
        for key in ('employes_by_entite', 'employes_by_direction', 'employes_by_departement'):
            assert key in org

    def test_kpis_effectif_coherent(self, client, seeded):
        r = client.get(f'/dashboard/analytics/{seeded["admin"].matricule}')
        kpis = r.json()['perimetre']['kpis']
        assert kpis['effectif_total'] >= 6
        assert kpis['hommes'] + kpis['femmes'] + kpis['indetermine'] == kpis['effectif_total']

    def test_filtre_annee_reduit_ops(self, client, seeded):
        all_total = client.get(
            f'/dashboard/analytics/{seeded["admin"].matricule}'
        ).json()['perimetre']['total_operations']
        filtre = client.get(
            f'/dashboard/analytics/{seeded["admin"].matricule}?annee=2025'
        ).json()['perimetre']['total_operations']
        assert filtre <= all_total

    def test_filtre_mois_ok(self, client, seeded):
        r = client.get(f'/dashboard/analytics/{seeded["admin"].matricule}?mois=3')
        assert r.status_code == 200


class TestAnalyticsErrors:
    def test_404_employe_inconnu(self, client, seeded):
        r = client.get('/dashboard/analytics/99999')
        assert r.status_code == 404

    def test_cles_obligatoires(self, client, seeded):
        r = client.get(f'/dashboard/analytics/{seeded["employe"].matricule}')
        data = r.json()
        for key in ('mes_operations', 'perimetre', 'scope_level', 'role', 'matricule'):
            assert key in data


class TestAnalyticsKpisGeo:
    def test_org_structure_by_geo_present(self, client, seeded):
        r = client.get(f'/dashboard/analytics/{seeded["rh"].matricule}')
        geo = r.json()['perimetre'].get('org_structure_by_geo')
        assert geo is not None
        for key in ('directions_by_ville', 'departments_by_ville', 'entities_by_ville'):
            assert key in geo

    def test_operations_by_sexe_dans_kpis(self, client, seeded):
        r = client.get(f'/dashboard/analytics/{seeded["rh"].matricule}')
        kpis = r.json()['perimetre']['kpis']
        assert 'operations_by_sexe' in kpis
        sexes = {it['sexe'] for it in kpis['operations_by_sexe']}
        assert 'M' in sexes and 'F' in sexes

    def test_operations_by_type_and_sexe(self, client, seeded):
        r = client.get(f'/dashboard/analytics/{seeded["rh"].matricule}')
        items = r.json()['perimetre']['kpis'].get('operations_by_type_and_sexe')
        assert isinstance(items, list)
        for item in items:
            assert 'type' in item and 'total' in item


# ---------------------------------------------------------------------------
# Other endpoints (no auth)
# ---------------------------------------------------------------------------

class TestOtherEndpoints:
    def test_absenteisme_par_dept(self, client, seeded):
        r = client.get('/dashboard/absenteisme-par-dept')
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        for item in data:
            assert 'departement' in item
            assert 'jours_absence' in item

    def test_solde_conges_par_tranche(self, client, seeded):
        r = client.get('/dashboard/solde-conges-par-tranche')
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        tranches = {it['tranche'] for it in data}
        # Default tranches list from router
        assert {'0 j', '1-5 j', '6-15 j', '16-25 j', '26-35 j', '36+ j'} <= tranches

    def test_formation_rate(self, client, seeded):
        r = client.get('/dashboard/formation-rate')
        assert r.status_code == 200
        data = r.json()
        for key in ('formes', 'total', 'taux', 'annee'):
            assert key in data

    def test_employee_distribution(self, client, seeded):
        r = client.get('/dashboard/employee-distribution')
        assert r.status_code == 200
        data = r.json()
        for key in ('by_entite', 'by_direction', 'by_departement'):
            assert key in data
            assert isinstance(data[key], list)

    def test_trends(self, client, seeded):
        r = client.get(f'/dashboard/trends/{seeded["employe"].matricule}')
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        for item in data:
            assert 'annee' in item
            assert 'mois' in item
            assert 'total' in item
