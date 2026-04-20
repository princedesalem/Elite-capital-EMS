"""
Tests pour le router tasks (tâches : liste, création, modification, suppression).
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


def _create_task(client, titre='Ma tâche', matricule_actor=1001, role_actor='RH', **kwargs):
    payload = {
        'titre': titre,
        'matricule_actor': matricule_actor,
        'role_actor': role_actor,
        'priorite': 'haute',
        'statut': 'a_faire',
    }
    payload.update(kwargs)
    return client.post('/api/tasks/', json=payload)


# ── Création ──────────────────────────────────────────────────────────────────

def test_create_task_success(client):
    resp = _create_task(client)
    assert resp.status_code == 200
    data = resp.json()
    assert data['titre'] == 'Ma tâche'
    assert data['priorite'] == 'haute'
    assert data['statut'] == 'a_faire'


def test_create_task_no_titre(client):
    resp = client.post('/api/tasks/', json={'matricule_actor': 1001, 'titre': ''})
    assert resp.status_code == 400


def test_create_task_invalid_priority(client):
    resp = client.post('/api/tasks/', json={'titre': 'test', 'matricule_actor': 1001, 'priorite': 'ultra'})
    assert resp.status_code == 400


def test_create_task_invalid_statut(client):
    resp = client.post('/api/tasks/', json={'titre': 'test', 'matricule_actor': 1001, 'statut': 'invalid'})
    assert resp.status_code == 400


def test_non_admin_cannot_assign_to_other(client):
    resp = client.post('/api/tasks/', json={
        'titre': 'test',
        'matricule_actor': 1001,
        'role_actor': 'Utilisateur',
        'assigne_a': 2002,
    })
    assert resp.status_code == 403


# ── Liste ─────────────────────────────────────────────────────────────────────

def test_list_tasks_admin_sees_all(client):
    _create_task(client, titre='T1', matricule_actor=1001, role_actor='RH')
    _create_task(client, titre='T2', matricule_actor=2001, role_actor='RH')
    resp = client.get('/api/tasks/1001?role=RH')
    assert resp.status_code == 200
    assert len(resp.json()) >= 1


def test_list_tasks_user_sees_own(client):
    _create_task(client, titre='Mine', matricule_actor=1001)
    _create_task(client, titre='Theirs', matricule_actor=2001)
    resp = client.get('/api/tasks/1001?role=Utilisateur')
    assert resp.status_code == 200
    titles = [t['titre'] for t in resp.json()]
    assert 'Mine' in titles


# ── Modification ──────────────────────────────────────────────────────────────

def test_update_task(client):
    create_resp = _create_task(client, titre='Original')
    task_id = create_resp.json()['id']
    resp = client.put(f'/api/tasks/{task_id}', json={
        'titre': 'Modifié',
        'priorite': 'basse',
        'statut': 'en_cours',
        'matricule_actor': 1001,
        'role_actor': 'RH',
    })
    assert resp.status_code == 200
    assert resp.json()['titre'] == 'Modifié'
    assert resp.json()['statut'] == 'en_cours'


def test_update_task_not_found(client):
    resp = client.put('/api/tasks/99999', json={
        'titre': 'X',
        'matricule_actor': 1001,
        'role_actor': 'RH',
        'priorite': 'haute',
        'statut': 'a_faire',
    })
    assert resp.status_code == 404


# ── Suppression ───────────────────────────────────────────────────────────────

def test_delete_task(client):
    create_resp = _create_task(client, titre='A supprimer')
    task_id = create_resp.json()['id']
    resp = client.delete(f'/api/tasks/{task_id}?matricule_actor=1001&role_actor=RH')
    assert resp.status_code == 200


def test_delete_task_not_found(client):
    resp = client.delete('/api/tasks/99999?matricule_actor=1001&role_actor=RH')
    assert resp.status_code == 404
