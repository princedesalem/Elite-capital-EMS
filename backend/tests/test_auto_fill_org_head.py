"""
Tests de non-régression pour le remplissage automatique de
DIRECTION.id_directeur et DEPARTEMENT.id_responsable lors de la création
ou de la mise à jour d'un employé.

Garantit que :
1. Créer un employé avec rôle DIRECTEUR + id_direction remplit DIRECTION.id_directeur.
2. Créer un employé avec rôle RESPONSABLE + dept_id remplit DEPARTEMENT.id_responsable.
3. Mettre à jour le rôle d'un employé vers DIRECTEUR remplit la direction.
4. Mettre à jour le rôle d'un employé vers RESPONSABLE remplit le département.
5. Un DIRECTEUR sans direction assignée ne provoque pas d'erreur.
6. Un RESPONSABLE sans département assigné ne provoque pas d'erreur.
7. L'ancien directeur/responsable est bien remplacé quand on en crée un nouveau.
"""
from datetime import date

import pytest

from app import models
from app.utils.security import hash_password, create_access_token
from app.routers.employees import _auto_fill_org_head


# ---------------------------------------------------------------------------
# Fixture locale
# ---------------------------------------------------------------------------

@pytest.fixture()
def org(db_session):
    """Structure minimale : 1 entité, 1 direction (sans id_directeur),
    1 département (sans id_responsable), tous les rôles nécessaires."""
    entite = models.Entite(nom='ELCAM')
    db_session.add(entite)
    db_session.flush()

    direction = models.Direction(
        nom='Direction Test',
        id_entite=entite.id_entite,
        id_directeur=None,
    )
    db_session.add(direction)
    db_session.flush()

    departement = models.Departement(
        nom='Département Test',
        id_entite=entite.id_entite,
        id_direction=direction.id_direction,
        id_responsable=None,
    )
    db_session.add(departement)
    db_session.flush()

    role_names = ['EMPLOYE', 'RESPONSABLE', 'DIRECTEUR', 'DG', 'RH', 'ADMIN']
    roles = {}
    for name in role_names:
        r = models.Role(name=name, description=f'Role {name}')
        db_session.add(r)
        db_session.flush()
        roles[name] = r

    db_session.commit()

    return {
        'entite': entite,
        'direction': direction,
        'departement': departement,
        'roles': roles,
    }


def _make_employe(db_session, matricule, role, org, *, dept=True, direction=True):
    """Crée un employé + utilisateur et retourne l'objet Employe."""
    emp = models.Employe(
        matricule=matricule,
        nom='Test',
        prenom=f'Employe{matricule}',
        email=f'{matricule}@test.com',
        date_embauche=date(2024, 1, 1),
        dept_id=org['departement'].dept_id if dept else None,
        id_direction=org['direction'].id_direction if direction else None,
        id_entite=org['entite'].id_entite,
        id_role=org['roles'][role].id,
        fonction=role,
        sexe='M',
    )
    db_session.add(emp)
    db_session.flush()
    db_session.add(models.Utilisateur(
        matricule=matricule,
        email=f'{matricule}@test.com',
        role_id=org['roles'][role].id,
        mot_de_passe_hash=hash_password('PasswordTest@1234!'),
        mot_de_passe_temporaire=False,
        mfa_enabled=False,
        mfa_active=False,
    ))
    db_session.commit()
    db_session.refresh(emp)
    return emp


# ---------------------------------------------------------------------------
# Tests — création
# ---------------------------------------------------------------------------

def test_creer_directeur_remplit_id_directeur_de_la_direction(db_session, org):
    """Créer un employé DIRECTEUR avec une direction → direction.id_directeur = matricule."""
    emp = _make_employe(db_session, 3001, 'DIRECTEUR', org)

    _auto_fill_org_head(db_session, emp)

    db_session.refresh(org['direction'])
    assert org['direction'].id_directeur == emp.matricule, (
        f"direction.id_directeur devrait être {emp.matricule}, "
        f"reçu: {org['direction'].id_directeur}"
    )


