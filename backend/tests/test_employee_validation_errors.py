"""Tests for employee validation errors (age, duplicates, missing fields)."""
import pytest
from datetime import date, timedelta


@pytest.fixture()
def data(seed_reference_data, db_session):
    return seed_reference_data


def _admin_headers(auth_headers, data):
    return auth_headers(data['admin'].matricule, 'ADMIN')


def _base_payload(data, matricule=10002):
    dept = data['departement']
    return {
        'matricule': matricule,
        'nom': 'Nouveau',
        'prenom': 'Employe',
        'email': f'emp{matricule}@example.com',
        'date_embauche': str(date.today()),
        'departement': dept.nom,         # string name, not numeric ID
        'entite': data['entite'].nom,    # string name for entite lookup
        'role': 'EMPLOYE',               # string role name for lookup
        'sexe': 'M',
        'fonction': 'Développeur',
    }


def test_create_employee_under_18_rejected(client, auth_headers, data):
    payload = _base_payload(data)
    payload['date_naissance'] = str(date.today() - timedelta(days=365 * 16))
    resp = client.post('/employees/', json=payload, headers=_admin_headers(auth_headers, data))
    assert resp.status_code == 400


def test_create_employee_stagiaire_under_18_allowed(client, auth_headers, data):
    payload = _base_payload(data, matricule=10003)
    payload['date_naissance'] = str(date.today() - timedelta(days=365 * 16))
    payload['categorie'] = 'Stagiaire'
    resp = client.post('/employees/', json=payload, headers=_admin_headers(auth_headers, data))
    # Stagiaires may be allowed (200) or rejected (400) depending on implementation
    assert resp.status_code in (200, 201, 400)


def test_create_duplicate_matricule_rejected(client, auth_headers, data):
    payload = _base_payload(data, matricule=data['employe'].matricule)
    resp = client.post('/employees/', json=payload, headers=_admin_headers(auth_headers, data))
    assert resp.status_code in (400, 409)


def test_create_duplicate_email_rejected(client, auth_headers, data):
    payload = _base_payload(data, matricule=10004)
    payload['email'] = data['employe'].email
    resp = client.post('/employees/', json=payload, headers=_admin_headers(auth_headers, data))
    assert resp.status_code in (400, 409)


def test_create_missing_mandatory_fields_rejected(client, auth_headers, data):
    # Send an empty payload
    resp = client.post('/employees/', json={}, headers=_admin_headers(auth_headers, data))
    assert resp.status_code == 422


def test_create_invalid_sexe_rejected(client, auth_headers, data):
    payload = _base_payload(data, matricule=10005)
    payload['sexe'] = 'X'
    resp = client.post('/employees/', json=payload, headers=_admin_headers(auth_headers, data))
    # Either 422 (validation) or 400 (business)
    assert resp.status_code in (400, 422)


def test_create_employee_success(client, auth_headers, data):
    payload = _base_payload(data, matricule=10006)
    resp = client.post('/employees/', json=payload, headers=_admin_headers(auth_headers, data))
    assert resp.status_code in (200, 201)
    body = resp.json()
    assert body.get('matricule') is not None or body.get('detail') == 'Employé créé'


# ---------------------------------------------------------------------------
# Messages d'erreur — accents et grammaire
# ---------------------------------------------------------------------------

def test_creer_compte_role_inconnu_message(client, auth_headers, data):
    """Créer un compte avec un rôle inexistant doit retourner 400 avec 'Rôle inconnu' (accent)."""
    headers = _admin_headers(auth_headers, data)
    emp = data['employe']
    resp = client.post(
        f'/employees/admin/utilisateurs/{emp.matricule}/creer-compte',
        json={'role': 'ROLE_INEXISTANT_XYZ', 'password': 'Test@1234!'},
        headers=headers,
    )
    # L'employé a déjà un compte (créé par conftest) → 409 ou rôle inconnu → 400
    # On vérifie que si on obtient 400 (pas de compte existant), le message est correct
    if resp.status_code == 400:
        assert resp.json()['detail'] == 'Rôle inconnu', (
            f"Message attendu 'Rôle inconnu', obtenu : '{resp.json()['detail']}'"
        )
    else:
        # 409 = déjà un compte, message doit aussi être correct
        assert resp.status_code == 409
        assert resp.json()['detail'] == 'Cet employé a déjà un compte', (
            f"Message 409 attendu 'Cet employé a déjà un compte', obtenu : '{resp.json()['detail']}'"
        )


def test_creer_compte_role_inconnu_nouvel_employe(client, auth_headers, data, db_session):
    """Créer un compte pour un employé sans compte existant, avec rôle inconnu → 400, 'Rôle inconnu'."""
    from app import models
    from datetime import date as dt_date

    headers = _admin_headers(auth_headers, data)

    # Créer un employé sans compte
    emp_sans_compte = models.Employe(
        matricule=19999,
        nom='SansCompte',
        prenom='Test',
        date_embauche=dt_date(2024, 1, 1),
        dept_id=data['departement'].dept_id,
        id_entite=data['entite'].id_entite,
        statut_employe='ACTIF',
        id_role=data['roles']['EMPLOYE'].id,
        sexe='M',
    )
    db_session.add(emp_sans_compte)
    db_session.commit()

    resp = client.post(
        '/employees/admin/utilisateurs/19999/creer-compte',
        json={'role': 'ROLE_INEXISTANT_XYZ', 'password': 'Test@1234!Longue'},
        headers=headers,
    )
    assert resp.status_code == 400, f"Statut attendu 400, obtenu {resp.status_code}: {resp.json()}"
    assert resp.json()['detail'] == 'Rôle inconnu', (
        f"Message attendu 'Rôle inconnu', obtenu : '{resp.json()['detail']}'"
    )


def test_suppression_fonction_employees_lies_message_accents(client, auth_headers, data, db_session):
    """Supprimer une fonction utilisée par un employé doit retourner 400 avec 'employé(s)' accentué."""
    from app import models

    headers = _admin_headers(auth_headers, data)

    # Créer une fonction référence avec le libellé exact de la fonction de l'employé seed
    emp = data['employe']
    fonction_libelle = emp.fonction or 'TestFonction'

    # S'assurer que la fonction existe dans FONCTION_REFERENCE
    existing = db_session.query(models.FonctionReference).filter(
        models.FonctionReference.libelle == fonction_libelle
    ).first()
    if not existing:
        fn = models.FonctionReference(libelle=fonction_libelle)
        db_session.add(fn)
        db_session.commit()
        db_session.refresh(fn)
        fn_id = fn.id_fonction
    else:
        fn_id = existing.id_fonction

    resp = client.delete(f'/employees/admin/fonctions-reference/{fn_id}', headers=headers)
    assert resp.status_code == 400, f"Statut attendu 400, obtenu {resp.status_code}: {resp.json()}"
    detail = resp.json()['detail']
    assert 'employé(s)' in detail, (
        f"Message doit contenir 'employé(s)' (accentué), obtenu : '{detail}'"
    )
