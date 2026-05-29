"""
Tests pour les correctifs :
1. Email vide normalisé en NULL (évite la contrainte UNIQUE sur '')
2. GET /employees/autocomplete/fonctions?dept_id=X retourne les fonctions
   de FONCTION_REFERENCE pour ce département
"""
import pytest
from datetime import date
from fastapi.testclient import TestClient
from app.utils.security import create_access_token
from app import models


# ── Helpers ────────────────────────────────────────────────────────────────

def _auth(refs, role_key='admin'):
    emp = refs[role_key]
    token = create_access_token({'matricule': emp.matricule, 'role': role_key.upper()})
    return {'Authorization': f'Bearer {token}'}


def _create_employee_payload(suffix, email=''):
    """Retourne un payload minimal de création d'employé."""
    return {
        'matricule': f'TEST{suffix}',
        'nom': f'Test{suffix}',
        'prenom': f'User{suffix}',
        'email': email,
        'date_embauche': '2024-01-01',
        'sexe': 'M',
        'statut': 'actif',
    }


def _add_dept(payload, dept_id):
    """Ajoute le département via le champ 'departement' (ID ou nom)."""
    payload['departement'] = str(dept_id)
    return payload


# ── Tests email vide ────────────────────────────────────────────────────────

class TestEmailVideNormalisé:

    def test_email_vide_ne_cause_pas_doublon(self, client, seed_reference_data):
        """
        Créer deux employés sans email ne doit PAS retourner 400 / email déjà existant.
        L'email vide doit être stocké comme NULL (UNIQUE NULL != NULL en MySQL/SQLite).
        """
        headers = _auth(seed_reference_data)
        dept_id = seed_reference_data['departement'].dept_id

        payload1 = _add_dept(_create_employee_payload('A', email=''), dept_id)
        r1 = client.post('/employees/', json=payload1, headers=headers)
        assert r1.status_code in (200, 201), f"Premier employé : {r1.json()}"

        payload2 = _add_dept(_create_employee_payload('B', email=''), dept_id)
        r2 = client.post('/employees/', json=payload2, headers=headers)
        assert r2.status_code in (200, 201), (
            f"Deuxième employé sans email refusé : {r2.json()} "
            "(l'email vide ne doit pas être traité comme un doublon)"
        )

    def test_email_reel_cause_doublon(self, client, seed_reference_data):
        """Deux employés avec le MÊME email réel doivent déclencher une erreur."""
        headers = _auth(seed_reference_data)
        dept_id = seed_reference_data['departement'].dept_id

        payload1 = _add_dept(_create_employee_payload('C', email='same@example.com'), dept_id)
        r1 = client.post('/employees/', json=payload1, headers=headers)
        assert r1.status_code in (200, 201), f"Premier employé : {r1.json()}"

        payload2 = _add_dept(_create_employee_payload('D', email='same@example.com'), dept_id)
        r2 = client.post('/employees/', json=payload2, headers=headers)
        assert r2.status_code == 400, (
            "Deux employés avec le même email réel devraient être rejetés"
        )

    def test_email_espaces_normalise_en_null(self, client, seed_reference_data):
        """Un email composé uniquement d'espaces doit être traité comme NULL."""
        headers = _auth(seed_reference_data)
        dept_id = seed_reference_data['departement'].dept_id

        payload1 = _add_dept(_create_employee_payload('E', email='   '), dept_id)
        r1 = client.post('/employees/', json=payload1, headers=headers)
        assert r1.status_code in (200, 201), f"Premier : {r1.json()}"

        payload2 = _add_dept(_create_employee_payload('F', email='   '), dept_id)
        r2 = client.post('/employees/', json=payload2, headers=headers)
        assert r2.status_code in (200, 201), (
            f"Email blanc refusé comme doublon : {r2.json()}"
        )


# ── Tests autocomplete fonctions par département ───────────────────────────

