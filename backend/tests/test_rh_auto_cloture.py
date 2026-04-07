"""Tests for RH auto-cloture (mirrors auto-activation)."""
from datetime import date, datetime

from app import models
from app.utils import activation_cloture


def _create_operation(db_session, refs, *, matricule=None):
    operation = models.Operation(
        matricule=matricule or refs['employe'].matricule,
        type_demande='Congé',
        titre='Op test cloture',
        statut='validé',
        date_debut=date(2026, 4, 10),
        date_fin=date(2026, 4, 15),
        date_depart=date(2026, 4, 10),
        date_retour=date(2026, 4, 15),
        duree_jours=4,
        duree=4,
        motif='Test',
    )
    db_session.add(operation)
    db_session.flush()
    # Add completed activation so cloture is allowed
    activation = models.Activation(
        id_operation=operation.id_operation,
        type_action=models.TypeActionEnum.ACTIVATION,
        demandeur_fait=True,
        date_demandeur=datetime.now(),
        rh_fait=True,
        date_rh=datetime.now(),
        statut_final=models.StatutFinalEnum.COMPLETE,
    )
    db_session.add(activation)
    db_session.commit()
    db_session.refresh(operation)
    return operation


def test_rh_auto_cloture_completes_immediately(db_session, seed_reference_data):
    """When the demandeur is RH, cloture should auto-complete (rh_fait=True, COMPLETE)."""
    refs = seed_reference_data
    operation = _create_operation(db_session, refs, matricule=refs['rh'].matricule)

    success, message = activation_cloture.cloturer_operation_demandeur(
        operation.id_operation, refs['rh'].matricule, db_session
    )

    cloture = db_session.query(models.Activation).filter(
        models.Activation.id_operation == operation.id_operation,
        models.Activation.type_action == models.TypeActionEnum.CLOTURE,
    ).first()

    assert success is True
    assert 'auto-confirmation' in message.lower() or 'complète' in message.lower()
    assert cloture is not None
    assert cloture.demandeur_fait is True
    assert cloture.rh_fait is True
    assert cloture.statut_final == models.StatutFinalEnum.COMPLETE
    assert cloture.date_rh is not None

    # No RH notification should be created for self-service
    notifs = db_session.query(models.Notification).filter(
        models.Notification.id_operation == operation.id_operation,
        models.Notification.titre.contains('Clôture')
    ).all()
    assert len(notifs) == 0


def test_non_rh_cloture_stays_en_attente(db_session, seed_reference_data):
    """When a normal employee clôtures, it stays EN_ATTENTE for RH confirmation."""
    refs = seed_reference_data
    operation = _create_operation(db_session, refs, matricule=refs['employe'].matricule)

    success, message = activation_cloture.cloturer_operation_demandeur(
        operation.id_operation, refs['employe'].matricule, db_session
    )

    cloture = db_session.query(models.Activation).filter(
        models.Activation.id_operation == operation.id_operation,
        models.Activation.type_action == models.TypeActionEnum.CLOTURE,
    ).first()

    assert success is True
    assert 'attente' in message.lower()
    assert cloture is not None
    assert cloture.demandeur_fait is True
    assert cloture.rh_fait is False
    assert cloture.statut_final == models.StatutFinalEnum.EN_ATTENTE
    assert cloture.date_rh is None


def test_rh_auto_cloture_no_duplicate(db_session, seed_reference_data):
    """Cannot cloture twice."""
    refs = seed_reference_data
    operation = _create_operation(db_session, refs, matricule=refs['rh'].matricule)

    success1, _ = activation_cloture.cloturer_operation_demandeur(
        operation.id_operation, refs['rh'].matricule, db_session
    )
    success2, msg2 = activation_cloture.cloturer_operation_demandeur(
        operation.id_operation, refs['rh'].matricule, db_session
    )

    assert success1 is True
    assert success2 is False
    assert 'déjà' in msg2.lower()
