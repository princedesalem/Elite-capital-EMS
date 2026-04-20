"""
Tests pour le router workforce (postes : liste, création, mise à jour, suppression).
"""
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient

from app.db import Base, get_db
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


def _pos_payload(**kwargs):
    data = {
        'titre': 'Analyste Senior',
        'trimestre': 'T2',
        'annee': '2026',
        'priorite': 'haute',
        'statut': 'planifie',
        'created_by': 1001,
    }
    data.update(kwargs)
    return data


# ── Liste ─────────────────────────────────────────────────────────────────────

def test_list_positions_empty(client):
    resp = client.get('/api/workforce/positions')
    assert resp.status_code == 200
    assert resp.json() == []


# ── Création ──────────────────────────────────────────────────────────────────

def test_create_position(client):
    resp = client.post('/api/workforce/positions', json=_pos_payload())
    assert resp.status_code == 200
    data = resp.json()
    assert data['titre'] == 'Analyste Senior'
    assert data['trimestre'] == 'T2'
    assert data['statut'] == 'planifie'


def test_create_position_with_budget(client):
    resp = client.post('/api/workforce/positions', json=_pos_payload(budget=50000.0, direction='Finance'))
    assert resp.status_code == 200
    assert resp.json()['budget'] == 50000.0
    assert resp.json()['direction'] == 'Finance'


def test_list_positions_after_creation(client):
    client.post('/api/workforce/positions', json=_pos_payload(titre='P1'))
    client.post('/api/workforce/positions', json=_pos_payload(titre='P2'))
    resp = client.get('/api/workforce/positions')
    assert resp.status_code == 200
    assert len(resp.json()) == 2


# ── Mise à jour ───────────────────────────────────────────────────────────────

def test_update_position(client):
    pos_id = client.post('/api/workforce/positions', json=_pos_payload()).json()['id']
    resp = client.put(f'/api/workforce/positions/{pos_id}', json=_pos_payload(statut='en_cours', titre='Modifié'))
    assert resp.status_code == 200
    assert resp.json()['statut'] == 'en_cours'
    assert resp.json()['titre'] == 'Modifié'


def test_update_position_not_found(client):
    resp = client.put('/api/workforce/positions/99999', json=_pos_payload())
    assert resp.status_code == 404


# ── Suppression ───────────────────────────────────────────────────────────────

def test_delete_position(client):
    pos_id = client.post('/api/workforce/positions', json=_pos_payload()).json()['id']
    resp = client.delete(f'/api/workforce/positions/{pos_id}')
    assert resp.status_code == 200
    assert client.get('/api/workforce/positions').json() == []


def test_delete_position_not_found(client):
    resp = client.delete('/api/workforce/positions/99999')
    assert resp.status_code == 404
