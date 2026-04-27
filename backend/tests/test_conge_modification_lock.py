"""Phase F — B3 : règle modification congé J-14."""
import pytest
from datetime import date, timedelta, datetime
from app import models


def _seed(db, mat='EMP1'):
    role = models.Role(name='EMPLOYE'); db.add(role); db.flush()
    ent = models.Entite(nom='E'); db.add(ent); db.flush()
    emp = models.Employe(matricule=mat, nom='X', prenom='Y',
                         email=f'{mat}@e.x', date_embauche=date(2020,1,1),
                         id_entite=ent.id_entite, id_role=role.id,
                         fonction='EMPLOYE', sexe='M')
    db.add(emp); db.commit()
    return emp


def _make_op(db, mat, date_creation, date_debut, date_fin):
    op = models.Operation(
        matricule=mat,
        type_demande='Congé',
        titre='Demande conge',
        statut='en attente',
        date_demande=datetime.combine(date_creation, datetime.min.time()),
        date_debut=date_debut,
        date_fin=date_fin,
        duree_jours=(date_fin - date_debut).days + 1,
        motif='Repos',
    )
    db.add(op); db.commit(); db.refresh(op)
    return op


def test_modification_blocked_when_anticipated_and_within_14_days(client, auth_headers, db_session):
    emp = _seed(db_session, 'L1')
    today = date.today()
    op = _make_op(db_session, emp.matricule, today - timedelta(days=30),
                  today + timedelta(days=10), today + timedelta(days=12))
    h = auth_headers('L1', 'EMPLOYE')
    resp = client.put(f'/api/conges/{op.id_operation}/modifier',
                      params={'date_debut': str(today + timedelta(days=11)),
                              'date_fin': str(today + timedelta(days=13))},
                      headers=h)
    assert resp.status_code == 403
    assert 'verrouill' in resp.json()['detail'].lower()


def test_modification_allowed_when_anticipated_but_more_than_14_days_away(client, auth_headers, db_session):
    emp = _seed(db_session, 'L2')
    today = date.today()
    op = _make_op(db_session, emp.matricule, today - timedelta(days=30),
                  today + timedelta(days=20), today + timedelta(days=22))
    h = auth_headers('L2', 'EMPLOYE')
    resp = client.put(f'/api/conges/{op.id_operation}/modifier',
                      params={'date_debut': str(today + timedelta(days=21)),
                              'date_fin': str(today + timedelta(days=23))},
                      headers=h)
    assert resp.status_code != 403


def test_modification_allowed_when_not_anticipated_even_within_14_days(client, auth_headers, db_session):
    emp = _seed(db_session, 'L3')
    today = date.today()
    op = _make_op(db_session, emp.matricule, today - timedelta(days=2),
                  today + timedelta(days=5), today + timedelta(days=7))
    h = auth_headers('L3', 'EMPLOYE')
    resp = client.put(f'/api/conges/{op.id_operation}/modifier',
                      params={'date_debut': str(today + timedelta(days=6)),
                              'date_fin': str(today + timedelta(days=8))},
                      headers=h)
    assert resp.status_code != 403


def test_modification_allowed_when_not_anticipated_and_far(client, auth_headers, db_session):
    emp = _seed(db_session, 'L4')
    today = date.today()
    op = _make_op(db_session, emp.matricule, today - timedelta(days=1),
                  today + timedelta(days=30), today + timedelta(days=32))
    h = auth_headers('L4', 'EMPLOYE')
    resp = client.put(f'/api/conges/{op.id_operation}/modifier',
                      params={'date_debut': str(today + timedelta(days=30)),
                              'date_fin': str(today + timedelta(days=32))},
                      headers=h)
    assert resp.status_code != 403
