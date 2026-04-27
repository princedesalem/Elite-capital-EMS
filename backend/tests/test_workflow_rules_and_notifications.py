from datetime import date, datetime, time

from app import models
from app.utils import world_geo_service


def _add_validation(db_session, id_operation, matricule_validateur, role_validateur, statut='validé'):
    validation = models.Validation(
        id_operation=id_operation,
        matricule_validateur=matricule_validateur,
        role_validateur=role_validateur,
        statut_validation=statut,
        commentaire='ok',
        timestamp_action=datetime.utcnow(),
    )
    db_session.add(validation)
    db_session.commit()
    return validation


def _create_conge_operation(db_session, matricule):
    operation = models.Operation(
        matricule=matricule,
        type_demande='Congé',
        titre='Congé annuel',
        statut='en attente',
        date_debut=date(2026, 4, 6),
        date_fin=date(2026, 4, 8),
        date_depart=date(2026, 4, 6),
        date_retour=date(2026, 4, 8),
        duree_jours=3,
        duree=3,
        motif='Repos',
    )
    db_session.add(operation)
    db_session.flush()
    db_session.add(models.CongesLink(id_conges=operation.id_operation))
    db_session.commit()
    db_session.refresh(operation)
    return operation


def _create_sortie_operation(db_session, matricule):
    operation = models.Operation(
        matricule=matricule,
        type_demande='Sortie',
        titre='Sortie médicale',
        statut='en attente',
        date_debut=date(2026, 4, 6),
        date_fin=date(2026, 4, 6),
        date_depart=date(2026, 4, 6),
        date_retour=date(2026, 4, 6),
        duree_jours=1,
        duree=2,
        motif='Consultation',
    )
    db_session.add(operation)
    db_session.flush()
    db_session.add(models.Sortie(
        matricule=matricule,
        id_operation=operation.id_operation,
        date_sortie=date(2026, 4, 6),
        heure_sortie=time(8, 0),
        commentaire='Consultation | Heure retour: 10:00',
        statut='en attente',
    ))
    db_session.commit()
    db_session.refresh(operation)
    return operation


def _create_mission_operation(db_session, matricule):
    operation = models.Operation(
        matricule=matricule,
        type_demande='Mission',
        titre='Mission client',
        statut='en attente',
        date_debut=date(2026, 5, 10),
        date_fin=date(2026, 5, 12),
        date_depart=date(2026, 5, 10),
        date_retour=date(2026, 5, 12),
        duree_jours=3,
        duree=3,
        motif='Visite client',
    )
    db_session.add(operation)
    db_session.flush()
    db_session.add(models.Mission(
        id_mission=operation.id_operation,
        pays='Cameroun',
        ville='Douala',
        moyens_transport=['aerien'],
        heure_depart=time(8, 0),
        heure_retour=time(18, 0),
    ))
    db_session.commit()
    db_session.refresh(operation)
    return operation


def _create_frais_operation(db_session, matricule):
    mission_operation = _create_mission_operation(db_session, matricule)
    operation = models.Operation(
        matricule=matricule,
        type_demande='Frais de mission',
        titre='Frais mission',
        statut='en attente',
        date_debut=mission_operation.date_debut,
        date_fin=mission_operation.date_fin,
        date_depart=mission_operation.date_depart,
        date_retour=mission_operation.date_retour,
        duree_jours=mission_operation.duree_jours,
        duree=mission_operation.duree,
        motif='Justificatifs initiaux',
    )
    db_session.add(operation)
    db_session.flush()
    db_session.add(models.Frais(
        id_frais=operation.id_operation,
        id_operation=operation.id_operation,
        id_mission=mission_operation.id_operation,
        frais_transport_voyage=15000,
        frais_hotel=25000,
        frais_deplacement=5000,
        frais_nutrition=10000,
        total_frais=55000,
        justificatif_de_frais='Justificatifs initiaux',
    ))
    db_session.commit()
    db_session.refresh(operation)
    return operation


