"""
Tests pour le router reviews360 (liste, création, suppression).
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


def _review_payload(**kwargs):
    data = {
        'reviewer_id': 1001,
        'reviewee_id': 2001,
        'scores': [4.0, 3.5, 5.0],
        'commentaire': 'Très bon travail',
        'points_forts': 'Rigueur',
        'points_amelioration': 'Communication',
    }
    data.update(kwargs)
    return data


def test_list_reviews_empty(client):
    resp = client.get('/api/performance-reviews')
    assert resp.status_code == 200
    assert resp.json() == []


def test_create_review(client):
    resp = client.post('/api/performance-reviews', json=_review_payload())
    assert resp.status_code == 200
    data = resp.json()
    assert data['reviewer_id'] == 1001
    assert data['reviewee_id'] == 2001
    assert data['scores'] == [4.0, 3.5, 5.0]
    assert data['points_forts'] == 'Rigueur'


def test_create_review_minimal(client):
    resp = client.post('/api/performance-reviews', json={'reviewer_id': 1, 'reviewee_id': 2})
    assert resp.status_code == 200
    assert resp.json()['scores'] == []


def test_list_reviews_after_creation(client):
    client.post('/api/performance-reviews', json=_review_payload())
    client.post('/api/performance-reviews', json=_review_payload(reviewer_id=2002))
    resp = client.get('/api/performance-reviews')
    assert resp.status_code == 200
    assert len(resp.json()) == 2


def test_delete_review(client):
    review_id = client.post('/api/performance-reviews', json=_review_payload()).json()['id']
    resp = client.delete(f'/api/performance-reviews/{review_id}')
    assert resp.status_code == 200
    assert resp.json().get('ok') is True
    assert client.get('/api/performance-reviews').json() == []


def test_delete_review_not_found(client):
    resp = client.delete('/api/performance-reviews/99999')
    assert resp.status_code == 404
