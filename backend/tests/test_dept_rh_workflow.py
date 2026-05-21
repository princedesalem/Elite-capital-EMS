"""
Tests pour la visibilité RH lecture seule.

Couvre :
- est_dans_dept_ou_direction_rh()
- obtenir_recu_rh_lecture()
- /boite/{matricule} → est_dept_rh + recu_rh_lecture
- /valider/{id_operation} → 403 pour employé RH dept sans rôle RH
"""
from datetime import date
import pytest
from app import models
from app.utils.security import hash_password
from app.utils.workflow import est_dans_dept_ou_direction_rh, obtenir_recu_rh_lecture


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_role(db, name):
    r = models.Role(name=name, description=f'Role {name}')
    db.add(r)
    db.flush()
    return r


def _make_entite(db, nom='ELCAM'):
    e = models.Entite(nom=nom)
    db.add(e)
    db.flush()
    return e


def _make_direction(db, nom, id_entite, id_localisation=None):
    d = models.Direction(nom=nom, id_entite=id_entite, id_localisation=id_localisation)
    db.add(d)
    db.flush()
    return d


def _make_departement(db, nom, id_entite, id_direction=None):
    dep = models.Departement(nom=nom, id_entite=id_entite, id_direction=id_direction)
    db.add(dep)
    db.flush()
    return dep


def _make_employe_user(db, matricule, nom, prenom, role, dept_id=None, id_direction=None, id_entite=None):
    emp = models.Employe(
        matricule=matricule,
        nom=nom,
        prenom=prenom,
        email=f'{matricule}@test.com',
        date_embauche=date(2024, 1, 1),
        dept_id=dept_id,
        id_direction=id_direction,
        id_entite=id_entite,
        id_role=role.id,
        fonction=role.name,
    )
    db.add(emp)
    db.flush()
    usr = models.Utilisateur(
        matricule=matricule,
        email=f'{matricule}@test.com',
        role_id=role.id,
        mot_de_passe_hash=hash_password('PasswordTemp123!'),
        mot_de_passe_temporaire=False,
        mfa_enabled=False,
        mfa_active=False,
    )
    db.add(usr)
    db.flush()
    return emp, usr


def _make_operation(db, matricule, statut='en attente', type_demande='Congé'):
    op = models.Operation(
        matricule=matricule,
        type_demande=type_demande,
        titre='Test op',
        statut=statut,
        date_debut=date(2026, 6, 1),
        date_fin=date(2026, 6, 5),
        duree_jours=3,
        motif='Test',
    )
    db.add(op)
    db.flush()
    db.commit()
    db.refresh(op)
    return op


# ---------------------------------------------------------------------------
# Fixtures locales (indépendantes de conftest)
# ---------------------------------------------------------------------------

@pytest.fixture()
def rh_dept_refs(db_session):
    """
    Monte un jeu de données avec :
    - Un département "Ressources Humaines"
    - Un employé EMPLOYE dans ce département (mat 8001)
    - Un employé avec rôle RH dans ce département (mat 8002)
    - Un employé EMPLOYE dans un département ordinaire (mat 8003)
    """
    entite = _make_entite(db_session)

    pays = models.Pays(nom_pays='Cameroun', code_pays='CM')
    db_session.add(pays)
    db_session.flush()

    loc = models.Localisation(ville='Yaoundé', id_pays=pays.id_pays)
    db_session.add(loc)
    db_session.flush()

    # Direction "Ressources Humaines"
    direction_rh = _make_direction(db_session, 'Direction Ressources Humaines', entite.id_entite, loc.id_localisation)
    # Département "Ressources Humaines"
    dept_rh = _make_departement(db_session, 'Ressources Humaines', entite.id_entite, direction_rh.id_direction)
    # Département ordinaire
    dept_ops = _make_departement(db_session, 'Opérations', entite.id_entite)

    role_emp  = _make_role(db_session, 'EMPLOYE')
    role_rh   = _make_role(db_session, 'RH')
    role_dg   = _make_role(db_session, 'DG')
    role_pca  = _make_role(db_session, 'PCA')
    role_resp = _make_role(db_session, 'RESPONSABLE')

    # Employé dans le département RH, sans rôle RH
    emp_dept_rh, _ = _make_employe_user(
        db_session, 8001, 'Dept', 'RhEmp', role_emp,
        dept_id=dept_rh.dept_id, id_entite=entite.id_entite
    )
    # Responsable RH (rôle RH) dans le même département
    emp_rh, _ = _make_employe_user(
        db_session, 8002, 'Rh', 'Responsable', role_rh,
        dept_id=dept_rh.dept_id, id_entite=entite.id_entite
    )
    # Employé dans un département ordinaire
    emp_ops, _ = _make_employe_user(
        db_session, 8003, 'Ops', 'Emp', role_emp,
        dept_id=dept_ops.dept_id, id_entite=entite.id_entite
    )
    # DG (pour compléter les séquences de validation)
    emp_dg, _ = _make_employe_user(
        db_session, 8004, 'Dg', 'One', role_dg,
        id_entite=entite.id_entite
    )

    dept_rh.id_responsable = emp_rh.matricule
    db_session.flush()
    db_session.commit()

    return {
        'entite': entite,
        'dept_rh': dept_rh,
        'dept_ops': dept_ops,
        'direction_rh': direction_rh,
        'emp_dept_rh': emp_dept_rh,
        'emp_rh': emp_rh,
        'emp_ops': emp_ops,
        'emp_dg': emp_dg,
        'role_emp': role_emp,
        'role_rh': role_rh,
    }


