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

    # Cas 4: pas de heartbeat, pas de logout -> 0 min (on ne sait pas, on n'invente pas)
    s4 = models.SessionUtilisation(
        matricule='1001',
        date_connexion=now - timedelta(hours=5),
    )
    assert _resolve_minutes(s4) == 0, "sans heartbeat ni logout: 0 min (pas d'estimation)"


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


def test_resolve_minutes_uses_audit_log_fallback():
    """Quand il n'y a ni duree_minutes, ni date_deconnexion, ni derniere_activite,
    _resolve_minutes doit utiliser l'audit_map pour estimer la duree.

    Scenario: user connecte, aucun heartbeat enregistre (ancienne session),
    mais des entrees audit_log existent. La derniere action 20min apres login
    doit donner 20 + INACTIVITY_TIMEOUT = 35 min.
    """
    from app.routers.employees import _resolve_minutes, _INACTIVITY_TIMEOUT_MINUTES
    from app import models

    now = datetime.utcnow()
    connexion = now - timedelta(hours=1)

    # Session sans heartbeat ni logout
    s = models.SessionUtilisation(
        matricule='1001',
        date_connexion=connexion,
        date_deconnexion=None,
        duree_minutes=None,
        derniere_activite=None,
    )

    # audit_map: 3 actions, la derniere 20min apres login
    audit_map = {
        '1001': [
            connexion + timedelta(minutes=5),
            connexion + timedelta(minutes=12),
            connexion + timedelta(minutes=20),  # ← derniere action dans la fenetre
        ]
    }
    expected = 20 + _INACTIVITY_TIMEOUT_MINUTES  # = 35 min
    result = _resolve_minutes(s, audit_map=audit_map)
    assert result == expected, f"fallback audit_log attendu {expected}min, recu {result}min"


def test_resolve_minutes_audit_fallback_ignores_out_of_window():
    """Les actions audit_log au-dela de 12h apres la connexion ne doivent pas
    etre utilisees (elles appartiennent probablement a une session suivante).
    """
    from app.routers.employees import _resolve_minutes, _SESSION_MAX_WINDOW_HOURS
    from app import models

    now = datetime.utcnow()
    connexion = now - timedelta(hours=20)

    s = models.SessionUtilisation(
        matricule='1001',
        date_connexion=connexion,
        date_deconnexion=None,
        duree_minutes=None,
        derniere_activite=None,
    )

    # Une seule action, mais 14h apres la connexion (hors fenetre de 12h)
    audit_map = {
        '1001': [connexion + timedelta(hours=14)]
    }
    # Doit ignorer l'action hors fenetre et retourner 0
    result = _resolve_minutes(s, audit_map=audit_map)
    assert result == 0, f"action hors fenetre ne doit pas etre utilisee, recu {result}min"


def test_resolve_minutes_audit_fallback_absent_matricule():
    """Si le matricule n'est pas dans audit_map, retourner 0."""
    from app.routers.employees import _resolve_minutes
    from app import models

    now = datetime.utcnow()
    s = models.SessionUtilisation(
        matricule='9999',
        date_connexion=now - timedelta(hours=2),
    )
    audit_map = {'1001': [now - timedelta(hours=1)]}
    assert _resolve_minutes(s, audit_map=audit_map) == 0


# ── Tests fusion d'intervalles (anti-double-comptage) ─────────────────────────

def test_merge_intervals_basic():
    """Verifie la fusion d'intervalles qui se chevauchent."""
    from app.routers.employees import _merge_intervals
    now = datetime.utcnow()

    # Pas de chevauchement
    iv1 = (now, now + timedelta(minutes=10))
    iv2 = (now + timedelta(minutes=20), now + timedelta(minutes=30))
    assert len(_merge_intervals([iv1, iv2])) == 2

    # Chevauchement -> fusion
    iv1 = (now, now + timedelta(minutes=20))
    iv2 = (now + timedelta(minutes=10), now + timedelta(minutes=30))
    merged = _merge_intervals([iv1, iv2])
    assert len(merged) == 1
    assert merged[0][0] == now
    assert merged[0][1] == now + timedelta(minutes=30)

    # Contact exact -> fusion
    iv1 = (now, now + timedelta(minutes=10))
    iv2 = (now + timedelta(minutes=10), now + timedelta(minutes=20))
    merged = _merge_intervals([iv1, iv2])
    assert len(merged) == 1


