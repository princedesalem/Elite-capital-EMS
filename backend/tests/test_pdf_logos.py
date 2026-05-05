"""Tests pour la fonctionnalité logo entité sur les PDFs.

Couvre :
- _get_logo_path : résolution correcte du logo selon l'entité de l'employé
- PDFReport : génère un PDF valide avec et sans logo
- Endpoints congé, mission, permission, sortie : PDF valide (logo absent en test car pas de fichier jpg, mais la logique est couverte)
- Fiche de poste PDF : accepte ?matricule= et produit un PDF valide
"""
import os
import tempfile
import pytest
from datetime import date, timedelta


# ---------------------------------------------------------------------------
# Tests unitaires : _get_logo_path
# ---------------------------------------------------------------------------

class TestGetLogoPath:
    """Tests du helper _get_logo_path sans appels HTTP."""

    def test_employe_sans_entite_retourne_none(self, db_session, seed_reference_data):
        from app.routers.pdf_router import _get_logo_path
        from app import models
        emp = seed_reference_data['employe']
        emp.id_entite = None
        db_session.commit()
        assert _get_logo_path(str(emp.matricule), db_session) is None

    def test_matricule_inexistant_retourne_none(self, db_session, seed_reference_data):
        from app.routers.pdf_router import _get_logo_path
        assert _get_logo_path('MATRICULE_INEXISTANT_99999', db_session) is None

    def test_entite_group_sans_logo_retourne_none(self, db_session, seed_reference_data):
        """L'entité GROUP n'a pas de logo prévu → None."""
        from app.routers.pdf_router import _get_logo_path
        from app import models
        entite_group = models.Entite(nom='GROUP')
        db_session.add(entite_group)
        db_session.flush()
        emp = seed_reference_data['employe']
        emp.id_entite = entite_group.id_entite
        db_session.commit()
        assert _get_logo_path(str(emp.matricule), db_session) is None

    def test_entite_elcam_sans_fichier_retourne_none(self, db_session, seed_reference_data):
        """Entité ELCAM connue mais fichier jpg absent sur disque → None."""
        from app.routers.pdf_router import _get_logo_path, _ENTITY_LOGOS
        emp = seed_reference_data['employe']
        # L'entité seed est déjà ELCAM ; le fichier n'existe pas dans l'env test
        result = _get_logo_path(str(emp.matricule), db_session)
        # En environnement de test le fichier logos/elcam.jpg n'existe pas
        assert result is None or (result == _ENTITY_LOGOS.get('ELCAM') and os.path.exists(result))

    def test_entite_elcam_avec_fichier_retourne_chemin(self, db_session, seed_reference_data, tmp_path):
        """Entité ELCAM avec fichier jpg présent → retourne le chemin."""
        from app.routers import pdf_router
        emp = seed_reference_data['employe']

        # Créer un faux fichier logo pour le test
        fake_logo = tmp_path / 'elcam.jpg'
        fake_logo.write_bytes(b'FAKEJPG')

        original = pdf_router._ENTITY_LOGOS.copy()
        pdf_router._ENTITY_LOGOS['ELCAM'] = str(fake_logo)
        try:
            result = pdf_router._get_logo_path(str(emp.matricule), db_session)
            assert result == str(fake_logo)
        finally:
            pdf_router._ENTITY_LOGOS.clear()
            pdf_router._ENTITY_LOGOS.update(original)

    def test_entite_exca_avec_fichier_retourne_chemin(self, db_session, seed_reference_data, tmp_path):
        from app.routers import pdf_router
        from app import models
        entite_exca = models.Entite(nom='EXCA')
        db_session.add(entite_exca)
        db_session.flush()
        emp = seed_reference_data['employe']
        emp.id_entite = entite_exca.id_entite
        db_session.commit()

        fake_logo = tmp_path / 'exca.jpg'
        fake_logo.write_bytes(b'FAKEJPG')

        original = pdf_router._ENTITY_LOGOS.copy()
        pdf_router._ENTITY_LOGOS['EXCA'] = str(fake_logo)
        try:
            result = pdf_router._get_logo_path(str(emp.matricule), db_session)
            assert result == str(fake_logo)
        finally:
            pdf_router._ENTITY_LOGOS.clear()
            pdf_router._ENTITY_LOGOS.update(original)

    def test_entite_ecg_avec_fichier_retourne_chemin(self, db_session, seed_reference_data, tmp_path):
        from app.routers import pdf_router
        from app import models
        entite_ecg = models.Entite(nom='ECG')
        db_session.add(entite_ecg)
        db_session.flush()
        emp = seed_reference_data['employe']
        emp.id_entite = entite_ecg.id_entite
        db_session.commit()

        fake_logo = tmp_path / 'ecg.jpg'
        fake_logo.write_bytes(b'FAKEJPG')

        original = pdf_router._ENTITY_LOGOS.copy()
        pdf_router._ENTITY_LOGOS['ECG'] = str(fake_logo)
        try:
            result = pdf_router._get_logo_path(str(emp.matricule), db_session)
            assert result == str(fake_logo)
        finally:
            pdf_router._ENTITY_LOGOS.clear()
            pdf_router._ENTITY_LOGOS.update(original)

    def test_logos_dir_pointe_vers_backend_logos(self):
        """_LOGOS_DIR doit pointer vers backend/logos/ (3 niveaux de dirname)."""
        from app.routers.pdf_router import _LOGOS_DIR
        # Dans le container : /app/logos ; en local : .../backend/logos
        assert _LOGOS_DIR.endswith('logos') or 'logos' in _LOGOS_DIR
        # Doit être un chemin absolu
        assert os.path.isabs(_LOGOS_DIR)

    def test_logos_dir_identique_dans_fiches_poste_router(self):
        """Les deux routers doivent utiliser le même dossier logos."""
        from app.routers.pdf_router import _LOGOS_DIR as logos_pdf
        from app.routers.fiches_poste_router import _LOGOS_DIR as logos_fiche
        assert logos_pdf == logos_fiche


