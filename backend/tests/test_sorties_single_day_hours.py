from datetime import date

from app import models


def test_create_sortie_sets_single_day_operation_and_hour_duration(client, seed_reference_data, db_session):
    response = client.post(
        '/api/sorties/',
        json={
            'matricule': seed_reference_data['employe'].matricule,
            'date_sortie': '2026-03-20',
            'heure_sortie': '08:00',
            'heure_retour': '11:30',
            'commentaire': 'Sortie client',
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert data['duree_heures'] == 3.5

    operation = db_session.query(models.Operation).filter(models.Operation.id_operation == data['id_operation']).first()
    assert operation is not None
    assert operation.type_demande == 'Sortie'
    assert operation.date_debut == date(2026, 3, 20)
    assert operation.date_fin == date(2026, 3, 20)
    assert operation.date_retour == date(2026, 3, 20)
    assert operation.duree_jours == 1


def test_create_sortie_rejects_heure_retour_before_heure_depart(client, seed_reference_data):
    response = client.post(
        '/api/sorties/',
        json={
            'matricule': seed_reference_data['employe'].matricule,
            'date_sortie': '2026-03-20',
            'heure_sortie': '15:00',
            'heure_retour': '10:00',
            'commentaire': 'Sortie invalide',
        },
    )

    assert response.status_code == 422
    assert "retour" in response.json()['detail'].lower()


def test_modifier_sortie_keeps_single_day_and_recomputes_hours(client, seed_reference_data, db_session, auth_headers):
    matricule = seed_reference_data['employe'].matricule
    create_response = client.post(
        '/api/sorties/',
        json={
            'matricule': matricule,
            'date_sortie': '2026-03-20',
            'heure_sortie': '09:00',
            'heure_retour': '12:00',
            'commentaire': 'Sortie initiale',
        },
    )
    assert create_response.status_code == 200
    operation_id = create_response.json()['id_operation']

    update_response = client.put(
        f'/api/sorties/{operation_id}/modifier',
        json={
            'date_sortie': '2026-03-21',
            'heure_sortie': '10:00',
            'heure_retour': '14:00',
            'commentaire': 'Sortie modifiee',
        },
        headers=auth_headers(matricule, 'EMPLOYE'),
    )

    assert update_response.status_code == 200
    updated = update_response.json()
    # 10:00 -> 14:00 overlaps lunch window (12:00-14:00), so 1h is deducted.
    assert updated['duree_heures'] == 3.0

    operation = db_session.query(models.Operation).filter(models.Operation.id_operation == operation_id).first()
    assert operation.date_debut == date(2026, 3, 21)
    assert operation.date_fin == date(2026, 3, 21)
    assert operation.date_retour == date(2026, 3, 21)
    assert operation.duree_jours == 1


def test_create_sortie_rejects_effective_duration_above_four_hours(client, seed_reference_data):
    response = client.post(
        '/api/sorties/',
        json={
            'matricule': seed_reference_data['employe'].matricule,
            'date_sortie': '2026-03-20',
            'heure_sortie': '08:00',
            'heure_retour': '13:30',  # 5h30 brut, -1h lunch => 4h30 effectives
            'commentaire': 'Sortie trop longue',
        },
    )

    assert response.status_code == 422
    assert '4 heures' in response.json()['detail']
