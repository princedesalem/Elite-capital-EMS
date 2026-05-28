"""
Tests CRUD pour les fonctions de référence (FonctionReference).

Couvre :
- GET  /employees/admin/fonctions-reference  : liste + seed par défaut
- POST /employees/admin/fonctions-reference  : création, idempotence, libellé vide, doublon
- PUT  /employees/admin/fonctions-reference/{id} : mise à jour, 404, doublon
- DELETE /employees/admin/fonctions-reference/{id} : suppression, 404, blocage si utilisée
- Contrôle d'accès : seul ADMIN peut créer/modifier/supprimer
"""
import pytest
from fastapi.testclient import TestClient
from app.utils.security import create_access_token
from app import models


# ── Helpers tokens ─────────────────────────────────────────────────────────

def _token(refs, role_key):
    emp = refs[role_key]
    return create_access_token({'matricule': emp.matricule, 'role': emp.id_role})


def _auth(refs, role_key):
    emp = refs[role_key]
    role_name = role_key.upper()
    token = create_access_token({'matricule': emp.matricule, 'role': role_name})
    return {'Authorization': f'Bearer {token}'}


# ── Tests ──────────────────────────────────────────────────────────────────

class TestFonctionsReferenceCRUD:

    # ── GET : liste ─────────────────────────────────────────────────────────

    def test_list_fonctions_authenticated(self, client, seed_reference_data):
        """Tout utilisateur authentifié peut lire la liste."""
        headers = _auth(seed_reference_data, 'employe')
        r = client.get('/employees/admin/fonctions-reference', headers=headers)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_list_fonctions_not_authenticated(self, client):
        """Sans token, la liste est refusée."""
        r = client.get('/employees/admin/fonctions-reference')
        assert r.status_code in (401, 403)

    def test_list_excludes_role_names(self, client, seed_reference_data, db_session):
        """Les libellés correspondant à un nom de rôle ne doivent pas apparaître."""
        # Insérer manuellement une fonction dont le libellé = un rôle connu
        db_session.add(models.FonctionReference(libelle='ADMIN'))
        db_session.commit()

        headers = _auth(seed_reference_data, 'admin')
        r = client.get('/employees/admin/fonctions-reference', headers=headers)
        assert r.status_code == 200
        libelles = [f['libelle'] for f in r.json()]
        assert 'ADMIN' not in libelles

    # ── POST : création ─────────────────────────────────────────────────────

    def test_create_fonction_admin(self, client, seed_reference_data):
        """Un ADMIN peut créer une fonction."""
        headers = _auth(seed_reference_data, 'admin')
        r = client.post(
            '/employees/admin/fonctions-reference',
            json={'libelle': 'Responsable Conformité'},
            headers=headers,
        )
        assert r.status_code == 200
        data = r.json()
        assert data['libelle'] == 'Responsable Conformité'
        assert data['created'] is True
        assert data['id_fonction'] > 0

    def test_create_fonction_with_direction(self, client, seed_reference_data):
        """Création avec liaison direction."""
        headers = _auth(seed_reference_data, 'admin')
        id_dir = seed_reference_data['direction'].id_direction
        r = client.post(
            '/employees/admin/fonctions-reference',
            json={'libelle': 'Chef de Projet', 'id_direction': id_dir},
            headers=headers,
        )
        assert r.status_code == 200
        assert r.json()['id_direction'] == id_dir

    def test_create_fonction_with_dept(self, client, seed_reference_data):
        """Création avec liaison département."""
        headers = _auth(seed_reference_data, 'admin')
        dept_id = seed_reference_data['departement'].dept_id
        r = client.post(
            '/employees/admin/fonctions-reference',
            json={'libelle': 'Analyste Senior', 'dept_id': dept_id},
            headers=headers,
        )
        assert r.status_code == 200
        assert r.json()['dept_id'] == dept_id

    def test_create_fonction_idempotent(self, client, seed_reference_data):
        """Créer deux fois le même libellé retourne l'existant (created=False)."""
        headers = _auth(seed_reference_data, 'admin')
        payload = {'libelle': 'Chargé des Relations Publiques'}
        r1 = client.post('/employees/admin/fonctions-reference', json=payload, headers=headers)
        r2 = client.post('/employees/admin/fonctions-reference', json=payload, headers=headers)
        assert r1.status_code == 200
        assert r2.status_code == 200
        assert r1.json()['id_fonction'] == r2.json()['id_fonction']
        assert r2.json()['created'] is False

    def test_create_fonction_empty_libelle(self, client, seed_reference_data):
        """Un libellé vide doit être rejeté avec 400."""
        headers = _auth(seed_reference_data, 'admin')
        r = client.post(
            '/employees/admin/fonctions-reference',
            json={'libelle': '   '},
            headers=headers,
        )
        assert r.status_code == 400

    def test_create_fonction_role_name_rejected(self, client, seed_reference_data):
        """Un libellé correspondant à un rôle doit être rejeté avec 400."""
        headers = _auth(seed_reference_data, 'admin')
        r = client.post(
            '/employees/admin/fonctions-reference',
            json={'libelle': 'EMPLOYE'},
            headers=headers,
        )
        assert r.status_code == 400

    def test_create_fonction_allowed_for_rh(self, client, seed_reference_data):
        """RH est inclus dans _check_admin_role et peut créer une fonction."""
        headers = _auth(seed_reference_data, 'rh')
        r = client.post(
            '/employees/admin/fonctions-reference',
            json={'libelle': 'Fonction RH Test'},
            headers=headers,
        )
        assert r.status_code == 200
        assert r.json()['libelle'] == 'Fonction RH Test'

    # ── PUT : mise à jour ───────────────────────────────────────────────────

    def test_update_fonction(self, client, seed_reference_data, db_session):
        """Un ADMIN peut renommer une fonction."""
        headers = _auth(seed_reference_data, 'admin')
        # Créer d'abord
        r_create = client.post(
            '/employees/admin/fonctions-reference',
            json={'libelle': 'Fonction À Renommer'},
            headers=headers,
        )
        assert r_create.status_code == 200
        id_f = r_create.json()['id_fonction']

        r = client.put(
            f'/employees/admin/fonctions-reference/{id_f}',
            json={'libelle': 'Fonction Renommée'},
            headers=headers,
        )
        assert r.status_code == 200
        data = r.json()
        assert data['libelle'] == 'Fonction Renommée'
        assert data['updated'] is True

    def test_update_fonction_not_found(self, client, seed_reference_data):
        """PUT sur un id inexistant retourne 404."""
        headers = _auth(seed_reference_data, 'admin')
        r = client.put(
            '/employees/admin/fonctions-reference/999999',
            json={'libelle': 'Inexistant'},
            headers=headers,
        )
        assert r.status_code == 404

    def test_update_fonction_duplicate_rejected(self, client, seed_reference_data):
        """Renommer vers un libellé déjà pris doit retourner 400."""
        headers = _auth(seed_reference_data, 'admin')
        r1 = client.post('/employees/admin/fonctions-reference', json={'libelle': 'Fonction Alpha'}, headers=headers)
        r2 = client.post('/employees/admin/fonctions-reference', json={'libelle': 'Fonction Beta'},  headers=headers)
        id_beta = r2.json()['id_fonction']

        r = client.put(
            f'/employees/admin/fonctions-reference/{id_beta}',
            json={'libelle': 'Fonction Alpha'},
            headers=headers,
        )
        assert r.status_code == 400

    # ── DELETE : suppression ────────────────────────────────────────────────

    def test_delete_fonction_unused(self, client, seed_reference_data):
        """Supprimer une fonction non utilisée par des employés."""
        headers = _auth(seed_reference_data, 'admin')
        r_create = client.post(
            '/employees/admin/fonctions-reference',
            json={'libelle': 'Fonction Temporaire'},
            headers=headers,
        )
        id_f = r_create.json()['id_fonction']

        r = client.delete(f'/employees/admin/fonctions-reference/{id_f}', headers=headers)
        assert r.status_code == 200
        assert r.json()['deleted'] is True

        # Elle ne doit plus apparaître dans la liste (vérification par libellé)
        liste = client.get('/employees/admin/fonctions-reference', headers=headers).json()
        libelles = [f['libelle'] for f in liste]
        assert 'Fonction Temporaire' not in libelles

    def test_delete_fonction_not_found(self, client, seed_reference_data):
        """DELETE sur un id inexistant retourne 404."""
        headers = _auth(seed_reference_data, 'admin')
        r = client.delete('/employees/admin/fonctions-reference/999999', headers=headers)
        assert r.status_code == 404

    def test_delete_fonction_used_by_employee_blocked(self, client, seed_reference_data, db_session):
        """Supprimer une fonction utilisée par un employé doit être bloqué (400)."""
        headers = _auth(seed_reference_data, 'admin')

        # Créer la fonction
        r_create = client.post(
            '/employees/admin/fonctions-reference',
            json={'libelle': 'Fonction En Usage'},
            headers=headers,
        )
        assert r_create.status_code == 200
        id_f = r_create.json()['id_fonction']

        # Assigner ce libellé à un employé
        employe = seed_reference_data['employe']
        employe.fonction = 'Fonction En Usage'
        db_session.add(employe)
        db_session.commit()

        r = client.delete(f'/employees/admin/fonctions-reference/{id_f}', headers=headers)
        assert r.status_code == 400
        assert 'employé' in r.json()['detail'].lower()

    def test_delete_fonction_forbidden_for_employe(self, client, seed_reference_data, db_session):
        """Un EMPLOYE ne peut pas supprimer une fonction."""
        admin_headers = _auth(seed_reference_data, 'admin')
        r_create = client.post(
            '/employees/admin/fonctions-reference',
            json={'libelle': 'Fonction Test Accès'},
            headers=admin_headers,
        )
        id_f = r_create.json()['id_fonction']

        emp_headers = _auth(seed_reference_data, 'employe')
        r = client.delete(f'/employees/admin/fonctions-reference/{id_f}', headers=emp_headers)
        assert r.status_code in (401, 403)
