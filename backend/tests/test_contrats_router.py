"""Tests pour contrats_router — alertes, infos contrat, lettres, parcours promotion."""
from datetime import date, timedelta
from unittest.mock import patch
from app import models
from app.scheduler import job_verif_contrats


# ---------------------------------------------------------------------------
# PUT /api/contrats/employe/{matricule} — changement de type contrat
# ---------------------------------------------------------------------------

def test_contrats_put_cdd_to_cdi_creates_promotion(db_session, seed_reference_data, client, auth_headers):
    """PUT /api/contrats/employe/ CDD → CDI doit créer une entrée PROMOTION dans le parcours."""
    emp = seed_reference_data['employe']
    rh = seed_reference_data['rh']
    headers = auth_headers(rh.matricule, 'RH')

    emp.type_contrat = models.TypeContratEnum.CDD
    emp.date_fin_contrat = date(2026, 6, 30)
    db_session.commit()
    db_session.refresh(emp)

    res = client.put(
        f'/api/contrats/employe/{emp.matricule}',
        json={'type_contrat': 'CDI', 'date_debut_contrat': None, 'date_fin_contrat': None},
        headers=headers,
    )
    assert res.status_code == 200, res.text

    rows = db_session.query(models.ParcoursEmploye).filter_by(
        matricule=emp.matricule, champ_modifie='type_contrat'
    ).all()
    assert len(rows) == 1
    assert rows[0].type_action == models.TypeParcoursEnum.PROMOTION
    assert rows[0].ancienne_valeur == 'CDD'
    assert rows[0].nouvelle_valeur == 'CDI'


def test_contrats_put_stagiaire_to_cdi_creates_promotion(db_session, seed_reference_data, client, auth_headers):
    """PUT /api/contrats/employe/ Stagiaire → CDI doit créer une entrée PROMOTION."""
    emp = seed_reference_data['employe']
    rh = seed_reference_data['rh']
    headers = auth_headers(rh.matricule, 'RH')

    emp.type_contrat = models.TypeContratEnum.STAGIAIRE
    emp.date_fin_contrat = date(2026, 8, 31)
    db_session.commit()
    db_session.refresh(emp)

    res = client.put(
        f'/api/contrats/employe/{emp.matricule}',
        json={'type_contrat': 'CDI', 'date_debut_contrat': None, 'date_fin_contrat': None},
        headers=headers,
    )
    assert res.status_code == 200, res.text

    rows = db_session.query(models.ParcoursEmploye).filter_by(
        matricule=emp.matricule, champ_modifie='type_contrat'
    ).all()
    assert len(rows) == 1
    assert rows[0].type_action == models.TypeParcoursEnum.PROMOTION
    assert rows[0].ancienne_valeur == 'Stagiaire'
    assert rows[0].nouvelle_valeur == 'CDI'


def test_contrats_put_cdi_to_cdd_no_promotion(db_session, seed_reference_data, client, auth_headers):
    """PUT /api/contrats/employe/ CDI → CDD doit créer AUTRE (pas PROMOTION)."""
    emp = seed_reference_data['employe']
    rh = seed_reference_data['rh']
    headers = auth_headers(rh.matricule, 'RH')

    emp.type_contrat = models.TypeContratEnum.CDI
    db_session.commit()
    db_session.refresh(emp)

    res = client.put(
        f'/api/contrats/employe/{emp.matricule}',
        json={'type_contrat': 'CDD', 'date_debut_contrat': '2026-06-01', 'date_fin_contrat': '2026-12-31'},
        headers=headers,
    )
    assert res.status_code == 200, res.text

    rows = db_session.query(models.ParcoursEmploye).filter_by(
        matricule=emp.matricule, champ_modifie='type_contrat'
    ).all()
    assert len(rows) == 1
    assert rows[0].type_action == models.TypeParcoursEnum.AUTRE
    assert rows[0].ancienne_valeur == 'CDI'
    assert rows[0].nouvelle_valeur == 'CDD'


