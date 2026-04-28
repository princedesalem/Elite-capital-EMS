"""Tests pour le module de relances 15 min en heures ouvr\u00e9es."""
import pytest
from datetime import date, datetime, timedelta
from app import models
from app.utils import relances


def _seed_employe(db, mat='REL1', role='RESPONSABLE'):
    role_obj = db.query(models.Role).filter(models.Role.name == role).first()
    if not role_obj:
        role_obj = models.Role(name=role); db.add(role_obj); db.flush()
    ent = db.query(models.Entite).first()
    if not ent:
        ent = models.Entite(nom='E'); db.add(ent); db.flush()
    emp = models.Employe(matricule=mat, nom='X', prenom='Y',
                         email=f'{mat}@e.x', date_embauche=date(2020, 1, 1),
                         id_entite=ent.id_entite, id_role=role_obj.id,
                         fonction=role, sexe='M')
    db.add(emp); db.commit()
    return emp


def test_en_heures_ouvrees_lundi_matin():
    # Lundi 15 d\u00e9cembre 2025 \u00e0 10h00
    assert relances.en_heures_ouvrees(datetime(2025, 12, 15, 10, 0)) is True


def test_en_heures_ouvrees_samedi_refuse():
    assert relances.en_heures_ouvrees(datetime(2025, 12, 13, 10, 0)) is False


def test_en_heures_ouvrees_dimanche_refuse():
    assert relances.en_heures_ouvrees(datetime(2025, 12, 14, 10, 0)) is False


def test_en_heures_ouvrees_avant_8h_refuse():
    assert relances.en_heures_ouvrees(datetime(2025, 12, 15, 7, 30)) is False


def test_en_heures_ouvrees_apres_18h_refuse():
    assert relances.en_heures_ouvrees(datetime(2025, 12, 15, 18, 0)) is False


def test_executer_relances_hors_horaires_no_op(db_session):
    _seed_employe(db_session, 'NOOP1')
    nb_v, nb_u = relances.executer_relances(db_session, now=datetime(2025, 12, 13, 10, 0))
    assert (nb_v, nb_u) == (0, 0)


def test_relancer_notifs_non_lues_seuil(db_session):
    emp = _seed_employe(db_session, 'NL1')
    # Notif vieille de 30 min, non lue
    notif = models.Notification(
        matricule=emp.matricule,
        type_notification=models.TypeNotificationEnum.VALIDATION,
        titre='Test', message='Message',
        lue=False,
        date_creation=datetime.now() - timedelta(minutes=30),
    )
    db_session.add(notif); db_session.commit(); db_session.refresh(notif)
    nb = relances.relancer_notifs_non_lues(db_session)
    assert nb == 1
    db_session.refresh(notif)
    assert notif.dernier_rappel_at is not None


def test_relancer_notifs_recente_ignoree(db_session):
    emp = _seed_employe(db_session, 'NL2')
    notif = models.Notification(
        matricule=emp.matricule,
        type_notification=models.TypeNotificationEnum.VALIDATION,
        titre='Test', message='Message',
        lue=False,
        date_creation=datetime.now() - timedelta(minutes=2),  # trop r\u00e9cente
    )
    db_session.add(notif); db_session.commit()
    nb = relances.relancer_notifs_non_lues(db_session)
    assert nb == 0


def test_relancer_notifs_lue_ignoree(db_session):
    emp = _seed_employe(db_session, 'NL3')
    notif = models.Notification(
        matricule=emp.matricule,
        type_notification=models.TypeNotificationEnum.VALIDATION,
        titre='Test', message='Message',
        lue=True,
        date_creation=datetime.now() - timedelta(minutes=30),
    )
    db_session.add(notif); db_session.commit()
    nb = relances.relancer_notifs_non_lues(db_session)
    assert nb == 0


def test_relancer_notifs_anti_spam_15min(db_session):
    emp = _seed_employe(db_session, 'NL4')
    now = datetime.now()
    notif = models.Notification(
        matricule=emp.matricule,
        type_notification=models.TypeNotificationEnum.VALIDATION,
        titre='Test', message='Message',
        lue=False,
        date_creation=now - timedelta(minutes=30),
        dernier_rappel_at=now - timedelta(minutes=5),  # rappel d\u00e9j\u00e0 fait < 15 min
    )
    db_session.add(notif); db_session.commit()
    nb = relances.relancer_notifs_non_lues(db_session, now=now)
    assert nb == 0
