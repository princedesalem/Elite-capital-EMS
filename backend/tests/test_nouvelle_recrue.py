"""
Tests pour le champ nouvelle_recrue sur le modèle Employe
et l'impact sur le comptage des nouvelles embauches dans ai_insights.
"""
import pytest
from datetime import date
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db import Base
from app import models


@pytest.fixture(scope='function')
def db_session():
    engine = create_engine(
        'sqlite:///:memory:',
        connect_args={'check_same_thread': False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.close()
    Base.metadata.drop_all(engine)


def _make_employe(db, matricule, nouvelle_recrue=False, date_embauche=None):
    """Crée un Employe minimal."""
    emp = models.Employe(
        matricule=matricule,
        nom='Test',
        prenom='Employe',
        email=f'{matricule}@test.com',
        date_embauche=date_embauche or date(2024, 1, 15),
        nouvelle_recrue=nouvelle_recrue,
        statut_employe='ACTIF',
    )
    db.add(emp)
    db.flush()
    return emp


# ── Test 1: le champ est bien enregistré et récupéré ──────────────────────

def test_nouvelle_recrue_field_true(db_session):
    emp = _make_employe(db_session, 'NR001', nouvelle_recrue=True)
    db_session.commit()

    fetched = db_session.query(models.Employe).filter_by(matricule='NR001').first()
    assert fetched is not None
    assert fetched.nouvelle_recrue is True


def test_nouvelle_recrue_field_false(db_session):
    emp = _make_employe(db_session, 'NR002', nouvelle_recrue=False)
    db_session.commit()

    fetched = db_session.query(models.Employe).filter_by(matricule='NR002').first()
    assert fetched is not None
    assert not fetched.nouvelle_recrue


def test_nouvelle_recrue_defaults_false(db_session):
    """Sans valeur explicite, le champ doit être falsy."""
    emp = models.Employe(
        matricule='NR003',
        nom='Test',
        prenom='Default',
        email='nr003@test.com',
        date_embauche=date(2024, 1, 15),
        statut_employe='ACTIF',
    )
    db_session.add(emp)
    db_session.commit()

    fetched = db_session.query(models.Employe).filter_by(matricule='NR003').first()
    assert not fetched.nouvelle_recrue


# ── Test 2: la logique de filtrage fonctionne correctement ─────────────────

def test_count_only_nouvelle_recrue_true(db_session):
    """Seuls les employés avec nouvelle_recrue=True doivent être comptés."""
    _make_employe(db_session, 'NR010', nouvelle_recrue=True, date_embauche=date(2024, 3, 1))
    _make_employe(db_session, 'NR011', nouvelle_recrue=True, date_embauche=date(2024, 4, 1))
    _make_employe(db_session, 'NR012', nouvelle_recrue=False, date_embauche=date(2024, 3, 15))
    _make_employe(db_session, 'NR013', nouvelle_recrue=None, date_embauche=date(2024, 3, 20))
    db_session.commit()

    count = (
        db_session.query(models.Employe)
        .filter(models.Employe.nouvelle_recrue == True)  # noqa: E712
        .count()
    )
    assert count == 2


def test_nouvelle_recrue_update(db_session):
    """On peut passer nouvelle_recrue de False à True."""
    emp = _make_employe(db_session, 'NR020', nouvelle_recrue=False)
    db_session.commit()

    emp.nouvelle_recrue = True
    db_session.commit()

    fetched = db_session.query(models.Employe).filter_by(matricule='NR020').first()
    assert fetched.nouvelle_recrue is True