def test_contrats_put_same_type_no_parcours_entry(db_session, seed_reference_data, client, auth_headers):
    """PUT /api/contrats/employe/ sans changement de type ne crée aucune entrée parcours."""
    emp = seed_reference_data['employe']
    rh = seed_reference_data['rh']
    headers = auth_headers(rh.matricule, 'RH')

    emp.type_contrat = models.TypeContratEnum.CDD
    emp.date_fin_contrat = date(2026, 6, 30)
    db_session.commit()

    res = client.put(
        f'/api/contrats/employe/{emp.matricule}',
        json={'type_contrat': 'CDD', 'date_debut_contrat': '2026-01-01', 'date_fin_contrat': '2026-12-31'},
        headers=headers,
    )
    assert res.status_code == 200, res.text

    rows = db_session.query(models.ParcoursEmploye).filter_by(
        matricule=emp.matricule, champ_modifie='type_contrat'
    ).all()
    assert len(rows) == 0


# ---------------------------------------------------------------------------
# POST /api/contrats/action/{matricule} — confirmation CDI via AlerteContrat
# ---------------------------------------------------------------------------

def _create_alerte(db_session, matricule, type_alerte=models.TypeAlerteContratEnum.J2):
    """Helper : crée une alerte active pour un employé."""
    alerte = models.AlerteContrat(
        employe_id=matricule,
        type_alerte=type_alerte,
        statut=models.StatutAlerteContratEnum.ACTIVE,
    )
    db_session.add(alerte)
    db_session.commit()
    db_session.refresh(alerte)
    return alerte


def test_action_confirmation_cdi_from_cdd_creates_promotion(db_session, seed_reference_data, client, auth_headers):
    """POST /api/contrats/action/ confirmation_cdi (depuis CDD) crée une PROMOTION dans le parcours."""
    emp = seed_reference_data['employe']
    rh = seed_reference_data['rh']
    headers = auth_headers(rh.matricule, 'RH')

    emp.type_contrat = models.TypeContratEnum.CDD
    emp.date_fin_contrat = date(2026, 5, 21)
    db_session.commit()
    _create_alerte(db_session, emp.matricule)

    res = client.post(
        f'/api/contrats/action/{emp.matricule}',
        json={'action': 'confirmation_cdi', 'fait_par': rh.matricule},
        headers=headers,
    )
    assert res.status_code == 200, res.text

    db_session.expire(emp)
    refreshed = db_session.query(models.Employe).filter_by(matricule=emp.matricule).first()
    assert refreshed.type_contrat == models.TypeContratEnum.CDI
    assert refreshed.date_fin_contrat is None

    rows = db_session.query(models.ParcoursEmploye).filter_by(
        matricule=emp.matricule, champ_modifie='type_contrat'
    ).all()
    assert len(rows) == 1
    assert rows[0].type_action == models.TypeParcoursEnum.PROMOTION
    assert rows[0].ancienne_valeur == 'CDD'
    assert rows[0].nouvelle_valeur == 'CDI'
    assert rows[0].actor == rh.matricule


def test_action_confirmation_cdi_from_stagiaire_creates_promotion(db_session, seed_reference_data, client, auth_headers):
    """POST /api/contrats/action/ confirmation_cdi (depuis Stagiaire) crée une PROMOTION."""
    emp = seed_reference_data['employe']
    rh = seed_reference_data['rh']
    headers = auth_headers(rh.matricule, 'RH')

    emp.type_contrat = models.TypeContratEnum.STAGIAIRE
    emp.date_fin_contrat = date(2026, 5, 21)
    db_session.commit()
    _create_alerte(db_session, emp.matricule)

    res = client.post(
        f'/api/contrats/action/{emp.matricule}',
        json={'action': 'confirmation_cdi', 'fait_par': rh.matricule},
        headers=headers,
    )
    assert res.status_code == 200, res.text

    rows = db_session.query(models.ParcoursEmploye).filter_by(
        matricule=emp.matricule, champ_modifie='type_contrat'
    ).all()
    assert len(rows) == 1
    assert rows[0].type_action == models.TypeParcoursEnum.PROMOTION
    assert rows[0].ancienne_valeur == 'Stagiaire'
    assert rows[0].nouvelle_valeur == 'CDI'


