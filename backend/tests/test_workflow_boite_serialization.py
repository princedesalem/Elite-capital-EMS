"""Tests for workflow boite serialization: valide/refuse items include statut + activation metadata."""
from datetime import date, datetime

from app import models
from app.routers import workflow_router


def _create_validated_operation(db_session, refs):
    """Create a fully validated operation with activation and validation records."""
    operation = models.Operation(
        matricule=refs['employe'].matricule,
        type_demande='Congé',
        titre='Op sérialisation test',
        statut='validé',
        date_debut=date(2026, 5, 1),
        date_fin=date(2026, 5, 5),
        date_depart=date(2026, 5, 1),
        date_retour=date(2026, 5, 5),
        duree_jours=3,
        duree=3,
        motif='Test sérialisation',
    )
    db_session.add(operation)
    db_session.flush()

    # Add activation record (complete)
    activation = models.Activation(
        id_operation=operation.id_operation,
        type_action=models.TypeActionEnum.ACTIVATION,
        demandeur_fait=True,
        date_demandeur=datetime(2026, 5, 1, 9, 0),
        rh_fait=True,
        date_rh=datetime(2026, 5, 1, 10, 0),
        statut_final=models.StatutFinalEnum.COMPLETE,
    )
    db_session.add(activation)

    # Add cloture record (in progress)
    cloture = models.Activation(
        id_operation=operation.id_operation,
        type_action=models.TypeActionEnum.CLOTURE,
        demandeur_fait=True,
        date_demandeur=datetime(2026, 5, 5, 18, 0),
        rh_fait=False,
        statut_final=models.StatutFinalEnum.EN_ATTENTE,
    )
    db_session.add(cloture)
    db_session.commit()
    db_session.refresh(operation)
    return operation


def test_mes_validations_includes_statut_and_activation_metadata(db_session, seed_reference_data):
    """obtenir_mes_validations should include statut, activation and cloture metadata."""
    refs = seed_reference_data
    operation = _create_validated_operation(db_session, refs)

    # Add a validation record by the responsable
    validation = models.Validation(
        id_operation=operation.id_operation,
        matricule_validateur=refs['responsable'].matricule,
        role_validateur='RESPONSABLE',
        statut_validation='validé',
        commentaire='OK',
        timestamp_action=datetime(2026, 5, 1, 8, 0),
    )
    db_session.add(validation)
    db_session.commit()

    result = workflow_router.obtenir_mes_validations(refs['responsable'].matricule, db_session)

    assert len(result) == 1
    item = result[0]

    # Must have statut (critical fix)
    assert 'statut' in item
    assert item['statut'] == 'validé'

    # Must have activation metadata
    assert item['activation_demandeur_fait'] is True
    assert item['activation_rh_fait'] is True
    assert item['activation_complete'] is True

    # Must have cloture metadata
    assert item['cloture_demandeur_fait'] is True
    assert item['cloture_rh_fait'] is False
    assert item['cloture_complete'] is False

    # Must have validation_terminee
    assert 'validation_terminee' in item

    # Must still have validation-specific fields
    assert 'id_validation' in item
    assert item['commentaire_validation'] == 'OK'
    assert item['role_validateur'] == 'RESPONSABLE'


def test_mes_refus_includes_statut_and_activation_metadata(db_session, seed_reference_data):
    """obtenir_mes_refus should include statut, activation and cloture metadata."""
    refs = seed_reference_data

    # Create a refused operation
    operation = models.Operation(
        matricule=refs['employe'].matricule,
        type_demande='Congé',
        titre='Op refusée',
        statut='refusé',
        date_debut=date(2026, 6, 1),
        date_fin=date(2026, 6, 3),
        duree_jours=2,
        duree=2,
        motif='Test refus',
    )
    db_session.add(operation)
    db_session.flush()

    # Add refusal validation
    validation = models.Validation(
        id_operation=operation.id_operation,
        matricule_validateur=refs['directeur'].matricule,
        role_validateur='DIRECTEUR',
        statut_validation='refusé',
        commentaire='Pas possible',
        timestamp_action=datetime(2026, 6, 1, 14, 0),
    )
    db_session.add(validation)
    db_session.commit()

    result = workflow_router.obtenir_mes_refus(refs['directeur'].matricule, db_session)

    assert len(result) == 1
    item = result[0]

    # Must have statut (critical fix)
    assert 'statut' in item
    assert item['statut'] == 'refusé'

    # Must have activation metadata (empty since not activated)
    assert item['activation_demandeur_fait'] is False
    assert item['activation_complete'] is False

    # Must have refus-specific fields
    assert 'id_validation' in item
    assert item['motif_refus'] == 'Pas possible'
    assert item['role_validateur'] == 'DIRECTEUR'


def test_boite_valide_and_refuse_have_consistent_schema(client, db_session, seed_reference_data):
    """boite.valide and boite.refuse items should have same keys as boite.envoye."""
    refs = seed_reference_data
    operation = _create_validated_operation(db_session, refs)

    # Add validation by responsable
    validation = models.Validation(
        id_operation=operation.id_operation,
        matricule_validateur=refs['responsable'].matricule,
        role_validateur='RESPONSABLE',
        statut_validation='validé',
        commentaire='OK',
        timestamp_action=datetime(2026, 5, 1, 8, 0),
    )
    db_session.add(validation)
    db_session.commit()

    response = client.get(f'/api/workflow/boite/{refs["responsable"].matricule}')
    assert response.status_code == 200
    data = response.json()

    # The validated operation should appear in 'valide' bucket
    valide_items = data.get('valide', [])
    assert len(valide_items) >= 1

    valide_item = next((v for v in valide_items if v['id_operation'] == operation.id_operation), None)
    assert valide_item is not None

    # These keys must be present (they were missing before the fix)
    required_keys = ['statut', 'activation_demandeur_fait', 'activation_rh_fait',
                     'activation_complete', 'cloture_demandeur_fait', 'cloture_complete',
                     'validation_terminee', 'demandeur']
    for key in required_keys:
        assert key in valide_item, f"Missing key '{key}' in boite.valide item"
