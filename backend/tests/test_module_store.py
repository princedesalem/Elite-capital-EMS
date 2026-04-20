"""
Tests pour le router module-store (CRUD générique par module).
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


# ── Liste ─────────────────────────────────────────────────────────────────────

def test_list_items_empty(client):
    resp = client.get('/api/module-store/my-module')
    assert resp.status_code == 200
    assert resp.json() == []


# ── Création ──────────────────────────────────────────────────────────────────

def test_create_item(client):
    resp = client.post('/api/module-store/budget', json={'nom': 'Budget Q1', 'montant': 10000, '_actor_matricule': 1001})
    assert resp.status_code == 200
    data = resp.json()
    assert data['nom'] == 'Budget Q1'
    assert data['montant'] == 10000
    assert data['_created_by'] == 1001


def test_create_item_strips_actor(client):
    """L'actor ne doit pas aparaître dans le payload du résultat."""
    resp = client.post('/api/module-store/test', json={'key': 'val', '_actor_matricule': 42})
    assert resp.status_code == 200
    data = resp.json()
    assert '_actor_matricule' not in data


def test_list_items_scoped_to_module(client):
    client.post('/api/module-store/modA', json={'x': 1})
    client.post('/api/module-store/modB', json={'x': 2})
    resp_a = client.get('/api/module-store/modA')
    resp_b = client.get('/api/module-store/modB')
    assert len(resp_a.json()) == 1
    assert len(resp_b.json()) == 1


# ── Mise à jour ───────────────────────────────────────────────────────────────

def test_update_item(client):
    item_id = client.post('/api/module-store/budget', json={'nom': 'old'}).json()['id']
    resp = client.put(f'/api/module-store/budget/{item_id}', json={'nom': 'new'})
    assert resp.status_code == 200
    assert resp.json()['nom'] == 'new'


def test_update_item_not_found(client):
    resp = client.put('/api/module-store/budget/99999', json={'nom': 'x'})
    assert resp.status_code == 404


# ── Suppression ───────────────────────────────────────────────────────────────

def test_delete_item(client):
    item_id = client.post('/api/module-store/budget', json={'nom': 'del'}).json()['id']
    resp = client.delete(f'/api/module-store/budget/{item_id}')
    assert resp.status_code == 200
    assert client.get('/api/module-store/budget').json() == []


def test_delete_item_not_found(client):
    resp = client.delete('/api/module-store/budget/99999')
    assert resp.status_code == 404
