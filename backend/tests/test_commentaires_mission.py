"""
Tests pour le router commentaires mission (creer, lister, marquer lu).
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


def _seed(db):
    """Crée un employé et une mission pour les tests."""
    from datetime import date
    emp = models.Employe(
        matricule=1001, prenom='Jean', nom='Dupont',
        statut_employe='ACTIF', fonction='Analyste',
        date_embauche=date(2020, 1, 1),
    )
    db.add(emp)
    mission = models.Mission(
        id_mission=1,
        ville='Paris',
        pays='France',
    )
    db.add(mission)
    db.commit()
    return emp, mission


def test_create_commentaire_mission_not_found(client):
    resp = client.post('/api/missions/commentaires/creer', json={
        'id_mission': 9999,
        'matricule': 1001,
        'commentaire': 'Test',
    })
    assert resp.status_code == 404


def test_create_commentaire_employe_not_found(client, db_session):
    mission = models.Mission(
        id_mission=1,
        ville='Lyon',
        pays='France',
    )
    db_session.add(mission)
    db_session.commit()
    resp = client.post('/api/missions/commentaires/creer', json={
        'id_mission': 1,
        'matricule': 9999,
        'commentaire': 'Test',
    })
    assert resp.status_code == 404


def test_create_and_list_commentaire(client, db_session):
    _seed(db_session)
    resp = client.post('/api/missions/commentaires/creer', json={
        'id_mission': 1,
        'matricule': 1001,
        'commentaire': 'Bon déroulement de mission.',
    })
    assert resp.status_code == 201

    list_resp = client.get('/api/missions/commentaires/1')
    assert list_resp.status_code == 200
    items = list_resp.json()
    assert len(items) >= 1
    assert items[0]['commentaire'] == 'Bon déroulement de mission.'


def test_marquer_commentaire_lu_not_found(client):
    resp = client.post('/api/missions/commentaires/99999/marquer-lu', params={'matricule': 1001})
    assert resp.status_code == 404


def test_marquer_commentaire_lu(client, db_session):
    _seed(db_session)
    create_resp = client.post('/api/missions/commentaires/creer', json={
        'id_mission': 1,
        'matricule': 1001,
        'commentaire': 'Lu test',
    })
    comm_id = create_resp.json()['id_commentaire']
    resp = client.post(f'/api/missions/commentaires/{comm_id}/marquer-lu', params={'matricule': 1001})
    assert resp.status_code == 200