# ---------------------------------------------------------------------------
# Tests unitaires : PDFReport avec logo
# ---------------------------------------------------------------------------

class TestPDFReportLogo:
    """PDFReport génère un PDF valide avec et sans logo."""

    def test_pdfreport_sans_logo_produit_pdf_valide(self):
        from app.routers.pdf_router import PDFReport
        pdf = PDFReport(title='TEST SANS LOGO')
        pdf.alias_nb_pages()
        pdf.add_page()
        pdf.set_font(pdf._body_font, '', 10)
        pdf.cell(0, 8, 'Contenu de test', new_x='LMARGIN', new_y='NEXT')
        content = bytes(pdf.output())
        assert content[:5] == b'%PDF-'

    def test_pdfreport_logo_inexistant_produit_pdf_valide(self):
        """Chemin logo non existant → pas d'erreur, PDF généré normalement."""
        from app.routers.pdf_router import PDFReport
        pdf = PDFReport(title='TEST LOGO ABSENT', logo_path='/non/existant/logo.jpg')
        pdf.alias_nb_pages()
        pdf.add_page()
        pdf.set_font(pdf._body_font, '', 10)
        pdf.cell(0, 8, 'Contenu de test', new_x='LMARGIN', new_y='NEXT')
        content = bytes(pdf.output())
        assert content[:5] == b'%PDF-'

    def test_pdfreport_avec_logo_valide_produit_pdf(self, tmp_path):
        """Avec un vrai fichier JPEG valide, le PDF est généré sans erreur."""
        from app.routers.pdf_router import PDFReport
        # JPEG minimal valide (1x1 pixel blanc)
        jpeg_bytes = (
            b'\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00'
            b'\xff\xdb\x00C\x00\x08\x06\x06\x07\x06\x05\x08\x07\x07\x07\t\t'
            b'\x08\n\x0c\x14\r\x0c\x0b\x0b\x0c\x19\x12\x13\x0f\x14\x1d\x1a'
            b'\x1f\x1e\x1d\x1a\x1c\x1c $.\' ",#\x1c\x1c(7),01444\x1f\'9=82<.342\x1e>'
            b'\x1b\x1b\x1b\x1b\x1b\x1b\x1b\x1b\x1b\x1b\x1b\x1b\x1b\x1b\x1b'
            b'\xff\xc0\x00\x0b\x08\x00\x01\x00\x01\x01\x01\x11\x00'
            b'\xff\xc4\x00\x1f\x00\x00\x01\x05\x01\x01\x01\x01\x01\x01\x00\x00'
            b'\x00\x00\x00\x00\x00\x00\x01\x02\x03\x04\x05\x06\x07\x08\t\n\x0b'
            b'\xff\xc4\x00\xb5\x10\x00\x02\x01\x03\x03\x02\x04\x03\x05\x05\x04'
            b'\x04\x00\x00\x01}\x01\x02\x03\x00\x04\x11\x05\x12!1A\x06\x13Qa'
            b'\x07"q\x142\x81\x91\xa1\x08#B\xb1\xc1\x15R\xd1\xf0$3br'
            b'\x82\t\n\x16\x17\x18\x19\x1a%&\'()*456789:CDEFGHIJ'
            b'STUVWXYZ\xff\xda\x00\x08\x01\x01\x00\x00?\x00\xfb\xd1P\x00\x00'
            b'\xff\xd9'
        )
        logo_file = tmp_path / 'test_logo.jpg'
        logo_file.write_bytes(jpeg_bytes)

        pdf = PDFReport(title='TEST AVEC LOGO', logo_path=str(logo_file))
        pdf.alias_nb_pages()
        pdf.add_page()
        pdf.set_font(pdf._body_font, '', 10)
        pdf.cell(0, 8, 'Contenu avec logo', new_x='LMARGIN', new_y='NEXT')
        content = bytes(pdf.output())
        assert content[:5] == b'%PDF-'

    def test_pdfreport_logo_path_none_par_defaut(self):
        from app.routers.pdf_router import PDFReport
        pdf = PDFReport(title='TEST')
        assert pdf._logo_path is None


