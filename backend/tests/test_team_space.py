"""
Tests pour les endpoints Team Space (posts, likes, votes, modification, suppression).
"""
import pytest
from datetime import datetime, timedelta
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient

from app.db import Base, get_db
from app import models
from app.main import app


# ── Fixtures ────────────────────────────────────────────────────────────────

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


def _shoutout_payload(**kwargs):
    data = {
        'type': 'shoutout',
        'from': 'Paul',
        'from_matricule': 1001,
        'destinataire': 'Samuel',
        'message': 'Félicitations pour le projet !',
        'likes': 0,
        'audience': {'type': 'all', 'selected': []},
    }
    data.update(kwargs)
    return data


def _kudos_payload(**kwargs):
    data = {
        'type': 'kudos',
        'from': 'Paul',
        'from_matricule': 1001,
        'destinataire': 'Yvan',
        'valeur': 'Excellence',
        'raison': 'Excellent travail',
        'likes': 0,
        'audience': {'type': 'all', 'selected': []},
    }
    data.update(kwargs)
    return data


def _poll_payload(**kwargs):
    data = {
        'type': 'poll',
        'from': 'Paul',
        'from_matricule': 1001,
        'question': 'Quelle est votre technologie préférée ?',
        'options': [{'texte': 'React', 'votes': 0}, {'texte': 'Vue', 'votes': 0}],
        'votedBy': [],
        'likes': 0,
        'audience': {'type': 'all', 'selected': []},
    }
    data.update(kwargs)
    return data


# ── Tests création ───────────────────────────────────────────────────────────

class TestTeamSpaceCreate:
    def test_create_shoutout(self, client):
        r = client.post('/api/team-space/posts', json=_shoutout_payload())
        assert r.status_code == 200
        data = r.json()
        assert data['type'] == 'shoutout'
        assert data['from'] == 'Paul'
        assert data['destinataire'] == 'Samuel'
        assert data['message'] == 'Félicitations pour le projet !'

    def test_create_kudos(self, client):
        r = client.post('/api/team-space/posts', json=_kudos_payload())
        assert r.status_code == 200
        data = r.json()
        assert data['type'] == 'kudos'
        assert data['destinataire'] == 'Yvan'
        assert data['valeur'] == 'Excellence'

    def test_create_poll(self, client):
        r = client.post('/api/team-space/posts', json=_poll_payload())
        assert r.status_code == 200
        data = r.json()
        assert data['type'] == 'poll'
        assert data['question'] == 'Quelle est votre technologie préférée ?'
        assert len(data['options']) == 2

    def test_create_shoutout_missing_message_returns_400(self, client):
        payload = _shoutout_payload()
        payload['message'] = ''
        r = client.post('/api/team-space/posts', json=payload)
        assert r.status_code == 400

    def test_create_poll_single_option_returns_400(self, client):
        payload = _poll_payload()
        payload['options'] = [{'texte': 'React', 'votes': 0}]
        r = client.post('/api/team-space/posts', json=payload)
        assert r.status_code == 400

    def test_create_invalid_type_returns_400(self, client):
        r = client.post('/api/team-space/posts', json={'type': 'invalid'})
        assert r.status_code == 400


# ── Tests lecture ────────────────────────────────────────────────────────────

class TestTeamSpaceList:
    def test_list_all_posts(self, client):
        client.post('/api/team-space/posts', json=_shoutout_payload())
        client.post('/api/team-space/posts', json=_kudos_payload())
        r = client.get('/api/team-space/posts')
        assert r.status_code == 200
        assert len(r.json()) >= 2

    def test_list_filter_by_type(self, client):
        client.post('/api/team-space/posts', json=_shoutout_payload())
        client.post('/api/team-space/posts', json=_kudos_payload())
        r = client.get('/api/team-space/posts?type=kudos')
        assert r.status_code == 200
        data = r.json()
        assert all(p['type'] == 'kudos' for p in data)

    def test_list_search(self, client):
        client.post('/api/team-space/posts', json=_shoutout_payload(destinataire='UniqueNameXYZ'))
        r = client.get('/api/team-space/posts?search=UniqueNameXYZ')
        assert r.status_code == 200
        assert len(r.json()) >= 1


# ── Tests like ───────────────────────────────────────────────────────────────

class TestTeamSpaceLike:
    def test_like_increments(self, client):
        created = client.post('/api/team-space/posts', json=_shoutout_payload()).json()
        post_id = created['id']
        r = client.patch(f'/api/team-space/posts/{post_id}/like')
        assert r.status_code == 200
        assert r.json()['likes'] == 1

    def test_like_404(self, client):
        r = client.patch('/api/team-space/posts/99999/like')
        assert r.status_code == 404


# ── Tests vote ───────────────────────────────────────────────────────────────

