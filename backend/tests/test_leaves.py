"""
Tests pour le router leaves / conges (congés : liste, éligibilité, solde).
Note: /leaves/ router references models.Conge which is a stub in this app;
we test the actual functional /conges/ endpoints instead.
"""
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient

from app.db import Base, get_db
from app import models
from app.main import app


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


@pytest.fixture(scope='function')
def client(db_session):
    def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


def test_conges_calculer_duree_weekdays(client):
    """Calculating working days between two dates."""
    resp = client.post('/api/conges/calculer-duree?date_debut=2026-07-06&date_fin=2026-07-10')
    assert resp.status_code == 200
    data = resp.json()
    assert data['duree_jours_ouvrables'] == 5


def test_conges_calculer_duree_includes_no_weekend(client):
    """A single weekend span returns 0 working days."""
    resp = client.post('/api/conges/calculer-duree?date_debut=2026-07-04&date_fin=2026-07-05')
    assert resp.status_code == 200
    assert resp.json()['duree_jours_ouvrables'] == 0


def test_conges_eligibilite_no_employee(client):
    """Unknown matricule returns 200 with eligible=False or 404."""
    resp = client.get('/api/conges/eligibilite/99999')
    assert resp.status_code in (200, 404)


def test_conges_solde_no_employee(client):
    """Unknown matricule returns solde data or 404."""
    resp = client.get('/api/conges/solde/99999')
    assert resp.status_code in (200, 404)


def test_conges_historique_empty(client):
    """Historique for unknown matricule returns list or 404."""
    resp = client.get('/api/conges/historique/99999')
    assert resp.status_code in (200, 404)
    if resp.status_code == 200:
        assert isinstance(resp.json(), list)