def test_creer_responsable_remplit_id_responsable_du_departement(db_session, org):
    """Créer un employé RESPONSABLE avec un département → departement.id_responsable = matricule."""
    emp = _make_employe(db_session, 2001, 'RESPONSABLE', org)

    _auto_fill_org_head(db_session, emp)

    db_session.refresh(org['departement'])
    assert org['departement'].id_responsable == emp.matricule, (
        f"departement.id_responsable devrait être {emp.matricule}, "
        f"reçu: {org['departement'].id_responsable}"
    )


def test_creer_employe_ordinaire_ne_modifie_pas_direction(db_session, org):
    """Un employé avec rôle EMPLOYE ne doit PAS modifier direction.id_directeur."""
    emp = _make_employe(db_session, 1001, 'EMPLOYE', org)

    _auto_fill_org_head(db_session, emp)

    db_session.refresh(org['direction'])
    assert org['direction'].id_directeur is None, (
        "Un rôle EMPLOYE ne doit pas remplir id_directeur"
    )


# ---------------------------------------------------------------------------
# Tests — mise à jour du rôle
# ---------------------------------------------------------------------------

def test_mettre_a_jour_role_vers_directeur_remplit_direction(db_session, org):
    """Promouvoir un employé EMPLOYE → DIRECTEUR déclenche le remplissage."""
    emp = _make_employe(db_session, 1010, 'EMPLOYE', org)
    assert org['direction'].id_directeur is None

    # Changer le rôle
    emp.id_role = org['roles']['DIRECTEUR'].id
    db_session.commit()

    _auto_fill_org_head(db_session, emp)

    db_session.refresh(org['direction'])
    assert org['direction'].id_directeur == emp.matricule


def test_mettre_a_jour_role_vers_responsable_remplit_departement(db_session, org):
    """Promouvoir un employé EMPLOYE → RESPONSABLE déclenche le remplissage."""
    emp = _make_employe(db_session, 1011, 'EMPLOYE', org)
    assert org['departement'].id_responsable is None

    emp.id_role = org['roles']['RESPONSABLE'].id
    db_session.commit()

    _auto_fill_org_head(db_session, emp)

    db_session.refresh(org['departement'])
    assert org['departement'].id_responsable == emp.matricule


# ---------------------------------------------------------------------------
# Tests — cas limites (pas d'erreur)
# ---------------------------------------------------------------------------

def test_directeur_sans_direction_ne_crash_pas(db_session, org):
    """DIRECTEUR sans id_direction → aucune erreur, aucune modification."""
    emp = _make_employe(db_session, 3002, 'DIRECTEUR', org, direction=False)
    assert emp.id_direction is None

    # Ne doit pas lever d'exception
    _auto_fill_org_head(db_session, emp)

    db_session.refresh(org['direction'])
    assert org['direction'].id_directeur is None


def test_responsable_sans_departement_ne_crash_pas(db_session, org):
    """RESPONSABLE sans dept_id → aucune erreur, aucune modification."""
    emp = _make_employe(db_session, 2002, 'RESPONSABLE', org, dept=False)
    assert emp.dept_id is None

    _auto_fill_org_head(db_session, emp)

    db_session.refresh(org['departement'])
    assert org['departement'].id_responsable is None


# ---------------------------------------------------------------------------
# Tests — remplacement (nouveau directeur remplace l'ancien)
# ---------------------------------------------------------------------------

def test_nouveau_directeur_remplace_ancien(db_session, org):
    """Affecter un 2ème DIRECTEUR à la même direction remplace id_directeur."""
    ancien = _make_employe(db_session, 3010, 'DIRECTEUR', org)
    _auto_fill_org_head(db_session, ancien)
    db_session.refresh(org['direction'])
    assert org['direction'].id_directeur == ancien.matricule

    nouveau = _make_employe(db_session, 3011, 'DIRECTEUR', org)
    _auto_fill_org_head(db_session, nouveau)
    db_session.refresh(org['direction'])
    assert org['direction'].id_directeur == nouveau.matricule, (
        "Le nouveau directeur doit remplacer l'ancien dans id_directeur"
    )


