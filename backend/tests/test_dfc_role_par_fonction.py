"""
Tests : le rôle DFC est déduit automatiquement de la fonction
'Directeur financier et Comptable' — aucune assignation manuelle requise.

Couverture :
  1. obtenir_role_validateur()  → retourne 'DFC' par fonction, pas par role_id
  2. obtenir_validateur_pour_role()  → trouve le DFC par fonction (même entité
     en priorité, puis global, puis fallback role_id)
  3. GET /roles/  → n'inclut pas 'DFC' dans la liste assignable
  4. auth._role_effectif()  → emballe 'DFC' dans le token pour un employé
     dont la fonction contient 'directeur financier'
  5. Workflow frais → DFC résolu via fonction quand role_id non assigné
"""
from datetime import date

import pytest
from fastapi.testclient import TestClient

from app import models
from app.db import Base, get_db
from app.main import app
from app.utils.security import hash_password
from app.utils import workflow as wf
from app.routers.auth import _role_effectif


# ─────────────────────────── fixtures ────────────────────────────────────────

@pytest.fixture()
def db(db_session):
    return db_session


@pytest.fixture()
def client_override(db_session):
    def override_get_db():
        yield db_session
    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


def _role(db, name):
    r = models.Role(name=name, description=name)
    db.add(r)
    db.flush()
    return r


def _entite(db, nom='ELCAM'):
    e = models.Entite(nom=nom)
    db.add(e)
    db.flush()
    return e


def _employe(db, matricule, fonction, entite, role_obj=None, with_user=True):
    emp = models.Employe(
        matricule=matricule,
        nom=f'Emp{matricule}', prenom='Test',
        email=f'{matricule}@example.com',
        date_embauche=date(2024, 1, 1),
        id_entite=entite.id_entite,
        id_role=role_obj.id if role_obj else None,
        fonction=fonction,
        sexe='M',
    )
    db.add(emp)
    db.flush()
    if with_user:
        user = models.Utilisateur(
            matricule=matricule,
            email=f'{matricule}@example.com',
            role_id=role_obj.id if role_obj else None,
            mot_de_passe_hash=hash_password('Pw123456!'),
            mot_de_passe_temporaire=False,
            mfa_enabled=False, mfa_active=False,
        )
        db.add(user)
        db.flush()
    return emp


# ─────────────────────── 1. obtenir_role_validateur ──────────────────────────

class TestObtenirRoleValidateur:
    def test_retourne_dfc_par_fonction(self, db):
        """Un employé SANS role_id assigné mais avec la bonne fonction → 'DFC'.
        La détection par fonction est un fallback pour les cas où aucun rôle
        n'a été assigné manuellement."""
        entite = _entite(db)
        emp = _employe(db, 9501, 'Directeur financier et Comptable(DFC)',
                       entite, role_obj=None, with_user=True)
        # S'assurer que role_id est NULL (pas de rôle assigné)
        user = db.query(models.Utilisateur).filter(models.Utilisateur.matricule == 9501).first()
        user.role_id = None
        emp.id_role = None
        db.flush()

        role = wf.obtenir_role_validateur(9501, db)
        assert role == 'DFC', f"Attendu 'DFC', obtenu '{role}'"

    def test_retourne_dfc_casse_insensible(self, db):
        """La détection par fonction est insensible à la casse."""
        entite = _entite(db)
        emp = _employe(db, 9502, 'DIRECTEUR FINANCIER ET COMPTABLE',
                       entite, role_obj=None, with_user=True)
        user = db.query(models.Utilisateur).filter(models.Utilisateur.matricule == 9502).first()
        user.role_id = None
        emp.id_role = None
        db.flush()

        role = wf.obtenir_role_validateur(9502, db)
        assert role == 'DFC'

    def test_retourne_role_normal_si_pas_dfc_fonction(self, db):
        """Un RH avec sa fonction normale → 'RH', pas 'DFC'."""
        entite = _entite(db)
        role_rh = _role(db, 'RH')
        _employe(db, 9503, 'Responsable des Ressources Humaines', entite, role_obj=role_rh)

        role = wf.obtenir_role_validateur(9503, db)
        assert role == 'RH'

    def test_role_assigne_prime_sur_fonction(self, db):
        """Si le role_id est DFC ET la fonction est aussi DFC → 'DFC' (cohérence)."""
        entite = _entite(db)
        role_dfc = _role(db, 'DFC')
        _employe(db, 9504, 'Directeur financier et Comptable(DFC)', entite, role_obj=role_dfc)

        role = wf.obtenir_role_validateur(9504, db)
        assert role == 'DFC'

    def test_employe_sans_role_sans_fonction_dfc(self, db):
        """Un employé sans role_id et sans fonction DFC → 'EMPLOYE'."""
        entite = _entite(db)
        role_emp = _role(db, 'EMPLOYE')
        _employe(db, 9505, 'Analyste financier', entite, role_obj=role_emp)

        role = wf.obtenir_role_validateur(9505, db)
        assert role == 'EMPLOYE'


