"""Phase F — B5 : DG cross-entité (tous les DG voient toutes les opérations)."""
import pytest
from datetime import date
from fastapi.testclient import TestClient
from app import models
from app.main import app
from app.utils.workflow import obtenir_tous_matricules_dg

client = TestClient(app)


@pytest.fixture()
def two_dg(db_session):
    role_dg = models.Role(name='DG'); db_session.add(role_dg); db_session.flush()
    e1 = models.Entite(nom='ENT_A'); db_session.add(e1); db_session.flush()
    e2 = models.Entite(nom='ENT_B'); db_session.add(e2); db_session.flush()
    dg_a = models.Employe(matricule='DGA01', nom='Big', prenom='A',
                          email='dga@e.x', date_embauche=date(2024,1,1),
                          id_entite=e1.id_entite, id_role=role_dg.id, fonction='DG', sexe='M')
    dg_b = models.Employe(matricule='DGB01', nom='Big', prenom='B',
                          email='dgb@e.x', date_embauche=date(2024,1,1),
                          id_entite=e2.id_entite, id_role=role_dg.id, fonction='DG', sexe='M')
    db_session.add_all([dg_a, dg_b]); db_session.commit()
    return dg_a, dg_b


def test_obtenir_tous_matricules_dg_returns_both(db_session, two_dg):
    dg_a, dg_b = two_dg
    mats = obtenir_tous_matricules_dg(db_session)
    assert 'DGA01' in mats
    assert 'DGB01' in mats
    assert len(mats) == 2


def test_obtenir_tous_matricules_dg_empty_when_no_dg(db_session):
    # Avec aucun rôle DG configuré
    mats = obtenir_tous_matricules_dg(db_session)
    assert mats == []


@pytest.fixture()
def operation_at_dg_step(db_session, two_dg):
    """Crée une opération dont le prochain validateur est DG (étape DG non encore validée)."""
    dg_a, dg_b = two_dg
    # Employé demandeur (RESPONSABLE → workflow inclut DG)
    role_resp = models.Role(name='RESPONSABLE'); db_session.add(role_resp); db_session.flush()
    emp = models.Employe(matricule='EMP001', nom='Test', prenom='Emp',
                         email='emp@e.x', date_embauche=date(2024,1,1),
                         id_entite=dg_a.id_entite, id_role=role_resp.id, fonction='Responsable', sexe='M')
    db_session.add(emp); db_session.flush()

    op = models.Operation(
        matricule='EMP001', type_demande='Conge', statut='en attente',
        duree_jours=3, date_demande=date(2024,6,1)
    )
    db_session.add(op); db_session.flush()

    # Simuler validation RH déjà faite pour atteindre l'étape DG
    val_rh = models.Validation(
        id_operation=op.id_operation,
        matricule_validateur='RH001',
        role_validateur='RH',
        statut_validation='validé'
    )
    db_session.add(val_rh); db_session.commit()
    return op, dg_a, dg_b


def test_both_dg_see_operation_simultaneously(db_session, operation_at_dg_step):
    """Les deux DG doivent voir l'opération dans leur boîte à valider simultanément."""
    from app.routers.workflow_router import obtenir_demandes_a_valider

    op, dg_a, dg_b = operation_at_dg_step
    ops_a = obtenir_demandes_a_valider('DGA01', db_session)
    ops_b = obtenir_demandes_a_valider('DGB01', db_session)

    ids_a = {o['id_operation'] for o in ops_a}
    ids_b = {o['id_operation'] for o in ops_b}
    assert op.id_operation in ids_a, "DGA01 doit voir l'opération en attente de validation DG"
    assert op.id_operation in ids_b, "DGB01 doit voir l'opération en attente de validation DG"


def test_dg_inbox_shows_operation_to_all_dgs(db_session, operation_at_dg_step):
    """GET /a-valider/{matricule} retourne l'op pour les DEUX DG simultanément."""
    from app.routers.workflow_router import obtenir_demandes_a_valider

    op, dg_a, dg_b = operation_at_dg_step
    ops_a = obtenir_demandes_a_valider('DGA01', db_session)
    ops_b = obtenir_demandes_a_valider('DGB01', db_session)

    ids_a = {o['id_operation'] for o in ops_a}
    ids_b = {o['id_operation'] for o in ops_b}
    assert op.id_operation in ids_a, "DGA01 doit voir l'opération en attente de validation DG"
    assert op.id_operation in ids_b, "DGB01 doit voir l'opération en attente de validation DG"


def test_dg_inbox_hides_operation_after_own_validation(db_session, operation_at_dg_step):
    """Après validation de DGA01, l'opération disparaît de sa boîte mais reste chez DGB01."""
    from app.routers.workflow_router import obtenir_demandes_a_valider

    op, dg_a, dg_b = operation_at_dg_step

    # DGA01 valide
    val_dg = models.Validation(
        id_operation=op.id_operation,
        matricule_validateur='DGA01',
        role_validateur='DG',
        statut_validation='validé'
    )
    db_session.add(val_dg); db_session.commit()

    ops_a = obtenir_demandes_a_valider('DGA01', db_session)
    ops_b = obtenir_demandes_a_valider('DGB01', db_session)

    ids_a = {o['id_operation'] for o in ops_a}
    ids_b = {o['id_operation'] for o in ops_b}
    assert op.id_operation not in ids_a, "DGA01 a déjà validé, ne doit plus voir l'opération"
    assert op.id_operation in ids_b, "DGB01 n'a pas encore validé, doit toujours voir l'opération"
