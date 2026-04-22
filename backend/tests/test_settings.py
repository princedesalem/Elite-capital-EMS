"""
Tests for /api/settings/{matricule} (user settings persistence).

Auth: Bearer token. The matricule in the JWT payload must match the path param
(IDOR protection). Uses seed_reference_data fixture from conftest.py.
"""
import pytest

from app.utils.security import create_access_token


def _headers(matricule):
    token = create_access_token({'matricule': matricule, 'role': 'EMPLOYE'}, expires_minutes=60)
    return {'Authorization': f'Bearer {token}'}


class TestGetSettings:
    def test_get_vide_nouvel_utilisateur(self, client, seed_reference_data):
        mat = seed_reference_data['employe'].matricule
        r = client.get(f'/api/settings/{mat}', headers=_headers(mat))
        assert r.status_code == 200
        body = r.json()
        assert body['matricule'] == mat
        assert body['settings'] == {}

    def test_get_sans_token_401(self, client, seed_reference_data):
        mat = seed_reference_data['employe'].matricule
        r = client.get(f'/api/settings/{mat}')
        assert r.status_code == 401

    def test_get_matricule_different_403(self, client, seed_reference_data):
        # Token carries matricule=1001 but request targets 5001 → 403 (IDOR)
        token_mat = seed_reference_data['employe'].matricule
        target = seed_reference_data['rh'].matricule
        r = client.get(f'/api/settings/{target}', headers=_headers(token_mat))
        assert r.status_code == 403


class TestPutSettings:
    def test_put_cree_settings(self, client, seed_reference_data):
        mat = seed_reference_data['employe'].matricule
        r = client.put(f'/api/settings/{mat}',
                       headers=_headers(mat),
                       json={'dark_mode': True})
        assert r.status_code == 200
        assert r.json()['settings']['dark_mode'] is True

    def test_get_apres_put_retourne_settings(self, client, seed_reference_data):
        mat = seed_reference_data['employe'].matricule
        client.put(f'/api/settings/{mat}', headers=_headers(mat),
                   json={'dark_mode': True, 'lang': 'fr'})
        r = client.get(f'/api/settings/{mat}', headers=_headers(mat))
        assert r.status_code == 200
        body = r.json()
        assert body['settings']['dark_mode'] is True
        assert body['settings']['lang'] == 'fr'

    def test_put_met_a_jour_settings_existants(self, client, seed_reference_data):
        mat = seed_reference_data['employe'].matricule
        client.put(f'/api/settings/{mat}', headers=_headers(mat),
                   json={'dark_mode': True})
        r = client.put(f'/api/settings/{mat}', headers=_headers(mat),
                       json={'dark_mode': False})
        assert r.status_code == 200
        assert r.json()['settings']['dark_mode'] is False

    def test_put_accepte_format_enveloppe(self, client, seed_reference_data):
        # Router accepte {settings: {...}} OR {...} directement
        mat = seed_reference_data['employe'].matricule
        r = client.put(f'/api/settings/{mat}', headers=_headers(mat),
                       json={'settings': {'theme': 'dark'}})
        assert r.status_code == 200
        assert r.json()['settings']['theme'] == 'dark'

    def test_put_matricule_different_403(self, client, seed_reference_data):
        token_mat = seed_reference_data['employe'].matricule
        target = seed_reference_data['rh'].matricule
        r = client.put(f'/api/settings/{target}',
                       headers=_headers(token_mat),
                       json={'dark_mode': True})
        assert r.status_code == 403
