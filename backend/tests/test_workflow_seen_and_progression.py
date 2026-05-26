"""
Tests pour :
  - GET /api/workflow/mes-vues/{matricule}  (endpoint persistance seenOps)
  - GET /api/workflow/progression/{id_operation}  (date_recu / date_vue enrichis)
"""
from datetime import date, datetime, timedelta

import pytest
from fastapi.testclient import TestClient

from app import models
from app.utils.security import hash_password


# ── helpers ──────────────────────────────────────────────────────────────────

def _make_user(db, matricule, role_name, n1=None):
    """Crée un EMPLOYE + UTILISATEUR minimal."""
    entite = db.query(models.Entite).first()
    dept = db.query(models.Departement).first()
    direction = db.query(models.Direction).first()
    role = db.query(models.Role).filter(models.Role.name == role_name).first()
    emp = models.Employe(
        matricule=matricule,
        nom=f'Nom{matricule}',
        prenom=f'Prenom{matricule}',
        email=f'{matricule}@test.com',
        date_embauche=date(2024, 1, 1),
        dept_id=dept.dept_id if dept else None,
        id_direction=direction.id_direction if direction else None,
        id_entite=entite.id_entite if entite else None,
        id_role=role.id if role else None,
        fonction=role_name,
        n1=n1,
        sexe='M',
    )
    db.add(emp)
    db.flush()
    usr = models.Utilisateur(
        matricule=matricule,
        email=f'{matricule}@test.com',
        role_id=role.id if role else None,
        mot_de_passe_hash=hash_password('PasswordTemp123!'),
        mot_de_passe_temporaire=False,
        mfa_enabled=False,
        mfa_active=False,
    )
    db.add(usr)
    db.flush()
    return emp


def _make_operation(db, matricule_createur):
    op = models.Operation(
        matricule=matricule_createur,
        type_demande='Congé',
        titre='Congé test',
        statut='en attente',
        date_debut=date(2026, 5, 1),
        date_fin=date(2026, 5, 3),
        duree_jours=3,
        motif='Test',
        date_demande=datetime(2026, 5, 1, 8, 0, 0),
    )
    db.add(op)
    db.flush()
    db.add(models.CongesLink(id_conges=op.id_operation))
    db.commit()
    db.refresh(op)
    return op


def _mark_seen(db, id_operation, matricule, dt=None):
    vue = models.OperationVue(
        id_operation=id_operation,
        matricule_observateur=str(matricule).upper(),
        nom_observateur=f'Nom {matricule}',
        role_observateur='RESPONSABLE',
        date_vue=dt or datetime.utcnow(),
    )
    db.add(vue)
    db.commit()
    db.refresh(vue)
    return vue


# ── fixture locale (référentiel minimal) ────────────────────────────────────

@pytest.fixture()
def base_data(db_session):
    entite = models.Entite(nom='ELCAM')
    db_session.add(entite)
    db_session.flush()
    direction = models.Direction(nom='DG', id_entite=entite.id_entite)
    db_session.add(direction)
    db_session.flush()
    dept = models.Departement(nom='Ops', id_entite=entite.id_entite, id_direction=direction.id_direction)
    db_session.add(dept)
    db_session.flush()
    for rname in ['EMPLOYE', 'RESPONSABLE', 'DIRECTEUR', 'DG', 'RH', 'ADMIN']:
        db_session.add(models.Role(name=rname, description=rname))
    db_session.commit()
    return {'entite': entite, 'direction': direction, 'dept': dept}


# ══════════════════════════════════════════════════════════════════════════════
#  GET /api/workflow/mes-vues/{matricule}
# ══════════════════════════════════════════════════════════════════════════════

def test_mes_vues_retourne_liste_vide_si_aucune_vue(client, db_session, base_data):
    """Un utilisateur sans consultation renvoie une liste vide."""
    emp = _make_user(db_session, 1001, 'EMPLOYE')
    resp = client.get(f'/api/workflow/mes-vues/{emp.matricule}')
    assert resp.status_code == 200
    assert resp.json() == []


def test_mes_vues_retourne_ids_vus(client, db_session, base_data):
    """Après avoir marqué 2 ops comme vues, mes-vues retourne ces 2 IDs."""
    createur = _make_user(db_session, 2001, 'RESPONSABLE')
    validateur = _make_user(db_session, 3001, 'RESPONSABLE')
    op1 = _make_operation(db_session, createur.matricule)
    op2 = _make_operation(db_session, createur.matricule)

    _mark_seen(db_session, op1.id_operation, validateur.matricule)
    _mark_seen(db_session, op2.id_operation, validateur.matricule)

    resp = client.get(f'/api/workflow/mes-vues/{validateur.matricule}')
    assert resp.status_code == 200
    ids = resp.json()
    assert op1.id_operation in ids
    assert op2.id_operation in ids
    assert len(ids) == 2


