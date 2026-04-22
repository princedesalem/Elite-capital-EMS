"""
Tests : toute demande de frais (opération avec au moins une ligne de Frais)
doit insérer la DG dans le workflow avant le PCA/AG, quelle que soit l'entité
du demandeur (y compris ECG) et quel que soit son rôle (EMPLOYE, RH, etc.).

Régression visée : avant ce correctif, un EMPLOYE ECG ou un RH ECG avec frais
allait directement RH → DFC → AG sans passer par la DG.
"""
from datetime import date, datetime

import pytest

from app import models
from app.utils.security import hash_password
from app.utils import workflow as wf


def _add_emp(db_session, matricule, prenom, nom, role_obj, entite, dept_id=None,
             id_direction=None, n1=None):
    emp = models.Employe(
        matricule=matricule, nom=nom, prenom=prenom,
        email=f'{matricule}@example.com',
        date_embauche=date(2024, 1, 1),
        dept_id=dept_id, id_direction=id_direction, n1=n1,
        id_entite=entite.id_entite,
        id_role=role_obj.id,
        fonction=role_obj.name, sexe='M',
    )
    db_session.add(emp)
    db_session.flush()
    db_session.add(models.Utilisateur(
        matricule=matricule, email=f'{matricule}@example.com',
        role_id=role_obj.id,
        mot_de_passe_hash=hash_password('Pw123!'),
        mot_de_passe_temporaire=False, mfa_enabled=False, mfa_active=False,
    ))
    db_session.flush()
    return emp


@pytest.fixture()
def org_frais(db_session):
    """Org minimale avec ELCAM + ECG, un DG, un RH, un PCA, un AG, et des
    employés + RH dans chaque entité. Pas de DIRECTEUR/RESPONSABLE ici : on
    teste les branches EMPLOYE simple et RH, là où la DG manquait pour ECG."""
    entite_elcam = models.Entite(nom='ELCAM')
    entite_ecg = models.Entite(nom='ECG')
    db_session.add_all([entite_elcam, entite_ecg])
    db_session.flush()

    roles = {}
    for name in ['EMPLOYE', 'RESPONSABLE', 'DIRECTEUR', 'DG', 'RH', 'DFC', 'PCA', 'AG']:
        r = models.Role(name=name, description=name)
        db_session.add(r)
        db_session.flush()
        roles[name] = r

    # Direction + dept ELCAM (pour qu'un EMPLOYE ELCAM passe DIRECTEUR → RH)
    dir_elcam = models.Direction(nom='Dir ELCAM', id_entite=entite_elcam.id_entite)
    db_session.add(dir_elcam)
    db_session.flush()
    dept_elcam = models.Departement(
        nom='Dept ELCAM', id_entite=entite_elcam.id_entite,
        id_direction=dir_elcam.id_direction,
    )
    db_session.add(dept_elcam)
    db_session.flush()
    directeur_elcam = _add_emp(db_session, 3001, 'Dir', 'Elcam',
                               roles['DIRECTEUR'], entite_elcam,
                               dept_id=dept_elcam.dept_id,
                               id_direction=dir_elcam.id_direction)
    dir_elcam.id_directeur = directeur_elcam.matricule

    # Direction + dept ECG (pour qu'un EMPLOYE ECG passe DIRECTEUR → RH)
    dir_ecg = models.Direction(nom='Dir ECG', id_entite=entite_ecg.id_entite)
    db_session.add(dir_ecg)
    db_session.flush()
    dept_ecg = models.Departement(
        nom='Dept ECG', id_entite=entite_ecg.id_entite,
        id_direction=dir_ecg.id_direction,
    )
    db_session.add(dept_ecg)
    db_session.flush()
    directeur_ecg = _add_emp(db_session, 3002, 'Dir', 'Ecg',
                             roles['DIRECTEUR'], entite_ecg,
                             dept_id=dept_ecg.dept_id,
                             id_direction=dir_ecg.id_direction)
    dir_ecg.id_directeur = directeur_ecg.matricule

    dg = _add_emp(db_session, 4001, 'Dg', 'Uno', roles['DG'], entite_elcam)
    rh_elcam = _add_emp(db_session, 5001, 'Rh', 'Elcam', roles['RH'], entite_elcam)
    rh_ecg = _add_emp(db_session, 5002, 'Rh', 'Ecg', roles['RH'], entite_ecg)
    _add_emp(db_session, 6001, 'Dfc', 'User', roles['DFC'], entite_elcam)
    _add_emp(db_session, 7001, 'Pca', 'User', roles['PCA'], entite_elcam)
    _add_emp(db_session, 7002, 'Ag', 'User', roles['AG'], entite_ecg)

    emp_elcam = _add_emp(db_session, 1001, 'Emp', 'Elcam', roles['EMPLOYE'],
                         entite_elcam, dept_id=dept_elcam.dept_id)
    emp_ecg = _add_emp(db_session, 1002, 'Emp', 'Ecg', roles['EMPLOYE'],
                       entite_ecg, dept_id=dept_ecg.dept_id)

    db_session.commit()
    return {
        'roles': roles,
        'entite_elcam': entite_elcam, 'entite_ecg': entite_ecg,
        'emp_elcam': emp_elcam, 'emp_ecg': emp_ecg,
        'rh_elcam': rh_elcam, 'rh_ecg': rh_ecg,
        'dg': dg,
    }


