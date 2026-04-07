"""
Tests for PCA/AG self-service workflow:
1. Auto-validation at creation (empty validation sequence → statut='validé' immediately)
2. One-step activation (PCA/AG click Activer → COMPLETE without RH step)
3. One-step clôture (PCA/AG click Clôturer → COMPLETE without RH step)
4. RH Reçu tab includes PCA/AG validated operations
"""
from datetime import date, datetime
from decimal import Decimal

import pytest

from app import models
from app.utils import activation_cloture, workflow as wf_utils
from app.utils.security import hash_password


# ── Helpers ──────────────────────────────────────────────────────────────────


def _add_role(db, name):
    existing = db.query(models.Role).filter(models.Role.name == name).first()
    if existing:
        return existing
    r = models.Role(name=name, description=f'Role {name}')
    db.add(r)
    db.flush()
    return r


def _add_user(db, matricule, nom, prenom, role: models.Role, entite, direction, departement, solde=30):
    emp = db.query(models.Employe).filter(models.Employe.matricule == matricule).first()
    if not emp:
        emp = models.Employe(
            matricule=matricule,
            nom=nom,
            prenom=prenom,
            email=f'{matricule}@test.com',
            date_embauche=date(2020, 1, 1),
            id_entite=entite.id_entite,
            id_direction=direction.id_direction,
            dept_id=departement.dept_id,
            id_role=role.id,
            fonction=role.name,
            sexe='M',
            solde_conges=Decimal(str(solde)),
        )
        db.add(emp)
        db.flush()
    usr = db.query(models.Utilisateur).filter(models.Utilisateur.matricule == matricule).first()
    if not usr:
        usr = models.Utilisateur(
            matricule=matricule,
            email=f'{matricule}@test.com',
            role_id=role.id,
            mot_de_passe_hash=hash_password('Password123!'),
            mot_de_passe_temporaire=False,
            mfa_enabled=False,
            mfa_active=False,
        )
        db.add(usr)
        db.flush()
    return emp, usr


def _make_conge(db, matricule, solde_deduit=False):
    op = models.Operation(
        matricule=matricule,
        type_demande='Congé',
        titre='Test congé PCA/AG',
        statut='en attente',
        date_debut=date(2026, 5, 4),
        date_fin=date(2026, 5, 15),
        date_depart=date(2026, 5, 4),
        date_retour=date(2026, 5, 15),
        duree_jours=8,
        duree=8,
        motif='Vacances',
        solde_deduit=solde_deduit,
        cree_par=matricule,
    )
    db.add(op)
    db.flush()
    return op


def _complete_activation(db, id_operation, matricule):
    act = models.Activation(
        id_operation=id_operation,
        type_action=models.TypeActionEnum.ACTIVATION,
        demandeur_fait=True,
        date_demandeur=datetime.now(),
        rh_fait=True,
        date_rh=datetime.now(),
        statut_final=models.StatutFinalEnum.COMPLETE,
    )
    db.add(act)
    db.commit()


# ── Fixture: PCA user ─────────────────────────────────────────────────────────


@pytest.fixture()
def pca_setup(seed_reference_data, db_session):
    """Extend seed_reference_data with a PCA user and a PCA role."""
    refs = seed_reference_data
    role_pca = _add_role(db_session, 'PCA')
    pca, _ = _add_user(
        db_session, 7001, 'Pca', 'One', role_pca,
        refs['entite'], refs['direction'], refs['departement'],
        solde=30,
    )
    db_session.commit()
    return {**refs, 'pca': pca, 'role_pca': role_pca}


# ── Test 1: Auto-validation at creation ───────────────────────────────────────


def test_pca_conge_auto_validates_on_creation(pca_setup, db_session):
    """
    When a PCA creates a congé, auto_valider_si_sequence_vide should set
    statut='validé' immediately (empty validation chain).
    """
    pca = pca_setup['pca']
    op = _make_conge(db_session, pca.matricule)

    auto_done = wf_utils.auto_valider_si_sequence_vide(op.id_operation, pca.matricule, db_session)

    assert auto_done is True, "Should return True for PCA (empty sequence)"
    db_session.refresh(op)
    assert op.statut == 'validé', f"Expected statut='validé' but got '{op.statut}'"


