"""
Tests for organisation endpoints — focuses on the entites/directions/departments
filtering logic and pays/villes autocomplete.
"""
import os
os.environ.setdefault('DATABASE_URL', 'sqlite:///./test_organisation.db')

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.db import Base, get_db

# ── In-memory SQLite test DB ────────────────────────────────────────────────
TEST_DB_URL = 'sqlite:///./test_organisation.db'
engine = create_engine(TEST_DB_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture(autouse=True, scope='module')
def setup_db():
    app.dependency_overrides[get_db] = override_get_db
    Base.metadata.create_all(bind=engine)
    yield
    app.dependency_overrides.pop(get_db, None)
    Base.metadata.drop_all(bind=engine)
    engine.dispose()
    if os.path.exists('test_organisation.db'):
        os.remove('test_organisation.db')


# ── Auth helper ─────────────────────────────────────────────────────────────
def get_token():
    """Generate a JWT token for an ADMIN user without hitting the DB."""
    from app.utils.security import create_access_token
    return create_access_token({'matricule': 9001, 'role': 'ADMIN'})


client = TestClient(app)


class TestEntites:
    def setup_method(self):
        self.token = get_token()
        self.headers = {'Authorization': f'Bearer {self.token}'} if self.token else {}

    def test_get_entites_no_filter_returns_200(self):
        """GET /employees/entites without filter must return 200 (not 500)."""
        resp = client.get('/employees/entites', headers=self.headers)
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_get_entites_with_id_localisation_returns_200(self):
        """GET /employees/entites?id_localisation=999 must return 200, not AttributeError 500.
        This regression test guards against the Departement.id_localisation column filter bug.
        """
        resp = client.get('/employees/entites?id_localisation=999', headers=self.headers)
        # Should be 200 with empty list (no data matching localisation 999), not 500
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_get_directions_returns_200(self):
        resp = client.get('/employees/directions', headers=self.headers)
        assert resp.status_code == 200

    def test_get_pays_returns_200(self):
        """GET /employees/pays must return 200 with list of country codes."""
        resp = client.get('/employees/pays', headers=self.headers)
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)

    def test_get_villes_autocomplete(self):
        """GET /employees/autocomplete/villes returns list."""
        resp = client.get('/employees/autocomplete/villes?q=Paris', headers=self.headers)
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)
