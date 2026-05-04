"""Tests assignation manuelle des titulaires (PATCH /titulaires) + GET /ma-fiche."""


def _seed_fiche(db, fonction='EMPLOYE'):
    from app import models
    t = models.FichePosteTemplate(
        fonction=fonction,
        fichier_nom=f'{fonction}.docx',
        sections=[],
        cree_par=9001,
    )
    db.add(t); db.commit(); db.refresh(t)
    return t


def test_assigner_titulaires_rh_ok(client, db_session, seed_reference_data, auth_headers):
    fiche = _seed_fiche(db_session)
    rh = seed_reference_data['rh']
    emp = seed_reference_data['employe']

    res = client.patch(
        f'/api/fiches-poste/{fiche.id_template}/titulaires',
        json={'matricules': [emp.matricule]},
        headers=auth_headers(rh.matricule, 'RH'),
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body['nb_titulaires'] == 1
    assert any(t['matricule'].upper() == str(emp.matricule).upper() for t in body['titulaires'])

    # Vérifie en DB
    db_session.expire_all()
    from app import models
    refreshed = db_session.query(models.Employe).filter_by(matricule=emp.matricule).first()
    assert refreshed.id_fiche_poste == fiche.id_template


def test_assigner_titulaires_detache_anciens(client, db_session, seed_reference_data, auth_headers):
    """Les anciens titulaires non listés sont détachés."""
    fiche = _seed_fiche(db_session)
    rh = seed_reference_data['rh']
    emp = seed_reference_data['employe']
    emp.id_fiche_poste = fiche.id_template
    db_session.commit()

    # Nouvelle liste vide → emp doit être détaché
    res = client.patch(
        f'/api/fiches-poste/{fiche.id_template}/titulaires',
        json={'matricules': []},
        headers=auth_headers(rh.matricule, 'RH'),
    )
    assert res.status_code == 200
    db_session.expire_all()
    from app import models
    refreshed = db_session.query(models.Employe).filter_by(matricule=emp.matricule).first()
    assert refreshed.id_fiche_poste is None


def test_assigner_titulaires_employe_forbidden(client, db_session, seed_reference_data, auth_headers):
    fiche = _seed_fiche(db_session)
    emp = seed_reference_data['employe']
    res = client.patch(
        f'/api/fiches-poste/{fiche.id_template}/titulaires',
        json={'matricules': [emp.matricule]},
        headers=auth_headers(emp.matricule, 'EMPLOYE'),
    )
    assert res.status_code == 403


def test_assigner_titulaires_404_fiche_inconnue(client, seed_reference_data, auth_headers):
    rh = seed_reference_data['rh']
    res = client.patch(
        '/api/fiches-poste/999999/titulaires',
        json={'matricules': []},
        headers=auth_headers(rh.matricule, 'RH'),
    )
    assert res.status_code == 404


def test_ma_fiche_via_assignation_manuelle(client, db_session, seed_reference_data):
    fiche = _seed_fiche(db_session)
    emp = seed_reference_data['employe']
    emp.id_fiche_poste = fiche.id_template
    db_session.commit()

    res = client.get(f'/api/fiches-poste/ma-fiche?matricule={emp.matricule}')
    assert res.status_code == 200, res.text
    assert res.json()['fonction'] == fiche.fonction


def test_ma_fiche_404_si_non_assignee(client, db_session, seed_reference_data):
    # Créer une fiche avec une fonction différente de l'employé (évite le fallback par fonction)
    _seed_fiche(db_session, fonction='DIRECTEUR_GENERAL')
    emp = seed_reference_data['employe']  # fonction='EMPLOYE'
    emp.id_fiche_poste = None
    db_session.commit()
    # Pas de fiche assignée et pas de fiche avec la même fonction → 404
    res = client.get(f'/api/fiches-poste/ma-fiche?matricule={emp.matricule}')
    assert res.status_code == 404


def test_evaluations_fiche_poste_via_template(client, db_session, seed_reference_data):
    """L'endpoint évaluations renvoie le template lié à l'employé."""
    fiche = _seed_fiche(db_session, fonction='RH')
    fiche.sections = [{'titre': 'Mission', 'contenu': ['Coordonner']}]
    fiche.html_content = '<h2>Mission</h2>'
    emp = seed_reference_data['employe']
    emp.id_fiche_poste = fiche.id_template
    db_session.commit()

    res = client.get(f'/api/evaluations/fiche-poste/{emp.matricule}')
    assert res.status_code == 200
    body = res.json()
    assert body['source'] == 'template'
    assert body['fonction'] == 'RH'
    assert len(body['sections']) == 1