# ────────────────────── 2. obtenir_validateur_pour_role ──────────────────────

class TestObtenirValidateurPourRole:
    def _make_org(self, db):
        entite_a = _entite(db, 'ELCAM')
        entite_b = _entite(db, 'ECG')
        role_emp = _role(db, 'EMPLOYE')
        role_rh = _role(db, 'RH')
        # DFC_A : fonction DFC, même entité qu'entite_a, PAS de role DFC assigné
        dfc_a = _employe(db, 6001, 'Directeur financier et Comptable(DFC)',
                         entite_a, role_obj=role_emp)
        # DFC_B : fonction DFC, entité B
        dfc_b = _employe(db, 6002, 'Directeur financier et Comptable(DFC)',
                         entite_b, role_obj=role_emp)
        # Demandeur dans entité A
        emp_a = _employe(db, 1001, 'Chargé comptabilité', entite_a, role_obj=role_emp)
        # Demandeur dans entité B
        emp_b = _employe(db, 1002, 'Chargé comptabilité', entite_b, role_obj=role_emp)
        db.commit()
        return dfc_a, dfc_b, emp_a, emp_b, entite_a, entite_b

    def test_trouve_dfc_meme_entite(self, db):
        """Priorité entité : le DFC de la même entité est trouvé en premier."""
        dfc_a, dfc_b, emp_a, _, _, _ = self._make_org(db)
        mat = wf.obtenir_validateur_pour_role(emp_a, 'DFC', db)
        assert mat == dfc_a.matricule

    def test_trouve_dfc_autre_entite_si_manquant(self, db):
        """Fallback global : si l'entité n'a pas de DFC, on prend le DFC global."""
        entite_a = _entite(db, 'ELCAM')
        entite_b = _entite(db, 'ECG')
        role_emp = _role(db, 'EMPLOYE')
        # DFC uniquement dans entite_b
        dfc_b = _employe(db, 6002, 'Directeur financier et Comptable(DFC)',
                         entite_b, role_obj=role_emp)
        emp_a = _employe(db, 1001, 'Chargé comptabilité', entite_a, role_obj=role_emp)
        db.commit()
        mat = wf.obtenir_validateur_pour_role(emp_a, 'DFC', db)
        assert mat == dfc_b.matricule

    def test_retourne_none_si_aucun_dfc(self, db):
        """Aucun employé DFC (ni par fonction ni par role_id) → None."""
        entite_a = _entite(db, 'ELCAM')
        role_emp = _role(db, 'EMPLOYE')
        emp = _employe(db, 1001, 'Chargé comptabilité', entite_a, role_obj=role_emp)
        db.commit()
        mat = wf.obtenir_validateur_pour_role(emp, 'DFC', db)
        assert mat is None

    def test_fallback_role_id_dfc(self, db):
        """Compatibilité descendante : role_id=DFC fonctionne toujours."""
        entite = _entite(db, 'ELCAM')
        role_dfc = _role(db, 'DFC')
        role_emp = _role(db, 'EMPLOYE')
        dfc = _employe(db, 6001, 'Directeur financier', entite, role_obj=role_dfc)
        emp = _employe(db, 1001, 'Comptable', entite, role_obj=role_emp)
        db.commit()
        mat = wf.obtenir_validateur_pour_role(emp, 'DFC', db)
        assert mat == dfc.matricule


