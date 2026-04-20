"""Tests for POST/DELETE /api/missions/{id_mission}/missionnaires/{matricule}."""
import pytest
from datetime import date, timedelta


@pytest.fixture()
def mission_with_missionnaire(client, seed_reference_data, db_session, auth_headers):
    """Create a mission with the main employee as 'responsable' missionnaire."""
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

    headers = auth_headers(emp.matricule, 'EMPLOYE')
    return {
        'op': op, 'mission': mission, 'emp': emp,
        'headers': headers, 'd0': d0, 'd1': d1,
    }


# ── ADD MISSIONNAIRE ──

def test_add_missionnaire_success(client, mission_with_missionnaire, seed_reference_data):
    s = mission_with_missionnaire
    resp_mat = seed_reference_data['responsable'].matricule
    r = client.post(
        f"/api/missions/{s['op'].id_operation}/missionnaires/{resp_mat}?role_mission=participant",
        headers=s['headers'],
    )
    assert r.status_code == 200
    body = r.json()
    assert body['matricule'] == resp_mat
    assert body['role_mission'] == 'participant'


def test_add_missionnaire_duplicate_rejected(client, mission_with_missionnaire):
    s = mission_with_missionnaire
    r = client.post(
        f"/api/missions/{s['op'].id_operation}/missionnaires/{s['emp'].matricule}",
        headers=s['headers'],
    )
    assert r.status_code == 400
    assert "déjà" in r.json()['detail'].lower()


def test_add_missionnaire_employee_not_found(client, mission_with_missionnaire):
    s = mission_with_missionnaire
    r = client.post(
        f"/api/missions/{s['op'].id_operation}/missionnaires/999999",
        headers=s['headers'],
    )
    assert r.status_code == 404
    assert "introuvable" in r.json()['detail'].lower()


def test_add_missionnaire_after_validation_rejected(client, mission_with_missionnaire, db_session, seed_reference_data):
    from app import models
    s = mission_with_missionnaire
    val = models.Validation(
        id_operation=s['op'].id_operation,
        matricule_validateur=2001,
        role_validateur='RESPONSABLE',
        statut_validation='validé',
    )
    db_session.add(val)
    db_session.commit()

    r = client.post(
        f"/api/missions/{s['op'].id_operation}/missionnaires/{seed_reference_data['responsable'].matricule}",
        headers=s['headers'],
    )
    assert r.status_code == 400
    assert "validation" in r.json()['detail'].lower()


def test_add_missionnaire_non_en_attente_rejected(client, mission_with_missionnaire, db_session, seed_reference_data):
    s = mission_with_missionnaire
    s['op'].statut = 'validé'
    db_session.commit()

    r = client.post(
        f"/api/missions/{s['op'].id_operation}/missionnaires/{seed_reference_data['responsable'].matricule}",
        headers=s['headers'],
    )
    assert r.status_code == 400


def test_add_missionnaire_date_conflict(client, mission_with_missionnaire, db_session, seed_reference_data):
    from app import models
    s = mission_with_missionnaire
    resp = seed_reference_data['responsable']
    # Create a conflicting operation for resp on same dates
    conflict_op = models.Operation(
        matricule=resp.matricule, cree_par=resp.matricule,
        type_demande='Congé', statut='en attente',
        date_debut=s['d0'], date_fin=s['d1'], date_demande=date.today(),
    )
    db_session.add(conflict_op)
    db_session.commit()

    r = client.post(
        f"/api/missions/{s['op'].id_operation}/missionnaires/{resp.matricule}",
        headers=s['headers'],
    )
    assert r.status_code == 400
    assert "conflit" in r.json()['detail'].lower()


def test_add_missionnaire_mission_not_found(client, auth_headers):
    headers = auth_headers(1001, 'EMPLOYE')
    r = client.post("/api/missions/999999/missionnaires/2001", headers=headers)
    assert r.status_code == 404


# ── REMOVE MISSIONNAIRE ──

def test_remove_participant_success(client, mission_with_missionnaire, db_session, seed_reference_data):
    from app import models
    s = mission_with_missionnaire
    resp = seed_reference_data['responsable']
    # Add a participant first
    miss2 = models.MissionnairesMission(
        id_mission=s['op'].id_operation, matricule=resp.matricule,
        role_mission='participant',
    )
    db_session.add(miss2)
    db_session.commit()

    r = client.delete(
        f"/api/missions/{s['op'].id_operation}/missionnaires/{resp.matricule}",
        headers=s['headers'],
    )
    assert r.status_code == 200
    assert "retiré" in r.json()['message'].lower()


def test_remove_last_responsable_rejected(client, mission_with_missionnaire):
    s = mission_with_missionnaire
    r = client.delete(
        f"/api/missions/{s['op'].id_operation}/missionnaires/{s['emp'].matricule}",
        headers=s['headers'],
    )
    assert r.status_code == 400
    assert "responsable" in r.json()['detail'].lower()


def test_remove_missionnaire_not_in_mission(client, mission_with_missionnaire, seed_reference_data):
    s = mission_with_missionnaire
    r = client.delete(
        f"/api/missions/{s['op'].id_operation}/missionnaires/{seed_reference_data['responsable'].matricule}",
        headers=s['headers'],
    )
    assert r.status_code == 404


def test_remove_missionnaire_after_validation_rejected(client, mission_with_missionnaire, db_session, seed_reference_data):
    from app import models
    s = mission_with_missionnaire
    resp = seed_reference_data['responsable']
    miss2 = models.MissionnairesMission(
        id_mission=s['op'].id_operation, matricule=resp.matricule,
        role_mission='participant',
    )
    db_session.add(miss2)

    val = models.Validation(
        id_operation=s['op'].id_operation,
        matricule_validateur=2001,
        role_validateur='RESPONSABLE',
        statut_validation='validé',
    )
    db_session.add(val)
    db_session.commit()

    r = client.delete(
        f"/api/missions/{s['op'].id_operation}/missionnaires/{resp.matricule}",
        headers=s['headers'],
    )
    assert r.status_code == 400
