"""Tests pour l'édition granulaire des segments de mission.

Couvre les 3 endpoints ajoutés :
    POST   /api/missions/{id_mission}/segments
    PATCH  /api/missions/{id_mission}/segments/{id_segment}
    DELETE /api/missions/{id_mission}/segments/{id_segment}
"""
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
def mission_multi(client, seed_reference_data, db_session, auth_headers):
    """Mission 'en attente' avec 2 segments existants."""
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

    seg1 = models.MissionSegment(
        id_mission=op.id_operation, pays='Cameroun', ville='Douala',
        date_debut=d0, date_fin=d1, ordre=1, moyen_transport='aerien', nombre_nuits=3,
    )
    seg2 = models.MissionSegment(
        id_mission=op.id_operation, pays='France', ville='Paris',
        date_debut=d1, date_fin=d2, ordre=2, moyen_transport='aerien', nombre_nuits=5,
    )
    db_session.add_all([seg1, seg2])
    db_session.commit()
    db_session.refresh(seg1)
    db_session.refresh(seg2)

    return {
        'op': op, 'id_mission': op.id_operation,
        'seg1': seg1, 'seg2': seg2,
        'emp': emp, 'headers': auth_headers(emp.matricule, 'EMPLOYE'),
        'd0': d0, 'd1': d1, 'd2': d2,
    }


# ── POST add one segment ────────────────────────────────────────────────────