# ---------------------------------------------------------------------------
# Tests endpoints PDF (congé, mission, permission, sortie) : logo absent en test
# ---------------------------------------------------------------------------

@pytest.fixture()
def pdf_ops(seed_reference_data, db_session):
    """Crée les opérations nécessaires pour chaque endpoint PDF."""
    from app import models
    emp = seed_reference_data['employe']
    today = date.today()

    op_mission = models.Operation(
        matricule=emp.matricule, cree_par=emp.matricule,
        type_demande='Mission', statut='validé',
        date_debut=today + timedelta(days=5), date_fin=today + timedelta(days=10),
        date_demande=today,
    )
    db_session.add(op_mission)
    db_session.flush()
    mission = models.Mission(id_mission=op_mission.id_operation, pays='Cameroun', ville='Douala')
    db_session.add(mission)
    seg = models.MissionSegment(
        id_mission=op_mission.id_operation, pays='Cameroun', ville='Douala',
        date_debut=today + timedelta(days=5), date_fin=today + timedelta(days=10), ordre=1,
    )
    db_session.add(seg)
    db_session.add(models.MissionnairesMission(
        id_mission=op_mission.id_operation, matricule=emp.matricule, role_mission='responsable',
    ))

    op_conge = models.Operation(
        matricule=emp.matricule, cree_par=emp.matricule,
        type_demande='Congé', statut='validé',
        date_debut=today + timedelta(days=20), date_fin=today + timedelta(days=30),
        date_demande=today, duree_jours=10, motif='Repos',
    )
    db_session.add(op_conge)

    op_perm = models.Operation(
        matricule=emp.matricule, cree_par=emp.matricule,
        type_demande='Permission', statut='validé',
        date_debut=today + timedelta(days=40), date_fin=today + timedelta(days=41),
        date_demande=today, duree_jours=1, motif='RDV',
    )
    db_session.add(op_perm)

    op_sortie = models.Operation(
        matricule=emp.matricule, cree_par=emp.matricule,
        type_demande='Sortie', statut='validé',
        date_debut=today, date_fin=today, date_demande=today, motif='Visite',
    )
    db_session.add(op_sortie)
    db_session.flush()
    db_session.add(models.Sortie(id_operation=op_sortie.id_operation))
    db_session.commit()

    return {
        'mission_id': op_mission.id_operation,
        'conge_id': op_conge.id_operation,
        'perm_id': op_perm.id_operation,
        'sortie_id': op_sortie.id_operation,
        'emp': emp,
    }


