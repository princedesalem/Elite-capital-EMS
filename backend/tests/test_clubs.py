"""
Tests pour le router clubs (CRUD clubs, membres, activités, avis).
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


def _create_club(client, nom='Tennis', **kwargs):
    data = {'nom': nom, 'type': 'Sports'}
    data.update(kwargs)
    return client.post('/api/clubs', json=data)


# ── Clubs CRUD ────────────────────────────────────────────────────────────────

def test_list_clubs_empty(client):
    resp = client.get('/api/clubs')
    assert resp.status_code == 200
    assert resp.json() == []


def test_create_club(client):
    resp = _create_club(client)
    assert resp.status_code == 200
    assert resp.json()['nom'] == 'Tennis'


def test_list_clubs_after_creation(client):
    _create_club(client, nom='Yoga')
    _create_club(client, nom='Football')
    resp = client.get('/api/clubs')
    assert len(resp.json()) == 2


def test_update_club(client):
    club_id = _create_club(client, nom='Old').json()['id']
    resp = client.put(f'/api/clubs/{club_id}', json={'nom': 'New', 'type': 'Loisirs'})
    assert resp.status_code == 200
    assert resp.json()['nom'] == 'New'


def test_update_club_not_found(client):
    resp = client.put('/api/clubs/99999', json={'nom': 'X', 'type': 'Sports'})
    assert resp.status_code == 404


def test_delete_club(client):
    club_id = _create_club(client).json()['id']
    resp = client.delete(f'/api/clubs/{club_id}')
    assert resp.status_code == 200
    assert len(client.get('/api/clubs').json()) == 0


def test_delete_club_not_found(client):
    resp = client.delete('/api/clubs/99999')
    assert resp.status_code == 404


# ── Adhésion ──────────────────────────────────────────────────────────────────

def test_join_club(client):
    club_id = _create_club(client).json()['id']
    resp = client.post('/api/clubs/memberships', json={'club_id': club_id, 'user_id': 1001})
    assert resp.status_code == 200
    assert resp.json()['club_id'] == club_id


def test_list_club_members(client):
    club_id = _create_club(client).json()['id']
    client.post('/api/clubs/memberships', json={'club_id': club_id, 'user_id': 1001})
    resp = client.get('/api/clubs/memberships')
    assert resp.status_code == 200
    assert any(m['club_id'] == club_id for m in resp.json())


def test_join_club_twice_is_idempotent(client):
    club_id = _create_club(client).json()['id']
    client.post('/api/clubs/memberships', json={'club_id': club_id, 'user_id': 1001})
    resp = client.post('/api/clubs/memberships', json={'club_id': club_id, 'user_id': 1001})
    assert resp.status_code == 200


def test_leave_club(client):
    club_id = _create_club(client).json()['id']
    member = client.post('/api/clubs/memberships', json={'club_id': club_id, 'user_id': 1001}).json()
    membership_id = member['id']
    resp = client.delete(f'/api/clubs/memberships/{membership_id}')
    assert resp.status_code == 200


# ── Activités ─────────────────────────────────────────────────────────────────

def test_create_activity(client):
    club_id = _create_club(client).json()['id']
    resp = client.post('/api/clubs/activities', json={
        'club_id': club_id,
        'titre': 'Tournoi',
        'date': '2026-08-15',
        'created_by': 1001,
    })
    assert resp.status_code == 200
    assert resp.json()['titre'] == 'Tournoi'


def test_list_activities(client):
    club_id = _create_club(client).json()['id']
    client.post('/api/clubs/activities', json={'club_id': club_id, 'titre': 'A1'})
    resp = client.get('/api/clubs/activities')
    assert resp.status_code == 200
    assert len(resp.json()) >= 1


# ── Avis ──────────────────────────────────────────────────────────────────────

def test_create_review(client):
    club_id = _create_club(client).json()['id']
    resp = client.post('/api/clubs/reviews', json={
        'club_id': club_id,
        'rating': 5,
        'commentaire': 'Excellent !',
        'user_id': 1001,
    })
    assert resp.status_code == 200
    assert resp.json()['rating'] == 5


def test_list_reviews(client):
    club_id = _create_club(client).json()['id']
    client.post('/api/clubs/reviews', json={'club_id': club_id, 'rating': 4, 'user_id': 1001})
    resp = client.get('/api/clubs/reviews')
    assert resp.status_code == 200
    assert len(resp.json()) >= 1

