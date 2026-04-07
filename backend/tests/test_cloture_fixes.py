"""Tests for 400 fix: activation check fallback + date_retour fallback for congés."""
from datetime import date, datetime
from decimal import Decimal

from app import models
from app.utils import activation_cloture


def _create_operation_with_stale_activation(db_session, refs, *, statut_final='EN_ATTENTE'):
    """Create an operation where activation has rh_fait=True but stale statut_final."""
    operation = models.Operation(
        matricule=refs['employe'].matricule,
        type_demande='Congé',
        titre='Op stale activation',
        statut='validé',
        date_debut=date(2026, 4, 10),
        date_fin=date(2026, 4, 20),
        date_depart=date(2026, 4, 10),
        date_retour=date(2026, 4, 20),
        duree_jours=7,
        duree=7,
        motif='Test stale activation',
    )
    db_session.add(operation)
    db_session.flush()
    # Activation with rh_fait=True but stale statut_final=EN_ATTENTE
    activation = models.Activation(
        id_operation=operation.id_operation,
        type_action=models.TypeActionEnum.ACTIVATION,
        demandeur_fait=True,
        date_demandeur=datetime.now(),
        rh_fait=True,
        date_rh=datetime.now(),
        statut_final=models.StatutFinalEnum[statut_final],
    )
    db_session.add(activation)
    db_session.commit()
    db_session.refresh(operation)
    return operation


def test_cloture_with_stale_statut_final(db_session, seed_reference_data):
    """Operation with rh_fait=True but statut_final=EN_ATTENTE should still allow cloture."""
    refs = seed_reference_data
    op = _create_operation_with_stale_activation(db_session, refs, statut_final='EN_ATTENTE')

    success, message = activation_cloture.cloturer_operation_demandeur(
        op.id_operation, refs['employe'].matricule, db_session
    )

    assert success is True, f"Expected success but got: {message}"


def test_cloture_with_complete_statut_final_still_works(db_session, seed_reference_data):
    """Operation with statut_final=COMPLETE should still work as before."""
    refs = seed_reference_data
    op = _create_operation_with_stale_activation(db_session, refs, statut_final='COMPLETE')

    success, message = activation_cloture.cloturer_operation_demandeur(
        op.id_operation, refs['employe'].matricule, db_session
    )

    assert success is True, f"Expected success but got: {message}"


def test_cloture_rejected_without_rh_fait(db_session, seed_reference_data):
    """Operation where rh_fait is still False should be rejected."""
    refs = seed_reference_data
    operation = models.Operation(
        matricule=refs['employe'].matricule,
        type_demande='Congé',
        titre='Op no rh',
        statut='validé',
        date_debut=date(2026, 4, 10),
        date_fin=date(2026, 4, 20),
        date_depart=date(2026, 4, 10),
        date_retour=date(2026, 4, 20),
        duree_jours=7,
        duree=7,
        motif='Test no rh',
    )
    db_session.add(operation)
    db_session.flush()
    # Activation with rh_fait=False
    activation = models.Activation(
        id_operation=operation.id_operation,
        type_action=models.TypeActionEnum.ACTIVATION,
        demandeur_fait=True,
        date_demandeur=datetime.now(),
        rh_fait=False,
        statut_final=models.StatutFinalEnum.EN_ATTENTE,
    )
    db_session.add(activation)
    db_session.commit()

    success, message = activation_cloture.cloturer_operation_demandeur(
        operation.id_operation, refs['employe'].matricule, db_session
    )

    assert success is False
    assert "activée" in message.lower()


def test_retour_anticipe_uses_date_fin_when_date_retour_is_none(db_session, seed_reference_data):
    """When date_retour is None (congés), retour anticipé should use date_fin as fallback."""
    refs = seed_reference_data
    employe = refs['employe']
    employe.solde_conges = Decimal('10.00')
    db_session.commit()

    # Create operation with date_retour=None (like a standard congé)
    operation = models.Operation(
        matricule=employe.matricule,
        type_demande='Congé',
        titre='Op date_fin fallback',
        statut='validé',
        date_debut=date(2026, 4, 10),
        date_fin=date(2026, 4, 25),
        date_depart=date(2026, 4, 10),
        date_retour=None,  # NULL — congé uses date_fin
        duree_jours=12,
        duree=12,
        motif='Test date_fin fallback',
    )
    db_session.add(operation)
    db_session.flush()
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

    # Retour anticipé on April 15 (before date_fin April 25)
    success, message = activation_cloture.cloturer_operation_demandeur(
        operation.id_operation, employe.matricule, db_session,
        retour_anticipe=True, date_retour_anticipe=date(2026, 4, 15)
    )

    assert success is True, f"Expected success but got: {message}"
    assert operation.retour_anticipe is True
    assert operation.date_retour_anticipe == date(2026, 4, 15)
    # Solde should have been restored for remaining days
    db_session.refresh(employe)
    assert employe.solde_conges > Decimal('10.00')
