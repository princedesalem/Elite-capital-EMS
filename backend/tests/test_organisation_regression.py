"""
Tests for organisation endpoints — guards against the
Departement.id_localisation AttributeError regression (bug where filtering
departments by localisation caused a 500 because the column doesn't exist on
the Departement model).
"""
import pytest
from fastapi.testclient import TestClient

from app import models
from app.utils.security import hash_password, create_access_token


def _auth_headers(db_session, client: TestClient, seed_reference_data) -> dict:
    """Return Bearer headers for a seeded ADMIN user."""
    token = create_access_token({'sub': '9001', 'matricule': '9001', 'role': 'ADMIN'})
    return {'Authorization': f'Bearer {token}'}


class TestEntitesFiltering:
    def test_get_entites_no_filter_returns_200(self, client, db_session, seed_reference_data):
        """GET /employees/entites without filter must return 200 with a list."""
        headers = _auth_headers(db_session, client, seed_reference_data)
        resp = client.get('/employees/entites', headers=headers)
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_get_entites_with_id_localisation_returns_200_not_500(
        self, client, db_session, seed_reference_data
    ):
        """GET /employees/entites?id_localisation=999 must return 200 (empty list acceptable).

        Regression: previously this triggered
          AttributeError: type object 'Departement' has no attribute 'id_localisation'
        which was converted into a 500.
        """
        headers = _auth_headers(db_session, client, seed_reference_data)
        resp = client.get('/employees/entites?id_localisation=999', headers=headers)
        assert resp.status_code == 200, (
            f"Expected 200, got {resp.status_code}. "
            "Likely Departement.id_localisation AttributeError still present."
        )
        assert isinstance(resp.json(), list)

    def test_get_directions_returns_200(self, client, db_session, seed_reference_data):
        headers = _auth_headers(db_session, client, seed_reference_data)
        resp = client.get('/employees/directions', headers=headers)
        assert resp.status_code == 200

    def test_get_departements_returns_200(self, client, db_session, seed_reference_data):
        headers = _auth_headers(db_session, client, seed_reference_data)
        resp = client.get('/employees/departements', headers=headers)
        assert resp.status_code == 200


class TestPaysVilles:
    def test_get_pays_returns_200(self, client, db_session, seed_reference_data):
        """GET /employees/pays must return 200 with a list of country records."""
        headers = _auth_headers(db_session, client, seed_reference_data)
        resp = client.get('/employees/pays', headers=headers)
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)

    def test_get_villes_autocomplete_returns_list(self, client, db_session, seed_reference_data):
        """GET /employees/autocomplete/villes?q=Paris returns a list (may be empty)."""
        headers = _auth_headers(db_session, client, seed_reference_data)
        resp = client.get('/employees/autocomplete/villes?q=Paris', headers=headers)
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)
