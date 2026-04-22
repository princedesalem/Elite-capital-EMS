"""
Tests de régression pour le routage des validateurs dans le workflow.

Garantit que :
1. Le DIRECTEUR validateur est TOUJOURS celui de la direction du département
   de l'employé, jamais celui d'une autre direction (même si `employe.id_direction`
   pointe par erreur ailleurs).
2. Quand un département N'A PAS de direction rattachée, c'est le RESPONSABLE du
   département qui valide (pas un DIRECTEUR).
"""
from datetime import date

import pytest

from app import models
from app.utils.security import hash_password
from app.utils.workflow import (
    determiner_sequence_validation,
    obtenir_prochain_validateur,
    obtenir_validateur_pour_role,
)


# ---------------------------------------------------------------------------
# Fixture spécifique à ce fichier : deux directions distinctes + un département
# sans direction, tous rattachés à la même entité.
# ---------------------------------------------------------------------------

@pytest.fixture()
def org_two_directions(db_session):
    """Crée une structure organisationnelle avec 2 directions + 1 dept sans direction."""
    entite = models.Entite(nom='ELCAM')
    db_session.add(entite)
    db_session.flush()

    # Rôles requis
    role_names = ['EMPLOYE', 'RESPONSABLE', 'DIRECTEUR', 'DG', 'RH', 'PCA', 'ADMIN']
    roles = {}
    for name in role_names:
        r = models.Role(name=name, description=f'Role {name}')
        db_session.add(r)
        db_session.flush()
        roles[name] = r

    def add_employe(matricule, prenom, role_name, dept_id=None, id_direction=None):
        emp = models.Employe(
            matricule=matricule,
            nom='Test',
            prenom=prenom,
            email=f'{matricule}@example.com',
            date_embauche=date(2024, 1, 1),
            dept_id=dept_id,
            id_direction=id_direction,
            id_entite=entite.id_entite,
            id_role=roles[role_name].id,
            fonction=role_name,
            sexe='M',
        )
        db_session.add(emp)
        db_session.flush()
        db_session.add(models.Utilisateur(
            matricule=matricule,
            email=f'{matricule}@example.com',
            role_id=roles[role_name].id,
            mot_de_passe_hash=hash_password('PasswordTemp123!'),
            mot_de_passe_temporaire=False,
            mfa_enabled=False,
            mfa_active=False,
        ))
        db_session.flush()
        return emp

    # Direction A "Organisation et Projet" avec son directeur
    directeur_A = add_employe(3010, 'DirOrgProjet', 'DIRECTEUR')
    direction_A = models.Direction(
        nom='Organisation et Projet',
        id_entite=entite.id_entite,
        id_directeur=directeur_A.matricule,
    )
    db_session.add(direction_A)
    db_session.flush()

    # Direction B "Audit" avec son directeur
    directeur_B = add_employe(3020, 'DirAudit', 'DIRECTEUR')
    direction_B = models.Direction(
        nom='Audit',
        id_entite=entite.id_entite,
        id_directeur=directeur_B.matricule,
    )
    db_session.add(direction_B)
    db_session.flush()

    # Département A "Projets" rattaché à Direction A
    responsable_A = add_employe(2010, 'RespProjets', 'RESPONSABLE')
    dept_A = models.Departement(
        nom='Projets',
        id_entite=entite.id_entite,
        id_direction=direction_A.id_direction,
        id_responsable=responsable_A.matricule,
    )
    db_session.add(dept_A)
    db_session.flush()

    # Département B "Audit Interne" rattaché à Direction B
    responsable_B = add_employe(2020, 'RespAudit', 'RESPONSABLE')
    dept_B = models.Departement(
        nom='Audit Interne',
        id_entite=entite.id_entite,
        id_direction=direction_B.id_direction,
        id_responsable=responsable_B.matricule,
    )
    db_session.add(dept_B)
    db_session.flush()

    # Département C "Support" SANS direction (id_direction = NULL)
    responsable_C = add_employe(2030, 'RespSupport', 'RESPONSABLE')
    dept_C = models.Departement(
        nom='Support',
        id_entite=entite.id_entite,
        id_direction=None,
        id_responsable=responsable_C.matricule,
    )
    db_session.add(dept_C)
    db_session.flush()

    # Seed DG + RH + PCA (validateurs finaux de la séquence)
    dg = add_employe(4001, 'Dg', 'DG')
    rh = add_employe(5001, 'Rh', 'RH')
    pca = add_employe(7001, 'Pca', 'PCA')

    db_session.commit()

    return {
        'entite': entite,
        'direction_A': direction_A,
        'direction_B': direction_B,
        'directeur_A': directeur_A,
        'directeur_B': directeur_B,
        'dept_A': dept_A,
        'dept_B': dept_B,
        'dept_C': dept_C,
        'responsable_A': responsable_A,
        'responsable_B': responsable_B,
        'responsable_C': responsable_C,
        'roles': roles,
        'dg': dg,
        'rh': rh,
        'pca': pca,
    }