class TestTeamSpaceVote:
    def test_vote_increments_option(self, client):
        created = client.post('/api/team-space/posts', json=_poll_payload()).json()
        post_id = created['id']
        r = client.patch(f'/api/team-space/posts/{post_id}/vote', json={
            'voter_matricule': '1001',
            'option_index': 0
        })
        assert r.status_code == 200
        assert r.json()['options'][0]['votes'] == 1

    def test_vote_doublon_ignored(self, client):
        created = client.post('/api/team-space/posts', json=_poll_payload()).json()
        post_id = created['id']
        payload = {'voter_matricule': '1002', 'option_index': 1}
        client.patch(f'/api/team-space/posts/{post_id}/vote', json=payload)
        r = client.patch(f'/api/team-space/posts/{post_id}/vote', json=payload)
        assert r.status_code == 200
        # Second vote ignored — total votes still 1
        total = sum(o['votes'] for o in r.json()['options'])
        assert total == 1

    def test_vote_invalid_option_returns_400(self, client):
        created = client.post('/api/team-space/posts', json=_poll_payload()).json()
        r = client.patch(f'/api/team-space/posts/{created["id"]}/vote', json={
            'voter_matricule': '1003',
            'option_index': 99
        })
        assert r.status_code == 400

    def test_vote_on_non_poll_returns_400(self, client):
        created = client.post('/api/team-space/posts', json=_shoutout_payload()).json()
        r = client.patch(f'/api/team-space/posts/{created["id"]}/vote', json={
            'voter_matricule': '1004',
            'option_index': 0
        })
        assert r.status_code == 400


# ── Tests suppression ────────────────────────────────────────────────────────

class TestTeamSpaceDelete:
    def test_delete_post(self, client):
        created = client.post('/api/team-space/posts', json=_shoutout_payload()).json()
        post_id = created['id']
        r = client.delete(f'/api/team-space/posts/{post_id}')
        assert r.status_code == 200
        assert r.json()['ok'] is True

    def test_delete_post_no_longer_in_list(self, client):
        created = client.post('/api/team-space/posts', json=_shoutout_payload()).json()
        post_id = created['id']
        client.delete(f'/api/team-space/posts/{post_id}')
        r = client.get('/api/team-space/posts')
        ids = [p['id'] for p in r.json()]
        assert post_id not in ids

    def test_delete_post_404(self, client):
        r = client.delete('/api/team-space/posts/99999')
        assert r.status_code == 404


# ── Tests modification ───────────────────────────────────────────────────────

class TestTeamSpaceUpdate:
    def test_update_shoutout_message(self, client):
        created = client.post('/api/team-space/posts', json=_shoutout_payload()).json()
        post_id = created['id']
        r = client.patch(f'/api/team-space/posts/{post_id}', json={
            'message': 'Message mis à jour'
        })
        assert r.status_code == 200
        assert r.json()['message'] == 'Message mis à jour'

    def test_update_shoutout_destinataire(self, client):
        created = client.post('/api/team-space/posts', json=_shoutout_payload()).json()
        post_id = created['id']
        r = client.patch(f'/api/team-space/posts/{post_id}', json={
            'destinataire': 'NouveauDestinataire'
        })
        assert r.status_code == 200
        assert r.json()['destinataire'] == 'NouveauDestinataire'

    def test_update_kudos_valeur(self, client):
        created = client.post('/api/team-space/posts', json=_kudos_payload()).json()
        post_id = created['id']
        r = client.patch(f'/api/team-space/posts/{post_id}', json={
            'valeur': 'Innovation'
        })
        assert r.status_code == 200
        assert r.json()['valeur'] == 'Innovation'

    def test_update_kudos_raison(self, client):
        created = client.post('/api/team-space/posts', json=_kudos_payload()).json()
        post_id = created['id']
        r = client.patch(f'/api/team-space/posts/{post_id}', json={
            'raison': 'Nouvelle raison'
        })
        assert r.status_code == 200
        assert r.json()['raison'] == 'Nouvelle raison'

    def test_update_poll_question(self, client):
        created = client.post('/api/team-space/posts', json=_poll_payload()).json()
        post_id = created['id']
        r = client.patch(f'/api/team-space/posts/{post_id}', json={
            'question': 'Nouvelle question ?'
        })
        assert r.status_code == 200
        assert r.json()['question'] == 'Nouvelle question ?'

    def test_update_empty_message_ignored(self, client):
        created = client.post('/api/team-space/posts', json=_shoutout_payload()).json()
        post_id = created['id']
        original_message = created['message']
        r = client.patch(f'/api/team-space/posts/{post_id}', json={'message': ''})
        assert r.status_code == 200
        # Empty string should not overwrite existing message
        assert r.json()['message'] == original_message

    def test_update_post_404(self, client):
        r = client.patch('/api/team-space/posts/99999', json={'message': 'Test'})
        assert r.status_code == 404

    def test_update_post_after_1h_returns_403(self, client, db_session):
        created = client.post('/api/team-space/posts', json=_shoutout_payload()).json()
        post_id = created['id']
        # Backdate the post by 2 hours
        from app import models as m
        post = db_session.query(m.TeamSpacePost).filter(m.TeamSpacePost.id_post == post_id).first()
        post.date_creation = datetime.utcnow() - timedelta(hours=2)
        db_session.commit()
        r = client.patch(f'/api/team-space/posts/{post_id}', json={'message': 'Trop tard'})
        assert r.status_code == 403
