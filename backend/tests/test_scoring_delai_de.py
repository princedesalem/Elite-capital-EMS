"""
Tests — Logique DE dans le score de délai de validation.

Règle DE :
  - DEs dont date_limite_reponse tombe dans la période ET est déjà passée → comptées
  - Répondu avant le délai → bon (rapide)
  - Délai dépassé sans réponse (ou réponse tardive) → mauvais
  - Délai pas encore passé → non compté
"""
import pytest
from datetime import datetime, timedelta

from app import models


@pytest.fixture()
def seed(db_session, seed_reference_data):
    return seed_reference_data


def _periode_actuelle():
    return datetime.utcnow().strftime('%Y-%m')


def rh_headers(auth_headers):
    return auth_headers(5001, 'RH')


def emp_headers(auth_headers):
    return auth_headers(1001, 'EMPLOYE')


# ── Helper ────────────────────────────────────────────────────────────────────

def _make_de(db_session, matricule_employe, cree_par, delai_expire=True, repondu_avant_delai=None):
    """
    Crée une DE.
    delai_expire=True  → date_limite_reponse dans le passé (DE expirée)
    delai_expire=False → date_limite_reponse dans le futur (délai non encore dépassé)
    repondu_avant_delai=True  → répondu avant la date limite (bon)
    repondu_avant_delai=False → répondu après la date limite (mauvais)
    repondu_avant_delai=None  → pas encore répondu
    """
    now = datetime.utcnow()
    if delai_expire:
        date_limite = now - timedelta(hours=24)    # expiré il y a 24h
        cree_le = date_limite - timedelta(hours=72)
    else:
        date_limite = now + timedelta(hours=48)    # expire dans 48h
        cree_le = now - timedelta(hours=24)

    statut = 'EN_ATTENTE'
    date_reponse = None
    reponse = None
    if repondu_avant_delai is True:
        date_reponse = date_limite - timedelta(hours=12)   # 12h avant l'expiration
        statut = 'REPONDU'
        reponse = 'Ma réponse'
    elif repondu_avant_delai is False:
        date_reponse = date_limite + timedelta(hours=12)   # 12h après l'expiration
        statut = 'REPONDU'
        reponse = 'Ma réponse tardive'

    de = models.DemandeExplicationV2(
        matricule_employe=matricule_employe,
        cree_par=cree_par,
        motif='Test motif',
        statut=statut,
        date_limite_reponse=date_limite,
        cree_le=cree_le,
        reponse_employe=reponse,
        date_reponse=date_reponse,
    )
    db_session.add(de)
    db_session.commit()
    return de


# ── Tests ─────────────────────────────────────────────────────────────────────