class TestFonctionsParDepartement:

    def test_fonctions_retournees_pour_dept(self, client, seed_reference_data, db_session):
        """
        GET /employees/autocomplete/fonctions?dept_id=X doit retourner les fonctions
        liées à ce département dans FONCTION_REFERENCE.
        """
        headers = _auth(seed_reference_data)
        dept = seed_reference_data['departement']

        # Ajouter une fonction dans FONCTION_REFERENCE pour ce département
        fonction = models.FonctionReference(libelle='Analyste Test', dept_id=dept.dept_id)
        db_session.add(fonction)
        db_session.commit()

        r = client.get(
            f'/employees/autocomplete/fonctions?dept_id={dept.dept_id}',
            headers=headers
        )
        assert r.status_code == 200
        data = r.json()
        libelles = [item['value'] if isinstance(item, dict) else item for item in data]
        assert 'Analyste Test' in libelles, (
            f"La fonction 'Analyste Test' n'apparaît pas dans : {data}"
        )

    def test_fonctions_sans_dept_retourne_toutes(self, client, seed_reference_data, db_session):
        """
        Sans dept_id, l'endpoint retourne toutes les fonctions disponibles.
        """
        headers = _auth(seed_reference_data)

        fonction = models.FonctionReference(libelle='Fonction Générique', dept_id=None)
        db_session.add(fonction)
        db_session.commit()

        r = client.get('/employees/autocomplete/fonctions', headers=headers)
        assert r.status_code == 200
        data = r.json()
        libelles = [item['value'] if isinstance(item, dict) else item for item in data]
        assert 'Fonction Générique' in libelles

    def test_fonctions_dept_sans_employees_mais_avec_reference(
        self, client, seed_reference_data, db_session
    ):
        """
        Un département vide (sans employés) doit quand même retourner ses fonctions
        depuis FONCTION_REFERENCE. C'est le bug précédemment signalé.
        """
        headers = _auth(seed_reference_data)

        # Créer un département sans aucun employé
        entite = seed_reference_data['entite']
        nouveau_dept = models.Departement(
            nom='Nouveau Département Test',
            id_entite=entite.id_entite,
        )
        db_session.add(nouveau_dept)
        db_session.flush()

        # Ajouter une fonction de référence pour ce département
        fonction = models.FonctionReference(
            libelle='Responsable Nouveau Dept',
            dept_id=nouveau_dept.dept_id
        )
        db_session.add(fonction)
        db_session.commit()

        r = client.get(
            f'/employees/autocomplete/fonctions?dept_id={nouveau_dept.dept_id}',
            headers=headers
        )
        assert r.status_code == 200
        data = r.json()
        libelles = [item['value'] if isinstance(item, dict) else item for item in data]
        assert 'Responsable Nouveau Dept' in libelles, (
            f"Le département vide ne retourne pas ses fonctions de référence : {data}"
        )

    def test_fonctions_autre_dept_non_incluses(self, client, seed_reference_data, db_session):
        """
        Les fonctions d'un autre département ne doivent pas apparaître
        dans les résultats filtrés par dept_id.
        """
        headers = _auth(seed_reference_data)
        entite = seed_reference_data['entite']

        dept_a = models.Departement(nom='Dept A', id_entite=entite.id_entite)
        dept_b = models.Departement(nom='Dept B', id_entite=entite.id_entite)
        db_session.add_all([dept_a, dept_b])
        db_session.flush()

        db_session.add(models.FonctionReference(libelle='Fonction A', dept_id=dept_a.dept_id))
        db_session.add(models.FonctionReference(libelle='Fonction B', dept_id=dept_b.dept_id))
        db_session.commit()

        r = client.get(
            f'/employees/autocomplete/fonctions?dept_id={dept_a.dept_id}',
            headers=headers
        )
        assert r.status_code == 200
        data = r.json()
        libelles = [item['value'] if isinstance(item, dict) else item for item in data]
        assert 'Fonction A' in libelles
        assert 'Fonction B' not in libelles, (
            "Les fonctions d'un autre département ne doivent pas être incluses"
        )
