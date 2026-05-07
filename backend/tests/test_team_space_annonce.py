"""
Tests pour le type 'annonce' dans les endpoints Team Space.
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
    Base.metadata.drop_all(engine)


@pytest.fixture(scope='function')
def client(db_session):
    def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


def _annonce_payload(**kwargs):
    data = {
        'type': 'annonce',
        'from': 'Marie',
        'from_matricule': 2001,
        'titre': 'Réunion générale vendredi',
        'message': 'Rappel : réunion générale vendredi à 10h dans la grande salle.',
        'likes': 0,
        'audience': {'type': 'all', 'selected': []},
    }
    data.update(kwargs)
    return data


# ── Tests ──────────────────────────────────────────────────────────────────

def test_create_annonce_returns_200(client):
    """POST /api/team-space/posts avec type='annonce' doit renvoyer 200."""
    res = client.post('/api/team-space/posts', json=_annonce_payload())
    assert res.status_code == 200
    data = res.json()
    assert data.get('type') == 'annonce'
    assert 'id' in data


def test_annonce_has_titre_in_response(client):
    """La réponse doit contenir le titre de l'annonce."""
    payload = _annonce_payload(titre='Annonce importante')
    res = client.post('/api/team-space/posts', json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data.get('titre') == 'Annonce importante'


def test_annonce_appears_in_list(client):
    """L'annonce créée doit figurer dans le GET /api/team-space/posts."""
    client.post('/api/team-space/posts', json=_annonce_payload())
    res = client.get('/api/team-space/posts')
    assert res.status_code == 200
    posts = res.json()
    annonces = [p for p in posts if p.get('type') == 'annonce']
    assert len(annonces) >= 1


def test_annonce_message_preserved(client):
    """Le contenu du message doit être intact."""
    msg = 'Ceci est un message de test long avec des accents éàü.'
    payload = _annonce_payload(message=msg)
    res = client.post('/api/team-space/posts', json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data.get('message') == msg


def test_annonce_with_restricted_audience(client):
    """Une annonce avec audience restreinte doit être acceptée."""
    payload = _annonce_payload(audience={'type': 'entites', 'selected': ['ELCAM']})
    res = client.post('/api/team-space/posts', json=payload)
    assert res.status_code == 200


def test_multiple_post_types_coexist(client):
    """Annonces et shoutouts peuvent coexister dans le feed."""
    client.post('/api/team-space/posts', json=_annonce_payload())
    client.post('/api/team-space/posts', json={
        'type': 'shoutout',
        'from': 'Paul',
        'from_matricule': 1001,
        'destinataire': 'Jean',
        'message': 'Bravo !',
        'likes': 0,
        'audience': {'type': 'all', 'selected': []},
    })
    res = client.get('/api/team-space/posts')
    assert res.status_code == 200
    posts = res.json()
    types = {p.get('type') for p in posts}
    assert 'annonce' in types
    assert 'shoutout' in types


def test_delete_annonce(client):
    """Une annonce peut être supprimée."""
    res = client.post('/api/team-space/posts', json=_annonce_payload())
    post_id = res.json()['id']
    del_res = client.delete(f'/api/team-space/posts/{post_id}')
    assert del_res.status_code == 200

    list_res = client.get('/api/team-space/posts')
    remaining = [p for p in list_res.json() if p.get('id') == post_id]
    assert len(remaining) == 0