def test_action_renouvellement_no_promotion(db_session, seed_reference_data, client, auth_headers):
    """POST /api/contrats/action/ renouvellement ne crée PAS d'entrée parcours."""
    emp = seed_reference_data['employe']
    rh = seed_reference_data['rh']
    headers = auth_headers(rh.matricule, 'RH')

    emp.type_contrat = models.TypeContratEnum.CDD
    emp.date_fin_contrat = date(2026, 5, 21)
    db_session.commit()
    _create_alerte(db_session, emp.matricule)

    res = client.post(
        f'/api/contrats/action/{emp.matricule}',
        json={'action': 'renouvellement', 'date_fin_nouvelle': '2026-11-30', 'fait_par': rh.matricule},
        headers=headers,
    )
    assert res.status_code == 200, res.text

    # Renouvellement = pas de changement de type → aucune entrée parcours type_contrat
    rows = db_session.query(models.ParcoursEmploye).filter_by(
        matricule=emp.matricule, champ_modifie='type_contrat'
    ).all()
    assert len(rows) == 0


def test_action_arret_no_promotion(db_session, seed_reference_data, client, auth_headers):
    """POST /api/contrats/action/ arret ne crée PAS d'entrée parcours."""
    emp = seed_reference_data['employe']
    rh = seed_reference_data['rh']
    headers = auth_headers(rh.matricule, 'RH')

    emp.type_contrat = models.TypeContratEnum.CDD
    emp.date_fin_contrat = date(2026, 5, 21)
    db_session.commit()
    _create_alerte(db_session, emp.matricule)

    res = client.post(
        f'/api/contrats/action/{emp.matricule}',
        json={'action': 'arret', 'fait_par': rh.matricule},
        headers=headers,
    )
    assert res.status_code == 200, res.text

    rows = db_session.query(models.ParcoursEmploye).filter_by(
        matricule=emp.matricule, champ_modifie='type_contrat'
    ).all()
    assert len(rows) == 0


# ---------------------------------------------------------------------------
# GET /api/contrats/alertes — liste des alertes actives
# ---------------------------------------------------------------------------

def test_get_alertes_vide(db_session, seed_reference_data, client, auth_headers):
    """GET /api/contrats/alertes retourne [] quand aucune alerte active."""
    rh = seed_reference_data['rh']
    headers = auth_headers(rh.matricule, 'RH')
    res = client.get('/api/contrats/alertes', headers=headers)
    assert res.status_code == 200
    assert res.json() == []


