from datetime import date

from app import models
from app.utils import business_logic


def test_calculer_jours_ouvrables_exclut_samedi_dimanche():
    # Monday -> Sunday should count only 5 working days.
    assert business_logic.calculer_jours_ouvrables(date(2026, 3, 30), date(2026, 4, 5)) == 5


def test_creer_conge_utilise_duree_jours_ouvrables(client, db_session, seed_reference_data):
    employe = seed_reference_data['employe']
    employe.solde_conges = 30
    db_session.commit()

    response = client.post(
        '/api/conges/demande',
        params={
            'matricule': employe.matricule,
            'date_debut': '2026-03-30',
            'date_fin': '2026-04-05',
            'motif': 'Repos test',
            'matricule_createur': employe.matricule,
        },
    )

    assert response.status_code == 201
    payload = response.json()
    assert payload['duree_jours'] == 5

    operation = db_session.query(models.Operation).filter(
        models.Operation.id_operation == payload['id_operation']
    ).first()
    assert operation is not None
    assert operation.duree_jours == 5
    assert operation.date_depart == date(2026, 3, 30)
    assert operation.date_retour == date(2026, 4, 5)


def test_creer_permission_non_conventionnelle_recalcule_duree_cote_serveur(client, db_session, seed_reference_data):
    employe = seed_reference_data['employe']
    employe.solde_conges = 40
    db_session.commit()

    response = client.post(
        '/api/permissions/non-conventionnelle',
        params={
            'matricule': employe.matricule,
            'date_debut': '2026-04-06',
            'date_fin': '2026-04-12',
            'duree': 99,
            'motif': 'Permission test',
            'matricule_createur': employe.matricule,
        },
    )

    assert response.status_code == 201
    payload = response.json()
    assert payload['duree_jours'] == 5


def test_creer_permission_conventionnelle_utilise_jours_ouvrables(client, db_session, seed_reference_data):
    employe = seed_reference_data['employe']
    db_session.commit()

    response = client.post(
        '/api/permissions/conventionnelle',
        params={
            'matricule': employe.matricule,
            'type_permission': 'deces',
            'sous_type': 'enfant',
            'date_debut': '2026-04-03',
            'date_fin': '2026-04-07',
            'motif': 'Permission conventionnelle test',
            'matricule_createur': employe.matricule,
        },
    )

    assert response.status_code == 201
    payload = response.json()
    assert payload['duree_demandee'] == 3

    operation = db_session.query(models.Operation).filter(
        models.Operation.id_operation == payload['id_operation']
    ).first()
    assert operation is not None
    assert operation.duree_jours == 3


def test_modifier_permission_weekend_seul_refuse(client, db_session, seed_reference_data, auth_headers):
    employe = seed_reference_data['employe']
    employe.solde_conges = 40
    db_session.commit()

    create_response = client.post(
        '/api/permissions/non-conventionnelle',
        params={
            'matricule': employe.matricule,
            'date_debut': '2026-04-06',
            'date_fin': '2026-04-08',
            'motif': 'Permission modif test',
            'matricule_createur': employe.matricule,
        },
        headers=auth_headers(employe.matricule, 'EMPLOYE'),
    )
    assert create_response.status_code == 201
    operation_id = create_response.json()['id_operation']

    update_response = client.put(
        f'/api/permissions/{operation_id}/modifier',
        params={
            'date_debut': '2026-04-11',
            'date_fin': '2026-04-12',
            'motif': 'Weekend uniquement',
        },
        headers=auth_headers(employe.matricule, 'EMPLOYE'),
    )

    assert update_response.status_code == 400
    assert 'durée' in update_response.json()['detail'].lower() or 'duree' in update_response.json()['detail'].lower()
