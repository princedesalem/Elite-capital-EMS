"""Tests pour le lien frais-missionnaire ↔ segment (id_segment nullable)."""
import pytest
from datetime import date, timedelta


@pytest.fixture()
def mission_with_segments(client, seed_reference_data, db_session, auth_headers):
    from app import models
    emp = seed_reference_data['employe']
    d0 = date.today() + timedelta(days=10)
    d1 = date.today() + timedelta(days=13)
    d2 = date.today() + timedelta(days=18)

    op = models.Operation(
        matricule=emp.matricule, cree_par=emp.matricule,
        type_demande='Mission', statut='en attente',
        date_debut=d0, date_fin=d2, date_demande=date.today(),
    )
    db_session.add(op)
    db_session.flush()

    mission = models.Mission(id_mission=op.id_operation, pays='Cameroun', ville='Douala')
    db_session.add(mission)

    seg_a = models.MissionSegment(
        id_mission=op.id_operation, pays='Cameroun', ville='Douala',
        date_debut=d0, date_fin=d1, ordre=1, moyen_transport='aerien', nombre_nuits=3,
    )
    seg_b = models.MissionSegment(
        id_mission=op.id_operation, pays='France', ville='Paris',
        date_debut=d1, date_fin=d2, ordre=2, moyen_transport='aerien', nombre_nuits=5,
    )
    db_session.add_all([seg_a, seg_b])
    db_session.flush()

    miss = models.MissionnairesMission(
        id_mission=op.id_operation, matricule=emp.matricule, role_mission='responsable',
    )
    db_session.add(miss)
    db_session.commit()
    db_session.refresh(seg_a)
    db_session.refresh(seg_b)

    return {
        'id_mission': op.id_operation, 'matricule': emp.matricule,
        'seg_a': seg_a, 'seg_b': seg_b,
        'headers': auth_headers(emp.matricule, 'EMPLOYE'),
    }


def test_post_frais_avec_segment_valide(client, mission_with_segments, db_session):
    from app import models
    s = mission_with_segments
    r = client.post(
        f"/api/missions/{s['id_mission']}/frais-missionnaire?matricule={s['matricule']}",
        json={"frais_transport": 50000, "frais_hotel": 30000,
              "frais_deplacement": 0, "frais_nutrition": 0,
              "id_segment": s['seg_a'].id_segment},
        headers=s['headers'],
    )
    assert r.status_code == 200, r.text
    frais = db_session.query(models.FraisMissionnaire).filter(
        models.FraisMissionnaire.id_mission == s['id_mission']
    ).first()
    assert frais.id_segment == s['seg_a'].id_segment


def test_post_frais_segment_autre_mission_rejete(client, mission_with_segments, seed_reference_data, db_session):
    """Un id_segment qui n'appartient pas à la mission courante doit être rejeté en 400."""
    from app import models
    s = mission_with_segments
    # Créer une autre mission + segment
    emp = seed_reference_data['employe']
    op2 = models.Operation(
        matricule=emp.matricule, cree_par=emp.matricule,
        type_demande='Mission', statut='en attente',
        date_debut=date.today(), date_fin=date.today() + timedelta(days=2),
        date_demande=date.today(),
    )
    db_session.add(op2); db_session.flush()
    db_session.add(models.Mission(id_mission=op2.id_operation, pays='X', ville='Y'))
    other_seg = models.MissionSegment(
        id_mission=op2.id_operation, pays='X', ville='Y',
        date_debut=date.today(), date_fin=date.today() + timedelta(days=1), ordre=1,
    )
    db_session.add(other_seg); db_session.commit(); db_session.refresh(other_seg)

    r = client.post(
        f"/api/missions/{s['id_mission']}/frais-missionnaire?matricule={s['matricule']}",
        json={"frais_transport": 100, "frais_hotel": 0, "frais_deplacement": 0,
              "frais_nutrition": 0, "id_segment": other_seg.id_segment},
        headers=s['headers'],
    )
    assert r.status_code == 400
    assert "segment" in r.json()['detail'].lower()


def test_get_retourne_id_segment_et_segment_info(client, mission_with_segments, db_session):
    from app import models
    s = mission_with_segments
    db_session.add(models.FraisMissionnaire(
        id_mission=s['id_mission'], matricule=s['matricule'],
        id_segment=s['seg_b'].id_segment,
        frais_transport=10, frais_hotel=20, frais_deplacement=0, frais_nutrition=0,
        total_frais=30,
    ))
    db_session.commit()

    r = client.get(f"/api/missions/{s['id_mission']}/frais-missionnaire")
    assert r.status_code == 200
    items = r.json()['frais_missionnaires']
    assert len(items) == 1
    assert items[0]['id_segment'] == s['seg_b'].id_segment
    assert items[0]['segment']['ville'] == 'Paris'
    assert items[0]['segment']['ordre'] == 2


def test_put_change_id_segment(client, mission_with_segments, db_session):
    from app import models
    s = mission_with_segments
    db_session.add(models.FraisMissionnaire(
        id_mission=s['id_mission'], matricule=s['matricule'],
        id_segment=s['seg_a'].id_segment,
        frais_transport=10, frais_hotel=0, frais_deplacement=0, frais_nutrition=0,
        total_frais=10,
    ))
    db_session.commit()

    r = client.put(
        f"/api/missions/{s['id_mission']}/frais-missionnaire/{s['matricule']}",
        json={"frais_transport": 10, "frais_hotel": 0, "frais_deplacement": 0,
              "frais_nutrition": 0, "id_segment": s['seg_b'].id_segment},
        headers=s['headers'],
    )
    assert r.status_code == 200
    f = db_session.query(models.FraisMissionnaire).filter(
        models.FraisMissionnaire.id_mission == s['id_mission']
    ).first()
    db_session.refresh(f)
    assert f.id_segment == s['seg_b'].id_segment


def test_post_frais_sans_id_segment_reste_null(client, mission_with_segments, db_session):
    """Rétro-compat : un POST sans id_segment laisse la colonne NULL."""
    from app import models
    s = mission_with_segments
    r = client.post(
        f"/api/missions/{s['id_mission']}/frais-missionnaire?matricule={s['matricule']}",
        json={"frais_transport": 100, "frais_hotel": 0,
              "frais_deplacement": 0, "frais_nutrition": 0},
        headers=s['headers'],
    )
    assert r.status_code == 200, r.text
    f = db_session.query(models.FraisMissionnaire).filter(
        models.FraisMissionnaire.id_mission == s['id_mission']
    ).first()
    assert f.id_segment is None
