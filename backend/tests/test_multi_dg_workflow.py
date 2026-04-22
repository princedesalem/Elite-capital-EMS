"""
Tests pour le workflow multi-DG :
- DIRECTEUR ou RESPONSABLE qui fait une demande → l'étape DG figure dans le
  workflow, quelle que soit l'entité (y compris ECG).
- S'il existe plusieurs DG dans l'application, tous doivent valider avant
  passage au validateur terminal (PCA/AG).
- Les étapes DG doivent être exposées comme parallèles dans la progression.
"""
from datetime import date, datetime

import pytest

from app import models
from app.utils.security import hash_password
from app.utils import workflow as wf


def _add_emp(db_session, matricule, prenom, nom, role_obj, entite, dept_id=None, id_direction=None):
    emp = models.Employe(
        matricule=matricule, nom=nom, prenom=prenom,
        email=f'{matricule}@example.com',
        date_embauche=date(2024, 1, 1),
        dept_id=dept_id, id_direction=id_direction,
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
def org_multi_dg(db_session):
    """Deux entités (ELCAM + ECG), 2 DG distincts, un DIRECTEUR et un
    RESPONSABLE dans ELCAM, plus RH/PCA/AG pour boucler la séquence."""
    entite_elcam = models.Entite(nom='ELCAM')
    entite_ecg = models.Entite(nom='ECG')
    db_session.add_all([entite_elcam, entite_ecg])
    db_session.flush()

    roles = {}
    for name in ['EMPLOYE', 'RESPONSABLE', 'DIRECTEUR', 'DG', 'RH', 'PCA', 'AG', 'ADMIN']:
        r = models.Role(name=name, description=name)
        db_session.add(r)
        db_session.flush()
        roles[name] = r

    # Direction + département ELCAM
    dir_elcam = models.Direction(nom='Direction ELCAM', id_entite=entite_elcam.id_entite)
    db_session.add(dir_elcam)
    db_session.flush()
    dept_elcam = models.Departement(
        nom='Dept ELCAM', id_entite=entite_elcam.id_entite,
        id_direction=dir_elcam.id_direction,
    )
    db_session.add(dept_elcam)
    db_session.flush()

    directeur = _add_emp(db_session, 3001, 'Dir', 'Elcam', roles['DIRECTEUR'],
                         entite_elcam, dept_id=dept_elcam.dept_id,
                         id_direction=dir_elcam.id_direction)
    responsable = _add_emp(db_session, 2001, 'Resp', 'Elcam', roles['RESPONSABLE'],
                           entite_elcam, dept_id=dept_elcam.dept_id)
    dir_elcam.id_directeur = directeur.matricule
    dept_elcam.id_responsable = responsable.matricule

    # Deux DG : un sur ELCAM, un sur ECG (toutes entités confondues)
    dg1 = _add_emp(db_session, 4001, 'Dg', 'Un', roles['DG'], entite_elcam)
    dg2 = _add_emp(db_session, 4002, 'Dg', 'Deux', roles['DG'], entite_ecg)

    rh = _add_emp(db_session, 5001, 'Rh', 'User', roles['RH'], entite_elcam)
    pca = _add_emp(db_session, 7001, 'Pca', 'User', roles['PCA'], entite_elcam)
    ag = _add_emp(db_session, 7002, 'Ag', 'User', roles['AG'], entite_ecg)

    # Direction + dept ECG pour demandeurs ECG
    dir_ecg = models.Direction(nom='Direction ECG', id_entite=entite_ecg.id_entite)
    db_session.add(dir_ecg)
    db_session.flush()
    dept_ecg = models.Departement(
        nom='Dept ECG', id_entite=entite_ecg.id_entite,
        id_direction=dir_ecg.id_direction,
    )
    db_session.add(dept_ecg)
    db_session.flush()

    directeur_ecg = _add_emp(db_session, 3002, 'Dir', 'Ecg', roles['DIRECTEUR'],
                             entite_ecg, dept_id=dept_ecg.dept_id,
                             id_direction=dir_ecg.id_direction)
    responsable_ecg = _add_emp(db_session, 2002, 'Resp', 'Ecg', roles['RESPONSABLE'],
                               entite_ecg, dept_id=dept_ecg.dept_id)
    dir_ecg.id_directeur = directeur_ecg.matricule
    dept_ecg.id_responsable = responsable_ecg.matricule

    db_session.commit()

    return {
        'entite_elcam': entite_elcam, 'entite_ecg': entite_ecg,
        'roles': roles,
        'directeur': directeur, 'responsable': responsable,
        'directeur_ecg': directeur_ecg, 'responsable_ecg': responsable_ecg,
        'dg1': dg1, 'dg2': dg2, 'rh': rh, 'pca': pca, 'ag': ag,
    }


def _make_op(db_session, demandeur):
    op = models.Operation(
        matricule=demandeur.matricule,
        type_demande='Congé',
        titre='Congé annuel',
        statut='en attente',
        date_debut=date(2026, 6, 1),
        date_fin=date(2026, 6, 3),
        duree_jours=3,
        duree=3,
        motif='Repos',
    )
    db_session.add(op)
    db_session.commit()
    db_session.refresh(op)
    return op


# ------- Séquence --------

def test_directeur_elcam_a_dg_dans_sequence(db_session, org_multi_dg):
    op = _make_op(db_session, org_multi_dg['directeur'])
    seq = wf.determiner_sequence_validation(org_multi_dg['directeur'], db_session, op.id_operation)
    assert 'DG' in seq
    assert seq.index('DG') < seq.index('PCA')


def test_directeur_ecg_a_dg_dans_sequence(db_session, org_multi_dg):
    """Régression : pour ECG, l'étape DG doit maintenant être présente."""
    op = _make_op(db_session, org_multi_dg['directeur_ecg'])
    seq = wf.determiner_sequence_validation(org_multi_dg['directeur_ecg'], db_session, op.id_operation)
    assert 'DG' in seq
    assert seq.index('DG') < seq.index('AG')


def test_responsable_elcam_a_dg_dans_sequence(db_session, org_multi_dg):
    op = _make_op(db_session, org_multi_dg['responsable'])
    seq = wf.determiner_sequence_validation(org_multi_dg['responsable'], db_session, op.id_operation)
    assert 'DG' in seq
    assert 'DIRECTEUR' not in seq  # un RESPONSABLE ne passe pas par un DIRECTEUR
    assert seq.index('DG') < seq.index('PCA')


def test_responsable_ecg_a_dg_dans_sequence(db_session, org_multi_dg):
    op = _make_op(db_session, org_multi_dg['responsable_ecg'])
    seq = wf.determiner_sequence_validation(org_multi_dg['responsable_ecg'], db_session, op.id_operation)
    assert 'DG' in seq
    assert 'DIRECTEUR' not in seq
    assert seq.index('DG') < seq.index('AG')


# ------- Multi-DG : prochain validateur --------

def test_deux_dg_prochain_validateur_est_premier_dg(db_session, org_multi_dg):
    """Quand le workflow arrive à DG, le 1er DG non-validé est le prochain."""
    op = _make_op(db_session, org_multi_dg['directeur'])
    # RH valide d'abord
    db_session.add(models.Validation(
        id_operation=op.id_operation,
        matricule_validateur=org_multi_dg['rh'].matricule,
        role_validateur='RH',
        statut_validation='validé',
        timestamp_action=datetime.utcnow(),
    ))
    db_session.commit()

    role, matricule = wf.obtenir_prochain_validateur(op.id_operation, db_session)
    assert role == 'DG'
    assert matricule == org_multi_dg['dg1'].matricule  # 4001 < 4002


def test_premier_dg_valide_prochain_est_second_dg(db_session, org_multi_dg):
    op = _make_op(db_session, org_multi_dg['directeur'])
    for role_name, matricule in [
        ('RH', org_multi_dg['rh'].matricule),
        ('DG', org_multi_dg['dg1'].matricule),
    ]:
        db_session.add(models.Validation(
            id_operation=op.id_operation,
            matricule_validateur=matricule,
            role_validateur=role_name,
            statut_validation='validé',
            timestamp_action=datetime.utcnow(),
        ))
    db_session.commit()

    role, matricule = wf.obtenir_prochain_validateur(op.id_operation, db_session)
    assert role == 'DG'
    assert matricule == org_multi_dg['dg2'].matricule


def test_tous_dg_valides_prochain_est_pca(db_session, org_multi_dg):
    op = _make_op(db_session, org_multi_dg['directeur'])
    for role_name, matricule in [
        ('RH', org_multi_dg['rh'].matricule),
        ('DG', org_multi_dg['dg1'].matricule),
        ('DG', org_multi_dg['dg2'].matricule),
    ]:
        db_session.add(models.Validation(
            id_operation=op.id_operation,
            matricule_validateur=matricule,
            role_validateur=role_name,
            statut_validation='validé',
            timestamp_action=datetime.utcnow(),
        ))
    db_session.commit()

    role, matricule = wf.obtenir_prochain_validateur(op.id_operation, db_session)
    assert role == 'PCA'
    assert matricule == org_multi_dg['pca'].matricule


def test_tous_dg_valides_pour_ecg_prochain_est_ag(db_session, org_multi_dg):
    op = _make_op(db_session, org_multi_dg['directeur_ecg'])
    for role_name, matricule in [
        ('RH', org_multi_dg['rh'].matricule),
        ('DG', org_multi_dg['dg1'].matricule),
        ('DG', org_multi_dg['dg2'].matricule),
    ]:
        db_session.add(models.Validation(
            id_operation=op.id_operation,
            matricule_validateur=matricule,
            role_validateur=role_name,
            statut_validation='validé',
            timestamp_action=datetime.utcnow(),
        ))
    db_session.commit()

    role, matricule = wf.obtenir_prochain_validateur(op.id_operation, db_session)
    assert role == 'AG'
    assert matricule == org_multi_dg['ag'].matricule


# ------- valider_operation: anti-double, flow complet --------

def test_dg_ne_peut_pas_valider_deux_fois(db_session, org_multi_dg):
    op = _make_op(db_session, org_multi_dg['directeur'])
    # RH valide
    wf.valider_operation(op.id_operation, org_multi_dg['rh'].matricule, 'validé', None, db_session)
    # DG1 valide
    ok, _ = wf.valider_operation(op.id_operation, org_multi_dg['dg1'].matricule, 'validé', None, db_session)
    assert ok is True
    # DG1 essaie à nouveau
    ok2, msg = wf.valider_operation(op.id_operation, org_multi_dg['dg1'].matricule, 'validé', None, db_session)
    assert ok2 is False
    assert 'déjà' in msg.lower()


def test_flow_multi_dg_complet_aboutit_a_validation(db_session, org_multi_dg):
    """Flow complet : RH → DG1 → DG2 → PCA → statut 'validé'."""
    op = _make_op(db_session, org_multi_dg['directeur'])
    wf.valider_operation(op.id_operation, org_multi_dg['rh'].matricule, 'validé', None, db_session)
    wf.valider_operation(op.id_operation, org_multi_dg['dg1'].matricule, 'validé', None, db_session)
    # après DG1, statut toujours 'en attente' (DG2 manque)
    db_session.refresh(op)
    assert op.statut == 'en attente'
    wf.valider_operation(op.id_operation, org_multi_dg['dg2'].matricule, 'validé', None, db_session)
    db_session.refresh(op)
    assert op.statut == 'en attente'
    # PCA clôt
    wf.valider_operation(op.id_operation, org_multi_dg['pca'].matricule, 'validé', None, db_session)
    db_session.refresh(op)
    assert op.statut == 'validé'


# ------- Progression endpoint : étapes parallèles --------

def test_progression_expose_deux_etapes_dg_paralleles(db_session, client, org_multi_dg):
    op = _make_op(db_session, org_multi_dg['directeur'])

    r = client.get(f'/api/workflow/progression/{op.id_operation}')
    assert r.status_code == 200
    data = r.json()

    etapes_dg = [e for e in data['etapes'] if e['role'] == 'DG']
    assert len(etapes_dg) == 2

    matricules_dg = {e['matricule_validateur_attendu'] for e in etapes_dg}
    assert matricules_dg == {
        org_multi_dg['dg1'].matricule,
        org_multi_dg['dg2'].matricule,
    }

    for e in etapes_dg:
        assert e['parallele'] is True
        assert e['groupe'] == 'DG'
        assert e['statut'] == 'en attente'


def test_progression_un_seul_dg_non_parallele(db_session, client, org_multi_dg):
    """Si un seul DG dans l'app, l'étape reste unique et non marquée parallèle."""
    # Supprimer dg2 (user + employe)
    db_session.query(models.Utilisateur).filter(
        models.Utilisateur.matricule == org_multi_dg['dg2'].matricule
    ).delete()
    db_session.query(models.Employe).filter(
        models.Employe.matricule == org_multi_dg['dg2'].matricule
    ).delete()
    db_session.commit()

    op = _make_op(db_session, org_multi_dg['directeur'])
    r = client.get(f'/api/workflow/progression/{op.id_operation}')
    assert r.status_code == 200
    data = r.json()

    etapes_dg = [e for e in data['etapes'] if e['role'] == 'DG']
    assert len(etapes_dg) == 1
    assert etapes_dg[0]['parallele'] is False
    assert etapes_dg[0]['matricule_validateur_attendu'] == org_multi_dg['dg1'].matricule


def test_progression_apres_un_dg_valide_autre_en_attente(db_session, client, org_multi_dg):
    op = _make_op(db_session, org_multi_dg['directeur'])
    wf.valider_operation(op.id_operation, org_multi_dg['rh'].matricule, 'validé', None, db_session)
    wf.valider_operation(op.id_operation, org_multi_dg['dg1'].matricule, 'validé', None, db_session)

    r = client.get(f'/api/workflow/progression/{op.id_operation}')
    data = r.json()

    etapes_dg = [e for e in data['etapes'] if e['role'] == 'DG']
    assert len(etapes_dg) == 2
    etape_dg1 = next(e for e in etapes_dg if e['matricule_validateur_attendu'] == org_multi_dg['dg1'].matricule)
    etape_dg2 = next(e for e in etapes_dg if e['matricule_validateur_attendu'] == org_multi_dg['dg2'].matricule)
    assert etape_dg1['statut'] == 'validé'
    assert etape_dg2['statut'] == 'en attente'


# ------- Non-régression --------

def test_employe_simple_workflow_inchange(db_session, org_multi_dg):
    """Un EMPLOYE lambda (non DIRECTEUR/RESPONSABLE) garde son workflow existant
    (DG déjà présent non-ECG, pas de changement)."""
    emp = _add_emp(
        db_session, 1001, 'Emp', 'Basic', org_multi_dg['roles']['EMPLOYE'],
        org_multi_dg['entite_elcam'],
        dept_id=None, id_direction=None,
    )
    op = _make_op(db_session, emp)
    seq = wf.determiner_sequence_validation(emp, db_session, op.id_operation)
    assert 'RESPONSABLE' in seq
    assert 'DG' in seq
    assert seq.index('DG') < seq.index('PCA')


def test_helper_obtenir_tous_matricules_dg(db_session, org_multi_dg):
    matricules = wf.obtenir_tous_matricules_dg(db_session)
    assert matricules == [
        org_multi_dg['dg1'].matricule,
        org_multi_dg['dg2'].matricule,
    ]
