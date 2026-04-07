"""Tests for retour anticipé: solde restoration and date validation."""
from datetime import date, datetime
from decimal import Decimal

from app import models
from app.utils import activation_cloture


def _create_active_operation(db_session, refs, *, matricule=None, date_retour=None):
    """Create a validated+activated operation ready for cloture."""
    mat = matricule or refs['employe'].matricule
    ret = date_retour or date(2026, 4, 20)
    operation = models.Operation(
        matricule=mat,
        type_demande='Congé',
        titre='Op retour anticipé',
        statut='validé',
        date_debut=date(2026, 4, 10),
        date_fin=ret,
        date_depart=date(2026, 4, 10),
        date_retour=ret,
        duree_jours=7,
        duree=7,
        motif='Test retour anticipé',
    )
    db_session.add(operation)
    db_session.flush()
    # Complete activation
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


def test_retour_anticipe_restores_solde(db_session, seed_reference_data):
    """Retour anticipé should restore remaining working days to employee solde."""
    refs = seed_reference_data
    employe = refs['employe']

    # Set initial solde
    employe.solde_conges = Decimal('10.00')
    db_session.commit()

    operation = _create_active_operation(
        db_session, refs,
        date_retour=date(2026, 4, 20)  # Original return: April 20
    )

    # Return early on April 15 (5 working days before April 20)
    success, message = activation_cloture.cloturer_operation_demandeur(
        operation.id_operation,
        employe.matricule,
        db_session,
        retour_anticipe=True,
        date_retour_anticipe=date(2026, 4, 15),
    )

    assert success is True

    db_session.refresh(employe)
    db_session.refresh(operation)

    # Solde should have increased (exact amount depends on calculer_jours_ouvrables)
    assert employe.solde_conges > Decimal('10.00')
    assert operation.retour_anticipe is True
    assert operation.date_retour_anticipe == date(2026, 4, 15)


def test_retour_anticipe_rejected_when_date_not_before_retour(db_session, seed_reference_data):
    """Retour anticipé should fail if date_retour_anticipe >= date_retour."""
    refs = seed_reference_data
    operation = _create_active_operation(
        db_session, refs,
        date_retour=date(2026, 4, 15)
    )

    # Try with same date as retour
    success, message = activation_cloture.cloturer_operation_demandeur(
        operation.id_operation,
        refs['employe'].matricule,
        db_session,
        retour_anticipe=True,
        date_retour_anticipe=date(2026, 4, 15),
    )

    assert success is False
    assert 'antérieure' in message.lower()


def test_retour_anticipe_rejected_when_date_after_retour(db_session, seed_reference_data):
    """Retour anticipé should fail if date_retour_anticipe > date_retour."""
    refs = seed_reference_data
    operation = _create_active_operation(
        db_session, refs,
        date_retour=date(2026, 4, 15)
    )

    success, message = activation_cloture.cloturer_operation_demandeur(
        operation.id_operation,
        refs['employe'].matricule,
        db_session,
        retour_anticipe=True,
        date_retour_anticipe=date(2026, 4, 20),
    )

    assert success is False
    assert 'antérieure' in message.lower()


def test_retour_anticipe_rejected_without_date(db_session, seed_reference_data):
    """Retour anticipé should fail if date_retour_anticipe is not provided."""
    refs = seed_reference_data
    operation = _create_active_operation(db_session, refs)

    success, message = activation_cloture.cloturer_operation_demandeur(
        operation.id_operation,
        refs['employe'].matricule,
        db_session,
        retour_anticipe=True,
        date_retour_anticipe=None,
    )

    assert success is False
    assert 'antérieure' in message.lower()


def test_retour_anticipe_rh_auto_cloture(db_session, seed_reference_data):
    """Retour anticipé by RH should auto-complete cloture AND restore solde."""
    refs = seed_reference_data
    rh = refs['rh']
    rh.solde_conges = Decimal('15.00')
    db_session.commit()

    operation = _create_active_operation(
        db_session, refs,
        matricule=rh.matricule,
        date_retour=date(2026, 4, 20),
    )

    success, message = activation_cloture.cloturer_operation_demandeur(
        operation.id_operation,
        rh.matricule,
        db_session,
        retour_anticipe=True,
        date_retour_anticipe=date(2026, 4, 15),
    )

    assert success is True

    cloture = db_session.query(models.Activation).filter(
        models.Activation.id_operation == operation.id_operation,
        models.Activation.type_action == models.TypeActionEnum.CLOTURE,
    ).first()

    assert cloture.rh_fait is True
    assert cloture.statut_final == models.StatutFinalEnum.COMPLETE

    db_session.refresh(rh)
    assert rh.solde_conges > Decimal('15.00')