def test_mes_vues_isole_par_matricule(client, db_session, base_data):
    """Les vues d'un utilisateur ne doivent pas apparaître pour un autre."""
    createur = _make_user(db_session, 2002, 'RESPONSABLE')
    val_a = _make_user(db_session, 3002, 'RESPONSABLE')
    val_b = _make_user(db_session, 3003, 'RESPONSABLE')
    op = _make_operation(db_session, createur.matricule)

    _mark_seen(db_session, op.id_operation, val_a.matricule)

    # val_b n'a pas vu l'op
    resp = client.get(f'/api/workflow/mes-vues/{val_b.matricule}')
    assert resp.status_code == 200
    assert resp.json() == []

    # val_a l'a vue
    resp = client.get(f'/api/workflow/mes-vues/{val_a.matricule}')
    assert op.id_operation in resp.json()


def test_mes_vues_matricule_insensible_casse(client, db_session, base_data):
    """Le matricule passé en minuscules doit donner le même résultat qu'en majuscules."""
    createur = _make_user(db_session, 2003, 'RESPONSABLE')
    val = _make_user(db_session, 3004, 'RESPONSABLE')
    op = _make_operation(db_session, createur.matricule)
    _mark_seen(db_session, op.id_operation, val.matricule)

    resp_upper = client.get(f'/api/workflow/mes-vues/{val.matricule}')
    resp_lower = client.get(f'/api/workflow/mes-vues/{str(val.matricule).lower()}')
    assert resp_upper.json() == resp_lower.json()


# ══════════════════════════════════════════════════════════════════════════════
#  GET /api/workflow/progression/{id_operation}  — date_recu / date_vue
# ══════════════════════════════════════════════════════════════════════════════

def test_progression_date_vue_nulle_si_validateur_na_pas_vu(client, db_session, base_data):
    """Si aucune vue enregistrée, date_vue de chaque étape doit être null."""
    createur = _make_user(db_session, 4001, 'EMPLOYE')
    db_session.query(models.Departement).first()
    op = _make_operation(db_session, createur.matricule)

    resp = client.get(f'/api/workflow/progression/{op.id_operation}')
    assert resp.status_code == 200
    data = resp.json()
    for etape in data.get('etapes', []):
        assert etape.get('date_vue') is None, f"Étape {etape['role']}: date_vue devrait être null"


def test_progression_date_vue_renseignee_si_validateur_a_vu(client, db_session, seed_reference_data):
    """Quand un validateur a ouvert l'opération, date_vue doit être présente dans son étape.
    Le DG (4001) est dans la séquence et a matricule_validateur_attendu → on peut le matcher.
    """
    op = seed_reference_data['operation']
    dg = seed_reference_data['dg']

    vu_at = datetime(2026, 5, 1, 9, 30, 0)
    _mark_seen(db_session, op.id_operation, dg.matricule, dt=vu_at)

    resp = client.get(f'/api/workflow/progression/{op.id_operation}')
    assert resp.status_code == 200
    data = resp.json()
    etapes = data.get('etapes', [])

    # Trouver l'étape DG dont le matricule_validateur_attendu correspond au DG
    mat_dg = str(dg.matricule).upper()
    etape_dg = next(
        (e for e in etapes
         if str(e.get('matricule_validateur') or '').upper() == mat_dg
         or str(e.get('matricule_validateur_attendu') or '').upper() == mat_dg),
        None,
    )
    assert etape_dg is not None, f'Étape du DG ({mat_dg}) non trouvée dans {etapes}'
    assert etape_dg['date_vue'] is not None, f'date_vue devrait être renseignée pour le DG : {etape_dg}'
    assert '2026-05-01' in etape_dg['date_vue']


def test_progression_pas_encore_vue_absente_si_non_consulte(client, db_session, base_data):
    """Pour une étape en attente sans vue, date_vue == null (frontend affiche 'Pas encore vue')."""
    createur = _make_user(db_session, 4004, 'EMPLOYE')
    op = _make_operation(db_session, createur.matricule)

    resp = client.get(f'/api/workflow/progression/{op.id_operation}')
    assert resp.status_code == 200
    data = resp.json()
    en_attente = [e for e in data.get('etapes', []) if e['statut'] == 'en attente']
    for etape in en_attente:
        assert etape.get('date_vue') is None


