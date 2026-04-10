"""
Tests: les endpoints /api/notifications/non-lues et /api/notifications/toutes
renvoient bien le champ workflow_bucket ('envoye' si le destinataire est le
créateur de l'opération, 'recu' sinon).
"""
from datetime import date

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient

from app.db import Base, get_db
from app import models
from app.main import app


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


@pytest.fixture(scope="function")
def client(db_session):
    def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


def _make_employe(db_session, matricule: int):
    emp = models.Employe(
        matricule=matricule,
        nom="Bucket",
        prenom="Test",
        date_embauche=date(2020, 1, 1),
        statut_employe="ACTIF",
    )
    db_session.add(emp)
    db_session.flush()
    return emp


def _make_operation(db_session, id_operation: int, matricule_createur: int, type_demande: str = "Permission"):
    op = models.Operation(
        id_operation=id_operation,
        matricule=matricule_createur,
        type_demande=type_demande,
        statut="en attente",
        date_debut=date(2026, 6, 1),
        date_fin=date(2026, 6, 2),
    )
    db_session.add(op)
    db_session.flush()
    return op


def _make_notification(db_session, matricule: int, id_operation: int | None = None, lue: bool = False):
    notif = models.Notification(
        matricule=matricule,
        type_notification=models.TypeNotificationEnum.VALIDATION,
        titre="Test bucket",
        message="Message test",
        lue=lue,
        id_operation=id_operation,
    )
    db_session.add(notif)
    db_session.flush()
    return notif


# ── /non-lues/ ────────────────────────────────────────────────────────────────

class TestWorkflowBucketNonLues:
    def test_bucket_envoye_quand_destinataire_est_createur(self, client, db_session):
        """workflow_bucket='envoye' si la notif.matricule == operation.matricule."""
        _make_employe(db_session, 7100)
        _make_operation(db_session, id_operation=1001, matricule_createur=7100)
        _make_notification(db_session, matricule=7100, id_operation=1001, lue=False)
        db_session.commit()

        resp = client.get("/api/notifications/non-lues/7100")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["workflow_bucket"] == "envoye"

    def test_bucket_recu_quand_destinataire_est_validateur(self, client, db_session):
        """workflow_bucket='recu' si la notif.matricule != operation.matricule."""
        _make_employe(db_session, 7101)
        _make_employe(db_session, 7102)
        # Op créée par 7101, notification envoyée à 7102 (validateur)
        _make_operation(db_session, id_operation=1002, matricule_createur=7101)
        _make_notification(db_session, matricule=7102, id_operation=1002, lue=False)
        db_session.commit()

        resp = client.get("/api/notifications/non-lues/7102")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["workflow_bucket"] == "recu"

    def test_bucket_recu_quand_pas_d_operation(self, client, db_session):
        """workflow_bucket='recu' par défaut quand id_operation est None."""
        _make_employe(db_session, 7103)
        _make_notification(db_session, matricule=7103, id_operation=None, lue=False)
        db_session.commit()

        resp = client.get("/api/notifications/non-lues/7103")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["workflow_bucket"] == "recu"


# ── /toutes/ ──────────────────────────────────────────────────────────────────

class TestWorkflowBucketToutes:
    def test_bucket_envoye_quand_destinataire_est_createur(self, client, db_session):
        """workflow_bucket='envoye' si la notif.matricule == operation.matricule (endpoint toutes)."""
        _make_employe(db_session, 7200)
        _make_operation(db_session, id_operation=2001, matricule_createur=7200)
        _make_notification(db_session, matricule=7200, id_operation=2001, lue=True)
        db_session.commit()

        resp = client.get("/api/notifications/toutes/7200")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["workflow_bucket"] == "envoye"

    def test_bucket_recu_quand_destinataire_est_validateur(self, client, db_session):
        """workflow_bucket='recu' si la notif.matricule != operation.matricule (endpoint toutes)."""
        _make_employe(db_session, 7201)
        _make_employe(db_session, 7202)
        _make_operation(db_session, id_operation=2002, matricule_createur=7201)
        _make_notification(db_session, matricule=7202, id_operation=2002, lue=True)
        db_session.commit()

        resp = client.get("/api/notifications/toutes/7202")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["workflow_bucket"] == "recu"

    def test_bucket_recu_quand_pas_d_operation(self, client, db_session):
        """workflow_bucket='recu' par défaut quand id_operation est None (endpoint toutes)."""
        _make_employe(db_session, 7203)
        _make_notification(db_session, matricule=7203, id_operation=None, lue=False)
        db_session.commit()

        resp = client.get("/api/notifications/toutes/7203")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["workflow_bucket"] == "recu"