def _add_employe(db_session, matricule, role_id, dept_id, id_direction, id_entite):
    emp = models.Employe(
        matricule=matricule,
        nom='Emp',
        prenom=f'M{matricule}',
        email=f'{matricule}@example.com',
        date_embauche=date(2024, 1, 1),
        dept_id=dept_id,
        id_direction=id_direction,
        id_entite=id_entite,
        id_role=role_id,
        fonction='EMPLOYE',
        sexe='M',
    )
    db_session.add(emp)
    db_session.flush()
    db_session.add(models.Utilisateur(
        matricule=matricule,
        email=f'{matricule}@example.com',
        role_id=role_id,
        mot_de_passe_hash=hash_password('PasswordTemp123!'),
        mot_de_passe_temporaire=False,
        mfa_enabled=False,
        mfa_active=False,
    ))
    db_session.flush()
    return emp


# ---------------------------------------------------------------------------
# Tests — Bug 1 : routage DIRECTEUR basé sur la direction du département
# ---------------------------------------------------------------------------

def test_dept_avec_direction_route_vers_directeur_de_sa_direction(db_session, org_two_directions):
    """Scénario bug signalé : employé du dept 'Projets' (Direction A) avec
    `id_direction` pointant par erreur vers la Direction B (Audit).
    Le validateur DIRECTEUR doit être celui de la Direction A, pas de l'Audit.
    """
    data = org_two_directions
    emp = _add_employe(
        db_session,
        matricule=1010,
        role_id=data['roles']['EMPLOYE'].id,
        dept_id=data['dept_A'].dept_id,               # département Projets (Direction A)
        id_direction=data['direction_B'].id_direction,  # ← INCOHÉRENT : pointe vers Audit
        id_entite=data['entite'].id_entite,
    )

    validateur = obtenir_validateur_pour_role(emp, 'DIRECTEUR', db_session)

    assert validateur == data['directeur_A'].matricule, (
        f"La demande devrait aller au directeur de la Direction A (Organisation et Projet, "
        f"matricule {data['directeur_A'].matricule}), pas au directeur de l'Audit "
        f"(matricule {data['directeur_B'].matricule}). Reçu: {validateur}"
    )
    assert validateur != data['directeur_B'].matricule


def test_dept_audit_route_vers_directeur_audit(db_session, org_two_directions):
    """Cas normal : employé du département Audit → routé vers le directeur de l'Audit."""
    data = org_two_directions
    emp = _add_employe(
        db_session,
        matricule=1020,
        role_id=data['roles']['EMPLOYE'].id,
        dept_id=data['dept_B'].dept_id,
        id_direction=data['direction_B'].id_direction,
        id_entite=data['entite'].id_entite,
    )

    validateur = obtenir_validateur_pour_role(emp, 'DIRECTEUR', db_session)

    assert validateur == data['directeur_B'].matricule


def test_deux_directions_distinctes_ont_validateurs_differents(db_session, org_two_directions):
    """Deux employés de deux directions différentes → deux validateurs différents."""
    data = org_two_directions
    emp_A = _add_employe(
        db_session, 1011, data['roles']['EMPLOYE'].id,
        dept_id=data['dept_A'].dept_id,
        id_direction=data['direction_A'].id_direction,
        id_entite=data['entite'].id_entite,
    )
    emp_B = _add_employe(
        db_session, 1021, data['roles']['EMPLOYE'].id,
        dept_id=data['dept_B'].dept_id,
        id_direction=data['direction_B'].id_direction,
        id_entite=data['entite'].id_entite,
    )

    val_A = obtenir_validateur_pour_role(emp_A, 'DIRECTEUR', db_session)
    val_B = obtenir_validateur_pour_role(emp_B, 'DIRECTEUR', db_session)

    assert val_A == data['directeur_A'].matricule
    assert val_B == data['directeur_B'].matricule
    assert val_A != val_B


