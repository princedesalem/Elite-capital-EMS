"""
Tests: endpoint PUT /api/notifications/{id}/marquer-lue retourne 200 (non 500).
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
        nom="Test",
        prenom="Notif",
        date_embauche=date(2020, 1, 1),
        statut_employe="ACTIF",
    )
    db_session.add(emp)
    db_session.flush()
    return emp


def test_marquer_lue_returns_200(client, db_session):
    """PUT /{id}/marquer-lue doit retourner 200, pas 500."""
    _make_employe(db_session, 7001)
    notif = models.Notification(
        matricule=7001,
        type_notification=models.TypeNotificationEnum.VALIDATION,
        titre="Test marquer lue",
        message="Message de test",
        lue=False,
    )
    db_session.add(notif)
    db_session.commit()

    resp = client.put(f"/api/notifications/{notif.id_notification}/marquer-lue")
    assert resp.status_code == 200
    assert "marqu" in resp.json().get("message", "").lower()


def test_marquer_lue_updates_flag(client, db_session):
    """Après PUT marquer-lue, lue == True en base."""
    _make_employe(db_session, 7002)
    notif = models.Notification(
        matricule=7002,
        type_notification=models.TypeNotificationEnum.REFUS,
        titre="Flag test",
        message="Vérification flag lue",
        lue=False,
    )
    db_session.add(notif)
    db_session.commit()

    client.put(f"/api/notifications/{notif.id_notification}/marquer-lue")
    db_session.refresh(notif)
    assert notif.lue is True


def test_marquer_lue_unknown_returns_404(client, db_session):
    """ID inconnu → 404, pas 500."""
    resp = client.put("/api/notifications/99999/marquer-lue")
    assert resp.status_code == 404
