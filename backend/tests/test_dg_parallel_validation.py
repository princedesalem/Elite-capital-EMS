"""
Tests pour la validation DG en parallèle strict :
- À l'arrivée à l'étape DG, tous les DG actifs reçoivent simultanément une
  notification VALIDATION non lue.
- Quand un DG valide, sa notification est marquée lue, mais celle des autres
  DG reste intacte (pas de doublon non plus).
- Quand un DG refuse, l'opération est rejetée et toutes les notifications DG
  en attente sont archivées.
- Tant que tous les DG n'ont pas validé, l'opération ne passe pas à PCA/AG.
"""
from datetime import date

import pytest

from app import models
from app.utils import workflow as wf
from app.utils.notifications import notifier_prochain_validateur

# Réutilise la fixture org_multi_dg du module voisin.
from .test_multi_dg_workflow import org_multi_dg, _make_op  # noqa: F401


def _notifs_dg_pending(db, id_op, matricules_dg):
    return db.query(models.Notification).filter(
        models.Notification.id_operation == id_op,
        models.Notification.matricule.in_(matricules_dg),
        models.Notification.type_notification == models.TypeNotificationEnum.VALIDATION,
        models.Notification.lue == False,  # noqa: E712
    ).all()


def test_etape_dg_cree_n_notifications_simultanees(db_session, org_multi_dg):
    """Lors de la transition vers l'étape DG, les deux DG reçoivent chacun
    une notification VALIDATION non lue, en même temps."""
    op = _make_op(db_session, org_multi_dg['directeur'])

    # RH valide → la fonction de validation crée elle-même les notifs DG
    wf.valider_operation(
        op.id_operation, org_multi_dg['rh'].matricule, 'validé', None, db_session
    )

    matricules_dg = [org_multi_dg['dg1'].matricule, org_multi_dg['dg2'].matricule]
    notifs = _notifs_dg_pending(db_session, op.id_operation, matricules_dg)
    assert {n.matricule for n in notifs} == set(matricules_dg)


def test_premier_dg_valide_second_dg_garde_notif(db_session, org_multi_dg):
    """Après validation du DG1, sa notif est lue, celle du DG2 reste pending,
    aucun doublon n'est créé pour DG2."""
    op = _make_op(db_session, org_multi_dg['directeur'])
    wf.valider_operation(
        op.id_operation, org_multi_dg['rh'].matricule, 'validé', None, db_session
    )
    wf.valider_operation(
        op.id_operation, org_multi_dg['dg1'].matricule, 'validé', None, db_session
    )

    dg1_notifs = db_session.query(models.Notification).filter(
        models.Notification.id_operation == op.id_operation,
        models.Notification.matricule == org_multi_dg['dg1'].matricule,
        models.Notification.type_notification == models.TypeNotificationEnum.VALIDATION,
    ).all()
    # Au moins une notif pour DG1 et toutes lues.
    assert dg1_notifs and all(n.lue for n in dg1_notifs)

    dg2_pending = db_session.query(models.Notification).filter(
        models.Notification.id_operation == op.id_operation,
        models.Notification.matricule == org_multi_dg['dg2'].matricule,
        models.Notification.type_notification == models.TypeNotificationEnum.VALIDATION,
        models.Notification.lue == False,  # noqa: E712
    ).all()
    # Une seule notif non lue pour DG2 (pas de doublon).
    assert len(dg2_pending) == 1

    # L'opération reste en attente.
    db_session.refresh(op)
    assert op.statut == 'en attente'


def test_tous_dg_valident_passe_pca(db_session, org_multi_dg):
    """Quand DG1 ET DG2 valident, le prochain validateur est PCA."""
    op = _make_op(db_session, org_multi_dg['directeur'])
    wf.valider_operation(op.id_operation, org_multi_dg['rh'].matricule, 'validé', None, db_session)
    wf.valider_operation(op.id_operation, org_multi_dg['dg1'].matricule, 'validé', None, db_session)
    wf.valider_operation(op.id_operation, org_multi_dg['dg2'].matricule, 'validé', None, db_session)

    role, _ = wf.obtenir_prochain_validateur(op.id_operation, db_session)
    assert role == 'PCA'

    db_session.refresh(op)
    assert op.statut == 'en attente'  # PCA n'a pas encore validé


def test_un_dg_refuse_op_rejetee_et_notifs_archivees(db_session, org_multi_dg):
    """Si un DG refuse, l'opération passe à 'refusé' et les notifs DG
    pending sont archivées (lue=True)."""
    op = _make_op(db_session, org_multi_dg['directeur'])
    wf.valider_operation(op.id_operation, org_multi_dg['rh'].matricule, 'validé', None, db_session)

    # DG1 refuse
    wf.valider_operation(
        op.id_operation, org_multi_dg['dg1'].matricule, 'refusé', 'Non.', db_session
    )

    db_session.refresh(op)
    assert op.statut == 'refusé'

    matricules_dg = [org_multi_dg['dg1'].matricule, org_multi_dg['dg2'].matricule]
    pending = _notifs_dg_pending(db_session, op.id_operation, matricules_dg)
    assert pending == []


def test_initial_dg_step_notifie_tous_les_dg(db_session, org_multi_dg):
    """notifier_prochain_validateur fanout : pour rôle DG, crée une notif
    par DG actif dans l'app."""
    op = _make_op(db_session, org_multi_dg['directeur'])

    n = notifier_prochain_validateur(
        role='DG',
        matricule=org_multi_dg['dg1'].matricule,
        type_notification=models.TypeNotificationEnum.VALIDATION,
        titre='Test',
        message='msg',
        id_operation=op.id_operation,
        db=db_session,
    )
    assert n == 2

    matricules_dg = [org_multi_dg['dg1'].matricule, org_multi_dg['dg2'].matricule]
    notifs = _notifs_dg_pending(db_session, op.id_operation, matricules_dg)
    assert {x.matricule for x in notifs} == set(matricules_dg)
