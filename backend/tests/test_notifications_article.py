"""
Tests : _avec_article() doit retourner l'article correct selon le rôle.
- Rôles commençant par une voyelle (AG, ADMIN) → "l'AG", "l'ADMIN"
- Autres rôles → "le RH", "le DG", "le PCA", etc.
Et notifier_validation_operation() ne doit PAS générer "par le AG".
"""
from datetime import date

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db import Base
from app import models
from app.utils.notifications import _avec_article, notifier_validation_operation


# ---------------------------------------------------------------------------
# Tests unitaires de _avec_article()
# ---------------------------------------------------------------------------

class TestAvecArticle:
    def test_ag_retourne_elision(self):
        assert _avec_article('AG') == "l'AG"

    def test_ag_minuscule_retourne_elision(self):
        """Le rôle en minuscule doit aussi être géré."""
        assert _avec_article('ag') == "l'ag"

    def test_admin_retourne_elision(self):
        assert _avec_article('ADMIN') == "l'ADMIN"

    def test_dg_retourne_le(self):
        assert _avec_article('DG') == "le DG"

    def test_rh_retourne_le(self):
        assert _avec_article('RH') == "le RH"

    def test_pca_retourne_le(self):
        assert _avec_article('PCA') == "le PCA"

    def test_directeur_retourne_le(self):
        assert _avec_article('DIRECTEUR') == "le DIRECTEUR"

    def test_responsable_retourne_le(self):
        assert _avec_article('RESPONSABLE') == "le RESPONSABLE"

    def test_none_retourne_le_vide(self):
        """Cas défensif : role=None ne doit pas crasher."""
        result = _avec_article(None)
        assert result.startswith("le ")

    def test_chaine_vide_retourne_le_vide(self):
        result = _avec_article('')
        assert result.startswith("le ")


# ---------------------------------------------------------------------------
# Tests d'intégration : notifier_validation_operation()
# ---------------------------------------------------------------------------

@pytest.fixture(scope="function")
def db_session():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.close()


def _make_employe(db, matricule, nom="Dupont", prenom="Jean"):
    emp = models.Employe(
        matricule=matricule,
        nom=nom,
        prenom=prenom,
        date_embauche=date(2020, 1, 1),
        statut_employe="ACTIF",
        email=f"{matricule}@test.com",
    )
    db.add(emp)
    db.flush()
    return emp


def _make_operation(db, matricule, type_demande="Mission"):
    op = models.Operation(
        matricule=matricule,
        type_demande=type_demande,
        statut="en attente",
        date_debut=date(2026, 5, 1),
        date_fin=date(2026, 5, 3),
    )
    db.add(op)
    db.flush()
    return op


def _make_rh_role_and_user(db, matricule_rh=8001):
    role = models.Role(name="RH", description="RH")
    db.add(role)
    db.flush()
    emp = _make_employe(db, matricule_rh, nom="Rh", prenom="User")
    user = models.Utilisateur(
        matricule=matricule_rh,
        role_id=role.id,
        mot_de_passe_hash="x",
        mot_de_passe_temporaire=False,
        mfa_enabled=False,
        mfa_active=False,
    )
    db.add(user)
    db.flush()
    return role, emp, user


class TestNotifArticleAG:
    """La notification d'une validation par l'AG ne doit jamais contenir 'le AG'."""

    def test_notif_validee_par_ag_message_sans_le_ag(self, db_session):
        emp = _make_employe(db_session, 3001)
        op = _make_operation(db_session, 3001, "Mission")
        _make_rh_role_and_user(db_session)
        db_session.commit()

        notifier_validation_operation(op.id_operation, "validé", "AG", None, db_session)

        notifs = db_session.query(models.Notification).filter(
            models.Notification.matricule == 3001
        ).all()
        assert notifs, "Aucune notification créée"
        for n in notifs:
            assert "par le AG" not in n.message, (
                f"Le message ne doit pas contenir 'par le AG' : '{n.message}'"
            )
            assert "par l'AG" in n.message, (
                f"Le message doit contenir \"par l'AG\" : '{n.message}'"
            )

    def test_notif_refusee_par_ag_message_sans_le_ag(self, db_session):
        emp = _make_employe(db_session, 3002)
        op = _make_operation(db_session, 3002, "Mission")
        _make_rh_role_and_user(db_session)
        db_session.commit()

        notifier_validation_operation(op.id_operation, "refusé", "AG", "Motif test", db_session)

        notifs = db_session.query(models.Notification).filter(
            models.Notification.matricule == 3002
        ).all()
        assert notifs
        for n in notifs:
            assert "par le AG" not in n.message, (
                f"Message refus ne doit pas contenir 'par le AG' : '{n.message}'"
            )

    def test_notif_validee_par_dg_message_avec_le_dg(self, db_session):
        """Vérifier que 'le DG' est toujours correct (pas d'élision)."""
        emp = _make_employe(db_session, 3003)
        op = _make_operation(db_session, 3003, "Mission")
        _make_rh_role_and_user(db_session)
        db_session.commit()

        notifier_validation_operation(op.id_operation, "validé", "DG", None, db_session)

        notifs = db_session.query(models.Notification).filter(
            models.Notification.matricule == 3003
        ).all()
        assert notifs
        demandeur_notif = notifs[0]
        assert "par le DG" in demandeur_notif.message, (
            f"Message doit contenir 'par le DG' : '{demandeur_notif.message}'"
        )

    def test_notif_validee_par_pca_message_avec_le_pca(self, db_session):
        emp = _make_employe(db_session, 3004)
        op = _make_operation(db_session, 3004, "Mission")
        _make_rh_role_and_user(db_session)
        db_session.commit()

        notifier_validation_operation(op.id_operation, "validé", "PCA", None, db_session)

        notifs = db_session.query(models.Notification).filter(
            models.Notification.matricule == 3004
        ).all()
        assert notifs
        demandeur_notif = notifs[0]
        assert "par le PCA" in demandeur_notif.message, (
            f"Message doit contenir 'par le PCA' : '{demandeur_notif.message}'"
        )

    def test_notif_conge_validee_par_ag(self, db_session):
        """Un congé validé par l'AG doit aussi utiliser l'élision."""
        emp = _make_employe(db_session, 3005)
        op = _make_operation(db_session, 3005, "Congé")
        _make_rh_role_and_user(db_session)
        db_session.commit()

        notifier_validation_operation(op.id_operation, "validé", "AG", None, db_session)

        notifs = db_session.query(models.Notification).filter(
            models.Notification.matricule == 3005
        ).all()
        assert notifs
        for n in notifs:
            assert "par le AG" not in n.message, (
                f"Congé: message ne doit pas contenir 'par le AG' : '{n.message}'"
            )
            assert "par l'AG" in n.message, (
                f"Congé: message doit contenir \"par l'AG\" : '{n.message}'"
            )
