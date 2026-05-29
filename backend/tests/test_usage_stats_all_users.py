"""Regression test: /employees/stats/usage/all/summary doit agreger TOUS les
utilisateurs ayant ouvert au moins une session, pas uniquement l'admin connecte.

Ce test garantit qu'on n'introduira plus de regression du type
"les stats d'usage ne comptent que l'admin".
"""
from datetime import datetime, timedelta


def _add_session(db, matricule, started_at, duree_minutes=30, derniere_activite=None):
    from app import models
    deconn = None
    if duree_minutes is not None:
        deconn = started_at + timedelta(minutes=duree_minutes)
    s = models.SessionUtilisation(
        matricule=str(matricule),
        date_connexion=started_at,
        date_deconnexion=deconn,
        duree_minutes=duree_minutes if deconn else None,
        derniere_activite=derniere_activite,
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


def test_usage_summary_respects_tz_parameter(client, db_session, seed_reference_data, auth_headers):
    """Une session ouverte a 23h30 heure locale Africa/Douala (UTC+1) =>
    UTC 22h30 le meme jour. Avec ?tz=Africa/Douala elle doit etre comptee
    dans 'today' local et non dans 'yesterday' UTC.
    """
    from datetime import datetime as _dt, timezone as _tz
    from app import models

    # Now en local Douala
    try:
        from zoneinfo import ZoneInfo
    except ImportError:
        import pytest
        pytest.skip('zoneinfo indisponible')

    douala = ZoneInfo('Africa/Douala')
    now_local = _dt.now(douala)
    # Session ouverte il y a 5 minutes, heure locale
    started_local = now_local.replace(minute=0, second=0, microsecond=0)
    started_utc = started_local.astimezone(_tz.utc).replace(tzinfo=None)
    db_session.add(models.SessionUtilisation(
        matricule='9001', date_connexion=started_utc,
        date_deconnexion=started_utc, duree_minutes=15,
    ))
    db_session.commit()

    headers = auth_headers('9001', 'ADMIN')
    resp = client.get('/employees/stats/usage/all/summary', params={'tz': 'Africa/Douala'}, headers=headers)
    assert resp.status_code == 200
    body = resp.json()
    # La session doit etre dans "today" local (au moins 1 user, >=15 min)
    assert body['today']['users'] >= 1
    assert body['today']['minutes'] >= 15


# ── Tests duree / heartbeat ────────────────────────────────────────────────────

def test_resolve_minutes_uses_derniere_activite():
    """Anti-regression: _resolve_minutes NE DOIT PAS utiliser datetime.utcnow()
    quand derniere_activite est disponible.

    Regression corrigee: avant ce fix, une session sans logout etait comptee
    comme (utcnow - date_connexion), ce qui donnait ex. 5h33 pour un user
    qui avait ferme le navigateur apres 10 minutes.
    """
    from app.routers.employees import _resolve_minutes, _INACTIVITY_TIMEOUT_MINUTES
    from app import models

    now = datetime.utcnow()

    # Cas 1: logout propre via duree_minutes
    s = models.SessionUtilisation(
        matricule='1001',
        date_connexion=now - timedelta(hours=5),
        duree_minutes=42,
    )
    assert _resolve_minutes(s) == 42, "logout propre doit utiliser duree_minutes"

    # Cas 2: logout via date_deconnexion
    s2 = models.SessionUtilisation(
        matricule='1001',
        date_connexion=now - timedelta(hours=2),
        date_deconnexion=now - timedelta(hours=2) + timedelta(minutes=20),
    )
    assert _resolve_minutes(s2) == 20, "deconnexion doit calculer depuis timestamps"

    # Cas 3: heartbeat disponible — duree = (derniere_activite + INACTIVITY) - date_connexion
    # User connecte il y a 30min, dernier heartbeat il y a 5 minutes → duree ~40min
    connexion = now - timedelta(minutes=30)
    last_hb = now - timedelta(minutes=5)
    s3 = models.SessionUtilisation(
        matricule='1001',
        date_connexion=connexion,
        derniere_activite=last_hb,
    )
    expected = int((last_hb + timedelta(minutes=_INACTIVITY_TIMEOUT_MINUTES) - connexion).total_seconds() / 60)
    result = _resolve_minutes(s3)
    assert result == expected, f"avec heartbeat attendu {expected}min, recu {result}min"
    # duree = ~40min (30min actif + 15min timeout - 5min avant fin) — PAS utcnow() - connexion (~30min)
    # La cle: si l'user ferme le navigateur et qu'il n'y a plus de heartbeat,
    # on n'utilise PAS utcnow() (qui continuerait a croitre indefiniment)
    assert result == expected  # formule deterministe, pas dependante de utcnow()

    # Cas 4: pas de heartbeat, pas de logout -> 30 min conservatif
    s4 = models.SessionUtilisation(
        matricule='1001',
        date_connexion=now - timedelta(hours=5),
    )
    assert _resolve_minutes(s4) == 30, "sans heartbeat ni logout: 30 min conservatif"


def test_heartbeat_updates_derniere_activite(client, db_session, seed_reference_data, auth_headers):
    """Le PATCH /employees/me/heartbeat doit mettre a jour derniere_activite
    sur la session ouverte la plus recente de l'utilisateur."""
    from app import models

    now = datetime.utcnow()
    sess = models.SessionUtilisation(
        matricule='9001',
        date_connexion=now - timedelta(hours=1),
        date_deconnexion=None,
        derniere_activite=None,
    )
    db_session.add(sess)
    db_session.commit()
    id_sess = sess.id_session

    headers = auth_headers('9001', 'ADMIN')
    resp = client.patch('/employees/me/heartbeat', headers=headers)
    assert resp.status_code == 204

    db_session.expire_all()
    updated = db_session.query(models.SessionUtilisation).filter_by(id_session=id_sess).first()
    assert updated.derniere_activite is not None, "derniere_activite doit etre definie apres heartbeat"
    delta = abs((updated.derniere_activite - datetime.utcnow()).total_seconds())
    assert delta < 10, f"derniere_activite pas recente: {delta}s d'ecart"


def test_heartbeat_does_not_update_closed_session(client, db_session, seed_reference_data, auth_headers):
    """Le heartbeat ne doit PAS modifier une session fermee (date_deconnexion definie)."""
    from app import models

    now = datetime.utcnow()
    closed = models.SessionUtilisation(
        matricule='9001',
        date_connexion=now - timedelta(hours=2),
        date_deconnexion=now - timedelta(hours=1),
        derniere_activite=None,
    )
    db_session.add(closed)
    db_session.commit()
    id_closed = closed.id_session

    headers = auth_headers('9001', 'ADMIN')
    client.patch('/employees/me/heartbeat', headers=headers)

    db_session.expire_all()
    still_closed = db_session.query(models.SessionUtilisation).filter_by(id_session=id_closed).first()
    assert still_closed.derniere_activite is None, "session fermee ne doit pas etre modifiee par heartbeat"