def test_pca_conge_auto_validation_deducts_solde(pca_setup, db_session):
    """
    Auto-validation for PCA congé must deduct solde_conges.
    """
    pca = pca_setup['pca']
    solde_avant = Decimal(pca.solde_conges)
    op = _make_conge(db_session, pca.matricule)

    wf_utils.auto_valider_si_sequence_vide(op.id_operation, pca.matricule, db_session)

    db_session.refresh(pca)
    db_session.refresh(op)
    assert op.solde_deduit is True, "solde_deduit should be True after auto-validation"
    assert pca.solde_conges == solde_avant - Decimal(op.duree), (
        f"Solde should have decreased by {op.duree} days; "
        f"got {pca.solde_conges} (was {solde_avant})"
    )


def test_employe_conge_does_not_auto_validate(seed_reference_data, db_session):
    """
    Normal employees still go through the validation chain → auto_valider returns False.
    """
    refs = seed_reference_data
    emp = refs['employe']
    op = _make_conge(db_session, emp.matricule)

    auto_done = wf_utils.auto_valider_si_sequence_vide(op.id_operation, emp.matricule, db_session)

    assert auto_done is False, "Regular employee must NOT auto-validate"
    db_session.refresh(op)
    assert op.statut == 'en attente', "Regular employee op must remain 'en attente'"


# ── Test 2: One-step activation ───────────────────────────────────────────────


def test_pca_activation_self_completes(pca_setup, db_session):
    """
    PCA calling activer_operation_demandeur should produce a COMPLETE activation
    immediately — no separate RH step needed.
    """
    pca = pca_setup['pca']
    op = _make_conge(db_session, pca.matricule)
    op.statut = 'validé'
    db_session.commit()

    success, msg = activation_cloture.activer_operation_demandeur(
        op.id_operation, pca.matricule, db_session
    )

    assert success is True, f"Activation should succeed: {msg}"

    act = db_session.query(models.Activation).filter(
        models.Activation.id_operation == op.id_operation,
        models.Activation.type_action == models.TypeActionEnum.ACTIVATION,
    ).first()
    assert act is not None, "Activation record should exist"
    assert act.rh_fait is True, "rh_fait should be True for PCA (self-complete)"
    assert act.statut_final == models.StatutFinalEnum.COMPLETE, "statut_final should be COMPLETE"


# ── Test 3: One-step clôture ──────────────────────────────────────────────────


def test_pca_cloture_self_completes(pca_setup, db_session):
    """
    PCA calling cloturer_operation_demandeur should produce a COMPLETE clôture record
    immediately — no separate RH confirmation needed.
    """
    pca = pca_setup['pca']
    op = _make_conge(db_session, pca.matricule)
    op.statut = 'validé'
    op.solde_deduit = True  # already deducted
    db_session.commit()

    # First create a complete activation so cloture is allowed
    _complete_activation(db_session, op.id_operation, pca.matricule)

    success, msg = activation_cloture.cloturer_operation_demandeur(
        op.id_operation, pca.matricule, db_session
    )

    assert success is True, f"Clôture should succeed: {msg}"

    clo = db_session.query(models.Activation).filter(
        models.Activation.id_operation == op.id_operation,
        models.Activation.type_action == models.TypeActionEnum.CLOTURE,
    ).first()
    assert clo is not None, "Clôture record should exist"
    assert clo.rh_fait is True, "rh_fait should be True for PCA (self-complete)"
    assert clo.statut_final == models.StatutFinalEnum.COMPLETE, "statut_final should be COMPLETE"


# ── Test 4: verifier_role_pca_ag helper ───────────────────────────────────────


def test_verifier_role_pca_ag_returns_true_for_pca(pca_setup, db_session):
    pca = pca_setup['pca']
    assert activation_cloture.verifier_role_pca_ag(pca.matricule, db_session) is True


def test_verifier_role_pca_ag_returns_false_for_employe(seed_reference_data, db_session):
    emp = seed_reference_data['employe']
    assert activation_cloture.verifier_role_pca_ag(emp.matricule, db_session) is False


def test_verifier_role_pca_ag_returns_false_for_rh(seed_reference_data, db_session):
    rh = seed_reference_data['rh']
    assert activation_cloture.verifier_role_pca_ag(rh.matricule, db_session) is False