def test_user_minutes_capped_by_window():
    """REGRESSION: un user ne peut JAMAIS depasser la duree physique
    de la fenetre meme avec plusieurs sessions paralleles.

    Reproduit le bug "46h en une journee" : 5 sessions de 10h chacune
    qui se chevauchent largement -> total reel = duree de la fenetre, pas la somme.
    """
    from app.routers.employees import _user_minutes_in_window
    from app import models

    now = datetime.utcnow()
    day_start = datetime.combine(now.date(), datetime.min.time())
    day_end = day_start + timedelta(days=1)

    # 5 sessions paralleles qui couvrent presque toute la journee
    sessions = []
    for i in range(5):
        sessions.append(models.SessionUtilisation(
            matricule='1001',
            date_connexion=day_start + timedelta(hours=i),  # 0h, 1h, 2h, 3h, 4h
            duree_minutes=600,  # 10h chacune
        ))

    mins = _user_minutes_in_window(sessions, day_start, day_end)
    # 4h + 10h = 14h max (de 0h a 14h). Pas 5 * 10h = 50h.
    assert mins <= 24 * 60, f"max 24h attendu, recu {mins} min ({mins/60}h)"
    assert mins == 14 * 60, f"intervals fusionnes attendus 14h, recu {mins/60}h"


def test_summary_does_not_double_count_parallel_sessions(client, db_session, seed_reference_data, auth_headers):
    """REGRESSION end-to-end: un user avec 3 sessions paralleles dans la meme
    journee ne doit pas voir son 'today.minutes' multiplie par 3.
    """
    from app import models
    today_dt = datetime.utcnow()
    day_start = datetime.combine(today_dt.date(), datetime.min.time())

    # 3 sessions paralleles de 1h chacune, toutes commencant a 10h
    base = day_start + timedelta(hours=10)
    for i in range(3):
        db_session.add(models.SessionUtilisation(
            matricule='1001',
            date_connexion=base + timedelta(minutes=i),  # decalees de 1min
            date_deconnexion=base + timedelta(minutes=60),
            duree_minutes=60,
        ))
    db_session.commit()

    headers = auth_headers('9001', 'ADMIN')
    resp = client.get('/employees/stats/usage/all/summary', headers=headers)
    assert resp.status_code == 200
    body = resp.json()

    # Attendu: ~60 min (les 3 sessions se chevauchent presque entierement)
    # PAS 180 min (somme bete des duree_minutes)
    today_mins = body['today']['minutes']
    assert today_mins <= 65, (
        f"Double-comptage detecte: {today_mins} min pour 3 sessions paralleles de 1h "
        f"(devrait etre ~60min). Le merge d'intervalles ne fonctionne pas."
    )
    assert today_mins >= 55, f"Sous-comptage: {today_mins} min attendu ~60"


def test_summary_today_never_exceeds_24h_per_user(client, db_session, seed_reference_data, auth_headers):
    """REGRESSION CRITIQUE: aucun utilisateur ne doit afficher > 24h aujourd'hui.

    Le bug "46h en une journee" venait de l'addition des minutes sans fusion.
    """
    from app import models
    today_dt = datetime.utcnow()
    day_start = datetime.combine(today_dt.date(), datetime.min.time())

    # 10 sessions de 6h chacune, decalees d'une heure -> total brut = 60h
    for i in range(10):
        db_session.add(models.SessionUtilisation(
            matricule='1001',
            date_connexion=day_start + timedelta(hours=i),
            date_deconnexion=day_start + timedelta(hours=i + 6),
            duree_minutes=360,
        ))
    db_session.commit()

    headers = auth_headers('9001', 'ADMIN')
    resp = client.get('/employees/stats/usage/all/summary', headers=headers)
    assert resp.status_code == 200
    body = resp.json()

    # Verifier que AUCUN user dans le ranking ne depasse 24h
    for emp in body['today']['ranking']['emp']:
        assert emp['minutes'] <= 24 * 60, (
            f"User {emp['label']} affiche {emp['minutes']} min "
            f"({emp['minutes']/60:.1f}h) > 24h IMPOSSIBLE dans une journee !"
        )
    # Le total today ne doit pas non plus depasser 24h par user actif
    assert body['today']['minutes'] <= 24 * 60 * body['today']['users'], (
        f"Total today.minutes = {body['today']['minutes']} pour "
        f"{body['today']['users']} users actifs (max possible = {24*60*body['today']['users']})"
    )


def test_summary_session_count_preserved_even_with_merge(client, db_session, seed_reference_data, auth_headers):
    """Le nombre de sessions brut est conserve (compte par jour),
    seules les MINUTES sont fusionnees."""
    from app import models
    today_dt = datetime.utcnow()
    day_start = datetime.combine(today_dt.date(), datetime.min.time())

    # 3 sessions paralleles
    base = day_start + timedelta(hours=10)
    for i in range(3):
        db_session.add(models.SessionUtilisation(
            matricule='1001',
            date_connexion=base + timedelta(minutes=i),
            date_deconnexion=base + timedelta(minutes=60),
            duree_minutes=60,
        ))
    db_session.commit()

    headers = auth_headers('9001', 'ADMIN')
    resp = client.get('/employees/stats/usage/all/summary', headers=headers)
    body = resp.json()

    # 3 sessions brutes mais 1 seul user
    assert body['today']['sessions'] == 3
    assert body['today']['users'] == 1
