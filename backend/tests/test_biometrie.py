"""Tests pour le webhook biom\u00e9trie et la d\u00e9tection des retards."""
import os
from datetime import date, time, datetime
import pytest
from app import models
from app.utils import retards


def _seed_employe(db, mat='BIO1'):
    role = db.query(models.Role).filter(models.Role.name == 'EMPLOYE').first()
    if not role:
        role = models.Role(name='EMPLOYE'); db.add(role); db.flush()
    ent = db.query(models.Entite).first()
    if not ent:
        ent = models.Entite(nom='E'); db.add(ent); db.flush()
    emp = models.Employe(matricule=mat, nom='X', prenom='Y',
                         email=f'{mat}@e.x', date_embauche=date(2020, 1, 1),
                         id_entite=ent.id_entite, id_role=role.id,
                         fonction='EMPLOYE', sexe='M')
    db.add(emp); db.commit()
    return emp


def test_calculer_retard_minutes_pas_de_retard():
    assert retards.calculer_retard_minutes(time(7, 55)) == 0
    assert retards.calculer_retard_minutes(time(8, 0)) == 0


def test_calculer_retard_minutes_15():
    assert retards.calculer_retard_minutes(time(8, 15)) == 15


def test_calculer_retard_minutes_45():
    assert retards.calculer_retard_minutes(time(8, 45)) == 45


def test_detecter_retard_cree_notif_si_au_dessus_tolerance(db_session):
    emp = _seed_employe(db_session, 'BIO2')
    p = models.Pointage(matricule=emp.matricule, date_pointage=date.today(),
                        heure_arrivee=time(8, 30))
    db_session.add(p); db_session.commit(); db_session.refresh(p)
    minutes, notif_envoyee = retards.detecter_retard(p, db_session)
    assert minutes == 30
    assert notif_envoyee is True
    notifs = db_session.query(models.Notification).filter(
        models.Notification.matricule == emp.matricule,
        models.Notification.type_notification == models.TypeNotificationEnum.RETARD_POINTAGE,
    ).all()
    assert len(notifs) == 1


def test_detecter_retard_pas_de_notif_dans_tolerance(db_session):
    emp = _seed_employe(db_session, 'BIO3')
    p = models.Pointage(matricule=emp.matricule, date_pointage=date.today(),
                        heure_arrivee=time(8, 10))
    db_session.add(p); db_session.commit(); db_session.refresh(p)
    minutes, notif_envoyee = retards.detecter_retard(p, db_session)
    assert minutes == 10
    assert notif_envoyee is False


def test_webhook_sans_token_503(client):
    # Token non configur\u00e9 par d\u00e9faut → 503
    if 'BIOMETRIE_WEBHOOK_TOKEN' in os.environ:
        del os.environ['BIOMETRIE_WEBHOOK_TOKEN']
    resp = client.post('/api/biometrie/pointage', json={
        'matricule': 'X', 'date': str(date.today()), 'heure_arrivee': '08:23:00'
    })
    assert resp.status_code == 503


def test_webhook_token_invalide_401(client, db_session):
    _seed_employe(db_session, 'BIOX')
    os.environ['BIOMETRIE_WEBHOOK_TOKEN'] = 'secret-good'
    try:
        resp = client.post('/api/biometrie/pointage',
                           json={'matricule': 'BIOX', 'date': str(date.today()),
                                 'heure_arrivee': '08:23:00'},
                           headers={'X-Biometrie-Token': 'wrong'})
        assert resp.status_code == 401
    finally:
        del os.environ['BIOMETRIE_WEBHOOK_TOKEN']


def test_webhook_pointage_avec_retard(client, db_session):
    emp = _seed_employe(db_session, 'BIO4')
    os.environ['BIOMETRIE_WEBHOOK_TOKEN'] = 'secret-good'
    try:
        resp = client.post('/api/biometrie/pointage',
                           json={'matricule': emp.matricule, 'date': str(date.today()),
                                 'heure_arrivee': '08:30:00', 'device_id': 'ZK1'},
                           headers={'X-Biometrie-Token': 'secret-good'})
        assert resp.status_code == 201
        body = resp.json()
        assert body['retard_minutes'] == 30
        assert body['notif_retard_envoyee'] is True
    finally:
        del os.environ['BIOMETRIE_WEBHOOK_TOKEN']


def test_webhook_pointage_idempotent(client, db_session):
    emp = _seed_employe(db_session, 'BIO5')
    os.environ['BIOMETRIE_WEBHOOK_TOKEN'] = 'secret-good'
    try:
        payload = {'matricule': emp.matricule, 'date': str(date.today()),
                   'heure_arrivee': '08:00:00', 'device_id': 'ZK1'}
        h = {'X-Biometrie-Token': 'secret-good'}
        r1 = client.post('/api/biometrie/pointage', json=payload, headers=h)
        # Deuxi\u00e8me appel : ajout heure_depart, m\u00eame (matricule, date, device_id)
        payload2 = {**payload, 'heure_depart': '17:00:00'}
        r2 = client.post('/api/biometrie/pointage', json=payload2, headers=h)
        assert r1.status_code == 201
        assert r2.status_code == 201
        # Un seul enregistrement en base
        cnt = db_session.query(models.Pointage).filter(
            models.Pointage.matricule == emp.matricule
        ).count()
        assert cnt == 1
    finally:
        del os.environ['BIOMETRIE_WEBHOOK_TOKEN']