# ──────────────────────── 3. GET /roles/ exclut DFC ──────────────────────────

class TestRolesEndpoint:
    def test_dfc_exclu_de_la_liste(self, db, client_override):
        """L'API /roles/ ne retourne jamais DFC."""
        for name in ['EMPLOYE', 'RH', 'DFC', 'DG', 'ADMIN']:
            db.add(models.Role(name=name, description=name))
        db.commit()

        resp = client_override.get('/roles/')
        assert resp.status_code == 200
        noms = [r['name'] for r in resp.json()]
        assert 'DFC' not in noms

    def test_autres_roles_toujours_presents(self, db, client_override):
        """Les rôles standards restent accessibles."""
        for name in ['EMPLOYE', 'RH', 'DG', 'ADMIN']:
            db.add(models.Role(name=name, description=name))
        db.commit()

        resp = client_override.get('/roles/')
        noms = [r['name'] for r in resp.json()]
        for name in ['EMPLOYE', 'RH', 'DG', 'ADMIN']:
            assert name in noms


# ──────────────────────── 4. _role_effectif (token) ──────────────────────────

class TestRoleEffectif:
    def _make_user_with_fonction(self, db, matricule, fonction, role_name='EMPLOYE'):
        entite = _entite(db, f'ENT{matricule}')
        role_obj = _role(db, role_name)
        emp = models.Employe(
            matricule=matricule, nom='Test', prenom='DFC',
            email=f'{matricule}@test.com',
            date_embauche=date(2024, 1, 1),
            id_entite=entite.id_entite,
            id_role=role_obj.id,
            fonction=fonction, sexe='M',
        )
        db.add(emp)
        db.flush()
        user = models.Utilisateur(
            matricule=matricule,
            email=f'{matricule}@test.com',
            role_id=role_obj.id,
            mot_de_passe_hash=hash_password('Pw123456!'),
            mot_de_passe_temporaire=False,
            mfa_enabled=False, mfa_active=False,
        )
        db.add(user)
        db.commit()
        return user

    def test_role_effectif_dfc_par_fonction(self, db):
        """_role_effectif retourne 'DFC' si la fonction contient 'directeur financier'."""
        user = self._make_user_with_fonction(
            db, 8001, 'Directeur financier et Comptable(DFC)')
        result = _role_effectif(user, db)
        assert result == 'DFC'

    def test_role_effectif_non_dfc(self, db):
        """_role_effectif retourne le rôle normal pour tout autre fonction."""
        user = self._make_user_with_fonction(db, 8002, 'Responsable RH', 'RH')
        result = _role_effectif(user, db)
        assert result == 'RH'

    def test_role_effectif_casse_insensible(self, db):
        """_role_effectif est insensible à la casse de la fonction."""
        user = self._make_user_with_fonction(db, 8003, 'DIRECTEUR FINANCIER ET COMPTABLE')
        result = _role_effectif(user, db)
        assert result == 'DFC'

    def test_login_retourne_role_dfc_par_fonction(self, db, client_override):
        """Après login, le token contient role=DFC pour l'employé DFC par fonction."""
        from jose import jwt
        import os

        entite = _entite(db, 'ELCAM_AUTH')
        role_emp = _role(db, 'EMPLOYE_AUTH')
        emp = models.Employe(
            matricule=9900, nom='Finance', prenom='Dir',
            email='dfc_test@example.com',
            date_embauche=date(2024, 1, 1),
            id_entite=entite.id_entite,
            id_role=role_emp.id,
            fonction='Directeur financier et Comptable(DFC)',
            sexe='M',
        )
        db.add(emp)
        db.flush()
        user = models.Utilisateur(
            matricule=9900,
            email='dfc_test@example.com',
            role_id=role_emp.id,  # rôle EMPLOYE, pas DFC
            mot_de_passe_hash=hash_password('Pw123456!'),
            mot_de_passe_temporaire=False,
            mfa_enabled=False, mfa_active=False,
        )
        db.add(user)
        db.commit()

        resp = client_override.post(
            '/auth/login',
            data={'matricule': '9900', 'password': 'Pw123456!'},
        )
        assert resp.status_code == 200
        token = resp.json()['access_token']
        # Décoder sans vérifier la signature pour inspecter le payload
        from app.utils.security import verify_token
        payload = verify_token(token)
        assert payload is not None, "Token invalide ou expiré"
        assert payload.get('role') == 'DFC', (
            f"Le token doit contenir role='DFC', obtenu: {payload.get('role')}"
        )


