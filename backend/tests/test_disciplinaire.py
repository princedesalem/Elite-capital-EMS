"""
Tests — Gestion Disciplinaire (/api/disciplinaire/)
"""
import pytest
from datetime import date


# ── Helpers ───────────────────────────────────────────────────────────────────

@pytest.fixture()
def seed_emp(db_session, seed_reference_data):
    """Données de référence déjà créées + l'employé EMP001."""
    return seed_reference_data


def rh_headers(auth_headers):
    return auth_headers(5001, 'RH')


def employe_headers(auth_headers):
    return auth_headers(1001, 'EMPLOYE')


PAYLOAD = {
    'matricule': '1001',         # string (MesureCreate.matricule: str)
    'type_mesure': 'avertissement',
    'motif': 'Retard répété',
    'gravite': 2,
    'date_mesure': str(date.today()),
}


# ── Tests CRUD ────────────────────────────────────────────────────────────────

class TestCRUD:
    def test_creer_mesure_rh_201(self, client, seed_emp, auth_headers):
        r = client.post('/api/disciplinaire/', json=PAYLOAD, headers=rh_headers(auth_headers))
        assert r.status_code == 201
        data = r.json()
        assert data['type_mesure'] == 'avertissement'
        assert data['gravite'] == 2

    def test_lister_mesures_rh(self, client, seed_emp, auth_headers):
        # Crée une mesure puis liste
        client.post('/api/disciplinaire/', json=PAYLOAD, headers=rh_headers(auth_headers))
        r = client.get('/api/disciplinaire/', headers=rh_headers(auth_headers))
        assert r.status_code == 200
        items = r.json()
        assert isinstance(items, list)
        assert len(items) >= 1

    def test_modifier_mesure(self, client, seed_emp, auth_headers):
        r = client.post('/api/disciplinaire/', json=PAYLOAD, headers=rh_headers(auth_headers))
        assert r.status_code == 201
        id_mesure = r.json()['id_mesure']

        update = {'motif': 'Motif mis à jour', 'gravite': 3}
        r2 = client.put(f'/api/disciplinaire/{id_mesure}', json=update, headers=rh_headers(auth_headers))
        assert r2.status_code == 200
        assert r2.json()['motif'] == 'Motif mis à jour'
        assert r2.json()['gravite'] == 3

    def test_supprimer_mesure_204(self, client, seed_emp, auth_headers):
        r = client.post('/api/disciplinaire/', json=PAYLOAD, headers=rh_headers(auth_headers))
        assert r.status_code == 201
        id_mesure = r.json()['id_mesure']

        r2 = client.delete(f'/api/disciplinaire/{id_mesure}', headers=rh_headers(auth_headers))
        assert r2.status_code == 204

        # La mesure ne doit plus exister
        items = client.get('/api/disciplinaire/', headers=rh_headers(auth_headers)).json()
        ids = [m['id_mesure'] for m in items]
        assert id_mesure not in ids


# ── Tests d'accès ─────────────────────────────────────────────────────────────

class TestAcces:
    def test_employe_ne_peut_pas_creer_403(self, client, seed_emp, auth_headers):
        r = client.post('/api/disciplinaire/', json=PAYLOAD, headers=employe_headers(auth_headers))
        assert r.status_code == 403

    def test_employe_ne_peut_pas_lister_403(self, client, seed_emp, auth_headers):
        r = client.get('/api/disciplinaire/', headers=employe_headers(auth_headers))
        assert r.status_code == 403

    def test_sans_token_401(self, client, seed_emp):
        r = client.post('/api/disciplinaire/', json=PAYLOAD)
        assert r.status_code == 401

    def test_employe_peut_voir_ses_propres_mesures(self, client, seed_emp, auth_headers):
        # Crée une mesure pour l'employé 1001
        client.post('/api/disciplinaire/', json=PAYLOAD, headers=rh_headers(auth_headers))
        # L'employé peut lire ses propres mesures via /api/disciplinaire/employe/{matricule}
        r = client.get('/api/disciplinaire/employe/1001', headers=employe_headers(auth_headers))
        assert r.status_code == 200
        items = r.json()
        assert len(items) >= 1

    def test_employe_ne_peut_pas_voir_mesures_autre_employe(self, client, seed_emp, auth_headers):
        # Crée une mesure pour l'employé 1001
        client.post('/api/disciplinaire/', json=PAYLOAD, headers=rh_headers(auth_headers))
        # Employé 1001 tente de voir les mesures de l'employé 2001 → 403
        r = client.get('/api/disciplinaire/employe/2001', headers=employe_headers(auth_headers))
        assert r.status_code == 403


# ── Tests de validation ───────────────────────────────────────────────────────

class TestValidation:
    def test_type_mesure_invalide_422(self, client, seed_emp, auth_headers):
        bad = {**PAYLOAD, 'type_mesure': 'suspension'}  # non reconnu
        r = client.post('/api/disciplinaire/', json=bad, headers=rh_headers(auth_headers))
        assert r.status_code == 422

    def test_gravite_hors_plage_422(self, client, seed_emp, auth_headers):
        bad = {**PAYLOAD, 'gravite': 10}
        r = client.post('/api/disciplinaire/', json=bad, headers=rh_headers(auth_headers))
        assert r.status_code == 422

    def test_employe_introuvable_404(self, client, seed_emp, auth_headers):
        bad = {**PAYLOAD, 'matricule': '99999'}
        r = client.post('/api/disciplinaire/', json=bad, headers=rh_headers(auth_headers))
        assert r.status_code == 404

    def test_modifier_mesure_inexistante_404(self, client, seed_emp, auth_headers):
        r = client.put('/api/disciplinaire/99999', json={'motif': 'test'}, headers=rh_headers(auth_headers))
        assert r.status_code == 404
