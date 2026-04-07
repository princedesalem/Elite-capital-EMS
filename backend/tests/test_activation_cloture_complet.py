from datetime import date, datetime

from app import models
from app.routers import workflow_router
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



def _create_operation(db_session, refs, *, matricule=None, type_demande='Congé', duree=3):
    operation = models.Operation(
        matricule=matricule or refs['employe'].matricule,
        type_demande=type_demande,
        titre='Operation test',
        statut='en attente',
        date_debut=date(2026, 4, 10),
        date_fin=date(2026, 4, 12),
        date_depart=date(2026, 4, 10),
        date_retour=date(2026, 4, 12),
        duree_jours=3,
        duree=duree,
        motif='Repos test',
    )
    db_session.add(operation)
    db_session.flush()
    db_session.commit()
    db_session.refresh(operation)
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



def test_auto_activation_completes_immediately_for_rh_demandeur(db_session, seed_reference_data):
    refs = seed_reference_data
    operation = _create_operation(db_session, refs, matricule=refs['rh'].matricule)

    success, message = activation_cloture.activer_operation_auto_apres_validation(
        operation.id_operation,
        refs['rh'].matricule,
        db_session,
    )

    activation = db_session.query(models.Activation).filter(
        models.Activation.id_operation == operation.id_operation,
        models.Activation.type_action == models.TypeActionEnum.ACTIVATION,
    ).first()
    notifications = db_session.query(models.Notification).filter(
        models.Notification.id_operation == operation.id_operation
    ).all()

    assert success is True, message
    assert activation is not None
    assert activation.demandeur_fait is True
    assert activation.rh_fait is True
    assert activation.statut_final == models.StatutFinalEnum.COMPLETE
    assert activation.date_demandeur is not None
    assert activation.date_rh is not None
    assert notifications == []



def test_workflow_serializer_exposes_activation_cloture_and_validation_metadata(db_session, seed_reference_data):
    refs = seed_reference_data
    operation = _create_operation(db_session, refs)

    validation = models.Validation(
        id_operation=operation.id_operation,
        matricule_validateur=refs['rh'].matricule,
        role_validateur='RH',
        statut_validation='validé',
        commentaire='ok',
        timestamp_action=datetime(2026, 4, 12, 9, 30, 0),
    )
    activation = models.Activation(
        id_operation=operation.id_operation,
        type_action=models.TypeActionEnum.ACTIVATION,
        demandeur_fait=True,
        date_demandeur=datetime(2026, 4, 12, 10, 0, 0),
        rh_fait=True,
        date_rh=datetime(2026, 4, 12, 10, 15, 0),
        statut_final=models.StatutFinalEnum.COMPLETE,
    )
    cloture = models.Activation(
        id_operation=operation.id_operation,
        type_action=models.TypeActionEnum.CLOTURE,
        demandeur_fait=True,
        date_demandeur=datetime(2026, 4, 13, 18, 0, 0),
        rh_fait=True,
        date_rh=datetime(2026, 4, 13, 18, 30, 0),
        statut_final=models.StatutFinalEnum.COMPLETE,
    )
    db_session.add(validation)
    db_session.add(activation)
    db_session.add(cloture)
    db_session.commit()

    payload = workflow_router._serialize_operation_with_demandeur(operation, db_session)

    assert payload['activation_demandeur_fait'] is True
    assert payload['activation_rh_fait'] is True
    assert payload['activation_complete'] is True
    assert payload['activation_date_demandeur'].startswith('2026-04-12 10:00:00')
    assert payload['cloture_demandeur_fait'] is True
    assert payload['cloture_rh_fait'] is True
    assert payload['cloture_complete'] is True
    assert payload['cloture_date_rh'].startswith('2026-04-13 18:30:00')
    assert payload['dernier_validateur_nom'] == 'One Rh'
    assert payload['derniere_validation_date'].startswith('2026-04-12 09:30:00')



def test_mes_demandes_returns_activation_metadata_after_final_validation(client, db_session, seed_reference_data):
    refs = seed_reference_data
    operation = _create_operation(db_session, refs)

    _validate_until_completion(db_session, refs, operation)

    response = client.get(f'/api/workflow/mes-demandes/{refs["employe"].matricule}')

    assert response.status_code == 200
    data = response.json()
    item = next(row for row in data if row['id_operation'] == operation.id_operation)

    assert item['statut'] == 'validé'
    assert item['validation_terminee'] is True
    assert item['activation_demandeur_fait'] is False
    assert item['activation_rh_fait'] is False
    assert item['activation_complete'] is False