def test_cancel_allowed_after_partial_validation_before_final_and_notifications_persist(client, seed_reference_data, db_session, auth_headers):
    operation_id = seed_reference_data['operation'].id_operation
    _add_validation(db_session, operation_id, seed_reference_data['directeur'].matricule, 'DIRECTEUR')

    response = client.delete(f'/api/operations/{operation_id}', headers=auth_headers(1001, 'EMPLOYE'))

    assert response.status_code == 200
    db_session.expire_all()
    operation = db_session.query(models.Operation).filter(models.Operation.id_operation == operation_id).first()
    assert operation is None

    notifications = db_session.query(models.Notification).order_by(models.Notification.matricule.asc()).all()
    assert [notif.matricule for notif in notifications] == ['1001', '3001']
    assert all(notif.id_operation is None for notif in notifications)
    assert all('annul' in notif.message.lower() for notif in notifications)


def test_cancel_blocked_when_final_validator_already_validated(client, seed_reference_data, db_session, auth_headers):
    operation_id = seed_reference_data['operation'].id_operation
    _add_validation(db_session, operation_id, seed_reference_data['admin'].matricule, 'PCA')

    response = client.delete(f'/api/operations/{operation_id}', headers=auth_headers(1001, 'EMPLOYE'))

    assert response.status_code == 400
    assert 'validateur final' in response.json()['detail']


def test_cannot_cancel_refused_operation(client, seed_reference_data, db_session, auth_headers):
    operation = db_session.query(models.Operation).filter(
        models.Operation.id_operation == seed_reference_data['operation'].id_operation
    ).first()
    operation.statut = 'refusé'
    db_session.commit()

    response = client.delete(f'/api/operations/{operation.id_operation}', headers=auth_headers(1001, 'EMPLOYE'))

    assert response.status_code == 400
    assert 'en attente' in response.json()['detail']


def test_conge_modification_blocked_after_first_validation(client, seed_reference_data, db_session, auth_headers):
    operation = _create_conge_operation(db_session, seed_reference_data['employe'].matricule)
    _add_validation(db_session, operation.id_operation, seed_reference_data['directeur'].matricule, 'DIRECTEUR')

    response = client.put(
        f'/api/conges/{operation.id_operation}/modifier',
        params={
            'date_debut': '2026-04-07',
            'date_fin': '2026-04-09',
            'motif': 'Repos ajusté',
        },
        headers=auth_headers(1001, 'EMPLOYE')
    )

    assert response.status_code == 400
    assert 'première validation' in response.json()['detail']


def test_permission_modification_requires_owner_or_global_role(client, seed_reference_data, db_session, auth_headers):
    operation = models.Operation(
        matricule=seed_reference_data['employe'].matricule,
        type_demande='Permission',
        titre='Permission non conventionnelle',
        statut='en attente',
        date_debut=date(2026, 4, 14),
        date_fin=date(2026, 4, 15),
        date_depart=date(2026, 4, 14),
        date_retour=date(2026, 4, 15),
        duree_jours=2,
        duree=2,
        motif='Affaires personnelles',
    )
    db_session.add(operation)
    db_session.flush()
    db_session.add(models.Permission(id_permission=operation.id_operation))
    db_session.add(models.PermNonConventionelle(id_perm_nc=operation.id_operation))
    db_session.commit()

    response = client.put(
        f'/api/permissions/{operation.id_operation}/modifier',
        params={
            'date_debut': '2026-04-14',
            'date_fin': '2026-04-16',
            'motif': 'Motif modifié',
        },
        headers=auth_headers(2001, 'RESPONSABLE')
    )

    assert response.status_code == 403


def test_sortie_modification_blocked_after_first_validation(client, seed_reference_data, db_session, auth_headers):
    operation = _create_sortie_operation(db_session, seed_reference_data['employe'].matricule)
    _add_validation(db_session, operation.id_operation, seed_reference_data['directeur'].matricule, 'DIRECTEUR')

    response = client.put(
        f'/api/sorties/{operation.id_operation}/modifier',
        json={
            'date_sortie': '2026-04-06',
            'heure_sortie': '09:00',
            'heure_retour': '11:00',
            'commentaire': 'Consultation modifiée',
        },
        headers=auth_headers(1001, 'EMPLOYE')
    )

    assert response.status_code == 400
    assert 'première validation' in response.json()['detail']