def test_progression_date_recu_premier_validateur_est_date_demande(client, db_session, base_data):
    """
    Le premier validateur dans la chaîne originale (= dernier dans la liste inversée)
    doit avoir date_recu == date_demande de l'opération.
    """
    createur = _make_user(db_session, 5001, 'EMPLOYE')
    op = _make_operation(db_session, createur.matricule)

    resp = client.get(f'/api/workflow/progression/{op.id_operation}')
    assert resp.status_code == 200
    data = resp.json()
    etapes = data.get('etapes', [])
    if not etapes:
        pytest.skip('Séquence vide pour cet employé')

    # Le dernier élément de la liste (inversée) = premier validateur de la chaîne
    premier_dans_chaine = etapes[-1]
    assert premier_dans_chaine.get('date_recu') is not None
    # date_recu doit correspondre à date_demande (même jour)
    date_demande = data.get('date_demande', '')
    assert date_demande[:10] in (premier_dans_chaine['date_recu'] or '')


def test_progression_endpoint_enrichit_chaque_etape(client, db_session, base_data):
    """Chaque étape retournée doit avoir les clés date_recu et date_vue."""
    createur = _make_user(db_session, 5002, 'EMPLOYE')
    op = _make_operation(db_session, createur.matricule)

    resp = client.get(f'/api/workflow/progression/{op.id_operation}')
    assert resp.status_code == 200
    etapes = resp.json().get('etapes', [])
    for etape in etapes:
        assert 'date_recu' in etape, f"Clé date_recu manquante dans l'étape {etape.get('role')}"
        assert 'date_vue' in etape, f"Clé date_vue manquante dans l'étape {etape.get('role')}"


def test_progression_date_vue_etape_en_attente_si_validateur_attendu_a_vu(
    client, db_session, seed_reference_data
):
    """
    Scénario clé : le validateur DG a OUVERT l'opération (badge vert côté UI)
    mais n'a PAS encore validé → statut étape = 'en attente'.
    → date_vue doit quand même être renseignée grâce à matricule_validateur_attendu.
    """
    op = seed_reference_data['operation']
    dg = seed_reference_data['dg']

    vu_at = datetime(2026, 5, 2, 14, 0, 0)
    _mark_seen(db_session, op.id_operation, dg.matricule, dt=vu_at)

    resp = client.get(f'/api/workflow/progression/{op.id_operation}')
    assert resp.status_code == 200
    etapes = resp.json().get('etapes', [])

    mat_dg = str(dg.matricule).upper()
    etape_dg = next(
        (e for e in etapes
         if str(e.get('matricule_validateur') or '').upper() == mat_dg
         or str(e.get('matricule_validateur_attendu') or '').upper() == mat_dg),
        None,
    )
    assert etape_dg is not None, f'Étape du DG ({mat_dg}) non trouvée'
    # L'étape peut être "en attente" OU "validé" selon la seed — dans les deux cas
    # date_vue doit être renseignée car la vue a été enregistrée.
    assert etape_dg['date_vue'] is not None, (
        f"date_vue devrait être renseignée pour étape {etape_dg['statut']} "
        f"(matricule_validateur_attendu={etape_dg.get('matricule_validateur_attendu')})"
    )
    assert '2026-05-02' in etape_dg['date_vue']


# ══════════════════════════════════════════════════════════════════════════════
#  POST /api/workflow/marquer-vu — traçabilité du demandeur
# ══════════════════════════════════════════════════════════════════════════════

