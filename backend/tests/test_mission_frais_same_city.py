"""Tests pour la logique de frais automatiquement à zéro quand la mission est
dans la même ville que l'employé (tous les segments = ville locale)."""
import pytest
from datetime import date, timedelta


# ─────────────────────────────────────────────────────────────────────────────
# Fixtures helpers
# ─────────────────────────────────────────────────────────────────────────────

def _make_mission_env(db_session, seed_reference_data, auth_headers,
                      segment_villes, employe_ville='Yaoundé'):
    """
    Helper: create employee with localisation in `employe_ville`, a mission,
    and segments with the given `segment_villes` list.
    Returns a dict with all relevant objects.
    """
    from app import models

    refs = seed_reference_data
    pays_cm = refs['pays']

    # Localisation for the employee
    loc = models.Localisation(ville=employe_ville, id_pays=pays_cm.id_pays)
    db_session.add(loc)
    db_session.flush()

    # Re-use existing employe but override their localisation
    emp = refs['employe']
    emp.id_localisation = loc.id_localisation
    db_session.flush()

    d0 = date.today() + timedelta(days=10)
    d1 = date.today() + timedelta(days=15)

    op = models.Operation(
        matricule=emp.matricule, cree_par=emp.matricule,
        type_demande='Mission', statut='en attente',
        date_debut=d0, date_fin=d1, date_demande=date.today(),
    )
    db_session.add(op)
    db_session.flush()

    mission = models.Mission(id_mission=op.id_operation, pays='Cameroun', ville=employe_ville)
    db_session.add(mission)
    db_session.flush()

    miss = models.MissionnairesMission(
        id_mission=op.id_operation, matricule=emp.matricule,
        role_mission='responsable',
    )
    db_session.add(miss)
    db_session.flush()

    segments = []
    for i, ville in enumerate(segment_villes):
        seg = models.MissionSegment(
            id_mission=op.id_operation,
            pays='Cameroun',
            ville=ville,
            date_debut=d0,
            date_fin=d1,
            ordre=i + 1,
        )
        db_session.add(seg)
        db_session.flush()
        segments.append(seg)

    db_session.commit()

    return {
        'op': op,
        'mission': mission,
        'emp': emp,
        'matricule': emp.matricule,
        'id_mission': op.id_operation,
        'segments': segments,
        'headers': auth_headers(emp.matricule, 'EMPLOYE'),
    }


FRAIS_PAYLOAD = {
    'frais_transport': 50000,
    'frais_hotel': 30000,
    'frais_deplacement': 10000,
    'frais_nutrition': 15000,
}


# ─────────────────────────────────────────────────────────────────────────────
# Tests POST frais-missionnaire
# ─────────────────────────────────────────────────────────────────────────────

def test_all_segments_same_city_forces_zero(client, db_session, seed_reference_data, auth_headers):
    """Si tous les segments sont dans la ville de l'employé → frais stockés = 0."""
    s = _make_mission_env(
        db_session, seed_reference_data, auth_headers,
        segment_villes=['Yaoundé', 'Yaoundé'],
        employe_ville='Yaoundé',
    )
    r = client.post(
        f"/api/missions/{s['id_mission']}/frais-missionnaire?matricule={s['matricule']}",
        json=FRAIS_PAYLOAD,
        headers=s['headers'],
    )
    assert r.status_code == 200
    body = r.json()
    assert body['total_frais'] == 0, f"Expected 0 but got {body['total_frais']}"


def test_mixed_segments_allows_amounts(client, db_session, seed_reference_data, auth_headers):
    """Si au moins un segment est en dehors de la ville → frais non forcés à 0."""
    s = _make_mission_env(
        db_session, seed_reference_data, auth_headers,
        segment_villes=['Yaoundé', 'Douala'],
        employe_ville='Yaoundé',
    )
    r = client.post(
        f"/api/missions/{s['id_mission']}/frais-missionnaire?matricule={s['matricule']}",
        json=FRAIS_PAYLOAD,
        headers=s['headers'],
    )
    assert r.status_code == 200
    body = r.json()
    assert body['total_frais'] == 105000, f"Expected 105000 but got {body['total_frais']}"


def test_no_segments_allows_amounts(client, db_session, seed_reference_data, auth_headers):
    """Si la mission n'a aucun segment → frais autorisés normalement (fallback gracieux)."""
    s = _make_mission_env(
        db_session, seed_reference_data, auth_headers,
        segment_villes=[],
        employe_ville='Yaoundé',
    )
    r = client.post(
        f"/api/missions/{s['id_mission']}/frais-missionnaire?matricule={s['matricule']}",
        json=FRAIS_PAYLOAD,
        headers=s['headers'],
    )
    assert r.status_code == 200
    body = r.json()
    assert body['total_frais'] == 105000


