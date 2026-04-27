"""Tests for POST /api/missions/{id}/valider-paiement-rh.

Le RH doit pouvoir confirmer le paiement des frais APRES que le missionnaire
ait lui-même confirmé la réception (frais_valides_missionnaire=True).
"""
import pytest
from datetime import date, timedelta


@pytest.fixture()
def mission_ready(client, seed_reference_data, db_session, auth_headers):
    """Mission + missionnaire créés, sans validation de frais."""
    from app import models
    refs = seed_reference_data
    emp = refs['employe']
    d0 = date.today() + timedelta(days=1)
    d1 = date.today() + timedelta(days=3)

    op = models.Operation(
        matricule=emp.matricule,
        cree_par=emp.matricule,
        type_demande='Mission',
        statut='validé',
        date_debut=d0,
        date_fin=d1,
        date_demande=date.today(),
    )
    db_session.add(op)
    db_session.flush()

    mission = models.Mission(id_mission=op.id_operation, pays='Cameroun', ville='Douala')
    db_session.add(mission)
    db_session.flush()

    db_session.add(models.MissionnairesMission(
        id_mission=op.id_operation,
        matricule=emp.matricule,
        role_mission='responsable',
    ))
    db_session.commit()

    return {
        'id_mission': op.id_operation,
        'matricule_emp': emp.matricule,
        'matricule_rh': refs['rh'].matricule,
        'matricule_resp': refs['responsable'].matricule,
        'headers_rh': auth_headers(refs['rh'].matricule, 'RH'),
        'headers_emp': auth_headers(emp.matricule, 'EMPLOYE'),
        'headers_resp': auth_headers(refs['responsable'].matricule, 'RESPONSABLE'),
    }


def _valider_frais_missionnaire(client, s):
    return client.post(
        f"/api/missions/{s['id_mission']}/valider-frais-missionnaire",
        json={'matricule': s['matricule_emp']},
        headers=s['headers_emp'],
    )


def test_rh_peut_confirmer_paiement_apres_confirmation_missionnaire(client, mission_ready, db_session):
    from app import models
    s = mission_ready

    r1 = _valider_frais_missionnaire(client, s)
    assert r1.status_code == 200
    assert r1.json()['frais_valides_missionnaire'] is True

    r2 = client.post(
        f"/api/missions/{s['id_mission']}/valider-paiement-rh",
        json={'matricule': s['matricule_rh']},
        headers=s['headers_rh'],
    )
    assert r2.status_code == 200, r2.text
    body = r2.json()
    assert body['frais_payes'] is True
    assert body['date_paiement']

    db_session.expire_all()
    mission = db_session.query(models.Mission).filter(
        models.Mission.id_mission == s['id_mission']
    ).first()
    assert mission.frais_valides_rh is True
    assert mission.frais_payes is True
    assert mission.date_paiement_frais is not None


def test_paiement_rh_refuse_si_missionnaire_na_pas_confirme(client, mission_ready):
    s = mission_ready

    r = client.post(
        f"/api/missions/{s['id_mission']}/valider-paiement-rh",
        json={'matricule': s['matricule_rh']},
        headers=s['headers_rh'],
    )
    assert r.status_code == 400
    assert 'missionnaire' in r.json()['detail'].lower()


def test_paiement_rh_refuse_pour_non_rh(client, mission_ready):
    s = mission_ready
    _valider_frais_missionnaire(client, s)

    r = client.post(
        f"/api/missions/{s['id_mission']}/valider-paiement-rh",
        json={'matricule': s['matricule_resp']},
        headers=s['headers_resp'],
    )
    assert r.status_code == 403


def test_paiement_rh_mission_introuvable(client, mission_ready):
    s = mission_ready
    r = client.post(
        "/api/missions/999999/valider-paiement-rh",
        json={'matricule': s['matricule_rh']},
        headers=s['headers_rh'],
    )
    assert r.status_code == 404


def test_statut_paiement_reflete_confirmation_rh(client, mission_ready):
    s = mission_ready
    _valider_frais_missionnaire(client, s)
    client.post(
        f"/api/missions/{s['id_mission']}/valider-paiement-rh",
        json={'matricule': s['matricule_rh']},
        headers=s['headers_rh'],
    )

    r = client.get(
        f"/api/missions/{s['id_mission']}/statut-paiement-frais",
        headers=s['headers_rh'],
    )
    assert r.status_code == 200
    data = r.json()
    assert data['frais_valides_missionnaire'] is True
    assert data['frais_valides_rh'] is True
    assert data['frais_payes'] is True
    assert data['date_validation_frais_rh']
    assert data['date_paiement_frais']