def test_marquer_vu_enregistre_aussi_le_demandeur(client, db_session, base_data):
    """Le demandeur lui-même doit être enregistré dans OPERATION_VUE (plus de skip)."""
    demandeur = _make_user(db_session, 9901, 'EMPLOYE')
    op = _make_operation(db_session, demandeur.matricule)

    resp = client.post(
        f'/api/workflow/marquer-vu/{op.id_operation}',
        params={'matricule_observateur': demandeur.matricule},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data['ok'] is True
    assert 'skipped' not in data, "Le demandeur ne doit plus être skippé"

    # Vérifier la trace en DB
    vue = db_session.query(models.OperationVue).filter(
        models.OperationVue.id_operation == op.id_operation,
        models.OperationVue.matricule_observateur == str(demandeur.matricule).upper(),
    ).first()
    assert vue is not None, "Aucune trace en DB pour le demandeur"
    assert vue.date_vue is not None


def test_marquer_vu_premier_clic_date_immuable(client, db_session, base_data):
    """Règle métier : la date de PREMIÈRE vue est immuable (deuxième clic = already)."""
    user = _make_user(db_session, 9911, 'EMPLOYE')
    op = _make_operation(db_session, user.matricule)

    # Premier clic : crée la trace
    r1 = client.post(
        f'/api/workflow/marquer-vu/{op.id_operation}',
        params={'matricule_observateur': user.matricule},
    )
    assert r1.status_code == 200
    d1 = r1.json()
    assert d1['ok'] is True
    assert d1.get('already') is False
    assert d1.get('date_vue') is not None
    date_initiale = d1['date_vue']

    # Deuxième clic immédiat : doit renvoyer already=true avec la MÊME date
    r2 = client.post(
        f'/api/workflow/marquer-vu/{op.id_operation}',
        params={'matricule_observateur': user.matricule},
    )
    assert r2.status_code == 200
    d2 = r2.json()
    assert d2['ok'] is True
    assert d2.get('already') is True
    assert d2.get('date_vue') == date_initiale, (
        f"date_vue a changé : {date_initiale} → {d2.get('date_vue')}"
    )

    # En DB : une seule ligne, date inchangée
    vues = db_session.query(models.OperationVue).filter(
        models.OperationVue.id_operation == op.id_operation,
        models.OperationVue.matricule_observateur == str(user.matricule).upper(),
    ).all()
    assert len(vues) == 1, f"Attendu 1 ligne, trouvé {len(vues)}"
    assert vues[0].date_vue.isoformat() == date_initiale.replace('Z', '')


def test_marquer_vu_concurrence_ne_cree_quune_ligne(client, db_session, base_data):
    """Appels répétés ne créent qu'une seule ligne (UNIQUE constraint / idempotence)."""
    user = _make_user(db_session, 9912, 'EMPLOYE')
    op = _make_operation(db_session, user.matricule)
    op_id = op.id_operation
    matricule = user.matricule

    # 5 appels séquentiels (SQLite in-memory ne supporte pas le vrai parallélisme)
    results = []
    for _ in range(5):
        r = client.post(
            f'/api/workflow/marquer-vu/{op_id}',
            params={'matricule_observateur': matricule},
        )
        results.append(r.status_code)

    # Tous les appels doivent réussir (200)
    assert all(s == 200 for s in results), f"Statuts inattendus : {results}"

    # Une seule ligne en DB (UNIQUE constraint)
    db_session.expire_all()
    vues = db_session.query(models.OperationVue).filter(
        models.OperationVue.id_operation == op_id,
        models.OperationVue.matricule_observateur == str(matricule).upper(),
    ).all()
    assert len(vues) == 1, f"Attendu 1 ligne (UNIQUE constraint), trouvé {len(vues)}"


def test_marquer_vu_validateur_meme_traitement_que_demandeur(client, db_session, base_data):
    """Demandeur et validateur sont traités identiquement (pas de skip)."""
    demandeur = _make_user(db_session, 9921, 'EMPLOYE')
    validateur = _make_user(db_session, 9922, 'RESPONSABLE')
    op = _make_operation(db_session, demandeur.matricule)

    # Demandeur clique
    r_dem = client.post(
        f'/api/workflow/marquer-vu/{op.id_operation}',
        params={'matricule_observateur': demandeur.matricule},
    )
    # Validateur clique
    r_val = client.post(
        f'/api/workflow/marquer-vu/{op.id_operation}',
        params={'matricule_observateur': validateur.matricule},
    )

    for r, label in [(r_dem, 'demandeur'), (r_val, 'validateur')]:
        assert r.status_code == 200, f"{label} : status {r.status_code}"
        d = r.json()
        assert d['ok'] is True
        assert d.get('already') is False, f"{label} : already devrait être False"
        assert d.get('date_vue') is not None, f"{label} : date_vue manquante"
        assert 'skipped' not in d, f"{label} : ne doit pas être skip"

    # 2 lignes distinctes en DB
    vues = db_session.query(models.OperationVue).filter(
        models.OperationVue.id_operation == op.id_operation,
    ).all()
    matricules_vus = {str(v.matricule_observateur).upper() for v in vues}
    assert str(demandeur.matricule).upper() in matricules_vus
    assert str(validateur.matricule).upper() in matricules_vus
