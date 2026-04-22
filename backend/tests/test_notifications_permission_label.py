"""
Tests : notifier_validation_operation() doit utiliser le bon libellé
selon le type_demande (permission, mission, congé) — et surtout NE PAS
confondre 'permission' avec 'mission' car 'mission' est une sous-chaîne
de 'per-MISSION-'.
"""
from datetime import date

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db import Base
from app import models
from app.utils.notifications import notifier_validation_operation


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


def _make_operation(db, matricule, type_demande):
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


# ---------------------------------------------------------------------------
# Permission
# ---------------------------------------------------------------------------

def test_permission_validation_notif_uses_permission_label(db_session):
    """Une permission validée doit générer 'Permission validée' — pas 'Mission validée'."""
    emp = _make_employe(db_session, 1001)
    op = _make_operation(db_session, 1001, "Permission")
    _make_rh_role_and_user(db_session)
    db_session.commit()

    notifier_validation_operation(op.id_operation, "validé", "DIRECTEUR", None, db_session)

    notifs = db_session.query(models.Notification).filter(
        models.Notification.matricule == 1001
    ).all()
    assert notifs, "Aucune notification créée pour le demandeur"

    demandeur_notif = notifs[0]
    # NOTE : 'mission' est une sous-chaîne de 'per-MISSION-', donc on vérifie
    # des phrases exactes plutôt que le mot seul.
    titre_lower = demandeur_notif.titre.lower()
    assert titre_lower.startswith("permission"), (
        f"Titre doit commencer par 'Permission', obtenu : '{demandeur_notif.titre}'"
    )
    assert not titre_lower.startswith("mission"), (
        f"Titre ne doit pas commencer par 'Mission', obtenu : '{demandeur_notif.titre}'"
    )
    msg_lower = demandeur_notif.message.lower()
    assert "votre permission" in msg_lower or "la permission" in msg_lower, (
        f"Message doit contenir 'votre permission' ou 'la permission', obtenu : '{demandeur_notif.message}'"
    )
    assert "la mission de" not in msg_lower, (
        f"Message ne doit pas contenir 'la mission de', obtenu : '{demandeur_notif.message}'"
    )
    assert "votre mission a été" not in msg_lower, (
        f"Message ne doit pas contenir 'votre mission a été', obtenu : '{demandeur_notif.message}'"
    )


def test_permission_refus_notif_uses_correct_label(db_session):
    """Une permission refusée doit générer 'Permission refusée'."""
    emp = _make_employe(db_session, 1002)
    op = _make_operation(db_session, 1002, "Permission")
    _make_rh_role_and_user(db_session)
    db_session.commit()

    notifier_validation_operation(op.id_operation, "refusé", "RESPONSABLE", "Motif test", db_session)

    notifs = db_session.query(models.Notification).filter(
        models.Notification.matricule == 1002
    ).all()
    assert notifs, "Aucune notification créée pour le refus"

    titre_lower = notifs[0].titre.lower()
    # 'mission' est une sous-chaîne de 'permission' — vérifier avec startswith
    assert titre_lower.startswith("permission"), (
        f"Titre doit commencer par 'Permission', obtenu : '{notifs[0].titre}'"
    )
    assert not titre_lower.startswith("mission"), (
        f"Titre ne doit pas commencer par 'Mission', obtenu : '{notifs[0].titre}'"
    )
    assert "refus" in titre_lower, f"Titre doit contenir 'refus', obtenu : '{notifs[0].titre}'"


# ---------------------------------------------------------------------------
# Mission
# ---------------------------------------------------------------------------

def test_mission_validation_notif_uses_mission_label(db_session):
    """Une mission validée doit conserver 'Mission validée'."""
    emp = _make_employe(db_session, 2001)
    op = _make_operation(db_session, 2001, "Mission")
    _make_rh_role_and_user(db_session)
    db_session.commit()

    notifier_validation_operation(op.id_operation, "validé", "DG", None, db_session)

    notifs = db_session.query(models.Notification).filter(
        models.Notification.matricule == 2001
    ).all()
    assert notifs, "Aucune notification créée pour la mission"

    titre = notifs[0].titre.lower()
    # 'permission' contient 'mission' — vérifier avec startswith
    assert titre.startswith("mission"), f"Titre doit commencer par 'mission', obtenu : '{notifs[0].titre}'"
    assert not titre.startswith("permission"), f"Titre ne doit pas commencer par 'permission'"


# ---------------------------------------------------------------------------
# Congé
# ---------------------------------------------------------------------------

def test_conge_validation_notif_uses_conge_label(db_session):
    """Un congé validé doit générer 'Congé validé' (masculin)."""
    emp = _make_employe(db_session, 3001)
    op = _make_operation(db_session, 3001, "Congé")
    _make_rh_role_and_user(db_session)
    db_session.commit()

    notifier_validation_operation(op.id_operation, "validé", "DG", None, db_session)

    notifs = db_session.query(models.Notification).filter(
        models.Notification.matricule == 3001
    ).all()
    assert notifs, "Aucune notification créée pour le congé"

    titre = notifs[0].titre.lower()
    assert "cong" in titre, f"Titre doit contenir 'congé', obtenu : '{notifs[0].titre}'"
    assert not titre.startswith("mission"), "Titre ne doit pas commencer par 'mission'"
    assert not titre.startswith("permission"), "Titre ne doit pas commencer par 'permission'"


# ---------------------------------------------------------------------------
# Notification RH — article et libellé corrects
# ---------------------------------------------------------------------------

def test_permission_notif_rh_uses_permission_label(db_session):
    """La notification RH pour une permission doit dire 'La permission de X' et non 'Le mission de X'."""
    rh_role = models.Role(name="RH", description="RH")
    db_session.add(rh_role)
    db_session.flush()

    rh_emp = _make_employe(db_session, 8001, "RH", "Agent")
    rh_user = models.Utilisateur(
        matricule=8001,
        role_id=rh_role.id,
        mot_de_passe_hash="x",
        mot_de_passe_temporaire=False,
        mfa_enabled=False,
        mfa_active=False,
    )
    db_session.add(rh_user)

    emp = _make_employe(db_session, 4001, "NGOULA", "Samuel")
    op = _make_operation(db_session, 4001, "Permission")
    db_session.commit()

    notifier_validation_operation(op.id_operation, "validé", "DIRECTEUR", None, db_session)

    rh_notifs = db_session.query(models.Notification).filter(
        models.Notification.matricule == 8001
    ).all()
    assert rh_notifs, "Aucune notification créée pour le RH"

    msg = rh_notifs[0].message.lower()
    assert "la permission de" in msg, (
        f"Message RH doit contenir 'La permission de', obtenu : '{rh_notifs[0].message}'"
    )
    assert "le mission de" not in msg, (
        f"Message RH ne doit pas contenir 'le mission de', obtenu : '{rh_notifs[0].message}'"
    )
    assert "la mission de" not in msg, (
        f"Message RH ne doit pas contenir 'la mission de', obtenu : '{rh_notifs[0].message}'"
    )
