"""
Tests pour le router talent (réunions 1:1 et objectifs de carrière).
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


# ── Meetings ──────────────────────────────────────────────────────────────────

def test_list_meetings_empty(client):
    resp = client.get('/api/talent/meetings')
    assert resp.status_code == 200
    assert resp.json() == []


def test_create_meeting(client):
    resp = client.post('/api/talent/meetings', json={
        'titre': 'Point hebdo',
        'manager_id': 1001,
        'employee_id': 2001,
        'date': '2026-06-10',
        'statut': 'planifie',
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data['titre'] == 'Point hebdo'
    assert data['manager_id'] == 1001


def test_update_meeting(client):
    meeting_id = client.post('/api/talent/meetings', json={'titre': 'Old', 'statut': 'planifie'}).json()['id']
    resp = client.put(f'/api/talent/meetings/{meeting_id}', json={'titre': 'New', 'statut': 'termine'})
    assert resp.status_code == 200
    assert resp.json()['titre'] == 'New'
    assert resp.json()['statut'] == 'termine'


def test_update_meeting_not_found(client):
    resp = client.put('/api/talent/meetings/99999', json={'titre': 'X', 'statut': 'planifie'})
    assert resp.status_code == 404


def test_delete_meeting(client):
    meeting_id = client.post('/api/talent/meetings', json={'titre': 'Del', 'statut': 'planifie'}).json()['id']
    resp = client.delete(f'/api/talent/meetings/{meeting_id}')
    assert resp.status_code == 200
    assert client.get('/api/talent/meetings').json() == []


def test_delete_meeting_not_found(client):
    resp = client.delete('/api/talent/meetings/99999')
    assert resp.status_code == 404


# ── Goals ─────────────────────────────────────────────────────────────────────

def test_list_goals_empty(client):
    resp = client.get('/api/talent/goals')
    assert resp.status_code == 200
    assert resp.json() == []


def test_create_goal(client):
    resp = client.post('/api/talent/goals', json={
        'titre': 'Obtenir certification',
        'type': 'Compétence',
        'employee_id': 2001,
        'statut': 'a_faire',
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data['titre'] == 'Obtenir certification'
    assert data['employee_id'] == 2001


def test_update_goal(client):
    goal_id = client.post('/api/talent/goals', json={'titre': 'Old', 'statut': 'a_faire'}).json()['id']
    resp = client.put(f'/api/talent/goals/{goal_id}', json={'titre': 'Done', 'statut': 'termine'})
    assert resp.status_code == 200
    assert resp.json()['statut'] == 'termine'


def test_update_goal_not_found(client):
    resp = client.put('/api/talent/goals/99999', json={'titre': 'X', 'statut': 'a_faire'})
    assert resp.status_code == 404


def test_delete_goal(client):
    goal_id = client.post('/api/talent/goals', json={'titre': 'Del', 'statut': 'a_faire'}).json()['id']
    resp = client.delete(f'/api/talent/goals/{goal_id}')
    assert resp.status_code == 200
    assert client.get('/api/talent/goals').json() == []


def test_delete_goal_not_found(client):
    resp = client.delete('/api/talent/goals/99999')
    assert resp.status_code == 404
