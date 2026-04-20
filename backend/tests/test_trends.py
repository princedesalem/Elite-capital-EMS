"""Tests for GET /dashboard/trends/{matricule} — operation trends over 12 rolling months."""
import pytest
from datetime import date, timedelta


@pytest.fixture()
def trends_data(seed_reference_data, db_session):
    """Create operations across recent months so trends returns data."""
    from app import models
    refs = seed_reference_data
    emp = refs['employe']
    today = date.today()

    # Create operations in the current month and 1 month ago
    ops = []
    for i, (type_dem, delta_months) in enumerate([
        ('Mission', 0), ('Congé', 0), ('Permission', 0), ('Sortie', 0),
        ('Mission', 1), ('Congé', 1),
    ]):
        d = today.replace(day=1) - timedelta(days=delta_months * 30)
        op = models.Operation(
            matricule=emp.matricule, cree_par=emp.matricule,
            type_demande=type_dem, statut='en attente',
            date_debut=d, date_fin=d + timedelta(days=2),
            date_demande=d,
        )
        db_session.add(op)
        ops.append(op)

    db_session.commit()
    return refs, ops


def test_trends_returns_12_months(client, trends_data, auth_headers):
    refs, _ = trends_data
    mat = refs['employe'].matricule
    r = client.get(f"/dashboard/trends/{mat}", headers=auth_headers(mat, 'EMPLOYE'))
    assert r.status_code == 200
    data = r.json()
    assert len(data) == 12
    assert all('annee' in m and 'mois' in m for m in data)
    assert all(k in data[0] for k in ['Mission', 'Congé', 'Permission', 'Sortie', 'total'])


def test_trends_counts_current_month(client, trends_data, auth_headers):
    refs, _ = trends_data
    mat = refs['employe'].matricule
    r = client.get(f"/dashboard/trends/{mat}", headers=auth_headers(mat, 'EMPLOYE'))
    data = r.json()
    today = date.today()
    current = next(m for m in data if m['annee'] == today.year and m['mois'] == today.month)
    # We created 4 ops in current month (Mission, Congé, Permission, Sortie)
    assert current['total'] >= 4
    assert current['Mission'] >= 1
    assert current['Congé'] >= 1


def test_trends_employee_not_found(client, seed_reference_data, auth_headers):
    r = client.get("/dashboard/trends/999999", headers=auth_headers(999999, 'EMPLOYE'))
    assert r.status_code == 404


def test_trends_admin_sees_all(client, trends_data, auth_headers, db_session):
    """RH user should see operations from all employees."""
    from app import models
    refs, _ = trends_data
    rh = refs['rh']
    today = date.today()
    # Create operation for a different employee
    other = refs['responsable']
    op = models.Operation(
        matricule=other.matricule, cree_par=other.matricule,
        type_demande='Mission', statut='en attente',
        date_debut=today, date_fin=today + timedelta(days=1),
        date_demande=today,
    )
    db_session.add(op)
    db_session.commit()

    r = client.get(f"/dashboard/trends/{rh.matricule}", headers=auth_headers(rh.matricule, 'RH'))
    assert r.status_code == 200
    data = r.json()
    current = next(m for m in data if m['annee'] == today.year and m['mois'] == today.month)
    # Admin sees all — should see at least 5 ops in current month
    assert current['total'] >= 5


def test_trends_structure_with_no_extra_ops(client, seed_reference_data, auth_headers):
    """With only seed data, trends should still return 12 months with valid structure."""
    refs = seed_reference_data
    mat = refs['employe'].matricule
    r = client.get(f"/dashboard/trends/{mat}", headers=auth_headers(mat, 'EMPLOYE'))
    assert r.status_code == 200
    data = r.json()
    assert len(data) == 12
    # Each month has the expected keys
    for m in data:
        assert set(m.keys()) >= {'annee', 'mois', 'Mission', 'Congé', 'Permission', 'Sortie', 'total'}