class TestAddSegment:
    @patch('app.utils.world_geo_service.validate_country_city', side_effect=lambda **kw: _geo_ok(**kw))
    def test_ajoute_segment_ordre_suivant(self, _geo, client, mission_multi, db_session):
        from app import models
        s = mission_multi
        d_start = s['d2']
        d_end = s['d2'] + timedelta(days=2)
        r = client.post(
            f"/api/missions/{s['id_mission']}/segments",
            json={"pays": "Cameroun", "ville": "Yaoundé",
                  "date_debut": str(d_start), "date_fin": str(d_end),
                  "moyen_transport": "routier"},
            headers=s['headers'],
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body['ordre'] == 3
        assert body['ville'] == 'Yaoundé'
        assert body['moyen_transport'] == 'routier'
        count = db_session.query(models.MissionSegment).filter(
            models.MissionSegment.id_mission == s['id_mission']
        ).count()
        assert count == 3

    def test_ajoute_segment_403_autre_user(self, client, mission_multi, seed_reference_data, auth_headers):
        s = mission_multi
        other = seed_reference_data['responsable']
        r = client.post(
            f"/api/missions/{s['id_mission']}/segments",
            json={"pays": "Cameroun", "ville": "Douala",
                  "date_debut": str(s['d0']), "date_fin": str(s['d1'])},
            headers=auth_headers(other.matricule, 'RESPONSABLE'),
        )
        assert r.status_code == 403

    def test_ajoute_segment_409_si_deja_validee(self, client, mission_multi, db_session):
        from app import models
        s = mission_multi
        s['op'].statut = 'validé'
        db_session.commit()
        r = client.post(
            f"/api/missions/{s['id_mission']}/segments",
            json={"pays": "Cameroun", "ville": "Douala",
                  "date_debut": str(s['d0']), "date_fin": str(s['d1'])},
            headers=s['headers'],
        )
        assert r.status_code == 400


# ── PATCH modify one segment ────────────────────────────────────────────────

class TestPatchSegment:
    @patch('app.utils.world_geo_service.validate_country_city', side_effect=lambda **kw: _geo_ok(**kw))
    def test_patch_partiel_ville(self, _geo, client, mission_multi, db_session):
        from app import models
        s = mission_multi
        r = client.patch(
            f"/api/missions/{s['id_mission']}/segments/{s['seg2'].id_segment}",
            json={"ville": "Lyon"},
            headers=s['headers'],
        )
        assert r.status_code == 200, r.text
        assert r.json()['ville'] == 'Lyon'
        # ordre et dates inchangés
        db_session.expire_all()
        seg = db_session.query(models.MissionSegment).get(s['seg2'].id_segment)
        assert seg.ordre == 2
        assert seg.date_debut == s['d1']

    def test_patch_dates_recalcule_nombre_nuits(self, client, mission_multi, db_session):
        from app import models
        s = mission_multi
        new_end = s['d2'] + timedelta(days=10)
        r = client.patch(
            f"/api/missions/{s['id_mission']}/segments/{s['seg2'].id_segment}",
            json={"date_fin": str(new_end)},
            headers=s['headers'],
        )
        assert r.status_code == 200, r.text
        db_session.expire_all()
        seg = db_session.query(models.MissionSegment).get(s['seg2'].id_segment)
        assert seg.nombre_nuits == (new_end - s['d1']).days

    def test_patch_segment_inexistant(self, client, mission_multi):
        s = mission_multi
        r = client.patch(
            f"/api/missions/{s['id_mission']}/segments/99999",
            json={"ville": "Nowhere"},
            headers=s['headers'],
        )
        assert r.status_code == 404

    def test_patch_refuse_apres_validation(self, client, mission_multi, db_session):
        s = mission_multi
        s['op'].statut = 'validé'
        db_session.commit()
        r = client.patch(
            f"/api/missions/{s['id_mission']}/segments/{s['seg1'].id_segment}",
            json={"ville": "X"},
            headers=s['headers'],
        )
        assert r.status_code == 400


# ── DELETE one segment ──────────────────────────────────────────────────────

class TestDeleteSegment:
    def test_supprime_segment_et_recompacte_ordres(self, client, mission_multi, db_session):
        from app import models
        s = mission_multi
        # Ajouter un 3e segment pour pouvoir supprimer le 2e
        seg3 = models.MissionSegment(
            id_mission=s['id_mission'], pays='Cameroun', ville='Kribi',
            date_debut=s['d2'], date_fin=s['d2'] + timedelta(days=1), ordre=3,
            moyen_transport='routier', nombre_nuits=1,
        )
        db_session.add(seg3)
        db_session.commit()
        db_session.refresh(seg3)

        r = client.delete(
            f"/api/missions/{s['id_mission']}/segments/{s['seg2'].id_segment}",
            headers=s['headers'],
        )
        assert r.status_code == 200, r.text
        assert r.json()['segments_restants'] == 2

        db_session.expire_all()
        restants = db_session.query(models.MissionSegment).filter(
            models.MissionSegment.id_mission == s['id_mission']
        ).order_by(models.MissionSegment.ordre).all()
        assert [x.ordre for x in restants] == [1, 2]
        # seg3 doit être rétrogradé à l'ordre 2
        assert any(x.id_segment == seg3.id_segment and x.ordre == 2 for x in restants)

    def test_supprime_refuse_si_dernier_segment(self, client, mission_multi, db_session):
        from app import models
        s = mission_multi
        # Supprimer d'abord seg2 directement en DB pour ne laisser que seg1
        db_session.query(models.MissionSegment).filter(
            models.MissionSegment.id_segment == s['seg2'].id_segment
        ).delete()
        db_session.commit()

        r = client.delete(
            f"/api/missions/{s['id_mission']}/segments/{s['seg1'].id_segment}",
            headers=s['headers'],
        )
        assert r.status_code == 400
        assert "dernier" in r.json()['detail'].lower()

    def test_supprime_detache_frais_associes(self, client, mission_multi, db_session):
        """Les frais liés au segment supprimé doivent voir id_segment→NULL."""
        from app import models
        s = mission_multi

        miss = models.MissionnairesMission(
            id_mission=s['id_mission'], matricule=s['emp'].matricule,
            role_mission='responsable',
        )
        db_session.add(miss)
        frais = models.FraisMissionnaire(
            id_mission=s['id_mission'], matricule=s['emp'].matricule,
            id_segment=s['seg2'].id_segment,
            frais_transport=100, frais_hotel=0, frais_deplacement=0, frais_nutrition=0,
            total_frais=100,
        )
        db_session.add(frais)
        db_session.commit()
        frais_id = frais.id

        r = client.delete(
            f"/api/missions/{s['id_mission']}/segments/{s['seg2'].id_segment}",
            headers=s['headers'],
        )
        assert r.status_code == 200, r.text

        db_session.expire_all()
        f = db_session.query(models.FraisMissionnaire).get(frais_id)
        assert f is not None, "Les frais ne doivent PAS être supprimés"
        assert f.id_segment is None

    def test_supprime_segment_inexistant(self, client, mission_multi):
        s = mission_multi
        r = client.delete(
            f"/api/missions/{s['id_mission']}/segments/99999",
            headers=s['headers'],
        )
        assert r.status_code == 404

    def test_supprime_refuse_apres_validation(self, client, mission_multi, db_session):
        s = mission_multi
        s['op'].statut = 'validé'
        db_session.commit()
        r = client.delete(
            f"/api/missions/{s['id_mission']}/segments/{s['seg1'].id_segment}",
            headers=s['headers'],
        )
        assert r.status_code == 400