def test_no_localisation_allows_amounts(client, db_session, seed_reference_data, auth_headers):
    """Si l'employé n'a pas de localisation → frais autorisés normalement (fallback gracieux)."""
    from app import models

    refs = seed_reference_data
    emp = refs['employe']
    emp.id_localisation = None  # pas de localisation
    db_session.flush()

    d0 = date.today() + timedelta(days=10)
    d1 = date.today() + timedelta(days=15)

    op = models.Operation(
        matricule=emp.matricule, cree_par=emp.matricule,
        type_demande='Mission', statut='en attente',
        date_debut=d0, date_fin=d1, date_demande=date.today(),
    )
    db_session.add(op)
    db_session.flush()

    mission = models.Mission(id_mission=op.id_operation, pays='Cameroun', ville='Yaoundé')
    db_session.add(mission)
    db_session.flush()

    miss = models.MissionnairesMission(
        id_mission=op.id_operation, matricule=emp.matricule, role_mission='responsable',
    )
    db_session.add(miss)
    db_session.flush()

    seg = models.MissionSegment(
        id_mission=op.id_operation, pays='Cameroun', ville='Yaoundé',
        date_debut=d0, date_fin=d1, ordre=1,
    )
    db_session.add(seg)
    db_session.commit()

    r = client.post(
        f"/api/missions/{op.id_operation}/frais-missionnaire?matricule={emp.matricule}",
        json=FRAIS_PAYLOAD,
        headers=auth_headers(emp.matricule, 'EMPLOYE'),
    )
    assert r.status_code == 200
    body = r.json()
    assert body['total_frais'] == 105000


def test_same_city_case_insensitive(client, db_session, seed_reference_data, auth_headers):
    """La comparaison des villes est insensible à la casse."""
    s = _make_mission_env(
        db_session, seed_reference_data, auth_headers,
        segment_villes=['YAOUNDÉ'],  # majuscules
        employe_ville='Yaoundé',
    )
    r = client.post(
        f"/api/missions/{s['id_mission']}/frais-missionnaire?matricule={s['matricule']}",
        json=FRAIS_PAYLOAD,
        headers=s['headers'],
    )
    assert r.status_code == 200
    assert r.json()['total_frais'] == 0


# ─────────────────────────────────────────────────────────────────────────────
# Tests PUT frais-missionnaire
# ─────────────────────────────────────────────────────────────────────────────

def test_put_also_forces_zero(client, db_session, seed_reference_data, auth_headers):
    """PUT frais sur une mission locale → montants également forcés à 0."""
    from app import models

    s = _make_mission_env(
        db_session, seed_reference_data, auth_headers,
        segment_villes=['Yaoundé'],
        employe_ville='Yaoundé',
    )
    # Create initial frais (will be zeroed)
    r_create = client.post(
        f"/api/missions/{s['id_mission']}/frais-missionnaire?matricule={s['matricule']}",
        json={'frais_transport': 0, 'frais_hotel': 0, 'frais_deplacement': 0, 'frais_nutrition': 0},
        headers=s['headers'],
    )
    assert r_create.status_code == 200

    # Try to update with non-zero amounts
    r_put = client.put(
        f"/api/missions/{s['id_mission']}/frais-missionnaire/{s['matricule']}",
        json=FRAIS_PAYLOAD,
        headers=s['headers'],
    )
    assert r_put.status_code == 200
    assert r_put.json()['total_frais'] == 0


# ─────────────────────────────────────────────────────────────────────────────
# Tests GET /{id_mission}?matricule — champ frais_applicable
# ─────────────────────────────────────────────────────────────────────────────

def test_get_detail_frais_applicable_false_when_local(client, db_session, seed_reference_data, auth_headers):
    """GET /api/missions/{id}?matricule → frais_applicable == False quand tous les segments sont locaux."""
    s = _make_mission_env(
        db_session, seed_reference_data, auth_headers,
        segment_villes=['Yaoundé', 'Yaoundé'],
        employe_ville='Yaoundé',
    )
    r = client.get(
        f"/api/missions/{s['id_mission']}",
        params={'matricule': s['matricule']},
        headers=s['headers'],
    )
    assert r.status_code == 200
    body = r.json()
    assert 'frais_applicable' in body
    assert body['frais_applicable'] is False


def test_get_detail_frais_applicable_true_when_external(client, db_session, seed_reference_data, auth_headers):
    """GET /api/missions/{id}?matricule → frais_applicable == True quand au moins un segment externe."""
    s = _make_mission_env(
        db_session, seed_reference_data, auth_headers,
        segment_villes=['Yaoundé', 'Douala'],
        employe_ville='Yaoundé',
    )
    r = client.get(
        f"/api/missions/{s['id_mission']}",
        params={'matricule': s['matricule']},
        headers=s['headers'],
    )
    assert r.status_code == 200
    body = r.json()
    assert body['frais_applicable'] is True


def test_get_detail_frais_applicable_none_without_matricule(client, db_session, seed_reference_data, auth_headers):
    """GET /api/missions/{id} sans matricule → frais_applicable == None."""
    s = _make_mission_env(
        db_session, seed_reference_data, auth_headers,
        segment_villes=['Yaoundé'],
        employe_ville='Yaoundé',
    )
    r = client.get(
        f"/api/missions/{s['id_mission']}",
        headers=s['headers'],
    )
    assert r.status_code == 200
    body = r.json()
    assert body.get('frais_applicable') is None
