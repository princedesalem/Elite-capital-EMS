"""Regression test: /employees/stats/usage/all/summary doit agreger TOUS les
utilisateurs ayant ouvert au moins une session, pas uniquement l'admin connecte.

Ce test garantit qu'on n'introduira plus de regression du type
"les stats d'usage ne comptent que l'admin".
"""
from datetime import datetime, timedelta


def _add_session(db, matricule, started_at, duree_minutes=30):
    from app import models
    s = models.SessionUtilisation(
        matricule=str(matricule),
        date_connexion=started_at,
        date_deconnexion=started_at + timedelta(minutes=duree_minutes),
        duree_minutes=duree_minutes,
    )
    db.add(s)
    db.commit()
    return s


def test_usage_summary_aggregates_all_users(client, db_session, seed_reference_data, auth_headers):
    """Avec 3 utilisateurs distincts ayant des sessions cette annee, l'endpoint
    doit en retourner 3 (et non 1)."""
    today = datetime.utcnow()
    _add_session(db_session, 9001, today, 45)             # ADMIN aujourd'hui
    _add_session(db_session, 1001, today, 60)             # EMPLOYE aujourd'hui
    _add_session(db_session, 5001, today - timedelta(days=2), 90)  # RH cette semaine

    headers = auth_headers('9001', 'ADMIN')
    resp = client.get('/employees/stats/usage/all/summary', headers=headers)
    assert resp.status_code == 200
    body = resp.json()

    assert body['today']['users'] == 2, f"Today users attendu 2, recu {body['today']['users']}"
    assert body['today']['sessions'] == 2
    assert body['week']['users'] == 3
    assert body['year']['users'] == 3
    assert body['year']['sessions'] == 3
    assert body['year']['minutes'] == 45 + 60 + 90

    emp_ranking = body['year']['ranking']['emp']
    non_zero = [r for r in emp_ranking if r['minutes'] > 0]
    assert len(non_zero) == 3, f"3 employes avec sessions attendus, recu {len(non_zero)}"


def test_usage_summary_requires_admin_role(client, db_session, seed_reference_data, auth_headers):
    """Un EMPLOYE simple ne doit pas pouvoir lire les stats globales."""
    headers = auth_headers('1001', 'EMPLOYE')
    resp = client.get('/employees/stats/usage/all/summary', headers=headers)
    assert resp.status_code == 403


def test_session_login_accepts_any_matricule(client, db_session, seed_reference_data):
    """L'endpoint /sessions/login doit accepter n'importe quel matricule
    (pas seulement l'admin) — sinon les stats ne tracent que l'admin en prod."""
    for matricule in (1001, 5001, 9001):
        resp = client.post('/employees/sessions/login', json={'matricule': matricule})
        assert resp.status_code == 200, f"matricule {matricule} a recu {resp.status_code}: {resp.text}"
        assert resp.json().get('status') == 'logged_in'