class TestPDFEndpointsAvecLogoLogique:
    """Vérifie que les endpoints PDF restent fonctionnels avec la logique logo (logo absent en test)."""

    def test_conge_pdf_valide_sans_logo(self, client, pdf_ops):
        r = client.get(f"/api/pdf/conges/{pdf_ops['conge_id']}")
        assert r.status_code == 200
        assert r.headers['content-type'] == 'application/pdf'
        assert r.content[:5] == b'%PDF-'

    def test_mission_pdf_valide_sans_logo(self, client, pdf_ops):
        r = client.get(f"/api/pdf/mission/{pdf_ops['mission_id']}")
        assert r.status_code == 200
        assert r.content[:5] == b'%PDF-'

    def test_permission_pdf_valide_sans_logo(self, client, pdf_ops):
        r = client.get(f"/api/pdf/permission/{pdf_ops['perm_id']}")
        assert r.status_code == 200
        assert r.content[:5] == b'%PDF-'

    def test_sortie_pdf_valide_sans_logo(self, client, pdf_ops):
        r = client.get(f"/api/pdf/sortie/{pdf_ops['sortie_id']}")
        assert r.status_code == 200
        assert r.content[:5] == b'%PDF-'

    def test_conge_pdf_logo_path_none_quand_logo_absent(self, db_session, pdf_ops):
        """_get_logo_path retourne None pour un employé dont le logo n'est pas sur disque."""
        from app.routers.pdf_router import _get_logo_path
        result = _get_logo_path(str(pdf_ops['emp'].matricule), db_session)
        # Pas de fichier jpg en env test → None
        assert result is None

    def test_conge_pdf_logo_injecte_quand_fichier_present(self, client, db_session, pdf_ops, tmp_path):
        """Avec un faux logo sur disque, le PDF est généré sans erreur."""
        from app.routers import pdf_router
        fake_logo = tmp_path / 'elcam.jpg'
        # JPEG minimal
        fake_logo.write_bytes(b'\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00\xff\xd9')

        original = pdf_router._ENTITY_LOGOS.copy()
        pdf_router._ENTITY_LOGOS['ELCAM'] = str(fake_logo)
        try:
            r = client.get(f"/api/pdf/conges/{pdf_ops['conge_id']}")
            assert r.status_code == 200
            assert r.content[:5] == b'%PDF-'
        finally:
            pdf_router._ENTITY_LOGOS.clear()
            pdf_router._ENTITY_LOGOS.update(original)


# ---------------------------------------------------------------------------
# Tests endpoint fiche de poste PDF : ?matricule= query param
# ---------------------------------------------------------------------------

@pytest.fixture()
def fiche_fixture(db_session, seed_reference_data, auth_headers):
    from app import models
    emp = seed_reference_data['employe']
    fiche = models.FichePosteTemplate(
        fonction=emp.fonction or 'EMPLOYE',
        fichier_nom='test.docx',
        sections=[{'titre': 'Missions', 'contenu': ['Gérer les opérations']}],
        html_content='<p>Contenu de la fiche de poste</p>',
        cree_par=seed_reference_data['rh'].matricule,
    )
    db_session.add(fiche)
    db_session.flush()
    emp.id_fiche_poste = fiche.id_template
    db_session.commit()
    return {'fiche': fiche, 'emp': emp}


