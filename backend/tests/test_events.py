"""
Tests pour le router events (liste, création, mise à jour, suppression).
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


def _ev_payload(**kwargs):
    data = {
        'titre': 'Réunion RH',
        'type': 'Réunion',
        'date_debut': '2026-06-01T09:00:00',
        'statut': 'brouillon',
        'created_by': 1001,
    }
    data.update(kwargs)
    return data


# ── Création ──────────────────────────────────────────────────────────────────

def test_create_event(client):
    resp = client.post('/api/events', json=_ev_payload())
    assert resp.status_code == 200
    data = resp.json()
    assert data['titre'] == 'Réunion RH'
    assert data['statut'] == 'brouillon'


def test_create_event_with_all_fields(client):
    resp = client.post('/api/events', json=_ev_payload(
        description='Description longue',
        lieu='Salle A',
        date_fin='2026-06-01T11:00:00',
        organisateur='Alice',
        capacite=20,
    ))
    assert resp.status_code == 200
    data = resp.json()
    assert data['lieu'] == 'Salle A'
    assert data['capacite'] == 20


# ── Liste ─────────────────────────────────────────────────────────────────────

def test_list_events_empty(client):
    resp = client.get('/api/events')
    assert resp.status_code == 200
    assert resp.json() == []


def test_list_events_after_creation(client):
    client.post('/api/events', json=_ev_payload(titre='Ev1'))
    client.post('/api/events', json=_ev_payload(titre='Ev2'))
    resp = client.get('/api/events')
    assert resp.status_code == 200
    assert len(resp.json()) == 2


# ── Mise à jour ───────────────────────────────────────────────────────────────

def test_update_event(client):
    create_resp = client.post('/api/events', json=_ev_payload())
    ev_id = create_resp.json()['id']
    resp = client.put(f'/api/events/{ev_id}', json=_ev_payload(titre='Modifié', statut='publie'))
    assert resp.status_code == 200
    assert resp.json()['titre'] == 'Modifié'
    assert resp.json()['statut'] == 'publie'


def test_update_event_not_found(client):
    resp = client.put('/api/events/99999', json=_ev_payload())
    assert resp.status_code == 404


# ── Suppression ───────────────────────────────────────────────────────────────

def test_delete_event(client):
    create_resp = client.post('/api/events', json=_ev_payload())
    ev_id = create_resp.json()['id']
    resp = client.delete(f'/api/events/{ev_id}')
    assert resp.status_code == 200
    # verify gone
    resp2 = client.get('/api/events')
    assert all(e['id'] != ev_id for e in resp2.json())


def test_delete_event_not_found(client):
    resp = client.delete('/api/events/99999')
    assert resp.status_code == 404
