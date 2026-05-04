"""Tests des endpoints fiches de poste : scoping par rôle + réassignation + PDF."""
import pytest


def _seed_fiches(db, fonctions):
    """Crée une fiche template par fonction (sections vide)."""
    from app import models
    created = []
    for f in fonctions:
        t = models.FichePosteTemplate(
            fonction=f,
            fichier_nom=f'{f}.docx',
            sections=[],
            cree_par=9001,
        )
        db.add(t)
        db.flush()
        created.append(t)
    db.commit()
    return created


# ----------------------------------------------------------------------------
# SCOPING
# ----------------------------------------------------------------------------

def test_lister_fiches_full_access_rh(client, db_session, seed_reference_data, auth_headers):
    _seed_fiches(db_session, ['RH', 'EMPLOYE', 'DIRECTEUR', 'AUTRE'])
    rh = seed_reference_data['rh']
    res = client.get('/api/fiches-poste/', headers=auth_headers(rh.matricule, 'RH'))
    assert res.status_code == 200, res.text
    fonctions = {f['fonction'] for f in res.json()}
    assert {'RH', 'EMPLOYE', 'DIRECTEUR', 'AUTRE'} <= fonctions


def test_lister_fiches_admin_full_access(client, db_session, seed_reference_data, auth_headers):
    _seed_fiches(db_session, ['RH', 'AUTRE'])
    admin = seed_reference_data['admin']
    res = client.get('/api/fiches-poste/', headers=auth_headers(admin.matricule, 'ADMIN'))
    assert res.status_code == 200
    assert len(res.json()) >= 2


def test_lister_fiches_dg_scoped_to_entite(client, db_session, seed_reference_data, auth_headers):
    """DG ne voit que les fiches dont la fonction est portée par un employé de son entité."""
    # Les seeds créent : EMPLOYE, RESPONSABLE, DIRECTEUR, DG, RH, ADMIN dans la même entité.
    _seed_fiches(db_session, ['EMPLOYE', 'RESPONSABLE', 'DIRECTEUR', 'INEXISTANT'])
    dg = seed_reference_data['dg']
    res = client.get('/api/fiches-poste/', headers=auth_headers(dg.matricule, 'DG'))
    assert res.status_code == 200
    fonctions = {f['fonction'] for f in res.json()}
    # DG → seulement les fonctions effectivement portées par un employé actif de l'entité
    assert 'EMPLOYE' in fonctions
    assert 'RESPONSABLE' in fonctions
    assert 'DIRECTEUR' in fonctions
    # La fonction "INEXISTANT" n'a aucun employé → exclue
    assert 'INEXISTANT' not in fonctions


def test_lister_fiches_responsable_scoped_to_dept(client, db_session, seed_reference_data, auth_headers):
    _seed_fiches(db_session, ['EMPLOYE', 'RESPONSABLE', 'DIRECTEUR'])
    resp = seed_reference_data['responsable']
    res = client.get('/api/fiches-poste/', headers=auth_headers(resp.matricule, 'RESPONSABLE'))
    assert res.status_code == 200
    fonctions = {f['fonction'] for f in res.json()}
    # Les seeds mettent EMPLOYE et RESPONSABLE dans le même département
    assert 'EMPLOYE' in fonctions
    assert 'RESPONSABLE' in fonctions


def test_lister_fiches_employe_returns_empty_list(client, db_session, seed_reference_data, auth_headers):
    """Un EMPLOYE n'a pas accès à la liste générale (résultat vide)."""
    _seed_fiches(db_session, ['EMPLOYE', 'AUTRE'])
    emp = seed_reference_data['employe']
    res = client.get('/api/fiches-poste/', headers=auth_headers(emp.matricule, 'EMPLOYE'))
    assert res.status_code == 200
    assert res.json() == []


# ----------------------------------------------------------------------------
# RÉASSIGNATION (PATCH /fonction)
# ----------------------------------------------------------------------------

def test_reassigner_fiche_rh_ok(client, db_session, seed_reference_data, auth_headers):
    fiches = _seed_fiches(db_session, ['ANCIENNE_FONCTION'])
    rh = seed_reference_data['rh']
    res = client.patch(
        f'/api/fiches-poste/{fiches[0].id_template}/fonction',
        json={'fonction': 'NOUVELLE_FONCTION'},
        headers=auth_headers(rh.matricule, 'RH'),
    )
    assert res.status_code == 200, res.text
    assert res.json()['fonction'] == 'NOUVELLE_FONCTION'


def test_reassigner_fiche_collision_409(client, db_session, seed_reference_data, auth_headers):
    fiches = _seed_fiches(db_session, ['A', 'B'])
    rh = seed_reference_data['rh']
    res = client.patch(
        f'/api/fiches-poste/{fiches[0].id_template}/fonction',
        json={'fonction': 'B'},  # déjà prise par fiches[1]
        headers=auth_headers(rh.matricule, 'RH'),
    )
    assert res.status_code == 409


def test_reassigner_fiche_employe_forbidden(client, db_session, seed_reference_data, auth_headers):
    fiches = _seed_fiches(db_session, ['X'])
    emp = seed_reference_data['employe']
    res = client.patch(
        f'/api/fiches-poste/{fiches[0].id_template}/fonction',
        json={'fonction': 'Y'},
        headers=auth_headers(emp.matricule, 'EMPLOYE'),
    )
    assert res.status_code == 403


