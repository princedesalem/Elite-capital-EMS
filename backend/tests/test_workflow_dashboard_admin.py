from datetime import date

from app import models
from app.utils.security import hash_password


def test_workflow_boite_returns_sent_and_received(client, seed_reference_data, auth_headers):
    employe = seed_reference_data['employe']
    directeur = seed_reference_data['directeur']
    operation = seed_reference_data['operation']

    response_envoye = client.get(
        f'/api/workflow/boite/{employe.matricule}',
        headers=auth_headers(employe.matricule, 'EMPLOYE'),
    )
    assert response_envoye.status_code == 200
    data_envoye = response_envoye.json()
    assert any(item['id_operation'] == operation.id_operation for item in data_envoye['envoye'])

    response_recu = client.get(
        f'/api/workflow/boite/{directeur.matricule}',
        headers=auth_headers(directeur.matricule, 'DIRECTEUR'),
    )
    assert response_recu.status_code == 200
    data_recu = response_recu.json()
    assert any(item['id_operation'] == operation.id_operation for item in data_recu['recu'])


def test_dashboard_analytics_returns_scope_and_gender_kpis(client, seed_reference_data, auth_headers):
    responsable = seed_reference_data['responsable']

    response = client.get(
        f'/dashboard/analytics/{responsable.matricule}',
        headers=auth_headers(responsable.matricule, 'RESPONSABLE'),
    )
    assert response.status_code == 200
    payload = response.json()

    assert payload['scope_level'] == 'departement'
    assert payload['show_org_stats'] is True
    assert payload['perimetre']['kpis']['hommes'] >= 1
    assert payload['perimetre']['kpis']['femmes'] >= 1
    assert 'by_sexe' in payload['perimetre']['kpis']


def test_admin_can_manage_user_accounts(client, seed_reference_data, auth_headers):
    admin = seed_reference_data['admin']
    employe = seed_reference_data['employe']

    list_response = client.get(
        '/employees/admin/utilisateurs',
        headers=auth_headers(admin.matricule, 'ADMIN'),
    )
    assert list_response.status_code == 200
    users = list_response.json()
    assert any(user['matricule'] == employe.matricule for user in users)

    update_response = client.put(
        f'/employees/admin/utilisateurs/{employe.matricule}',
        json={'mfa_enabled': True, 'active': False, 'role': 'RESPONSABLE'},
        headers=auth_headers(admin.matricule, 'ADMIN'),
    )
    assert update_response.status_code == 200
    updated = update_response.json()
    assert updated['mfa_enabled'] is True
    assert updated['active'] is False
    assert updated['role'] == 'RESPONSABLE'

    reset_response = client.post(
        f'/employees/admin/utilisateurs/{employe.matricule}/reset-password-temp',
        json={'new_password': 'NouvelleCleTemp123!'},
        headers=auth_headers(admin.matricule, 'ADMIN'),
    )
    assert reset_response.status_code == 200
    reset_payload = reset_response.json()
    assert reset_payload['ok'] is True
    assert reset_payload['mot_de_passe_temporaire'] == 'NouvelleCleTemp123!'


def test_non_admin_cannot_manage_user_accounts(client, seed_reference_data, auth_headers):
    employe = seed_reference_data['employe']

    list_response = client.get(
        '/employees/admin/utilisateurs',
        headers=auth_headers(employe.matricule, 'EMPLOYE'),
    )
    assert list_response.status_code == 403

    update_response = client.put(
        f'/employees/admin/utilisateurs/{employe.matricule}',
        json={'active': False},
        headers=auth_headers(employe.matricule, 'EMPLOYE'),
    )
    assert update_response.status_code == 403


def test_structure_endpoints_accessible_to_all_roles(client, seed_reference_data, auth_headers):
    """Entités / Directions / Départements are read-only reference data visible to everyone."""
    employe = seed_reference_data['employe']

    for path in ['/employees/admin/entites-structure',
                 '/employees/admin/directions-structure',
                 '/employees/admin/departements']:
        resp = client.get(path, headers=auth_headers(employe.matricule, 'EMPLOYE'))
        assert resp.status_code == 200, f"{path} returned {resp.status_code} for EMPLOYE role"
        assert isinstance(resp.json(), list)