def test_mission_modification_blocked_after_first_validation(client, seed_reference_data, db_session, auth_headers, monkeypatch):
    operation = _create_mission_operation(db_session, seed_reference_data['employe'].matricule)
    _add_validation(db_session, operation.id_operation, seed_reference_data['directeur'].matricule, 'DIRECTEUR')

    from app.utils import world_geo_service

    monkeypatch.setattr(world_geo_service, 'validate_country_city', lambda **kwargs: (True, 'ok', {
        'country_name': kwargs['country_name'],
        'city_name': kwargs['city_name'],
    }))

    response = client.put(
        f'/api/missions/{operation.id_operation}/modifier',
        params={
            'pays': 'Cameroun',
            'ville': 'Douala',
            'moyens_transport': ['aerien'],
            'date_debut': '2026-05-10',
            'date_fin': '2026-05-12',
            'motif': 'Visite modifiée',
        },
        headers=auth_headers(1001, 'EMPLOYE')
    )

    assert response.status_code == 400
    assert 'première validation' in response.json()['detail']


def test_mission_creation_returns_503_when_geo_provider_unavailable(client, seed_reference_data, monkeypatch):
    monkeypatch.setattr(
        world_geo_service,
        'validate_country_city',
        lambda **kwargs: (False, world_geo_service.GEO_VALIDATION_UNAVAILABLE_MESSAGE, None),
    )

    payload = {
        'matricule': seed_reference_data['responsable'].matricule,
        'matricules_missionnaires': [seed_reference_data['responsable'].matricule],
        'motif': 'Test indisponibilite geo',
        'segments': [
            {
                'pays': 'Cameroun',
                'country_code': 'CM',
                'ville': 'Douala',
                'date_debut': '2026-06-01',
                'date_fin': '2026-06-02',
                'moyen_transport': 'aerien',
            }
        ],
    }

    response = client.post('/api/missions/creer-multi-segments', json=payload)
    assert response.status_code == 503
    assert response.json()['detail'] == world_geo_service.GEO_VALIDATION_UNAVAILABLE_MESSAGE


def test_frais_modification_blocked_after_first_validation(client, seed_reference_data, db_session, auth_headers):
    operation = _create_frais_operation(db_session, seed_reference_data['employe'].matricule)
    _add_validation(db_session, operation.id_operation, seed_reference_data['directeur'].matricule, 'DIRECTEUR')

    response = client.put(
        f'/api/missions/frais/{operation.id_operation}/modifier',
        params={
            'frais_transport': 20000,
            'frais_hotel': 30000,
            'frais_deplacement': 7000,
            'frais_nutrition': 12000,
            'justificatif': 'MAJ',
        },
        headers=auth_headers(1001, 'EMPLOYE')
    )

    assert response.status_code == 400
    assert 'première validation' in response.json()['detail']


def test_workflow_boite_and_progression_expose_modification_metadata(client, seed_reference_data, db_session):
    operation = _create_conge_operation(db_session, seed_reference_data['employe'].matricule)
    operation.est_modifie = True
    operation.date_modification = datetime(2026, 4, 1, 9, 30)
    db_session.commit()

    boite_response = client.get(f'/api/workflow/boite/{seed_reference_data["employe"].matricule}')
    assert boite_response.status_code == 200
    envoye = boite_response.json()['envoye']
    entry = next(item for item in envoye if item['id_operation'] == operation.id_operation)
    assert entry['est_modifie'] is True
    assert entry['date_modification'].startswith('2026-04-01')

    progression_response = client.get(f'/api/workflow/progression/{operation.id_operation}')
    assert progression_response.status_code == 200
    progression = progression_response.json()
    assert progression['est_modifie'] is True
    assert progression['date_modification'].startswith('2026-04-01T09:30:00')