def _make_op_with_frais(db_session, demandeur, avec_frais=True):
    op = models.Operation(
        matricule=demandeur.matricule,
        type_demande='Mission',
        titre='Mission avec frais',
        statut='en attente',
        date_debut=date(2026, 6, 1),
        date_fin=date(2026, 6, 3),
        duree_jours=3,
        duree=3,
        motif='Mission terrain',
    )
    db_session.add(op)
    db_session.commit()
    db_session.refresh(op)
    if avec_frais:
        db_session.add(models.Frais(
            id_operation=op.id_operation,
            frais_transport_voyage=50000,
            total_frais=50000,
        ))
        db_session.commit()
    return op


# ------------- EMPLOYE : DG obligatoire pour frais, toutes entités -------------

def test_employe_elcam_frais_a_dg_avant_pca(db_session, org_frais):
    """ELCAM : EMPLOYE avec frais → DIRECTEUR, RH, DFC, DG, PCA (DG après DFC)."""
    op = _make_op_with_frais(db_session, org_frais['emp_elcam'])
    seq = wf.determiner_sequence_validation(org_frais['emp_elcam'], db_session, op.id_operation)
    assert 'DG' in seq
    assert 'DFC' in seq
    assert seq.index('DFC') < seq.index('DG') < seq.index('PCA')


def test_employe_ecg_frais_a_dg_avant_ag(db_session, org_frais):
    """Régression ECG : EMPLOYE ECG avec frais doit passer par DFC puis DG
    avant AG (la DG valide après le DFC)."""
    op = _make_op_with_frais(db_session, org_frais['emp_ecg'])
    seq = wf.determiner_sequence_validation(org_frais['emp_ecg'], db_session, op.id_operation)
    assert 'DG' in seq, f'La DG doit figurer dans la séquence ECG avec frais, got {seq}'
    assert 'DFC' in seq
    assert seq.index('DFC') < seq.index('DG') < seq.index('AG')


def test_employe_ecg_sans_frais_n_a_pas_dg(db_session, org_frais):
    """Non-régression : un EMPLOYE ECG SANS frais garde son workflow
    historique (pas de DG, pas de DFC), seulement DIRECTEUR → RH → AG."""
    op = _make_op_with_frais(db_session, org_frais['emp_ecg'], avec_frais=False)
    seq = wf.determiner_sequence_validation(org_frais['emp_ecg'], db_session, op.id_operation)
    assert 'DG' not in seq
    assert 'DFC' not in seq
    assert 'AG' in seq


# ------------- RH : DG obligatoire pour frais, toutes entités -------------

def test_rh_ecg_frais_a_dg_avant_ag(db_session, org_frais):
    """Régression ECG : un RH ECG avec frais doit passer par DFC puis DG avant AG."""
    op = _make_op_with_frais(db_session, org_frais['rh_ecg'])
    seq = wf.determiner_sequence_validation(org_frais['rh_ecg'], db_session, op.id_operation)
    assert 'DG' in seq
    assert 'DFC' in seq
    assert seq.index('DFC') < seq.index('DG') < seq.index('AG')
    # Le RH ne se valide pas lui-même
    assert 'RH' not in seq


def test_rh_ecg_sans_frais_n_a_pas_dg(db_session, org_frais):
    """Non-régression : RH ECG sans frais → séquence ECG historique (AG)."""
    op = _make_op_with_frais(db_session, org_frais['rh_ecg'], avec_frais=False)
    seq = wf.determiner_sequence_validation(org_frais['rh_ecg'], db_session, op.id_operation)
    assert 'DG' not in seq
    assert 'DFC' not in seq
    assert seq == ['AG']


def test_rh_elcam_frais_a_toujours_dg(db_session, org_frais):
    """Non-régression ELCAM : RH avec frais → DFC puis DG."""
    op = _make_op_with_frais(db_session, org_frais['rh_elcam'])
    seq = wf.determiner_sequence_validation(org_frais['rh_elcam'], db_session, op.id_operation)
    assert seq.index('DFC') < seq.index('DG') < seq.index('PCA')


# ------------- Prochain validateur : DG routé quand l'employé ECG a des frais ---

def test_prochain_validateur_employe_ecg_frais_atteint_dg(db_session, org_frais):
    """Quand DIRECTEUR, RH et DFC ont validé une demande de frais d'un EMPLOYE
    ECG, le prochain validateur doit être la DG (elle valide après le DFC)."""
    op = _make_op_with_frais(db_session, org_frais['emp_ecg'])

    # DIRECTEUR ECG valide
    db_session.add(models.Validation(
        id_operation=op.id_operation,
        matricule_validateur=3002,
        role_validateur='DIRECTEUR',
        statut_validation='validé',
        timestamp_action=datetime.utcnow(),
    ))
    # RH valide
    db_session.add(models.Validation(
        id_operation=op.id_operation,
        matricule_validateur=org_frais['rh_ecg'].matricule,
        role_validateur='RH',
        statut_validation='validé',
        timestamp_action=datetime.utcnow(),
    ))
    # DFC valide
    db_session.add(models.Validation(
        id_operation=op.id_operation,
        matricule_validateur=6001,
        role_validateur='DFC',
        statut_validation='validé',
        timestamp_action=datetime.utcnow(),
    ))
    db_session.commit()

    role, matricule = wf.obtenir_prochain_validateur(op.id_operation, db_session)
    assert role == 'DG'
    assert matricule == org_frais['dg'].matricule
