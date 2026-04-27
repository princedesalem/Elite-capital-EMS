"""Phase F — C4 : filtre employés par sexe."""
import pytest
from app import models
from datetime import date


@pytest.fixture()
def seeded_employees(db_session):
    # Use seeded reference via simple direct adds
    entite = models.Entite(nom='ENT')
    db_session.add(entite); db_session.flush()
    role = models.Role(name='EMPLOYE'); db_session.add(role); db_session.flush()
    for mat, sx in [('M001', 'M'), ('M002', 'M'), ('F001', 'F'), ('F002', 'F'), ('A001', 'Autre')]:
        db_session.add(models.Employe(
            matricule=mat, nom='N'+mat, prenom='P'+mat,
            email=f'{mat}@e.x', date_embauche=date(2024, 1, 1),
            id_entite=entite.id_entite, id_role=role.id,
            fonction='EMPLOYE', sexe=sx,
        ))
    db_session.commit()
    return entite, role


def test_normalize_sexe_filter():
    from app.routers.employees import _normalize_sexe_filter
    assert _normalize_sexe_filter('M') == 'M'
    assert _normalize_sexe_filter('m') == 'M'
    assert _normalize_sexe_filter('Homme') == 'M'
    assert _normalize_sexe_filter('F') == 'F'
    assert _normalize_sexe_filter('Femme') == 'F'
    assert _normalize_sexe_filter('Autre') == 'Autre'
    assert _normalize_sexe_filter('') is None
    assert _normalize_sexe_filter(None) is None


def test_filter_sexe_M(client, auth_headers, seeded_employees):
    headers = auth_headers('A001', 'ADMIN')
    resp = client.get('/employees/?sexe=M', headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    mats = [e['matricule'] for e in data]
    assert all(e['sexe'] == 'M' for e in data)
    assert 'M001' in mats and 'M002' in mats
    assert 'F001' not in mats


def test_filter_sexe_F(client, auth_headers, seeded_employees):
    headers = auth_headers('A001', 'ADMIN')
    resp = client.get('/employees/?sexe=F', headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert all(e['sexe'] == 'F' for e in data)


def test_filter_sexe_absent_returns_all(client, auth_headers, seeded_employees):
    headers = auth_headers('A001', 'ADMIN')
    resp = client.get('/employees/', headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) >= 5
