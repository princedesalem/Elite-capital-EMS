"""
Tests pour le flux Demander/accepter (RemplacantPropose.demande_envoyee)
"""
import pytest
from datetime import date
from fastapi.testclient import TestClient
from app import models
from app.utils.security import create_access_token


@pytest.fixture()
def seed_proposition(db_session, seed_reference_data):
    """Crée une proposition de remplacement (non encore demandée)."""
    refs = seed_reference_data

    # candidat remplaçant
    candidat = models.Employe(
        matricule=8001,
        nom='Candidat', prenom='Test',
        email='8001@example.com',
        date_embauche=date(2024, 1, 1),
        dept_id=refs['departement'].dept_id,
        id_direction=refs['direction'].id_direction,
        id_entite=refs['entite'].id_entite,
        id_role=refs['roles']['EMPLOYE'].id,
        fonction='Agent',
        sexe='M',
        statut_employe=models.StatutEmployeEnum.ACTIF,
    )
    db_session.add(candidat)
    db_session.flush()

    prop = models.RemplacantPropose(
        id_operation=refs['operation'].id_operation,
        matricule_remplacant=candidat.matricule,
        ordre_proposition=1,
        est_accepte=False,
        demande_envoyee=False,
    )
    db_session.add(prop)
    db_session.commit()
    db_session.refresh(prop)
    return {**refs, 'candidat': candidat, 'prop': prop}


def _rh_token(refs):
    return create_access_token({'matricule': refs['rh'].matricule, 'role': 'RH'})


class TestDemanderFlow:
    def test_demander_sets_flag(self, client, db_session, seed_proposition):
        refs = seed_proposition
        token = _rh_token(refs)
        op_id = refs['operation'].id_operation
        mat = refs['candidat'].matricule

        r = client.post(
            f'/api/remplacants/{op_id}/demander/{mat}',
            headers={'Authorization': f'Bearer {token}'}
        )
        assert r.status_code == 200

        db_session.expire_all()
        prop = db_session.query(models.RemplacantPropose).filter_by(
            id_operation=op_id, matricule_remplacant=mat
        ).first()
        assert prop.demande_envoyee is True

    def test_demander_sends_notification(self, client, db_session, seed_proposition):
        refs = seed_proposition
        token = _rh_token(refs)
        op_id = refs['operation'].id_operation
        mat = refs['candidat'].matricule

        client.post(
            f'/api/remplacants/{op_id}/demander/{mat}',
            headers={'Authorization': f'Bearer {token}'}
        )

        notif = db_session.query(models.Notification).filter_by(
            matricule=mat
        ).first()
        assert notif is not None
        assert 'remplacement' in notif.titre.lower() or 'rempla' in notif.message.lower()

    def test_demander_404_if_not_proposed(self, client, seed_proposition):
        refs = seed_proposition
        token = _rh_token(refs)
        op_id = refs['operation'].id_operation

        r = client.post(
            f'/api/remplacants/{op_id}/demander/99999',
            headers={'Authorization': f'Bearer {token}'}
        )
        assert r.status_code == 404

    def test_demander_requires_auth(self, client, seed_proposition):
        refs = seed_proposition
        op_id = refs['operation'].id_operation
        mat = refs['candidat'].matricule

        r = client.post(f'/api/remplacants/{op_id}/demander/{mat}')
        assert r.status_code == 401

    def test_mes_demandes_returns_pending(self, client, db_session, seed_proposition):
        refs = seed_proposition
        op_id = refs['operation'].id_operation
        mat = refs['candidat'].matricule
        token = _rh_token(refs)

        # Envoyer la demande d'abord
        client.post(
            f'/api/remplacants/{op_id}/demander/{mat}',
            headers={'Authorization': f'Bearer {token}'}
        )

        r = client.get(f'/api/remplacants/mes-demandes/{mat}')
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert any(d['id_operation'] == op_id for d in data)

    def test_mes_demandes_excludes_accepted(self, client, db_session, seed_proposition):
        refs = seed_proposition
        op_id = refs['operation'].id_operation
        mat = refs['candidat'].matricule

        # Marquer comme demandé ET accepté
        prop = refs['prop']
        prop.demande_envoyee = True
        prop.est_accepte = True
        db_session.commit()

        r = client.get(f'/api/remplacants/mes-demandes/{mat}')
        assert r.status_code == 200
        data = r.json()
        # Ne doit pas apparaître car déjà accepté
        assert not any(d['id_operation'] == op_id for d in data)

    def test_propositions_includes_demande_envoyee(self, client, seed_proposition):
        refs = seed_proposition
        op_id = refs['operation'].id_operation

        r = client.get(f'/api/remplacants/propositions/{op_id}')
        assert r.status_code == 200
        data = r.json()
        assert len(data) >= 1
        # Chaque item doit avoir demande_envoyee
        for item in data:
            assert 'demande_envoyee' in item