def test_cors_preflight_allows_local_dev_origin(client):
    response = client.options(
        '/employees/',
        headers={
            'Origin': 'http://localhost:5173',
            'Access-Control-Request-Method': 'GET',
            'Access-Control-Request-Headers': 'Authorization,Content-Type',
        },
    )
    assert response.status_code in (200, 204)
    assert response.headers.get('access-control-allow-origin') == 'http://localhost:5173'


def test_workflow_status_is_valid_only_after_last_validator(client, db_session, seed_reference_data, auth_headers):
    operation = seed_reference_data['operation']
    entite = seed_reference_data['entite']

    pca_role = models.Role(name='PCA', description='Role PCA')
    db_session.add(pca_role)
    db_session.flush()

    pca = models.Employe(
        matricule=6001,
        nom='Pca',
        prenom='User',
        email='6001@example.com',
        date_embauche=date(2024, 1, 1),
        id_entite=entite.id_entite,
        id_role=pca_role.id,
        fonction='PCA',
        sexe='M',
    )
    db_session.add(pca)
    db_session.flush()

    pca_user = models.Utilisateur(
        matricule=6001,
        email='6001@example.com',
        role_id=pca_role.id,
        mot_de_passe_hash=hash_password('PasswordTemp123!'),
        mot_de_passe_temporaire=False,
        mfa_enabled=False,
        mfa_active=False,
    )
    db_session.add(pca_user)
    db_session.commit()

    step_1 = client.post(
        f'/api/workflow/valider/{operation.id_operation}',
        params={'matricule_validateur': seed_reference_data['directeur'].matricule, 'statut': 'validé'},
        headers=auth_headers(seed_reference_data['directeur'].matricule, 'DIRECTEUR'),
    )
    assert step_1.status_code == 200
    assert step_1.json()['termine'] is False

    step_2 = client.post(
        f'/api/workflow/valider/{operation.id_operation}',
        params={'matricule_validateur': seed_reference_data['rh'].matricule, 'statut': 'validé'},
        headers=auth_headers(seed_reference_data['rh'].matricule, 'RH'),
    )
    assert step_2.status_code == 200
    assert step_2.json()['termine'] is False

    step_3 = client.post(
        f'/api/workflow/valider/{operation.id_operation}',
        params={'matricule_validateur': seed_reference_data['dg'].matricule, 'statut': 'validé'},
        headers=auth_headers(seed_reference_data['dg'].matricule, 'DG'),
    )
    assert step_3.status_code == 200
    assert step_3.json()['termine'] is False
    assert step_3.json()['prochain_role'] == 'PCA'

    operation_before_final = db_session.query(models.Operation).filter(
        models.Operation.id_operation == operation.id_operation
    ).first()
    assert operation_before_final.statut == 'en attente'

    final_step = client.post(
        f'/api/workflow/valider/{operation.id_operation}',
        params={'matricule_validateur': 6001, 'statut': 'validé'},
        headers=auth_headers(6001, 'PCA'),
    )
    assert final_step.status_code == 200
    assert final_step.json()['termine'] is True

    db_session.expire_all()
    operation_after_final = db_session.query(models.Operation).filter(
        models.Operation.id_operation == operation.id_operation
    ).first()
    assert operation_after_final.statut == 'validé'


def test_workflow_refusal_sets_status_immediately(client, db_session, seed_reference_data, auth_headers):
    operation = seed_reference_data['operation']

    step_1 = client.post(
        f'/api/workflow/valider/{operation.id_operation}',
        params={'matricule_validateur': seed_reference_data['directeur'].matricule, 'statut': 'validé'},
        headers=auth_headers(seed_reference_data['directeur'].matricule, 'DIRECTEUR'),
    )
    assert step_1.status_code == 200
    assert step_1.json()['termine'] is False

    refusal = client.post(
        f'/api/workflow/valider/{operation.id_operation}',
        params={
            'matricule_validateur': seed_reference_data['rh'].matricule,
            'statut': 'refusé',
            'commentaire': 'Dossier incomplet',
        },
        headers=auth_headers(seed_reference_data['rh'].matricule, 'RH'),
    )
    assert refusal.status_code == 200

    db_session.expire_all()
    operation_after_refusal = db_session.query(models.Operation).filter(
        models.Operation.id_operation == operation.id_operation
    ).first()
    assert operation_after_refusal.statut == 'refusé'
