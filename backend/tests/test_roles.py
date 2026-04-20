"""
Tests pour le router roles (liste et création de rôles).
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


def test_list_roles_empty(client):
    resp = client.get('/roles/')
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


def test_create_role(client):
    resp = client.post('/roles/?name=Admin&description=Administrateur')
    assert resp.status_code == 200
    data = resp.json()
    assert data['name'] == 'Admin'


def test_create_duplicate_role(client):
    client.post('/roles/?name=Manager&description=test')
    resp = client.post('/roles/?name=Manager&description=test')
    assert resp.status_code == 400


def test_list_roles_after_creation(client):
    client.post('/roles/?name=RH&description=Ressources Humaines')
    resp = client.get('/roles/')
    assert resp.status_code == 200
    names = [r['name'] for r in resp.json()]
    assert 'RH' in names
