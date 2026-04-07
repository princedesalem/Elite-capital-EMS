from datetime import date
from decimal import Decimal

from app import models
from app.utils import activation_cloture, workflow as wf_utils
from app.utils.security import hash_password


def _add_role_if_missing(db_session, name):
    role = db_session.query(models.Role).filter(models.Role.name == name).first()
    if role:
        return role

    role = models.Role(name=name, description=f'Role {name}')
    db_session.add(role)
    db_session.flush()
    return role


def _add_user(db_session, refs, matricule, role_name, nom, prenom):
    role = _add_role_if_missing(db_session, role_name)
    employe = models.Employe(
        matricule=matricule,
        nom=nom,
        prenom=prenom,
        email=f'{matricule}@example.com',
        date_embauche=date(2024, 1, 1),
        dept_id=refs['departement'].dept_id,
        id_direction=refs['direction'].id_direction,
        id_entite=refs['entite'].id_entite,
        id_role=role.id,
        fonction=role_name,
        sexe='M',
    )
    db_session.add(employe)
    db_session.flush()

    user = models.Utilisateur(
        matricule=matricule,
        email=f'{matricule}@example.com',
        role_id=role.id,
        mot_de_passe_hash=hash_password('PasswordTemp123!'),
        mot_de_passe_temporaire=False,
        mfa_enabled=False,
        mfa_active=False,
    )
    db_session.add(user)
    db_session.flush()
    return employe


def _create_conge_operation(db_session, refs, *, duree):
    employe = refs['employe']
    employe.solde_conges = Decimal('10')

    operation = models.Operation(
        matricule=employe.matricule,
        type_demande='Congé',
        titre='Congé annuel',
        statut='en attente',
        date_debut=date(2026, 4, 10),
        date_fin=date(2026, 4, 12),
        date_depart=date(2026, 4, 10),
        date_retour=date(2026, 4, 12),
        duree_jours=3,
        duree=duree,
        motif='Repos',
    )
    db_session.add(operation)
    db_session.flush()
    db_session.add(models.CongesLink(id_conges=operation.id_operation))
    db_session.commit()
    db_session.refresh(operation)
    db_session.refresh(employe)
    return operation


def _validate_until_completion(db_session, refs, operation):
    pca = _add_user(db_session, refs, 6101, 'PCA', 'Pca', 'Final')

    steps = [
        refs['directeur'].matricule,
        refs['rh'].matricule,
        refs['dg'].matricule,
        pca.matricule,
    ]

    for matricule_validateur in steps:
        success, message = wf_utils.valider_operation(
            operation.id_operation,
            matricule_validateur,
            'validé',
            'ok',
            db_session,
        )
        assert success, message

    db_session.expire_all()
    return pca


def test_solde_deducted_when_last_validator_approves(db_session, seed_reference_data):
    """Solde is deducted at final validation. No Activation record created until employee clicks Activer."""
    refs = seed_reference_data
    operation = _create_conge_operation(db_session, refs, duree=3)

    _validate_until_completion(db_session, refs, operation)

    # After validation: solde deducted, but NO activation record yet
    db_session.expire_all()
    employe = db_session.query(models.Employe).filter(models.Employe.matricule == refs['employe'].matricule).first()
    operation = db_session.query(models.Operation).filter(models.Operation.id_operation == operation.id_operation).first()
    activation = db_session.query(models.Activation).filter(models.Activation.id_operation == operation.id_operation).first()

    assert operation.statut == 'validé'
    assert employe.solde_conges == Decimal('7')
    assert operation.solde_deduit is True
    assert activation is None  # employee hasn't clicked Activer yet

    # Employee activates manually
    success, message = activation_cloture.activer_operation_demandeur(operation.id_operation, refs['employe'].matricule, db_session)
    assert success is True, message

    activation = db_session.query(models.Activation).filter(models.Activation.id_operation == operation.id_operation).first()
    assert activation is not None
    assert activation.demandeur_fait is True
    assert activation.rh_fait is False


def test_solde_not_deducted_twice_at_rh_activation(db_session, seed_reference_data):
    """Solde deducted once at demandeur activation; RH activation must not deduct again."""
    refs = seed_reference_data
    operation = _create_conge_operation(db_session, refs, duree=3)

    _validate_until_completion(db_session, refs, operation)
    # Employee activates first (deducts solde)
    activation_cloture.activer_operation_demandeur(operation.id_operation, refs['employe'].matricule, db_session)
    # RH confirms activation
    success, message = activation_cloture.activer_operation_rh(operation.id_operation, refs['rh'].matricule, db_session)

    employe = db_session.query(models.Employe).filter(models.Employe.matricule == refs['employe'].matricule).first()
    operation = db_session.query(models.Operation).filter(models.Operation.id_operation == operation.id_operation).first()

    assert success is True, message
    assert employe.solde_conges == Decimal('7')
    assert operation.solde_deduit is True


def test_rh_activation_succeeds_when_duree_is_none(db_session, seed_reference_data):
    """RH activation succeeds even when duree is None (no solde to deduct)."""
    refs = seed_reference_data
    operation = _create_conge_operation(db_session, refs, duree=None)

    _validate_until_completion(db_session, refs, operation)
    # Employee activates first
    activation_cloture.activer_operation_demandeur(operation.id_operation, refs['employe'].matricule, db_session)
    # RH confirms
    success, message = activation_cloture.activer_operation_rh(operation.id_operation, refs['rh'].matricule, db_session)

    activation = db_session.query(models.Activation).filter(models.Activation.id_operation == operation.id_operation).first()
    employe = db_session.query(models.Employe).filter(models.Employe.matricule == refs['employe'].matricule).first()

    assert success is True, message
    assert activation.statut_final == models.StatutFinalEnum.COMPLETE
    assert employe.solde_conges == Decimal('10')


def test_notification_api_returns_type_demande(client, db_session, seed_reference_data):
    refs = seed_reference_data
    operation = _create_conge_operation(db_session, refs, duree=3)

    notification = models.Notification(
        matricule=refs['employe'].matricule,
        type_notification=models.TypeNotificationEnum.VALIDATION,
        titre='Opération liée',
        message='Notification avec type de demande',
        id_operation=operation.id_operation,
        lue=False,
    )
    db_session.add(notification)
    db_session.commit()

    response = client.get(f'/api/notifications/non-lues/{refs["employe"].matricule}')

    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]['type_demande'] == 'Congé'


def test_full_workflow_end_to_end(db_session, seed_reference_data):
    """Full flow: validate → employee activates (EN_ATTENTE) → RH confirms (COMPLETE)."""
    refs = seed_reference_data
    operation = _create_conge_operation(db_session, refs, duree=3)

    _validate_until_completion(db_session, refs, operation)

    # After validation: no activation record yet
    activation = db_session.query(models.Activation).filter(models.Activation.id_operation == operation.id_operation).first()
    assert activation is None

    # Employee activates manually
    ok, msg = activation_cloture.activer_operation_demandeur(operation.id_operation, refs['employe'].matricule, db_session)
    assert ok is True, msg
    activation = db_session.query(models.Activation).filter(models.Activation.id_operation == operation.id_operation).first()
    assert activation is not None
    assert activation.statut_final == models.StatutFinalEnum.EN_ATTENTE

    # RH confirms
    success, message = activation_cloture.activer_operation_rh(operation.id_operation, refs['rh'].matricule, db_session)
    activation = db_session.query(models.Activation).filter(models.Activation.id_operation == operation.id_operation).first()

    assert success is True, message
    assert activation.demandeur_fait is True
    assert activation.rh_fait is True
    assert activation.statut_final == models.StatutFinalEnum.COMPLETE