# ---------------------------------------------------------------------------
# Tests unitaires (utils)
# ---------------------------------------------------------------------------

def test_est_dans_dept_rh_true(db_session, rh_dept_refs):
    """Employé dans un département nommé 'Ressources Humaines' → True."""
    emp = rh_dept_refs['emp_dept_rh']
    assert est_dans_dept_ou_direction_rh(emp.matricule, db_session) is True


def test_est_dans_dept_rh_false(db_session, rh_dept_refs):
    """Employé dans un département ordinaire → False."""
    emp = rh_dept_refs['emp_ops']
    assert est_dans_dept_ou_direction_rh(emp.matricule, db_session) is False


def test_est_dans_direction_rh_true(db_session, rh_dept_refs, db_session_with_direction_only=None):
    """
    Employé rattaché directement à une direction 'Ressources Humaines'
    (sans passer par un département) → True.
    """
    entite = rh_dept_refs['entite']
    role_emp = rh_dept_refs['role_emp']
    direction_rh = rh_dept_refs['direction_rh']

    emp_dir, _ = _make_employe_user(
        db_session, 8010, 'Dir', 'RhEmp', role_emp,
        dept_id=None,
        id_direction=direction_rh.id_direction,
        id_entite=entite.id_entite,
    )
    db_session.commit()
    assert est_dans_dept_ou_direction_rh(emp_dir.matricule, db_session) is True


def test_obtenir_recu_rh_lecture_includes_ops_waiting_for_rh(db_session, rh_dept_refs):
    """
    Une opération d'un employé Ops (séquence RESPONSABLE → RH → DG → PCA)
    doit apparaître dans obtenir_recu_rh_lecture() quand son prochain validateur
    est RH.
    """
    emp_ops = rh_dept_refs['emp_ops']
    emp_rh  = rh_dept_refs['emp_rh']

    op = _make_operation(db_session, emp_ops.matricule)

    # Simuler que le RESPONSABLE a déjà validé → prochain est RH
    val = models.Validation(
        id_operation=op.id_operation,
        matricule_validateur=999,
        role_validateur='RESPONSABLE',
        statut_validation='validé',
        commentaire='OK',
    )
    db_session.add(val)
    db_session.commit()

    result = obtenir_recu_rh_lecture(db_session)
    ids = [o.id_operation for o in result]
    assert op.id_operation in ids


# ---------------------------------------------------------------------------
# Tests endpoint /boite/{matricule}
# ---------------------------------------------------------------------------

def test_boite_est_dept_rh_flag(client, rh_dept_refs, auth_headers):
    """
    GET /api/workflow/boite/{matricule} retourne est_dept_rh=True pour
    un employé dans le département RH sans rôle RH.
    """
    emp = rh_dept_refs['emp_dept_rh']
    headers = auth_headers(emp.matricule, 'EMPLOYE')
    resp = client.get(f'/api/workflow/boite/{emp.matricule}', headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data.get('est_dept_rh') is True
    assert 'recu_rh_lecture' in data


def test_boite_non_dept_rh_no_lecture_section(client, rh_dept_refs, auth_headers):
    """
    GET /api/workflow/boite/{matricule} retourne est_dept_rh=False pour
    un employé hors département RH.
    """
    emp = rh_dept_refs['emp_ops']
    headers = auth_headers(emp.matricule, 'EMPLOYE')
    resp = client.get(f'/api/workflow/boite/{emp.matricule}', headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data.get('est_dept_rh') is False
    assert data.get('recu_rh_lecture') == []


# ---------------------------------------------------------------------------
# Tests endpoint /valider/{id_operation}
# ---------------------------------------------------------------------------

def test_valider_dept_rh_non_role_rh_est_refuse(db_session, client, rh_dept_refs, auth_headers):
    """
    POST /api/workflow/valider/{id_operation} avec un employé du dept RH
    mais sans rôle RH → 403.
    """
    emp_ops = rh_dept_refs['emp_ops']
    emp_dept_rh = rh_dept_refs['emp_dept_rh']

    op = _make_operation(db_session, emp_ops.matricule)

    headers = auth_headers(emp_dept_rh.matricule, 'EMPLOYE')
    resp = client.post(
        f'/api/workflow/valider/{op.id_operation}',
        headers=headers,
        params={'matricule_validateur': emp_dept_rh.matricule, 'statut': 'validé'},
    )
    assert resp.status_code == 403


def test_valider_role_rh_dans_dept_rh_est_accepte(db_session, client, rh_dept_refs, auth_headers):
    """
    POST /api/workflow/valider/{id_operation} avec un employé ayant le rôle
    RH (même s'il est dans le dept RH) → pas de 403 (400 ou 200 selon séquence).
    """
    emp_ops = rh_dept_refs['emp_ops']
    emp_rh  = rh_dept_refs['emp_rh']

    op = _make_operation(db_session, emp_ops.matricule)
    # Ajouter validation RESPONSABLE pour que le prochain validateur soit RH
    val = models.Validation(
        id_operation=op.id_operation,
        matricule_validateur=9999,
        role_validateur='RESPONSABLE',
        statut_validation='validé',
        commentaire='OK',
    )
    db_session.add(val)
    db_session.commit()

    headers = auth_headers(emp_rh.matricule, 'RH')
    resp = client.post(
        f'/api/workflow/valider/{op.id_operation}',
        headers=headers,
        params={'matricule_validateur': emp_rh.matricule, 'statut': 'validé'},
    )
    # 200 (success) or 400 (workflow logic issue) – must NOT be 403
    assert resp.status_code != 403
