"""
Tests pour les endpoints Documentation (/api/documentation/articles, /upload).
"""
import io
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient

from app.db import Base, get_db
from app import models
from app.main import app
from app.utils.security import create_access_token


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


@pytest.fixture()
def rh_headers():
    """Headers d'auth pour un utilisateur RH."""
    token = create_access_token({'matricule': '9999', 'role': 'RH'}, expires_minutes=120)
    return {'Authorization': f'Bearer {token}'}


def _article_payload(**kwargs):
    data = {
        'titre': 'Procédure de congé',
        'contenu': '## Étapes\n1. Soumettre la demande\n2. Attendre validation',
        'categorie': 'RH',
    }
    data.update(kwargs)
    return data


# ── CRUD Articles ──────────────────────────────────────────────────────────

def test_create_article(client, rh_headers):
    """POST /api/documentation/articles doit créer un article."""
    res = client.post('/api/documentation/articles', json=_article_payload(), headers=rh_headers)
    assert res.status_code in (200, 201)
    data = res.json()
    assert data['titre'] == 'Procédure de congé'
    assert 'id' in data


def test_get_articles_list(client, rh_headers):
    """GET /api/documentation/articles doit lister les articles."""
    client.post('/api/documentation/articles', json=_article_payload(), headers=rh_headers)
    res = client.get('/api/documentation/articles', headers=rh_headers)
    assert res.status_code == 200
    articles = res.json()
    assert isinstance(articles, list)
    assert len(articles) >= 1


def test_get_article_by_id(client, rh_headers):
    """GET /api/documentation/articles/{id} doit retourner l'article."""
    create_res = client.post('/api/documentation/articles', json=_article_payload(), headers=rh_headers)
    article_id = create_res.json()['id']
    res = client.get(f'/api/documentation/articles/{article_id}', headers=rh_headers)
    assert res.status_code == 200
    assert res.json()['id'] == article_id


def test_update_article(client, rh_headers):
    """PUT /api/documentation/articles/{id} doit mettre à jour."""
    create_res = client.post('/api/documentation/articles', json=_article_payload(), headers=rh_headers)
    article_id = create_res.json()['id']
    res = client.put(
        f'/api/documentation/articles/{article_id}',
        json={'titre': 'Titre modifié'},
        headers=rh_headers,
    )
    assert res.status_code == 200
    assert res.json()['titre'] == 'Titre modifié'


def test_delete_article(client, rh_headers):
    """DELETE /api/documentation/articles/{id} doit supprimer."""
    create_res = client.post('/api/documentation/articles', json=_article_payload(), headers=rh_headers)
    article_id = create_res.json()['id']
    del_res = client.delete(f'/api/documentation/articles/{article_id}', headers=rh_headers)
    assert del_res.status_code in (200, 204)

    list_res = client.get('/api/documentation/articles', headers=rh_headers)
    ids = [a['id'] for a in list_res.json()]
    assert article_id not in ids


def test_get_nonexistent_article_returns_404(client, rh_headers):
    """Un article inexistant doit lever 404."""
    res = client.get('/api/documentation/articles/99999', headers=rh_headers)
    assert res.status_code == 404


def test_categories_endpoint(client, rh_headers):
    """GET /api/documentation/categories doit retourner une liste."""
    res = client.get('/api/documentation/categories', headers=rh_headers)
    assert res.status_code == 200
    assert isinstance(res.json(), list)


def test_multiple_articles_different_categories(client, rh_headers):
    """Plusieurs articles dans différentes catégories."""
    client.post('/api/documentation/articles', json=_article_payload(categorie='RH'), headers=rh_headers)
    client.post('/api/documentation/articles', json=_article_payload(titre='Contrat', categorie='Juridique'), headers=rh_headers)
    res = client.get('/api/documentation/articles', headers=rh_headers)
    assert res.status_code == 200
    cats = {a['categorie'] for a in res.json()}
    assert 'RH' in cats
    assert 'Juridique' in cats


# ── Upload ─────────────────────────────────────────────────────────────────

def test_upload_valid_pdf(client, rh_headers):
    """POST /api/documentation/upload avec un PDF doit réussir."""
    file_content = b'%PDF-1.4 fake pdf content'
    res = client.post(
        '/api/documentation/upload',
        data={'categorie': 'Général'},
        files={'file': ('test.pdf', io.BytesIO(file_content), 'application/pdf')},
        headers=rh_headers,
    )
    assert res.status_code in (200, 201)
    data = res.json()
    assert data.get('type_doc') == 'fichier'


def test_upload_invalid_extension_rejected(client, rh_headers):
    """Un fichier avec une extension non autorisée doit être refusé."""
    res = client.post(
        '/api/documentation/upload',
        data={'categorie': 'Général'},
        files={'file': ('malware.exe', io.BytesIO(b'binary'), 'application/octet-stream')},
        headers=rh_headers,
    )
    assert res.status_code == 400

