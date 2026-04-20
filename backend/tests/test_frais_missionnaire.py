"""Tests for FraisMissionnaire CRUD — POST/GET/PUT /api/missions/{id}/frais-missionnaire."""
import pytest
from datetime import date, timedelta


@pytest.fixture()
def mission_with_missionary(client, seed_reference_data, db_session, auth_headers):
    """Create a mission + 1 missionnaire so frais can be submitted."""
    from app import models
    refs = seed_reference_data
    emp = refs['employe']
    d0 = date.today() + timedelta(days=10)
    d1 = date.today() + timedelta(days=15)

    op = models.Operation(
        matricule=emp.matricule, cree_par=emp.matricule,
        type_demande='Mission', statut='en attente',
        date_debut=d0, date_fin=d1, date_demande=date.today(),
    )
    db_session.add(op)
    db_session.flush()

    mission = models.Mission(id_mission=op.id_operation, pays='Cameroun', ville='Douala')
    db_session.add(mission)
    db_session.flush()

    miss = models.MissionnairesMission(
        id_mission=op.id_operation, matricule=emp.matricule,
        role_mission='responsable',
    )
    db_session.add(miss)
    db_session.commit()

    return {
        'op': op, 'mission': mission, 'emp': emp, 'matricule': emp.matricule,
        'id_mission': op.id_operation,
        'headers': auth_headers(emp.matricule, 'EMPLOYE'),
    }


# ── CREATE ──

def test_create_frais_success(client, mission_with_missionary):
    s = mission_with_missionary
    r = client.post(
        f"/api/missions/{s['id_mission']}/frais-missionnaire?matricule={s['matricule']}",
        json={"frais_transport": 50000, "frais_hotel": 30000, "frais_deplacement": 10000, "frais_nutrition": 15000},
        headers=s['headers'],
    )
    assert r.status_code == 200
    body = r.json()
    assert body['total_frais'] == 105000
    assert 'id' in body


def test_create_frais_duplicate_rejected(client, mission_with_missionary):
    s = mission_with_missionary
    payload = {"frais_transport": 100, "frais_hotel": 0, "frais_deplacement": 0, "frais_nutrition": 0}
    r1 = client.post(
        f"/api/missions/{s['id_mission']}/frais-missionnaire?matricule={s['matricule']}",
        json=payload, headers=s['headers'],
    )
    assert r1.status_code == 200

    r2 = client.post(
        f"/api/missions/{s['id_mission']}/frais-missionnaire?matricule={s['matricule']}",
        json=payload, headers=s['headers'],
    )
    assert r2.status_code == 400
    assert "existent déjà" in r2.json()['detail']


def test_create_frais_non_missionary_rejected(client, mission_with_missionary, seed_reference_data):
    s = mission_with_missionary
    other_mat = seed_reference_data['responsable'].matricule
    r = client.post(
        f"/api/missions/{s['id_mission']}/frais-missionnaire?matricule={other_mat}",
        json={"frais_transport": 100, "frais_hotel": 0, "frais_deplacement": 0, "frais_nutrition": 0},
        headers=s['headers'],
    )
    assert r.status_code == 400
    assert "missionnaire" in r.json()['detail'].lower()


def test_create_frais_mission_not_found(client, auth_headers):
    r = client.post(
        "/api/missions/999999/frais-missionnaire?matricule=1001",
        json={"frais_transport": 100, "frais_hotel": 0, "frais_deplacement": 0, "frais_nutrition": 0},
        headers=auth_headers(1001, 'EMPLOYE'),
    )
    assert r.status_code == 404


# ── READ ALL ──

def test_get_all_frais(client, mission_with_missionary):
    s = mission_with_missionary
    # Create first
    client.post(
        f"/api/missions/{s['id_mission']}/frais-missionnaire?matricule={s['matricule']}",
        json={"frais_transport": 500, "frais_hotel": 200, "frais_deplacement": 0, "frais_nutrition": 0},
        headers=s['headers'],
    )

    r = client.get(f"/api/missions/{s['id_mission']}/frais-missionnaire", headers=s['headers'])
    assert r.status_code == 200
    body = r.json()
    assert body['id_mission'] == s['id_mission']
    assert len(body['frais_missionnaires']) == 1
    frais = body['frais_missionnaires'][0]
    assert frais['frais_transport'] == 500
    assert frais['total_frais'] == 700
    assert frais['nom_complet']  # should have a name


def test_get_all_frais_empty(client, mission_with_missionary):
    s = mission_with_missionary
    r = client.get(f"/api/missions/{s['id_mission']}/frais-missionnaire", headers=s['headers'])
    assert r.status_code == 200
    assert len(r.json()['frais_missionnaires']) == 0


# ── READ SINGLE ──

def test_get_frais_by_matricule(client, mission_with_missionary):
    s = mission_with_missionary
    client.post(
        f"/api/missions/{s['id_mission']}/frais-missionnaire?matricule={s['matricule']}",
        json={"frais_transport": 100, "frais_hotel": 200, "frais_deplacement": 300, "frais_nutrition": 400},
        headers=s['headers'],
    )
    r = client.get(
        f"/api/missions/{s['id_mission']}/frais-missionnaire/{s['matricule']}",
        headers=s['headers'],
    )
    assert r.status_code == 200
    body = r.json()
    assert body['matricule'] == s['matricule']
    assert body['total_frais'] == 1000


def test_get_frais_by_matricule_not_found(client, mission_with_missionary):
    s = mission_with_missionary
    r = client.get(
        f"/api/missions/{s['id_mission']}/frais-missionnaire/999999",
        headers=s['headers'],
    )
    assert r.status_code == 404


# ── UPDATE ──

def test_update_frais_success(client, mission_with_missionary):
    s = mission_with_missionary
    client.post(
        f"/api/missions/{s['id_mission']}/frais-missionnaire?matricule={s['matricule']}",
        json={"frais_transport": 100, "frais_hotel": 0, "frais_deplacement": 0, "frais_nutrition": 0},
        headers=s['headers'],
    )
    r = client.put(
        f"/api/missions/{s['id_mission']}/frais-missionnaire/{s['matricule']}",
        json={"frais_transport": 999, "frais_hotel": 111, "frais_deplacement": 0, "frais_nutrition": 0},
        headers=s['headers'],
    )
    assert r.status_code == 200
    assert r.json()['total_frais'] == 1110


def test_update_frais_not_found(client, mission_with_missionary):
    s = mission_with_missionary
    r = client.put(
        f"/api/missions/{s['id_mission']}/frais-missionnaire/999999",
        json={"frais_transport": 0, "frais_hotel": 0, "frais_deplacement": 0, "frais_nutrition": 0},
        headers=s['headers'],
    )
    assert r.status_code == 404
