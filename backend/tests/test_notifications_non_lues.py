"""
Tests: l'endpoint /api/notifications/non-lues retourne bien les notifications non lues.
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
        nom="Notif",
        prenom="Test",
        date_embauche=date(2020, 1, 1),
        statut_employe="ACTIF",
    )
    db_session.add(emp)
    db_session.flush()
    return emp


def test_retourne_uniquement_non_lues(client, db_session):
    """Seules les notifications non lues doivent être renvoyées."""
    _make_employe(db_session, 6001)

    db_session.add(models.Notification(
        matricule=6001,
        type_notification=models.TypeNotificationEnum.VALIDATION,
        titre="Demande validée",
        message="Votre demande a été validée",
        lue=False,
    ))
    db_session.add(models.Notification(
        matricule=6001,
        type_notification=models.TypeNotificationEnum.REFUS,
        titre="Déjà lue",
        message="Notification déjà lue",
        lue=True,
    ))
    db_session.commit()

    resp = client.get("/api/notifications/non-lues/6001")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["titre"] == "Demande validée"
    assert data[0]["lue"] is False


def test_champs_complets_retournes(client, db_session):
    """Les champs requis par le frontend sont tous présents."""
    _make_employe(db_session, 6002)

    db_session.add(models.Notification(
        matricule=6002,
        type_notification=models.TypeNotificationEnum.AUTRE,
        titre="Test champs",
        message="Message test",
        lue=False,
    ))
    db_session.commit()

    resp = client.get("/api/notifications/non-lues/6002")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    entry = data[0]

    for champ in ("id_notification", "titre", "message", "date_creation", "lue"):
        assert champ in entry, f"Champ manquant: {champ}"

    assert entry["lue"] is False


def test_liste_vide_si_aucune(client, db_session):
    """Retourne une liste vide si aucune notification non lue."""
    resp = client.get("/api/notifications/non-lues/9998")
    assert resp.status_code == 200
    assert resp.json() == []


def test_plusieurs_non_lues(client, db_session):
    """Plusieurs notifications non lues sont toutes retournées."""
    _make_employe(db_session, 6003)

    for i in range(3):
        db_session.add(models.Notification(
            matricule=6003,
            type_notification=models.TypeNotificationEnum.AUTRE,
            titre=f"Notification {i}",
            message=f"Message {i}",
            lue=False,
        ))
    db_session.commit()

    resp = client.get("/api/notifications/non-lues/6003")
    assert resp.status_code == 200
    assert len(resp.json()) == 3


def test_compteur_coherent(client, db_session):
    """Le compteur /compteur/{matricule} doit être cohérent avec /non-lues/{matricule}."""
    _make_employe(db_session, 6004)

    for i in range(2):
        db_session.add(models.Notification(
            matricule=6004,
            type_notification=models.TypeNotificationEnum.AUTRE,
            titre=f"N{i}",
            message="msg",
            lue=False,
        ))
    db_session.commit()

    resp_list = client.get("/api/notifications/non-lues/6004")
    resp_count = client.get("/api/notifications/compteur/6004")

    assert resp_list.status_code == 200
    assert resp_count.status_code == 200
    assert len(resp_list.json()) == resp_count.json()["non_lues"]
