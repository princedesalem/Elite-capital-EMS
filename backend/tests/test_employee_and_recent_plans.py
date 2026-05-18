from datetime import date

from app import models


def test_employee_registration_creates_new_employee(client, seed_reference_data):
    payload = {
        'matricule': 7777,
        'nom': 'Nouveau',
        'prenom': 'Collaborateur',
        'email': '7777@example.com',
        'date_naissance': date(1998, 5, 10).isoformat(),
        'date_embauche': date(2026, 1, 5).isoformat(),
        'sexe': 'M',
        'entite': seed_reference_data['entite'].nom,
        'direction': seed_reference_data['direction'].nom,
        'departement': seed_reference_data['departement'].nom,
        'role': 'EMPLOYE',
        'fonction': 'Analyste',
        'n1': seed_reference_data['responsable'].matricule,
    }

    response = client.post('/employees/', json=payload)
    assert response.status_code == 200

    created = response.json()
    assert created['matricule'] == '7777'
    assert created['nom'] == 'Nouveau'
    assert created['prenom'] == 'Collaborateur'
    assert created['role'] == 'EMPLOYE'
    assert created['entite'] == seed_reference_data['entite'].nom


def test_employee_registration_rejects_under_18_non_stagiaire(client, seed_reference_data):
    payload = {
        'matricule': 7778,
        'nom': 'Mineur',
        'prenom': 'NonStagiaire',
        'email': '7778@example.com',
        'date_naissance': date(2010, 1, 1).isoformat(),
        'date_embauche': date(2026, 1, 5).isoformat(),
        'sexe': 'M',
        'entite': seed_reference_data['entite'].nom,
        'direction': seed_reference_data['direction'].nom,
        'departement': seed_reference_data['departement'].nom,
        'role': 'EMPLOYE',
        'fonction': 'Analyste',
        'categorie': 'Cadre moyen',
    }

    response = client.post('/employees/', json=payload)
    assert response.status_code == 400
    assert '18 ans' in str(response.json().get('detail', ''))


def test_employee_registration_allows_stagiaire_under_18(client, seed_reference_data):
    payload = {
        'matricule': 7779,
        'nom': 'Mineur',
        'prenom': 'Stagiaire',
        'email': '7779@example.com',
        'date_naissance': date(2010, 1, 1).isoformat(),
        'date_embauche': date(2026, 1, 5).isoformat(),
        'sexe': 'F',
        'entite': seed_reference_data['entite'].nom,
        'direction': seed_reference_data['direction'].nom,
        'departement': seed_reference_data['departement'].nom,
        'role': 'EMPLOYE',
        'fonction': 'Stagiaire professionnel',
        'categorie': 'Stagiaire',
    }

    response = client.post('/employees/', json=payload)
    assert response.status_code == 200
    created = response.json()
    assert created['matricule'] == '7779'


def test_rh_employee_creation_notifies_admin(client, seed_reference_data, db_session, auth_headers):
    payload = {
        'matricule': 7780,
        'nom': 'Notif',
        'prenom': 'Admin',
        'email': '7780@example.com',
        'date_naissance': date(1998, 5, 10).isoformat(),
        'date_embauche': date(2026, 1, 5).isoformat(),
        'sexe': 'M',
        'entite': seed_reference_data['entite'].nom,
        'direction': seed_reference_data['direction'].nom,
        'departement': seed_reference_data['departement'].nom,
        'role': 'EMPLOYE',
        'fonction': 'Analyste',
    }

    response = client.post('/employees/', json=payload, headers=auth_headers(seed_reference_data['rh'].matricule, 'RH'))
    assert response.status_code == 200

    admin_notifs = db_session.query(models.Notification).filter(
        models.Notification.matricule == seed_reference_data['admin'].matricule,
        models.Notification.titre == 'Nouvel employé créé'
    ).all()
    assert len(admin_notifs) >= 1



def test_module_store_crud_round_trip(client):
    module_name = 'workforce_positions'

    create_response = client.post(
        f'/api/module-store/{module_name}',
        json={'title': 'Agent support', 'status': 'en_attente', '_actor_matricule': 9001},
    )
    assert create_response.status_code == 200
    created = create_response.json()
    assert created['title'] == 'Agent support'
    assert created['status'] == 'en_attente'
    assert created['_created_by'] == '9001'

    item_id = created['id']

    list_response = client.get(f'/api/module-store/{module_name}')
    assert list_response.status_code == 200
    listed = list_response.json()
    assert any(item['id'] == item_id for item in listed)

    update_response = client.put(
        f'/api/module-store/{module_name}/{item_id}',
        json={'title': 'Agent support senior', 'status': 'valide'},
    )
    assert update_response.status_code == 200
    updated = update_response.json()
    assert updated['title'] == 'Agent support senior'
    assert updated['status'] == 'valide'

    delete_response = client.delete(f'/api/module-store/{module_name}/{item_id}')
    assert delete_response.status_code == 200



def test_team_space_create_like_and_vote_poll(client):
    poll_payload = {
        'type': 'poll',
        'from': 'RH Team',
        'question': 'Quel atelier prioriser ?',
        'options': [
            {'texte': 'Onboarding', 'votes': 0},
            {'texte': 'Leadership', 'votes': 0},
        ],
        'audience': {'type': 'all', 'selected': []},
    }

    create_response = client.post('/api/team-space/posts', json=poll_payload)
    assert create_response.status_code == 200
    poll = create_response.json()
    poll_id = poll['id']

    like_response = client.patch(
        f'/api/team-space/posts/{poll_id}/like',
        json={'matricule': '1001'},
    )
    assert like_response.status_code == 200
    liked = like_response.json()
    assert liked['likes'] == 1

    vote_response = client.patch(
        f'/api/team-space/posts/{poll_id}/vote',
        json={'voter_matricule': '1001', 'option_index': 1},
    )
    assert vote_response.status_code == 200
    voted = vote_response.json()
    assert '1001' in voted['votedBy']
    assert voted['options'][1]['votes'] == 1
