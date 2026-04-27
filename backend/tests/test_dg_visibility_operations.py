"""Phase F — B5 : DG cross-entité (tous les DG voient toutes les opérations)."""
import pytest
from datetime import date
from app import models
from app.utils.workflow import obtenir_tous_matricules_dg


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