def test_nouveau_responsable_remplace_ancien(db_session, org):
    """Affecter un 2ème RESPONSABLE au même département remplace id_responsable."""
    ancien = _make_employe(db_session, 2010, 'RESPONSABLE', org)
    _auto_fill_org_head(db_session, ancien)
    db_session.refresh(org['departement'])
    assert org['departement'].id_responsable == ancien.matricule

    nouveau = _make_employe(db_session, 2011, 'RESPONSABLE', org)
    _auto_fill_org_head(db_session, nouveau)
    db_session.refresh(org['departement'])
    assert org['departement'].id_responsable == nouveau.matricule, (
        "Le nouveau responsable doit remplacer l'ancien dans id_responsable"
    )


# ---------------------------------------------------------------------------
# Tests — via API endpoint (intégration complète)
# ---------------------------------------------------------------------------

def test_api_create_directeur_auto_fill(client, db_session, org):
    """POST /employees avec rôle DIRECTEUR → direction.id_directeur rempli."""
    admin_role = org['roles']['ADMIN']
    admin_emp = models.Employe(
        matricule=9999,
        nom='Admin',
        prenom='Test',
        email='admin9999@test.com',
        date_embauche=date(2024, 1, 1),
        id_entite=org['entite'].id_entite,
        id_role=admin_role.id,
        fonction='ADMIN',
        sexe='M',
    )
    db_session.add(admin_emp)
    db_session.flush()
    db_session.add(models.Utilisateur(
        matricule=9999,
        email='admin9999@test.com',
        role_id=admin_role.id,
        mot_de_passe_hash=hash_password('PasswordTest@1234!'),
        mot_de_passe_temporaire=False,
        mfa_enabled=False,
        mfa_active=False,
    ))
    db_session.commit()

    token = create_access_token({'matricule': 9999, 'role': 'ADMIN'}, expires_minutes=60)
    headers = {'Authorization': f'Bearer {token}'}

    payload = {
        'matricule': '5001',
        'nom': 'Nouveau',
        'prenom': 'Directeur',
        'email': '5001@test.com',
        'sexe': 'M',
        'date_embauche': '2024-01-01',
        'role': 'DIRECTEUR',
        'entite': str(org['entite'].id_entite),
        'direction': str(org['direction'].id_direction),
    }

    response = client.post('/employees', json=payload, headers=headers)
    assert response.status_code == 200, response.text

    db_session.refresh(org['direction'])
    assert org['direction'].id_directeur == '5001', (
        f"direction.id_directeur doit être 5001 après création via API, "
        f"reçu: {org['direction'].id_directeur}"
    )


def test_api_create_responsable_auto_fill(client, db_session, org):
    """POST /employees avec rôle RESPONSABLE → departement.id_responsable rempli."""
    admin_role = org['roles']['ADMIN']
    admin_emp = models.Employe(
        matricule=9998,
        nom='Admin',
        prenom='Test2',
        email='admin9998@test.com',
        date_embauche=date(2024, 1, 1),
        id_entite=org['entite'].id_entite,
        id_role=admin_role.id,
        fonction='ADMIN',
        sexe='M',
    )
    db_session.add(admin_emp)
    db_session.flush()
    db_session.add(models.Utilisateur(
        matricule=9998,
        email='admin9998@test.com',
        role_id=admin_role.id,
        mot_de_passe_hash=hash_password('PasswordTest@1234!'),
        mot_de_passe_temporaire=False,
        mfa_enabled=False,
        mfa_active=False,
    ))
    db_session.commit()

    token = create_access_token({'matricule': 9998, 'role': 'ADMIN'}, expires_minutes=60)
    headers = {'Authorization': f'Bearer {token}'}

    payload = {
        'matricule': '4001',
        'nom': 'Nouveau',
        'prenom': 'Responsable',
        'email': '4001@test.com',
        'sexe': 'F',
        'date_embauche': '2024-01-01',
        'role': 'RESPONSABLE',
        'entite': str(org['entite'].id_entite),
        'departement': str(org['departement'].dept_id),
    }

    response = client.post('/employees', json=payload, headers=headers)
    assert response.status_code == 200, response.text

    db_session.refresh(org['departement'])
    assert org['departement'].id_responsable == '4001', (
        f"departement.id_responsable doit être 4001 après création via API, "
        f"reçu: {org['departement'].id_responsable}"
    )
