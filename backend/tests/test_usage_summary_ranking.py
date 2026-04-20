"""
Tests for GET /employees/stats/usage/all/summary — ranking quality.

Verifies:
- All ranking entries include an 'id' field (required by frontend drill-down).
- Employees without any sessions appear with minutes=0 (fill-zeros pass).
- The ranking list is sorted by minutes descending (non-zero entries before zeros).
- All four dimensions (emp/dept/direction/entite) are present in the response.
"""
from datetime import datetime, timezone

from app import models


def test_usage_summary_ranking_includes_all_employees_with_zeros(
    client, db_session, seed_reference_data, auth_headers
):
    """Employees with no session must appear in emp ranking with minutes=0."""
    admin = seed_reference_data['admin']
    employe = seed_reference_data['employe']  # matricule 1001

    # Create one session with a known duration for employe only
    session = models.SessionUtilisation(
        matricule=employe.matricule,
        date_connexion=datetime.now(timezone.utc).replace(tzinfo=None),
        duree_minutes=90,
    )
    db_session.add(session)
    db_session.commit()

    resp = client.get(
        '/employees/stats/usage/all/summary',
        headers=auth_headers(admin.matricule, 'ADMIN'),
    )
    assert resp.status_code == 200
    data = resp.json()

    # All four periods must be present
    for period in ('today', 'week', 'month', 'year'):
        assert period in data, f"Missing period '{period}'"

    ranking = data['today']['ranking']

    # All four dimensions must be present
    for dim in ('emp', 'dept', 'direction', 'entite'):
        assert dim in ranking, f"Missing dimension '{dim}'"

    emp_ranking = ranking['emp']

    # All 6 employees created by seed_reference_data must appear
    assert len(emp_ranking) == 6

    # Every entry must have an 'id' field (required for frontend drill-down filtering)
    for entry in emp_ranking:
        assert 'id' in entry, f"Entry missing 'id': {entry}"
        assert 'label' in entry
        assert 'minutes' in entry
        assert 'sessions' in entry

    # The employee with a session must have the correct minutes
    emp_entry = next((e for e in emp_ranking if e['id'] == str(employe.matricule)), None)
    assert emp_entry is not None, f"Employee {employe.matricule} not found in ranking"
    assert emp_entry['minutes'] == 90

    # Employees without sessions must appear with minutes=0 (fill-zeros pass)
    zero_entries = [e for e in emp_ranking if e['id'] != str(employe.matricule)]
    assert len(zero_entries) == 5
    for entry in zero_entries:
        assert entry['minutes'] == 0, f"Expected 0 minutes for {entry['id']}, got {entry['minutes']}"

    # Ranking must be sorted descending by minutes (non-zero first)
    minutes_list = [e['minutes'] for e in emp_ranking]
    assert minutes_list == sorted(minutes_list, reverse=True), \
        f"Ranking not sorted descending: {minutes_list}"


def test_usage_summary_ranking_dept_has_id_field(
    client, db_session, seed_reference_data, auth_headers
):
    """Department, direction, and entite ranking entries must all include 'id'."""
    admin = seed_reference_data['admin']
    employe = seed_reference_data['employe']

    session = models.SessionUtilisation(
        matricule=employe.matricule,
        date_connexion=datetime.now(timezone.utc).replace(tzinfo=None),
        duree_minutes=30,
    )
    db_session.add(session)
    db_session.commit()

    resp = client.get(
        '/employees/stats/usage/all/summary',
        headers=auth_headers(admin.matricule, 'ADMIN'),
    )
    assert resp.status_code == 200
    ranking = resp.json()['today']['ranking']

    for dim in ('dept', 'direction', 'entite'):
        for entry in ranking[dim]:
            assert 'id' in entry, f"'{dim}' entry missing 'id': {entry}"
            assert entry['minutes'] >= 0


def test_usage_summary_requires_admin_role(client, seed_reference_data, auth_headers):
    """EMPLOYE role must receive 403 when accessing the summary endpoint."""
    employe = seed_reference_data['employe']
    resp = client.get(
        '/employees/stats/usage/all/summary',
        headers=auth_headers(employe.matricule, 'EMPLOYE'),
    )
    assert resp.status_code == 403
