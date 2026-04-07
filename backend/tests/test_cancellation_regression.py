from datetime import date, datetime

from app import models


def _build_operation(seed_reference_data, type_demande, titre, motif, d):
    return models.Operation(
        matricule=seed_reference_data['employe'].matricule,
        type_demande=type_demande,
        titre=titre,
        statut='en attente',
        date_debut=d,
        date_fin=d,
        duree_jours=1,
        motif=motif,
        date_demande=datetime.utcnow(),
    )


def test_cancel_conge_deletes_operation_and_conge_link(client, seed_reference_data, db_session, auth_headers):
    operation = _build_operation(seed_reference_data, 'CONGE', 'Demande conge', 'Repos', date(2026, 4, 1))
    db_session.add(operation)
    db_session.flush()
    operation_id = operation.id_operation
    db_session.add(models.CongesLink(id_conges=operation.id_operation))
    db_session.commit()

    response = client.delete(
        f"/api/operations/{operation_id}",
        headers=auth_headers(seed_reference_data['employe'].matricule, 'EMPLOYE'),
    )
    assert response.status_code == 200

    db_session.expire_all()
    assert db_session.query(models.Operation).filter(models.Operation.id_operation == operation_id).first() is None
    assert db_session.query(models.CongesLink).filter(models.CongesLink.id_conges == operation_id).first() is None


def test_cancel_permission_deletes_permission_tree(client, seed_reference_data, db_session, auth_headers):
    operation = _build_operation(seed_reference_data, 'Permission', 'Demande permission', 'Personnel', date(2026, 4, 2))
    db_session.add(operation)
    db_session.flush()
    operation_id = operation.id_operation
    db_session.add(models.Permission(id_permission=operation.id_operation))
    db_session.add(models.PermConventionelle(id_perm_c=operation.id_operation, preuve='piece.pdf'))
    db_session.commit()

    response = client.delete(
        f"/api/operations/{operation_id}",
        headers=auth_headers(seed_reference_data['employe'].matricule, 'EMPLOYE'),
    )
    assert response.status_code == 200

    db_session.expire_all()
    assert db_session.query(models.Operation).filter(models.Operation.id_operation == operation_id).first() is None
    assert db_session.query(models.Permission).filter(models.Permission.id_permission == operation_id).first() is None
    assert db_session.query(models.PermConventionelle).filter(models.PermConventionelle.id_perm_c == operation_id).first() is None


def test_cancel_sortie_deletes_operation_and_sortie(client, seed_reference_data, db_session, auth_headers):
    operation = _build_operation(seed_reference_data, 'Sortie', 'Demande sortie', 'Course', date(2026, 4, 3))
    db_session.add(operation)
    db_session.flush()
    operation_id = operation.id_operation

    db_session.add(models.Sortie(
        matricule=seed_reference_data['employe'].matricule,
        id_operation=operation.id_operation,
        date_sortie=date(2026, 4, 3),
        heure_sortie=datetime.strptime('09:00', '%H:%M').time(),
        commentaire='Sortie test',
        statut='en attente',
    ))
    db_session.commit()

    response = client.put(
        f"/api/sorties/{operation_id}/annuler",
        headers=auth_headers(seed_reference_data['employe'].matricule, 'EMPLOYE'),
    )
    assert response.status_code == 200

    db_session.expire_all()
    assert db_session.query(models.Operation).filter(models.Operation.id_operation == operation_id).first() is None
    assert db_session.query(models.Sortie).filter(models.Sortie.id_operation == operation_id).first() is None


def test_cancel_mission_deletes_operation_and_mission_children(client, seed_reference_data, db_session, auth_headers):
    operation = _build_operation(seed_reference_data, 'Mission', 'Demande mission', 'Mission test', date(2026, 4, 4))
    db_session.add(operation)
    db_session.flush()
    operation_id = operation.id_operation

    db_session.add(models.Mission(id_mission=operation.id_operation, pays='Cameroun', ville='Douala'))
    db_session.add(models.MissionSegment(id_mission=operation.id_operation, pays='Cameroun', ville='Douala', date_debut=date(2026, 4, 4), date_fin=date(2026, 4, 4), ordre=1))
    db_session.add(models.MissionnairesMission(id_mission=operation.id_operation, matricule=seed_reference_data['employe'].matricule))
    db_session.add(models.CommentaireMission(id_mission=operation.id_operation, matricule=seed_reference_data['employe'].matricule, commentaire='ok'))
    db_session.add(models.RelanceMission(id_mission=operation.id_operation, type_relance='48h', destinataires='[]'))
    db_session.commit()

    response = client.delete(
        f"/api/operations/{operation_id}",
        headers=auth_headers(seed_reference_data['employe'].matricule, 'EMPLOYE'),
    )
    assert response.status_code == 200

    db_session.expire_all()
    assert db_session.query(models.Operation).filter(models.Operation.id_operation == operation_id).first() is None
    assert db_session.query(models.Mission).filter(models.Mission.id_mission == operation_id).first() is None
    assert db_session.query(models.MissionSegment).filter(models.MissionSegment.id_mission == operation_id).count() == 0
    assert db_session.query(models.MissionnairesMission).filter(models.MissionnairesMission.id_mission == operation_id).count() == 0
    assert db_session.query(models.CommentaireMission).filter(models.CommentaireMission.id_mission == operation_id).count() == 0
    assert db_session.query(models.RelanceMission).filter(models.RelanceMission.id_mission == operation_id).count() == 0


def test_cancel_frais_deletes_frais_operation_and_frais_row(client, seed_reference_data, db_session, auth_headers):
    mission_op = _build_operation(seed_reference_data, 'Mission', 'Mission mere', 'Mission pour frais', date(2026, 4, 5))
    db_session.add(mission_op)
    db_session.flush()
    db_session.add(models.Mission(id_mission=mission_op.id_operation, pays='Cameroun', ville='Yaounde'))

    frais_op = _build_operation(seed_reference_data, 'Frais de mission', 'Demande frais', 'Frais test', date(2026, 4, 6))
    db_session.add(frais_op)
    db_session.flush()
    frais_operation_id = frais_op.id_operation
    db_session.add(models.Frais(id_frais=frais_op.id_operation, id_operation=frais_op.id_operation, id_mission=mission_op.id_operation, total_frais=1000))
    db_session.commit()

    response = client.delete(
        f"/api/missions/frais/{frais_operation_id}",
        headers=auth_headers(seed_reference_data['employe'].matricule, 'EMPLOYE'),
    )
    assert response.status_code == 200

    db_session.expire_all()
    assert db_session.query(models.Operation).filter(models.Operation.id_operation == frais_operation_id).first() is None
    assert db_session.query(models.Frais).filter(models.Frais.id_operation == frais_operation_id).first() is None