class TestDelaiDEDansScore:

    def test_de_expire_sans_reponse_degrade_score(self, client, seed, db_session, auth_headers):
        """DE expirée sans réponse → comptée comme mauvaise → score dégradé."""
        _make_de(db_session, '1001', '5001', delai_expire=True, repondu_avant_delai=None)
        p = _periode_actuelle()
        r = client.get(f'/api/scores/employe/1001?periode={p}', headers=emp_headers(auth_headers))
        assert r.status_code == 200
        d = r.json()['dimensions']['delai_validation']
        assert d['total'] == 1
        assert d['rapides'] == 0
        assert d['valeur'] == 0.0

    def test_de_repondue_avant_delai_bon_score(self, client, seed, db_session, auth_headers):
        """DE expirée, répondu AVANT le délai → bon score."""
        _make_de(db_session, '1001', '5001', delai_expire=True, repondu_avant_delai=True)
        p = _periode_actuelle()
        r = client.get(f'/api/scores/employe/1001?periode={p}', headers=emp_headers(auth_headers))
        assert r.status_code == 200
        d = r.json()['dimensions']['delai_validation']
        assert d['total'] == 1
        assert d['rapides'] == 1
        assert d['valeur'] == 100.0

    def test_de_repondue_apres_delai_mauvais_score(self, client, seed, db_session, auth_headers):
        """DE expirée, répondu APRÈS le délai → comptée comme mauvaise."""
        _make_de(db_session, '1001', '5001', delai_expire=True, repondu_avant_delai=False)
        p = _periode_actuelle()
        r = client.get(f'/api/scores/employe/1001?periode={p}', headers=emp_headers(auth_headers))
        assert r.status_code == 200
        d = r.json()['dimensions']['delai_validation']
        assert d['total'] == 1
        assert d['rapides'] == 0
        assert d['valeur'] == 0.0

    def test_de_delai_non_expire_pas_comptee(self, client, seed, db_session, auth_headers):
        """DE dont le délai n'est PAS encore passé → non comptée dans le score."""
        _make_de(db_session, '1001', '5001', delai_expire=False, repondu_avant_delai=None)
        p = _periode_actuelle()
        r = client.get(f'/api/scores/employe/1001?periode={p}', headers=emp_headers(auth_headers))
        assert r.status_code == 200
        d = r.json()['dimensions']['delai_validation']
        assert d['total'] == 0
        assert d['valeur'] == 100.0

    def test_mix_bon_et_mauvais(self, client, seed, db_session, auth_headers):
        """1 DE avant délai + 1 DE expirée sans réponse → score = 50%."""
        _make_de(db_session, '1001', '5001', delai_expire=True, repondu_avant_delai=True)
        _make_de(db_session, '1001', '5001', delai_expire=True, repondu_avant_delai=None)
        p = _periode_actuelle()
        r = client.get(f'/api/scores/employe/1001?periode={p}', headers=emp_headers(auth_headers))
        assert r.status_code == 200
        d = r.json()['dimensions']['delai_validation']
        assert d['total'] == 2
        assert d['rapides'] == 1
        assert d['valeur'] == 50.0

    def test_de_autre_employe_pas_comptee(self, client, seed, db_session, auth_headers):
        """Une DE adressée à un autre employé ne doit pas impacter le score de 1001."""
        _make_de(db_session, '2001', '5001', delai_expire=True, repondu_avant_delai=None)
        p = _periode_actuelle()
        r = client.get(f'/api/scores/employe/1001?periode={p}', headers=emp_headers(auth_headers))
        assert r.status_code == 200
        d = r.json()['dimensions']['delai_validation']
        assert d['total'] == 0

    def test_employe_simple_validations_workflow_non_comptees(
        self, client, seed, db_session, auth_headers
    ):
        """
        Un employé simple (rôle EMPLOYE) ne valide aucune demande :
        les validations workflow ne doivent PAS entrer dans son score de délai.
        Seules les DEs comptent.
        """
        from calendar import monthrange
        now = datetime.utcnow()
        annee, mois = now.year, now.month
        last_day = monthrange(annee, mois)[1]
        d_start = datetime(annee, mois, 1)
        d_end = datetime(annee, mois, last_day, 23, 59, 59)

        # Créer une opération soumise par l'employé 1001 validée en 6h (hors délai)
        op = models.Operation(
            matricule='1001',
            type_demande='CONGE',
            titre='Test congé',
            statut='valide',
            date_debut=d_start.date(),
            date_fin=d_start.date(),
            duree_jours=1,
            motif='Test',
            date_demande=d_start,
        )
        db_session.add(op)
        db_session.flush()
        validation = models.Validation(
            id_operation=op.id_operation,
            matricule_validateur='2001',
            role_validateur='RESPONSABLE',
            statut_validation='VALIDE',
            timestamp_action=d_start + timedelta(hours=6),  # 6h > 3h
        )
        db_session.add(validation)
        db_session.commit()

        p = _periode_actuelle()
        r = client.get(f'/api/scores/employe/1001?periode={p}', headers=emp_headers(auth_headers))
        assert r.status_code == 200
        d = r.json()['dimensions']['delai_validation']
        # Employé simple : la validation workflow ne doit pas être comptée
        assert d['total'] == 0
        assert d['valeur'] == 100.0

    def test_responsable_validations_workflow_comptees(
        self, client, seed, db_session, auth_headers
    ):
        """
        Un responsable (rôle RESPONSABLE) a ses validations workflow comptées dans son score.
        (Le calcul porte sur les opérations qu'il a soumises et leur délai de validation.)
        """
        from calendar import monthrange
        now = datetime.utcnow()
        annee, mois = now.year, now.month
        d_start = datetime(annee, mois, 1)

        # Opération soumise PAR le responsable 2001, validée en 6h (hors délai 3h)
        op = models.Operation(
            matricule='2001',
            type_demande='CONGE',
            titre='Test congé resp',
            statut='valide',
            date_debut=d_start.date(),
            date_fin=d_start.date(),
            duree_jours=1,
            motif='Test',
            date_demande=d_start,
        )
        db_session.add(op)
        db_session.flush()
        validation = models.Validation(
            id_operation=op.id_operation,
            matricule_validateur='3001',
            role_validateur='DIRECTEUR',
            statut_validation='VALIDE',
            timestamp_action=d_start + timedelta(hours=6),  # 6h > 3h → mauvais
        )
        db_session.add(validation)
        db_session.commit()

        p = _periode_actuelle()
        r = client.get(f'/api/scores/employe/2001?periode={p}', headers=rh_headers(auth_headers))
        assert r.status_code == 200
        d = r.json()['dimensions']['delai_validation']
        # Responsable : la validation workflow doit être comptée
        assert d['total'] >= 1
        assert d['valeur'] < 100.0
