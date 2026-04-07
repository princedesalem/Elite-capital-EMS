"""
Tests pour la liaison Fonction <-> Direction / Département (FonctionReference)
"""
import pytest
from fastapi.testclient import TestClient
from app.utils.security import create_access_token


def _admin_token(refs):
    return create_access_token({'matricule': refs['admin'].matricule, 'role': 'ADMIN'})


def _rh_token(refs):
    return create_access_token({'matricule': refs['rh'].matricule, 'role': 'RH'})


class TestFonctionLiaisons:
    def test_create_fonction_no_liaison(self, client, seed_reference_data):
        """Créer une fonction sans liaisons (cas de base — doit rester fonctionnel)."""
        refs = seed_reference_data
        token = _admin_token(refs)

        r = client.post(
            '/employees/admin/fonctions-reference',
            json={'libelle': 'Technicien Simple'},
            headers={'Authorization': f'Bearer {token}'}
        )
        assert r.status_code == 200
        data = r.json()
        assert data['libelle'] == 'Technicien Simple'
        assert data.get('id_direction') is None
        assert data.get('dept_id') is None

    def test_create_fonction_with_direction(self, client, seed_reference_data):
        refs = seed_reference_data
        token = _admin_token(refs)
        id_dir = refs['direction'].id_direction

        r = client.post(
            '/employees/admin/fonctions-reference',
            json={'libelle': 'Chef de direction', 'id_direction': id_dir},
            headers={'Authorization': f'Bearer {token}'}
        )
        assert r.status_code == 200
        data = r.json()
        assert data['id_direction'] == id_dir
        assert data.get('dept_id') is None

    def test_create_fonction_with_dept(self, client, seed_reference_data):
        refs = seed_reference_data
        token = _admin_token(refs)
        dept_id = refs['departement'].dept_id

        r = client.post(
            '/employees/admin/fonctions-reference',
            json={'libelle': 'Chef de département', 'dept_id': dept_id},
            headers={'Authorization': f'Bearer {token}'}
        )
        assert r.status_code == 200
        data = r.json()
        assert data['dept_id'] == dept_id

    def test_list_fonctions_includes_liaison_fields(self, client, seed_reference_data):
        refs = seed_reference_data
        token = _admin_token(refs)
        id_dir = refs['direction'].id_direction

        # Créer une fonction avec direction
        client.post(
            '/employees/admin/fonctions-reference',
            json={'libelle': 'Analyste Financement', 'id_direction': id_dir},
            headers={'Authorization': f'Bearer {token}'}
        )

        r = client.get(
            '/employees/admin/fonctions-reference',
            headers={'Authorization': f'Bearer {token}'}
        )
        assert r.status_code == 200
        data = r.json()
        # Chaque entrée doit avoir les champs de liaison
        for item in data:
            assert 'id_direction' in item
            assert 'dept_id' in item
            assert 'direction_nom' in item
            assert 'dept_nom' in item

    def test_update_fonction_direction(self, client, seed_reference_data):
        refs = seed_reference_data
        token = _admin_token(refs)
        id_dir = refs['direction'].id_direction

        # Créer sans direction
        r = client.post(
            '/employees/admin/fonctions-reference',
            json={'libelle': 'Comptable Principal'},
            headers={'Authorization': f'Bearer {token}'}
        )
        assert r.status_code == 200
        id_f = r.json()['id_fonction']

        # Mettre à jour avec direction
        r2 = client.put(
            f'/employees/admin/fonctions-reference/{id_f}',
            json={'libelle': 'Comptable Principal', 'id_direction': id_dir},
            headers={'Authorization': f'Bearer {token}'}
        )
        assert r2.status_code == 200
        data = r2.json()
        assert data['id_direction'] == id_dir
        assert data.get('updated') is True

    def test_list_includes_direction_nom(self, client, seed_reference_data):
        refs = seed_reference_data
        token = _admin_token(refs)
        id_dir = refs['direction'].id_direction

        client.post(
            '/employees/admin/fonctions-reference',
            json={'libelle': 'Responsable SI', 'id_direction': id_dir},
            headers={'Authorization': f'Bearer {token}'}
        )

        r = client.get(
            '/employees/admin/fonctions-reference',
            headers={'Authorization': f'Bearer {token}'}
        )
        data = r.json()
        linked = [d for d in data if d['libelle'] == 'Responsable SI']
        assert len(linked) == 1
        assert linked[0]['direction_nom'] == refs['direction'].nom
