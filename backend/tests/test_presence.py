"""
Tests pour le système de présence en ligne (heartbeat + liste de présence).

Couvre :
- PATCH /employees/me/heartbeat → 204 + mise à jour de derniere_connexion
- GET /employees/presence → liste tous les actifs, statut en_ligne correct
- Seuil 5 min : employé récent = en_ligne True, employé ancien = False
- Scope : seuls les ACTIFS sont retournés
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
from app.utils import security


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
    Base.metadata.drop_all(engine)


@pytest.fixture(scope='function')
def client(db_session):
    def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


def _make_token(matricule: str, role: str = 'EMPLOYE') -> str:
    return security.create_access_token({'matricule': matricule, 'role': role})


def _make_employe(db, matricule, statut='ACTIF', derniere_connexion=None):
    emp = models.Employe(
        matricule=matricule,
        nom='Test',
        prenom='User',
        email=f'{matricule}@test.com',
        date_embauche=datetime(2023, 1, 1).date(),
        statut_employe=statut,
        derniere_connexion=derniere_connexion,
    )
    db.add(emp)
    db.commit()
    return emp


# ── Test 1 : heartbeat retourne 204 ─────────────────────────────────────────

def test_heartbeat_returns_204(client, db_session):
    _make_employe(db_session, 'HB001')
    token = _make_token('HB001')
    res = client.patch(
        '/employees/me/heartbeat',
        headers={'Authorization': f'Bearer {token}'},
    )
    assert res.status_code == 204


# ── Test 2 : heartbeat met à jour derniere_connexion ────────────────────────

def test_heartbeat_updates_derniere_connexion(client, db_session):
    emp = _make_employe(db_session, 'HB002', derniere_connexion=None)
    assert emp.derniere_connexion is None

    token = _make_token('HB002')
    client.patch(
        '/employees/me/heartbeat',
        headers={'Authorization': f'Bearer {token}'},
    )

    db_session.refresh(emp)
    assert emp.derniere_connexion is not None
    # Doit être très récent (moins de 5 secondes)
    delta = datetime.utcnow() - emp.derniere_connexion
    assert delta.total_seconds() < 5


# ── Test 3 : heartbeat sans token = 204 silencieux (pas d'erreur) ───────────

def test_heartbeat_without_token_is_silent(client):
    res = client.patch('/employees/me/heartbeat')
    # Le endpoint ignore silencieusement les requêtes non authentifiées
    assert res.status_code == 204


# ── Test 4 : GET /presence retourne tous les actifs ─────────────────────────

def test_presence_returns_actifs_only(client, db_session):
    _make_employe(db_session, 'PR001', statut='ACTIF')
    _make_employe(db_session, 'PR002', statut='CONGEDIE')
    _make_employe(db_session, 'PR003', statut='ACTIF')

    token = _make_token('PR001')
    res = client.get(
        '/employees/presence',
        headers={'Authorization': f'Bearer {token}'},
    )
    assert res.status_code == 200
    matricules = [e['matricule'] for e in res.json()]
    assert 'PR001' in matricules
    assert 'PR003' in matricules
    assert 'PR002' not in matricules  # CONGEDIE exclu


# ── Test 5 : employé actif dans les 5 min = en_ligne True ───────────────────

def test_presence_en_ligne_true_for_recent_connexion(client, db_session):
    recent = datetime.utcnow() - timedelta(minutes=2)
    _make_employe(db_session, 'PR010', derniere_connexion=recent)

    token = _make_token('PR010')
    res = client.get(
        '/employees/presence',
        headers={'Authorization': f'Bearer {token}'},
    )
    assert res.status_code == 200
    emp_data = next(e for e in res.json() if e['matricule'] == 'PR010')
    assert emp_data['en_ligne'] is True


# ── Test 6 : employé connecté il y a > 5 min = en_ligne False ───────────────

def test_presence_en_ligne_false_for_old_connexion(client, db_session):
    old = datetime.utcnow() - timedelta(minutes=10)
    _make_employe(db_session, 'PR011', derniere_connexion=old)

    token = _make_token('PR011')
    res = client.get(
        '/employees/presence',
        headers={'Authorization': f'Bearer {token}'},
    )
    assert res.status_code == 200
    emp_data = next(e for e in res.json() if e['matricule'] == 'PR011')
    assert emp_data['en_ligne'] is False


# ── Test 7 : employé jamais connecté = en_ligne False ───────────────────────

def test_presence_en_ligne_false_for_never_connected(client, db_session):
    _make_employe(db_session, 'PR012', derniere_connexion=None)

    token = _make_token('PR012')
    res = client.get(
        '/employees/presence',
        headers={'Authorization': f'Bearer {token}'},
    )
    assert res.status_code == 200
    emp_data = next(e for e in res.json() if e['matricule'] == 'PR012')
    assert emp_data['en_ligne'] is False
    assert emp_data['derniere_connexion'] is None


# ── Test 8 : les en ligne apparaissent en tête de liste ─────────────────────

def test_presence_online_first(client, db_session):
    old = datetime.utcnow() - timedelta(hours=2)
    recent = datetime.utcnow() - timedelta(minutes=1)
    _make_employe(db_session, 'PR020', derniere_connexion=old)
    _make_employe(db_session, 'PR021', derniere_connexion=recent)

    token = _make_token('PR021')
    res = client.get(
        '/employees/presence',
        headers={'Authorization': f'Bearer {token}'},
    )
    assert res.status_code == 200
    data = res.json()
    online = [e for e in data if e['en_ligne']]
    offline = [e for e in data if not e['en_ligne']]
    # Tous les en ligne avant les hors ligne
    if online and offline:
        last_online_idx = max(i for i, e in enumerate(data) if e['en_ligne'])
        first_offline_idx = min(i for i, e in enumerate(data) if not e['en_ligne'])
        assert last_online_idx < first_offline_idx


# ── Test 9 : champ derniere_connexion ISO est dans la réponse ───────────────

def test_presence_has_derniere_connexion_field(client, db_session):
    ts = datetime(2026, 3, 15, 10, 30, 0)
    _make_employe(db_session, 'PR030', derniere_connexion=ts)

    token = _make_token('PR030')
    res = client.get(
        '/employees/presence',
        headers={'Authorization': f'Bearer {token}'},
    )
    assert res.status_code == 200
    emp_data = next(e for e in res.json() if e['matricule'] == 'PR030')
    assert emp_data['derniere_connexion'] is not None
    assert '2026-03-15' in emp_data['derniere_connexion']