# ────────── 5. Workflow frais : DFC résolu par fonction sans role_id ──────────

class TestWorkflowDfcParFonction:
    def _make_org(self, db):
        entite = _entite(db, 'ELCAM')
        roles = {}
        for name in ['EMPLOYE', 'RH', 'DG', 'PCA']:
            roles[name] = _role(db, name)

        dept = models.Departement(nom='Finance', id_entite=entite.id_entite)
        db.add(dept)
        db.flush()

        direction = models.Direction(nom='Dir Finance', id_entite=entite.id_entite)
        db.add(direction)
        db.flush()
        dept.id_direction = direction.id_direction

        dir_role = _role(db, 'DIRECTEUR')
        directeur = _employe(db, 3001, 'Directeur', entite, role_obj=dir_role,
                             with_user=True)
        direction.id_directeur = directeur.matricule
        dept.id_direction = direction.id_direction

        # DFC par FONCTION uniquement — role_id = EMPLOYE
        dfc = _employe(db, 6001, 'Directeur financier et Comptable(DFC)',
                       entite, role_obj=roles['EMPLOYE'])
        dg = _employe(db, 4001, 'DG Général', entite, role_obj=roles['DG'])
        rh = _employe(db, 5001, 'Responsable RH', entite, role_obj=roles['RH'])
        pca = _employe(db, 7001, 'PCA', entite, role_obj=roles['PCA'])

        emp = models.Employe(
            matricule=1001, nom='Emp', prenom='Test',
            email='emp@example.com',
            date_embauche=date(2024, 1, 1),
            id_entite=entite.id_entite,
            dept_id=dept.dept_id,
            id_role=roles['EMPLOYE'].id,
            fonction='Analyste', sexe='M',
        )
        db.add(emp)
        db.commit()
        return emp, dfc

    def test_frais_inclut_dfc_dans_sequence(self, db):
        """Une demande avec frais inclut 'DFC' dans la séquence même si le
        validateur DFC n'a pas de role_id=DFC mais la bonne fonction."""
        emp, dfc = self._make_org(db)
        op = models.Operation(
            matricule=emp.matricule, type_demande='Mission',
            titre='Mission frais', statut='en attente',
            date_debut=date(2026, 6, 1), date_fin=date(2026, 6, 3),
            duree_jours=3, duree=3, motif='terrain',
        )
        db.add(op)
        db.commit()
        db.refresh(op)
        db.add(models.Frais(id_operation=op.id_operation,
                            frais_transport_voyage=30000, total_frais=30000))
        db.commit()

        seq = wf.determiner_sequence_validation(emp, db, op.id_operation)
        assert 'DFC' in seq, f"DFC attendu dans la séquence, obtenu: {seq}"
        assert seq.index('DFC') < seq.index('DG'), "DFC doit précéder DG"

    def test_frais_dfc_resolu_par_fonction(self, db):
        """obtenir_validateur_pour_role retourne le matricule DFC trouvé
        par fonction, sans aucun role_id=DFC dans la base."""
        emp, dfc = self._make_org(db)
        mat = wf.obtenir_validateur_pour_role(emp, 'DFC', db)
        assert mat == dfc.matricule

    def test_sans_frais_pas_de_dfc(self, db):
        """Sans frais, DFC n'apparaît pas dans la séquence."""
        emp, _ = self._make_org(db)
        op = models.Operation(
            matricule=emp.matricule, type_demande='Congé',
            titre='Congé', statut='en attente',
            date_debut=date(2026, 7, 1), date_fin=date(2026, 7, 5),
            duree_jours=5, motif='Repos',
        )
        db.add(op)
        db.commit()
        db.refresh(op)

        seq = wf.determiner_sequence_validation(emp, db, op.id_operation)
        assert 'DFC' not in seq, f"DFC ne doit pas figurer sans frais, obtenu: {seq}"
