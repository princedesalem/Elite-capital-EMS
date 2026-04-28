"""Tests pour l'endpoint GET /api/conges/{id}/modifiabilite (r\u00e8gle B3)."""
import pytest
from datetime import date, timedelta, datetime
from app import models


def _seed(db, mat='EMP1'):
    role = models.Role(name='EMPLOYE'); db.add(role); db.flush()
    ent = models.Entite(nom='E'); db.add(ent); db.flush()
    emp = models.Employe(matricule=mat, nom='X', prenom='Y',
                         email=f'{mat}@e.x', date_embauche=date(2020, 1, 1),
                         id_entite=ent.id_entite, id_role=role.id,
                         fonction='EMPLOYE', sexe='M')
    db.add(emp); db.commit()
    return emp


def _make_op(db, mat, date_creation, date_debut, date_fin, statut='en attente'):
    op = models.Operation(
        matricule=mat,
        type_demande='Cong\u00e9',
        titre='Demande cong\u00e9',
        statut=statut,
        date_demande=datetime.combine(date_creation, datetime.min.time()),
        date_debut=date_debut,
        date_fin=date_fin,
        duree_jours=(date_fin - date_debut).days + 1,
        motif='Repos',
    )
    db.add(op); db.commit(); db.refresh(op)
    return op


def test_modifiabilite_anticipe_dans_14j_blocage(client, auth_headers, db_session):
    emp = _seed(db_session, 'M1')
    today = date.today()
    op = _make_op(db_session, emp.matricule, today - timedelta(days=30),
                  today + timedelta(days=10), today + timedelta(days=12))
    resp = client.get(f'/api/conges/{op.id_operation}/modifiabilite',
                      headers=auth_headers('M1', 'EMPLOYE'))
    assert resp.status_code == 200
    body = resp.json()
    assert body['peut_modifier'] is False
    assert body['motif_blocage'] is not None
    assert 'verrouill' in body['motif_blocage'].lower()


def test_modifiabilite_non_anticipe_proche_autorise(client, auth_headers, db_session):
    emp = _seed(db_session, 'M2')
    today = date.today()
    op = _make_op(db_session, emp.matricule, today - timedelta(days=2),
                  today + timedelta(days=5), today + timedelta(days=7))
    resp = client.get(f'/api/conges/{op.id_operation}/modifiabilite',
                      headers=auth_headers('M2', 'EMPLOYE'))
    assert resp.status_code == 200
    body = resp.json()
    assert body['peut_modifier'] is True
    assert body['motif_blocage'] is None


def test_modifiabilite_anticipe_loin_autorise(client, auth_headers, db_session):
    emp = _seed(db_session, 'M3')
    today = date.today()
    op = _make_op(db_session, emp.matricule, today - timedelta(days=30),
                  today + timedelta(days=20), today + timedelta(days=22))
    resp = client.get(f'/api/conges/{op.id_operation}/modifiabilite',
                      headers=auth_headers('M3', 'EMPLOYE'))
    assert resp.status_code == 200
    assert resp.json()['peut_modifier'] is True


def test_modifiabilite_statut_non_attente_bloque(client, auth_headers, db_session):
    emp = _seed(db_session, 'M4')
    today = date.today()
    op = _make_op(db_session, emp.matricule, today - timedelta(days=2),
                  today + timedelta(days=5), today + timedelta(days=7),
                  statut='valid\u00e9')
    resp = client.get(f'/api/conges/{op.id_operation}/modifiabilite',
                      headers=auth_headers('M4', 'EMPLOYE'))
    assert resp.status_code == 200
    body = resp.json()
    assert body['peut_modifier'] is False
    assert 'attente' in (body['motif_blocage'] or '').lower()


def test_modifiabilite_inconnue_404(client, auth_headers, db_session):
    _seed(db_session, 'M5')
    resp = client.get('/api/conges/999999/modifiabilite',
                      headers=auth_headers('M5', 'EMPLOYE'))
    assert resp.status_code == 404