def test_get_alertes_retourne_alertes_actives(db_session, seed_reference_data, client, auth_headers):
    """GET /api/contrats/alertes retourne les alertes actives avec infos employé."""
    emp = seed_reference_data['employe']
    rh = seed_reference_data['rh']

    emp.type_contrat = models.TypeContratEnum.CDD
    emp.date_fin_contrat = date(2026, 5, 23)
    db_session.commit()
    _create_alerte(db_session, emp.matricule, models.TypeAlerteContratEnum.J2)

    headers = auth_headers(rh.matricule, 'RH')
    res = client.get('/api/contrats/alertes', headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert len(data) == 1
    assert data[0]['employe_id'] == emp.matricule
    assert data[0]['type_alerte'] == 'J2'
    assert data[0]['type_contrat'] == 'CDD'
    assert data[0]['date_fin_contrat'] == '2026-05-23'


def test_get_alertes_exclut_traitees(db_session, seed_reference_data, client, auth_headers):
    """GET /api/contrats/alertes n'inclut PAS les alertes déjà traitées."""
    emp = seed_reference_data['employe']
    rh = seed_reference_data['rh']

    alerte = _create_alerte(db_session, emp.matricule)
    alerte.statut = models.StatutAlerteContratEnum.TRAITEE
    db_session.commit()

    headers = auth_headers(rh.matricule, 'RH')
    res = client.get('/api/contrats/alertes', headers=headers)
    assert res.status_code == 200
    assert res.json() == []


def test_get_alertes_j2_avant_j7(db_session, seed_reference_data, client, auth_headers):
    """GET /api/contrats/alertes trie J2 avant J7."""
    emp = seed_reference_data['employe']
    rh = seed_reference_data['rh']
    responsable = seed_reference_data['responsable']

    emp.type_contrat = models.TypeContratEnum.CDD
    emp.date_fin_contrat = date(2026, 5, 23)
    responsable.type_contrat = models.TypeContratEnum.CDD
    responsable.date_fin_contrat = date(2026, 5, 27)
    db_session.commit()

    _create_alerte(db_session, emp.matricule, models.TypeAlerteContratEnum.J7)
    _create_alerte(db_session, responsable.matricule, models.TypeAlerteContratEnum.J2)

    headers = auth_headers(rh.matricule, 'RH')
    res = client.get('/api/contrats/alertes', headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert len(data) == 2
    assert data[0]['type_alerte'] == 'J2'
    assert data[1]['type_alerte'] == 'J7'


# ---------------------------------------------------------------------------
# GET /api/contrats/employe/{matricule} — info contrat
# ---------------------------------------------------------------------------

def test_get_contrat_employe_cdi(db_session, seed_reference_data, client, auth_headers):
    """GET /api/contrats/employe/ retourne les infos contrat CDI."""
    emp = seed_reference_data['employe']
    rh = seed_reference_data['rh']

    emp.type_contrat = models.TypeContratEnum.CDI
    emp.date_debut_contrat = date(2024, 1, 1)
    emp.date_fin_contrat = None
    db_session.commit()

    headers = auth_headers(rh.matricule, 'RH')
    res = client.get(f'/api/contrats/employe/{emp.matricule}', headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data['matricule'] == emp.matricule
    assert data['type_contrat'] == 'CDI'
    assert data['date_fin_contrat'] is None


def test_get_contrat_employe_cdd(db_session, seed_reference_data, client, auth_headers):
    """GET /api/contrats/employe/ retourne date_fin_contrat pour un CDD."""
    emp = seed_reference_data['employe']
    rh = seed_reference_data['rh']

    emp.type_contrat = models.TypeContratEnum.CDD
    emp.date_debut_contrat = date(2026, 1, 1)
    emp.date_fin_contrat = date(2026, 12, 31)
    db_session.commit()

    headers = auth_headers(rh.matricule, 'RH')
    res = client.get(f'/api/contrats/employe/{emp.matricule}', headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data['type_contrat'] == 'CDD'
    assert data['date_fin_contrat'] == '2026-12-31'
    assert data['date_debut_contrat'] == '2026-01-01'


def test_get_contrat_employe_inconnu(db_session, seed_reference_data, client, auth_headers):
    """GET /api/contrats/employe/ retourne 404 pour matricule inconnu."""
    rh = seed_reference_data['rh']
    headers = auth_headers(rh.matricule, 'RH')
    res = client.get('/api/contrats/employe/INCONNU999', headers=headers)
    assert res.status_code == 404


# ---------------------------------------------------------------------------
# GET /api/contrats/lettres/{matricule} — historique lettres
# ---------------------------------------------------------------------------

def _create_lettre(db_session, matricule, type_lettre, fait_par):
    lettre = models.LettreRH(
        employe_id=matricule,
        type_lettre=models.TypeLettreRHEnum(type_lettre),
        pdf_path=None,
        signature_data=None,
        genere_par=fait_par,
        date_fin_nouvelle=None,
    )
    db_session.add(lettre)
    db_session.commit()
    db_session.refresh(lettre)
    return lettre


def test_lettres_vide(db_session, seed_reference_data, client, auth_headers):
    """GET /api/contrats/lettres/ retourne [] si aucune lettre générée."""
    emp = seed_reference_data['employe']
    rh = seed_reference_data['rh']
    headers = auth_headers(rh.matricule, 'RH')
    res = client.get(f'/api/contrats/lettres/{emp.matricule}', headers=headers)
    assert res.status_code == 200
    assert res.json() == []


def test_lettres_historique(db_session, seed_reference_data, client, auth_headers):
    """GET /api/contrats/lettres/ retourne la liste des lettres générées."""
    emp = seed_reference_data['employe']
    rh = seed_reference_data['rh']
    headers = auth_headers(rh.matricule, 'RH')

    _create_lettre(db_session, emp.matricule, 'confirmation_cdi', rh.matricule)
    _create_lettre(db_session, emp.matricule, 'info_contrat', rh.matricule)

    res = client.get(f'/api/contrats/lettres/{emp.matricule}', headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert len(data) == 2
    types = {l['type_lettre'] for l in data}
    assert 'confirmation_cdi' in types
    assert 'info_contrat' in types


def test_lettres_inconnu(db_session, seed_reference_data, client, auth_headers):
    """GET /api/contrats/lettres/ retourne 200 + [] pour matricule inconnu (liste vide)."""
    rh = seed_reference_data['rh']
    headers = auth_headers(rh.matricule, 'RH')
    res = client.get('/api/contrats/lettres/INCONNU999', headers=headers)
    assert res.status_code == 200
    assert res.json() == []


# ---------------------------------------------------------------------------
# job_verif_contrats — scheduler de création d'alertes J7/J2
# ---------------------------------------------------------------------------

def _make_emp_cdd(db_session, seed_reference_data, matricule, fin, type_contrat=models.TypeContratEnum.CDD):
    ref = seed_reference_data
    emp = models.Employe(
        matricule=matricule, nom='Test', prenom='Contrat',
        email=f'{matricule}@test.com', date_embauche=date(2024, 1, 1),
        dept_id=ref['departement'].dept_id, id_entite=ref['entite'].id_entite,
        id_role=ref['roles']['EMPLOYE'].id,
        type_contrat=type_contrat, date_fin_contrat=fin,
        statut_employe='ACTIF', sexe='M',
    )
    db_session.add(emp)
    user = models.Utilisateur(
        matricule=matricule, email=f'{matricule}@test.com',
        role_id=ref['roles']['EMPLOYE'].id, mot_de_passe_hash='x',
        mot_de_passe_temporaire=False, mfa_enabled=False, mfa_active=False,
    )
    db_session.add(user)
    db_session.commit()
    return emp


def test_job_verif_contrats_cree_alerte_j7(db_session, seed_reference_data):
    """job_verif_contrats crée une alerte J7 pour CDD à J-7."""
    today = date(2026, 5, 19)
    emp = _make_emp_cdd(db_session, seed_reference_data, 'JOB001', today + timedelta(days=7))

    with patch('app.scheduler.date') as mock_date:
        mock_date.today.return_value = today
        mock_date.side_effect = lambda *a, **kw: date(*a, **kw)
        job_verif_contrats()

    alertes = db_session.query(models.AlerteContrat).filter_by(
        employe_id=emp.matricule, type_alerte=models.TypeAlerteContratEnum.J7
    ).all()
    assert len(alertes) == 1
    assert alertes[0].statut == models.StatutAlerteContratEnum.ACTIVE


def test_job_verif_contrats_cree_alerte_j2(db_session, seed_reference_data):
    """job_verif_contrats crée une alerte J2 pour CDD à J-2."""
    today = date(2026, 5, 19)
    emp = _make_emp_cdd(db_session, seed_reference_data, 'JOB002', today + timedelta(days=2))

    with patch('app.scheduler.date') as mock_date:
        mock_date.today.return_value = today
        mock_date.side_effect = lambda *a, **kw: date(*a, **kw)
        job_verif_contrats()

    alertes = db_session.query(models.AlerteContrat).filter_by(
        employe_id=emp.matricule, type_alerte=models.TypeAlerteContratEnum.J2
    ).all()
    assert len(alertes) == 1


def test_job_verif_contrats_pas_dalerte_si_cdi(db_session, seed_reference_data):
    """job_verif_contrats ne crée PAS d'alerte pour un CDI."""
    ref = seed_reference_data
    today = date(2026, 5, 19)
    emp = models.Employe(
        matricule='JOB003', nom='CDI', prenom='Emp', email='job003@test.com',
        date_embauche=date(2024, 1, 1),
        dept_id=ref['departement'].dept_id, id_entite=ref['entite'].id_entite,
        id_role=ref['roles']['EMPLOYE'].id,
        type_contrat=models.TypeContratEnum.CDI,
        date_fin_contrat=today + timedelta(days=2),
        statut_employe='ACTIF', sexe='M',
    )
    db_session.add(emp)
    db_session.add(models.Utilisateur(
        matricule='JOB003', email='job003@test.com',
        role_id=ref['roles']['EMPLOYE'].id, mot_de_passe_hash='x',
        mot_de_passe_temporaire=False, mfa_enabled=False, mfa_active=False,
    ))
    db_session.commit()

    with patch('app.scheduler.date') as mock_date:
        mock_date.today.return_value = today
        mock_date.side_effect = lambda *a, **kw: date(*a, **kw)
        job_verif_contrats()

    assert db_session.query(models.AlerteContrat).filter_by(employe_id='JOB003').count() == 0


def test_job_verif_contrats_pas_de_doublon(db_session, seed_reference_data):
    """job_verif_contrats ne crée pas de doublon si alerte active déjà existante."""
    today = date(2026, 5, 19)
    emp = _make_emp_cdd(db_session, seed_reference_data, 'JOB004', today + timedelta(days=7))

    db_session.add(models.AlerteContrat(
        employe_id=emp.matricule,
        type_alerte=models.TypeAlerteContratEnum.J7,
        statut=models.StatutAlerteContratEnum.ACTIVE,
    ))
    db_session.commit()

    with patch('app.scheduler.date') as mock_date:
        mock_date.today.return_value = today
        mock_date.side_effect = lambda *a, **kw: date(*a, **kw)
        job_verif_contrats()

    count = db_session.query(models.AlerteContrat).filter_by(
        employe_id=emp.matricule, type_alerte=models.TypeAlerteContratEnum.J7
    ).count()
    assert count == 1


def test_job_verif_contrats_ignore_suspendu(db_session, seed_reference_data):
    """job_verif_contrats ignore les employés suspendus."""
    today = date(2026, 5, 19)
    emp = _make_emp_cdd(db_session, seed_reference_data, 'JOB005', today + timedelta(days=2))
    emp.statut_employe = 'SUSPENDU'
    db_session.commit()

    with patch('app.scheduler.date') as mock_date:
        mock_date.today.return_value = today
        mock_date.side_effect = lambda *a, **kw: date(*a, **kw)
        job_verif_contrats()

    assert db_session.query(models.AlerteContrat).filter_by(employe_id='JOB005').count() == 0


def test_job_verif_contrats_stagiaire_inclus(db_session, seed_reference_data):
    """job_verif_contrats crée des alertes pour les stagiaires aussi."""
    today = date(2026, 5, 19)
    emp = _make_emp_cdd(
        db_session, seed_reference_data, 'JOB006',
        today + timedelta(days=2),
        type_contrat=models.TypeContratEnum.STAGIAIRE,
    )

    with patch('app.scheduler.date') as mock_date:
        mock_date.today.return_value = today
        mock_date.side_effect = lambda *a, **kw: date(*a, **kw)
        job_verif_contrats()

    assert db_session.query(models.AlerteContrat).filter_by(
        employe_id=emp.matricule, type_alerte=models.TypeAlerteContratEnum.J2
    ).count() == 1
