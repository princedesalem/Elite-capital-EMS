from app import models


def test_owner_can_cancel_own_operation(client, seed_reference_data, auth_headers):
    operation_id = seed_reference_data['operation'].id_operation

    response = client.delete(f'/api/operations/{operation_id}', headers=auth_headers(1001, 'EMPLOYE'))
    assert response.status_code == 200
    assert response.json()['id_operation'] == operation_id


def test_owner_cancel_deletes_operation(client, seed_reference_data, db_session, auth_headers):
    operation_id = seed_reference_data['operation'].id_operation

    response = client.delete(f'/api/operations/{operation_id}', headers=auth_headers(1001, 'EMPLOYE'))
    assert response.status_code == 200

    db_session.expire_all()
    operation = db_session.query(models.Operation).filter(models.Operation.id_operation == operation_id).first()
    assert operation is None


def test_non_owner_cannot_cancel_operation(client, seed_reference_data, auth_headers):
    operation_id = seed_reference_data['operation'].id_operation

    response = client.delete(f'/api/operations/{operation_id}', headers=auth_headers(2001, 'RESPONSABLE'))
    assert response.status_code == 403


def test_admin_can_cancel_operation_of_other_user(client, seed_reference_data, auth_headers):
    operation_id = seed_reference_data['operation'].id_operation

    response = client.delete(f'/api/operations/{operation_id}', headers=auth_headers(9001, 'ADMIN'))
    assert response.status_code == 200


def test_cannot_cancel_validated_operation(client, seed_reference_data, db_session, auth_headers):
    operation = db_session.query(models.Operation).filter(
        models.Operation.id_operation == seed_reference_data['operation'].id_operation
    ).first()
    operation.statut = 'validé'
    db_session.commit()

    response = client.delete(f"/api/operations/{operation.id_operation}", headers=auth_headers(1001, 'EMPLOYE'))
    assert response.status_code == 400