def test_employe_sans_dept_utilise_id_direction_fallback(db_session, org_two_directions):
    """Si l'employé n'a pas de département, le fallback utilise `id_direction`."""
    data = org_two_directions
    emp = _add_employe(
        db_session, 1030, data['roles']['EMPLOYE'].id,
        dept_id=None,
        id_direction=data['direction_A'].id_direction,
        id_entite=data['entite'].id_entite,
    )

    validateur = obtenir_validateur_pour_role(emp, 'DIRECTEUR', db_session)

    assert validateur == data['directeur_A'].matricule


# ---------------------------------------------------------------------------
# Tests — Bug 2 : département sans direction → RESPONSABLE valide
# ---------------------------------------------------------------------------

def test_dept_sans_direction_sequence_contient_responsable_pas_directeur(db_session, org_two_directions):
    """Département sans direction rattachée → la séquence commence par RESPONSABLE,
    pas par DIRECTEUR.
    """
    data = org_two_directions
    emp = _add_employe(
        db_session, 1040, data['roles']['EMPLOYE'].id,
        dept_id=data['dept_C'].dept_id,   # dept SANS direction
        id_direction=None,
        id_entite=data['entite'].id_entite,
    )

    sequence = determiner_sequence_validation(emp, db_session)

    assert 'RESPONSABLE' in sequence, f"Séquence attendue contient RESPONSABLE, reçu: {sequence}"
    assert 'DIRECTEUR' not in sequence, (
        f"Un dept sans direction ne doit PAS déclencher une validation DIRECTEUR. "
        f"Reçu: {sequence}"
    )


def test_dept_sans_direction_id_direction_stale_ignore(db_session, org_two_directions):
    """Même avec `employe.id_direction` renseigné (valeur stale), si le département
    n'a pas de direction, la séquence passe par le RESPONSABLE du département
    (bug 2 : le `elif employe.id_direction` bypassait cette règle).
    """
    data = org_two_directions
    emp = _add_employe(
        db_session, 1041, data['roles']['EMPLOYE'].id,
        dept_id=data['dept_C'].dept_id,                # dept sans direction
        id_direction=data['direction_B'].id_direction,  # ← stale / hérité
        id_entite=data['entite'].id_entite,
    )

    sequence = determiner_sequence_validation(emp, db_session)

    assert 'RESPONSABLE' in sequence
    assert 'DIRECTEUR' not in sequence, (
        f"La règle 'dept sans direction → RESPONSABLE' doit s'appliquer même si "
        f"employe.id_direction est renseigné. Reçu: {sequence}"
    )


def test_dept_sans_direction_prochain_validateur_est_responsable(db_session, org_two_directions):
    """Sur une opération créée par un employé d'un dept sans direction,
    `obtenir_prochain_validateur` doit pointer vers le RESPONSABLE du département.
    """
    data = org_two_directions
    emp = _add_employe(
        db_session, 1042, data['roles']['EMPLOYE'].id,
        dept_id=data['dept_C'].dept_id,
        id_direction=None,
        id_entite=data['entite'].id_entite,
    )
    op = models.Operation(
        matricule=emp.matricule,
        type_demande='Congé',
        titre='Congé test',
        statut='en attente',
        date_debut=date(2026, 6, 1),
        date_fin=date(2026, 6, 3),
        duree_jours=3,
        duree=3,
        motif='Repos',
    )
    db_session.add(op)
    db_session.commit()

    role, matricule = obtenir_prochain_validateur(op.id_operation, db_session)

    assert role == 'RESPONSABLE'
    assert matricule == data['responsable_C'].matricule


def test_dept_avec_direction_sequence_contient_directeur_regression(db_session, org_two_directions):
    """Non-régression : un employé d'un dept rattaché à une direction a bien
    DIRECTEUR dans sa séquence de validation (règle standard).
    """
    data = org_two_directions
    emp = _add_employe(
        db_session, 1050, data['roles']['EMPLOYE'].id,
        dept_id=data['dept_A'].dept_id,
        id_direction=data['direction_A'].id_direction,
        id_entite=data['entite'].id_entite,
    )

    sequence = determiner_sequence_validation(emp, db_session)

    assert 'DIRECTEUR' in sequence
    assert 'RESPONSABLE' not in sequence  # court-circuit : le directeur remplace le responsable
    # Vérifier l'ordre : DIRECTEUR avant RH avant DG
    assert sequence.index('DIRECTEUR') < sequence.index('RH')
    assert sequence.index('RH') < sequence.index('DG')
