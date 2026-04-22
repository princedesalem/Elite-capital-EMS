"""
Tests: une opération refusée ou annulée ne bloque plus les dates.
"""
from datetime import date

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db import Base
from app import models
from app.utils.business_logic import verifier_chevauchement_operations


@pytest.fixture
def db_session():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.close()


@pytest.fixture
def employe(db_session):
    role = models.Role(name="EMPLOYE", description="Employe")
    db_session.add(role)
    db_session.flush()
    emp = models.Employe(
        matricule=7001,
        nom="Test",
        prenom="DateCheck",
        date_embauche=date(2020, 1, 1),
        id_role=role.id,
        statut_employe="ACTIF",
    )
    db_session.add(emp)
    db_session.commit()
    return emp


def test_dates_bloquees_si_en_attente(db_session, employe):
    """Une demande en attente doit bloquer les dates."""
    op = models.Operation(
        matricule=7001,
        type_demande="Congé",
        statut="en attente",
        date_debut=date(2026, 5, 1),
        date_fin=date(2026, 5, 5),
    )
    db_session.add(op)
    db_session.commit()

    chevauchement, msg = verifier_chevauchement_operations(
        employe, date(2026, 5, 1), date(2026, 5, 5), db_session
    )
    assert chevauchement, "Une demande en attente doit bloquer les dates"


def test_dates_libres_apres_refus(db_session, employe):
    """Un refus libère les dates pour une nouvelle demande."""
    op = models.Operation(
        matricule=7001,
        type_demande="Congé",
        statut="refusé",
        date_debut=date(2026, 5, 1),
        date_fin=date(2026, 5, 5),
    )
    db_session.add(op)
    db_session.commit()

    chevauchement, msg = verifier_chevauchement_operations(
        employe, date(2026, 5, 1), date(2026, 5, 5), db_session
    )
    assert not chevauchement, f"Une demande refusée ne doit pas bloquer les dates: {msg}"


def test_dates_libres_apres_rejete(db_session, employe):
    """Un rejet libère les dates."""
    op = models.Operation(
        matricule=7001,
        type_demande="Congé",
        statut="rejeté",
        date_debut=date(2026, 6, 1),
        date_fin=date(2026, 6, 3),
    )
    db_session.add(op)
    db_session.commit()

    chevauchement, msg = verifier_chevauchement_operations(
        employe, date(2026, 6, 1), date(2026, 6, 3), db_session
    )
    assert not chevauchement, f"Une demande rejetée ne doit pas bloquer les dates: {msg}"


def test_dates_libres_apres_annulation(db_session, employe):
    """Une annulation libère les dates."""
    op = models.Operation(
        matricule=7001,
        type_demande="Congé",
        statut="annulé",
        date_debut=date(2026, 7, 1),
        date_fin=date(2026, 7, 3),
    )
    db_session.add(op)
    db_session.commit()

    chevauchement, msg = verifier_chevauchement_operations(
        employe, date(2026, 7, 1), date(2026, 7, 3), db_session
    )
    assert not chevauchement, f"Une demande annulée ne doit pas bloquer les dates: {msg}"


def test_dates_bloquees_si_validee(db_session, employe):
    """Une demande validée continue de bloquer les dates."""
    op = models.Operation(
        matricule=7001,
        type_demande="Congé",
        statut="validé",
        date_debut=date(2026, 8, 1),
        date_fin=date(2026, 8, 5),
    )
    db_session.add(op)
    db_session.commit()

    chevauchement, msg = verifier_chevauchement_operations(
        employe, date(2026, 8, 1), date(2026, 8, 5), db_session
    )
    assert chevauchement, "Une demande validée doit bloquer les dates"


def test_chevauchement_partiel_refus_libre(db_session, employe):
    """Un chevauchement partiel avec une opération refusée ne doit pas bloquer."""
    op = models.Operation(
        matricule=7001,
        type_demande="Mission",
        statut="refusé",
        date_debut=date(2026, 9, 1),
        date_fin=date(2026, 9, 10),
    )
    db_session.add(op)
    db_session.commit()

    chevauchement, msg = verifier_chevauchement_operations(
        employe, date(2026, 9, 5), date(2026, 9, 15), db_session
    )
    assert not chevauchement, f"Chevauchement partiel avec refusée ne doit pas bloquer: {msg}"


def test_chevauchement_conge_article_masculin(db_session, employe):
    """Le message de chevauchement pour un congé doit utiliser 'un congé', pas 'une congé'."""
    op = models.Operation(
        matricule=7001,
        type_demande="Congé",
        statut="validé",
        date_debut=date(2026, 10, 1),
        date_fin=date(2026, 10, 15),
    )
    db_session.add(op)
    db_session.commit()

    chevauchement, msg = verifier_chevauchement_operations(
        employe, date(2026, 10, 5), date(2026, 10, 10), db_session
    )
    assert chevauchement
    assert "un congé" in msg.lower(), f"Article masculin attendu dans: {msg!r}"
    assert "une congé" not in msg.lower(), f"Article féminin incorrect dans: {msg!r}"


def test_chevauchement_permission_article_feminin(db_session, employe):
    """Le message de chevauchement pour une permission doit utiliser 'une permission'."""
    op = models.Operation(
        matricule=7001,
        type_demande="Permission",
        statut="validé",
        date_debut=date(2026, 11, 1),
        date_fin=date(2026, 11, 10),
    )
    db_session.add(op)
    db_session.commit()

    chevauchement, msg = verifier_chevauchement_operations(
        employe, date(2026, 11, 5), date(2026, 11, 8), db_session
    )
    assert chevauchement
    assert "une permission" in msg.lower(), f"Article féminin attendu dans: {msg!r}"


def test_chevauchement_message_accents(db_session, employe):
    """Le message de chevauchement doit contenir les accents corrects: déjà, période, opération."""
    op = models.Operation(
        matricule=7001,
        type_demande="Congé",
        statut="en attente",
        date_debut=date(2026, 12, 1),
        date_fin=date(2026, 12, 20),
    )
    db_session.add(op)
    db_session.commit()

    chevauchement, msg = verifier_chevauchement_operations(
        employe, date(2026, 12, 5), date(2026, 12, 10), db_session
    )
    assert chevauchement
    assert "déjà" in msg, f"'déjà' attendu dans: {msg!r}"
    assert "période" in msg, f"'période' attendu dans: {msg!r}"
    assert "opération" in msg, f"'opération' attendu dans: {msg!r}"
