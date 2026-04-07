"""
Tests for:
- POST /api/missions/creer-multi-segments  (persists mission_comment)
- GET  /api/missions/{id}                  (detail endpoint returns segments + missionnaires)
- POST /api/missions/{id}/marquer-paye     (RH sets frais_payes=True; non-RH gets 403)
"""
from datetime import date

from app import models
from app.utils import world_geo_service


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _patch_geo(monkeypatch):
    """Disable external geo validation so tests don't need network access."""
    monkeypatch.setattr(
        world_geo_service,
        '_countries_index',
        lambda: [
            {
                'code': 'CM',
                'name': 'Cameroun',
                'official_name': 'Republique du Cameroun',
                'flag': '🇨🇲',
            }
        ],
    )
    monkeypatch.setattr(
        world_geo_service,
        '_cities_for_country',
        lambda country: ['Douala', 'Yaounde', 'Kribi'],
    )


def _create_mission(client, seed_reference_data, mission_comment=None):
    """Helper that creates a mission via the API and returns the response JSON."""
    rh = seed_reference_data['rh']
    employe = seed_reference_data['employe']
    payload = {
        'matricule': rh.matricule,
        'matricules_missionnaires': [rh.matricule, employe.matricule],
        'motif': 'Mission test',
        'segments': [
            {
                'pays': 'Cameroun',
                'country_code': 'CM',
                'ville': 'Douala',
                'date_debut': '2026-06-01',
                'date_fin': '2026-06-05',
                'moyen_transport': 'aerien',
            }
        ],
    }
    if mission_comment is not None:
        payload['mission_comment'] = mission_comment
    return client.post('/api/missions/creer-multi-segments', json=payload)


# ─── Tests: mission_comment persisted ─────────────────────────────────────────

def test_creer_mission_persists_mission_comment(client, seed_reference_data, db_session, monkeypatch):
    _patch_geo(monkeypatch)

    response = _create_mission(client, seed_reference_data, mission_comment='Visite client Douala')
    assert response.status_code == 201, response.text

    id_mission = response.json()['id_mission']
    mission = db_session.query(models.Mission).filter(
        models.Mission.id_mission == id_mission
    ).first()
    assert mission is not None
    assert mission.mission_comment == 'Visite client Douala'


def test_creer_mission_without_comment_stores_none(client, seed_reference_data, db_session, monkeypatch):
    _patch_geo(monkeypatch)

    response = _create_mission(client, seed_reference_data, mission_comment=None)
    assert response.status_code == 201, response.text

    id_mission = response.json()['id_mission']
    mission = db_session.query(models.Mission).filter(
        models.Mission.id_mission == id_mission
    ).first()
    assert mission is not None
    assert mission.mission_comment is None


# ─── Tests: GET /{id_mission} detail endpoint ─────────────────────────────────

def test_get_mission_detail_returns_200_with_segments_and_missionnaires(
    client, seed_reference_data, monkeypatch
):
    _patch_geo(monkeypatch)

    create_response = _create_mission(
        client, seed_reference_data, mission_comment='Detail test'
    )
    assert create_response.status_code == 201, create_response.text
    id_mission = create_response.json()['id_mission']

    get_response = client.get(f'/api/missions/{id_mission}')
    assert get_response.status_code == 200, get_response.text

    data = get_response.json()
    assert data['id_mission'] == id_mission
    assert data['mission_comment'] == 'Detail test'
    assert data['motif'] == 'Mission test'

    # Segments
    assert 'segments' in data
    assert len(data['segments']) == 1
    seg = data['segments'][0]
    assert seg['pays'] == 'Cameroun'
    assert seg['ville'] == 'Douala'
    assert seg['date_debut'] == '2026-06-01'
    assert seg['date_fin'] == '2026-06-05'

    # Missionnaires
    assert 'missionnaires' in data
    assert len(data['missionnaires']) == 2
    matricules = {m['matricule'] for m in data['missionnaires']}
    assert seed_reference_data['rh'].matricule in matricules
    assert seed_reference_data['employe'].matricule in matricules


def test_get_mission_detail_returns_404_for_unknown_id(client, seed_reference_data):
    response = client.get('/api/missions/999999')
    assert response.status_code == 404


def test_get_mission_detail_returns_frais_payment_fields(
    client, seed_reference_data, monkeypatch
):
    _patch_geo(monkeypatch)

    create_response = _create_mission(client, seed_reference_data)
    assert create_response.status_code == 201, create_response.text
    id_mission = create_response.json()['id_mission']

    data = client.get(f'/api/missions/{id_mission}').json()
    assert data['frais_payes'] is False
    assert data['frais_valides_missionnaire'] is False
    assert data['frais_valides_rh'] is False


# ─── Tests: POST /{id_mission}/marquer-paye ────────────────────────────────────

def test_marquer_paye_sets_frais_payes_true(
    client, seed_reference_data, db_session, monkeypatch, auth_headers
):
    _patch_geo(monkeypatch)

    create_response = _create_mission(client, seed_reference_data)
    assert create_response.status_code == 201, create_response.text
    id_mission = create_response.json()['id_mission']

    headers = auth_headers(seed_reference_data['rh'].matricule, 'RH')
    response = client.post(f'/api/missions/{id_mission}/marquer-paye', headers=headers)
    assert response.status_code == 200, response.text
    assert response.json()['frais_payes'] is True

    db_session.expire_all()
    mission = db_session.query(models.Mission).filter(
        models.Mission.id_mission == id_mission
    ).first()
    assert mission.frais_payes is True
    assert mission.frais_valides_rh is True
    assert mission.date_paiement_frais is not None


def test_marquer_paye_returns_403_for_non_rh(
    client, seed_reference_data, monkeypatch, auth_headers
):
    _patch_geo(monkeypatch)

    create_response = _create_mission(client, seed_reference_data)
    assert create_response.status_code == 201, create_response.text
    id_mission = create_response.json()['id_mission']

    # EMPLOYE role should be forbidden
    headers = auth_headers(seed_reference_data['employe'].matricule, 'EMPLOYE')
    response = client.post(f'/api/missions/{id_mission}/marquer-paye', headers=headers)
    assert response.status_code == 403


def test_marquer_paye_returns_404_for_unknown_mission(
    client, seed_reference_data, auth_headers
):
    headers = auth_headers(seed_reference_data['rh'].matricule, 'RH')
    response = client.post('/api/missions/999999/marquer-paye', headers=headers)
    assert response.status_code == 404
