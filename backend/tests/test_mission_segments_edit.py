"""Tests for PUT /api/missions/{id_mission}/segments — edit mission segments."""
import pytest
from datetime import date, timedelta
from unittest.mock import patch


def _geo_ok(country_name=None, city_name=None, country_code=None):
    return True, "OK", {
        "country_name": country_name or "Cameroun",
        "city_name": city_name or "Douala",
        "country_code": country_code or "CM",
    }


@pytest.fixture()
def mission_setup(client, seed_reference_data, db_session, auth_headers):
    """Create a mission with 1 segment in 'en attente' state."""
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

    seg = models.MissionSegment(
        id_mission=op.id_operation, pays='Cameroun', ville='Douala',
        date_debut=d0, date_fin=d1, ordre=1,
    )
    db_session.add(seg)
    db_session.commit()

    headers = auth_headers(emp.matricule, 'EMPLOYE')
    return {
        'op': op, 'mission': mission, 'seg': seg,
        'headers': headers, 'emp': emp, 'd0': d0, 'd1': d1,
    }


@patch('app.utils.world_geo_service.validate_country_city', side_effect=lambda **kw: _geo_ok(**kw))
def test_replace_segments_success(mock_geo, client, mission_setup):
    s = mission_setup
    d_new = date.today() + timedelta(days=20)
    d_end = date.today() + timedelta(days=25)
    payload = [
        {"pays": "France", "ville": "Paris", "date_debut": str(d_new), "date_fin": str(d_end),
         "heure_depart": "08:00", "heure_arrivee": "12:00"},
        {"pays": "Cameroun", "ville": "Yaoundé", "date_debut": str(d_end), "date_fin": str(d_end + timedelta(days=3)),
         "heure_depart": "14:00", "heure_arrivee": "18:00"},
    ]
    r = client.put(f"/api/missions/{s['op'].id_operation}/segments", json=payload, headers=s['headers'])
    assert r.status_code == 200
    body = r.json()
    assert body['segments_count'] == 2
    assert "mis à jour" in body['message']


@patch('app.utils.world_geo_service.validate_country_city', side_effect=lambda **kw: _geo_ok(**kw))
def test_replace_segments_empty_list_rejected(mock_geo, client, mission_setup):
    r = client.put(
        f"/api/missions/{mission_setup['op'].id_operation}/segments",
        json=[], headers=mission_setup['headers'],
    )
    assert r.status_code == 400
    assert "segment" in r.json()['detail'].lower()


def test_replace_segments_after_validation_rejected(client, mission_setup, db_session):
    from app import models
    s = mission_setup
    # Create a validation record → operation has been validated
    val = models.Validation(
        id_operation=s['op'].id_operation,
        matricule_validateur=2001,
        role_validateur='RESPONSABLE',
        statut_validation='validé',
    )
    db_session.add(val)
    db_session.commit()

    payload = [{"pays": "France", "ville": "Paris",
                "date_debut": str(date.today() + timedelta(days=20)),
                "date_fin": str(date.today() + timedelta(days=25))}]
    r = client.put(f"/api/missions/{s['op'].id_operation}/segments", json=payload, headers=s['headers'])
    assert r.status_code == 400
    assert "validation" in r.json()['detail'].lower()


def test_replace_segments_non_en_attente_rejected(client, mission_setup, db_session):
    s = mission_setup
    s['op'].statut = 'validé'
    db_session.commit()

    payload = [{"pays": "France", "ville": "Paris",
                "date_debut": str(date.today() + timedelta(days=20)),
                "date_fin": str(date.today() + timedelta(days=25))}]
    r = client.put(f"/api/missions/{s['op'].id_operation}/segments", json=payload, headers=s['headers'])
    assert r.status_code == 400


def test_replace_segments_forbidden_other_employee(client, mission_setup, auth_headers):
    """A random employee cannot edit someone else's mission segments."""
    s = mission_setup
    other_headers = auth_headers(7777, 'EMPLOYE')
    payload = [{"pays": "France", "ville": "Paris",
                "date_debut": str(date.today() + timedelta(days=20)),
                "date_fin": str(date.today() + timedelta(days=25))}]
    r = client.put(f"/api/missions/{s['op'].id_operation}/segments", json=payload, headers=other_headers)
    assert r.status_code == 403


@patch('app.utils.world_geo_service.validate_country_city', side_effect=lambda **kw: _geo_ok(**kw))
def test_replace_segments_rh_can_edit(mock_geo, client, mission_setup, auth_headers):
    """RH user should be able to edit any mission's segments."""
    s = mission_setup
    rh_headers = auth_headers(5001, 'RH')
    d = date.today() + timedelta(days=30)
    payload = [{"pays": "France", "ville": "Lyon", "date_debut": str(d), "date_fin": str(d + timedelta(days=2))}]
    r = client.put(f"/api/missions/{s['op'].id_operation}/segments", json=payload, headers=rh_headers)
    assert r.status_code == 200
    assert r.json()['segments_count'] == 1


def test_replace_segments_mission_not_found(client, auth_headers):
    headers = auth_headers(1001, 'EMPLOYE')
    r = client.put("/api/missions/999999/segments", json=[{"pays": "France", "ville": "Paris",
        "date_debut": str(date.today()), "date_fin": str(date.today() + timedelta(days=1))}], headers=headers)
    assert r.status_code == 404


@patch('app.utils.world_geo_service.validate_country_city',
       side_effect=lambda **kw: (False, "Ville inconnue", {}))
def test_replace_segments_invalid_geo_rejected(mock_geo, client, mission_setup):
    s = mission_setup
    payload = [{"pays": "XXX", "ville": "YYY",
                "date_debut": str(date.today() + timedelta(days=20)),
                "date_fin": str(date.today() + timedelta(days=25))}]
    r = client.put(f"/api/missions/{s['op'].id_operation}/segments", json=payload, headers=s['headers'])
    assert r.status_code == 400
    assert "Segment 1" in r.json()['detail']