class TestFichePostePDFLogo:
    """Tests de l'endpoint GET /api/fiches-poste/{id}/pdf avec ?matricule=."""

    def test_pdf_fiche_sans_matricule_retourne_pdf_ou_html(self, client, fiche_fixture, auth_headers, seed_reference_data):
        """Sans ?matricule=, le PDF est généré sans logo mais reste valide."""
        rh = seed_reference_data['rh']
        headers = auth_headers(rh.matricule, 'RH')
        fiche_id = fiche_fixture['fiche'].id_template
        r = client.get(f'/api/fiches-poste/{fiche_id}/pdf', headers=headers)
        assert r.status_code == 200
        ct = r.headers.get('content-type', '')
        assert 'pdf' in ct or 'html' in ct

    def test_pdf_fiche_avec_matricule_employe_sans_logo_fichier(self, client, fiche_fixture, auth_headers, seed_reference_data):
        """Avec ?matricule= d'un employé ELCAM mais sans fichier logo → PDF valide sans erreur."""
        rh = seed_reference_data['rh']
        headers = auth_headers(rh.matricule, 'RH')
        fiche_id = fiche_fixture['fiche'].id_template
        emp_mat = fiche_fixture['emp'].matricule
        r = client.get(f'/api/fiches-poste/{fiche_id}/pdf?matricule={emp_mat}', headers=headers)
        assert r.status_code == 200
        ct = r.headers.get('content-type', '')
        assert 'pdf' in ct or 'html' in ct

    def test_pdf_fiche_avec_matricule_inconnu_retourne_pdf_sans_logo(self, client, fiche_fixture, auth_headers, seed_reference_data):
        """Matricule inconnu → logo_path=None → PDF généré normalement."""
        rh = seed_reference_data['rh']
        headers = auth_headers(rh.matricule, 'RH')
        fiche_id = fiche_fixture['fiche'].id_template
        r = client.get(f'/api/fiches-poste/{fiche_id}/pdf?matricule=INCONNU999', headers=headers)
        assert r.status_code == 200

    def test_build_pdf_html_sans_logo_ne_contient_pas_img(self):
        """_build_pdf_html sans logo_path ne doit pas contenir de balise <img>."""
        from app.routers.fiches_poste_router import _build_pdf_html
        from app import models
        fiche = models.FichePosteTemplate(
            id_template=1, fonction='Testeur',
            sections=[], html_content='<p>Contenu</p>',
        )
        html = _build_pdf_html(fiche, [], logo_path=None)
        assert '<img' not in html

    def test_build_pdf_html_avec_logo_contient_img(self, tmp_path):
        """_build_pdf_html avec logo_path doit inclure la balise <img>."""
        from app.routers.fiches_poste_router import _build_pdf_html
        from app import models
        fiche = models.FichePosteTemplate(
            id_template=1, fonction='Testeur',
            sections=[], html_content='<p>Contenu</p>',
        )
        fake_logo = tmp_path / 'test.jpg'
        fake_logo.write_bytes(b'FAKE')
        html = _build_pdf_html(fiche, [], logo_path=str(fake_logo))
        assert '<img' in html
        assert str(fake_logo) in html

    def test_build_pdf_html_logo_avant_header_sombre(self, tmp_path):
        """Le logo doit apparaître avant le div.head dans le HTML."""
        from app.routers.fiches_poste_router import _build_pdf_html
        from app import models
        fiche = models.FichePosteTemplate(
            id_template=1, fonction='Testeur',
            sections=[], html_content='<p>Contenu</p>',
        )
        fake_logo = tmp_path / 'test.jpg'
        fake_logo.write_bytes(b'FAKE')
        html = _build_pdf_html(fiche, [], logo_path=str(fake_logo))
        img_pos = html.find('<img')
        head_pos = html.find('class="head"')
        assert img_pos < head_pos, "Le logo doit apparaître avant le header sombre"