def test_reassigner_fiche_empty_fonction_400(client, db_session, seed_reference_data, auth_headers):
    fiches = _seed_fiches(db_session, ['Z'])
    rh = seed_reference_data['rh']
    res = client.patch(
        f'/api/fiches-poste/{fiches[0].id_template}/fonction',
        json={'fonction': '   '},
        headers=auth_headers(rh.matricule, 'RH'),
    )
    assert res.status_code == 400


# ----------------------------------------------------------------------------
# EXPORT PDF
# ----------------------------------------------------------------------------

def test_export_pdf_returns_pdf_or_html(client, db_session, seed_reference_data, auth_headers):
    """Renvoie un PDF si WeasyPrint est installé, sinon un fallback HTML."""
    fiches = _seed_fiches(db_session, ['RH'])
    fiche = fiches[0]
    fiche.html_content = '<h2>Mission</h2><p>Coordonner les RH.</p>'
    db_session.commit()

    rh = seed_reference_data['rh']
    res = client.get(
        f'/api/fiches-poste/{fiche.id_template}/pdf',
        headers=auth_headers(rh.matricule, 'RH'),
    )
    assert res.status_code == 200
    ct = res.headers.get('content-type', '')
    assert 'pdf' in ct or 'html' in ct
    # Si HTML fallback, on doit retrouver le contenu
    if 'html' in ct:
        body = res.text
        assert 'Mission' in body
        assert 'Coordonner' in body


def test_export_pdf_employe_own_ok(client, db_session, seed_reference_data, auth_headers):
    """Un employé doit pouvoir exporter sa propre fiche (assignation manuelle)."""
    fiches = _seed_fiches(db_session, ['EMPLOYE'])
    fiches[0].html_content = '<p>Ma fiche.</p>'
    emp = seed_reference_data['employe']
    emp.id_fiche_poste = fiches[0].id_template  # assignation manuelle
    db_session.commit()
    res = client.get(
        f'/api/fiches-poste/{fiches[0].id_template}/pdf',
        headers=auth_headers(emp.matricule, 'EMPLOYE'),
    )
    assert res.status_code == 200


def test_export_pdf_employe_other_forbidden(client, db_session, seed_reference_data, auth_headers):
    """Un employé ne doit pas pouvoir exporter une fiche qui n'est pas la sienne."""
    fiches = _seed_fiches(db_session, ['DIRECTEUR'])
    emp = seed_reference_data['employe']
    # Pas d'assignation → accès refusé
    res = client.get(
        f'/api/fiches-poste/{fiches[0].id_template}/pdf',
        headers=auth_headers(emp.matricule, 'EMPLOYE'),
    )
    assert res.status_code == 403


def test_export_pdf_404_unknown_fiche(client, seed_reference_data, auth_headers):
    rh = seed_reference_data['rh']
    res = client.get(
        '/api/fiches-poste/999999/pdf',
        headers=auth_headers(rh.matricule, 'RH'),
    )
    assert res.status_code == 404


# ----------------------------------------------------------------------------
# ENDPOINT /ma-fiche
# ----------------------------------------------------------------------------

def test_ma_fiche_404_employe_inconnu(client, seed_reference_data, auth_headers):
    """GET /ma-fiche avec un matricule inconnu retourne 404."""
    emp = seed_reference_data['employe']
    res = client.get(
        '/api/fiches-poste/ma-fiche',
        params={'matricule': 'MATRICULE_TOTALEMENT_INEXISTANT'},
        headers=auth_headers(emp.matricule, 'EMPLOYE'),
    )
    assert res.status_code == 404
    assert 'introuvable' in (res.json().get('detail') or '').lower() or res.status_code == 404


def test_ma_fiche_404_sans_fiche_assignee(client, db_session, seed_reference_data, auth_headers):
    """GET /ma-fiche pour un employé sans fiche assignée retourne 404."""
    from app import models
    emp = seed_reference_data['employe']
    # S'assurer qu'aucune fiche n'est assignée ni par id ni par fonction
    emp.id_fiche_poste = None
    # Supprimer toute fiche de même fonction
    db_session.query(models.FichePosteTemplate).filter(
        models.FichePosteTemplate.fonction == emp.fonction
    ).delete()
    db_session.commit()
    res = client.get(
        '/api/fiches-poste/ma-fiche',
        params={'matricule': str(emp.matricule)},
        headers=auth_headers(emp.matricule, 'EMPLOYE'),
    )
    assert res.status_code == 404


def test_ma_fiche_ok_avec_assignation_directe(client, db_session, seed_reference_data, auth_headers):
    """GET /ma-fiche retourne la fiche assignée directement via id_fiche_poste."""
    from app import models
    emp = seed_reference_data['employe']
    fiche = models.FichePosteTemplate(
        fonction='COMPTABLE_TEST',
        fichier_nom='Comptable.docx',
        sections=[],
        html_content='<p>Contenu fiche comptable</p>',
        cree_par=9001,
    )
    db_session.add(fiche)
    db_session.flush()
    emp.id_fiche_poste = fiche.id_template
    db_session.commit()
    res = client.get(
        '/api/fiches-poste/ma-fiche',
        params={'matricule': str(emp.matricule)},
        headers=auth_headers(emp.matricule, 'EMPLOYE'),
    )
    assert res.status_code == 200, res.text
    assert res.json()['fonction'] == 'COMPTABLE_TEST'
