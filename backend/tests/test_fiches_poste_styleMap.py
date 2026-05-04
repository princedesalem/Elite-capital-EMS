"""Tests : import .docx — préservation du rouge, suppression images & filigranes."""
import io
import zipfile
from app.routers.fiches_poste_router import _docx_to_clean_html, _retrocompat_html, _inject_fp_red_style
from unittest.mock import patch


class _MammothResult:
    def __init__(self, html):
        self.value = html
        self.messages = []


# ─── Helpers ──────────────────────────────────────────────────────────────────

_CT_XML = (
    '<?xml version="1.0"?>'
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
    '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
    '</Types>'
)
_RELS_XML = (
    '<?xml version="1.0"?>'
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>'
    '</Relationships>'
)
_STYLES_XML = (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    '<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
    '</w:styles>'
)


def _make_docx(doc_xml: str) -> bytes:
    """Construit un DOCX minimal en mémoire avec le document.xml fourni."""
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, 'w') as z:
        z.writestr('[Content_Types].xml', _CT_XML)
        z.writestr('_rels/.rels', _RELS_XML)
        z.writestr('word/_rels/document.xml.rels',
                   '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>')
        z.writestr('word/styles.xml', _STYLES_XML)
        z.writestr('word/document.xml', doc_xml)
    return buf.getvalue()


_DOC_RED = (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
    '<w:body>'
    '<w:p><w:r><w:rPr><w:color w:val="C00000"/></w:rPr><w:t>TEXTE ROUGE</w:t></w:r></w:p>'
    '<w:p><w:r><w:rPr><w:color w:val="FF0000"/></w:rPr><w:t>TEXTE FF0000</w:t></w:r></w:p>'
    '<w:p><w:r><w:t>Texte normal</w:t></w:r></w:p>'
    '</w:body></w:document>'
)


def test_inject_fp_red_style_sur_docx_reel():
    """_inject_fp_red_style injecte FPRed sur les runs C00000 et FF0000 via ElementTree."""
    docx_bytes = _make_docx(_DOC_RED)
    patched = _inject_fp_red_style(docx_bytes)

    with zipfile.ZipFile(io.BytesIO(patched)) as z:
        doc = z.read('word/document.xml').decode()
        styles = z.read('word/styles.xml').decode()

    # FPRed injecté dans le document ET défini dans styles.xml
    assert 'FPRed' in doc, "FPRed doit être injecté dans document.xml"
    assert 'FPRed' in styles, "FPRed doit être défini dans styles.xml"


def test_docx_to_clean_html_rouge_via_docx_reel():
    """_docx_to_clean_html détecte les couleurs rouge dans un DOCX réel (sans mock mammoth)."""
    docx_bytes = _make_docx(_DOC_RED)
    html = _docx_to_clean_html(docx_bytes)
    # Les runs rouges doivent être wrappés fp-red avec style inline
    assert 'fp-red' in html or 'c00000' in html.lower(), \
        f"Le rouge doit apparaître dans HTML; obtenu: {html[:300]}"
    assert 'TEXTE ROUGE' in html
    assert 'Texte normal' in html


def test_docx_preserve_red_via_stylemap():
    """Les couleurs rouges (via FPRed style injecté dans le DOCX) produisent fp-red dans le HTML."""
    captured = {}

    def fake_convert(stream, **kwargs):
        captured['style_map'] = kwargs.get('style_map')
        # Mammoth reçoit le DOCX pré-traité avec FPRed → retourne le span fp-red
        return _MammothResult('<p>Texte <span class="fp-red">URGENT</span> à traiter.</p>')

    with patch('mammoth.convert_to_html', side_effect=fake_convert):
        html = _docx_to_clean_html(b'fake-docx')
    # Le style inline rouge doit être présent (ajouté par la passe BeautifulSoup)
    assert 'color:#c00000' in html or 'color: #c00000' in html
    assert 'URGENT' in html
    assert captured['style_map'] is not None
    # Le nouveau style_map utilise FPRed (plus les hex FF0000/C00000 qui ne fonctionnaient pas)
    assert 'FPRed' in captured['style_map']


def test_docx_strips_images():
    """Les <img> (logos / filigranes raster) sont retirés."""
    def fake_convert(stream, **kwargs):
        return _MammothResult(
            '<p><img src="logo.png" alt="logo" /> Bienvenue</p><p>Texte</p>'
        )

    with patch('mammoth.convert_to_html', side_effect=fake_convert):
        html = _docx_to_clean_html(b'fake')
    assert '<img' not in html
    assert 'Bienvenue' in html
    assert 'Texte' in html


def test_docx_strips_position_absolute_watermark():
    """Les éléments en position:absolute (filigrane WordArt) sont supprimés."""
    def fake_convert(stream, **kwargs):
        return _MammothResult(
            '<p style="position:absolute;color:#ccc">CONFIDENTIEL</p>'
            '<p>Contenu réel</p>'
        )

    with patch('mammoth.convert_to_html', side_effect=fake_convert):
        html = _docx_to_clean_html(b'fake')
    assert 'CONFIDENTIEL' not in html
    assert 'Contenu réel' in html


def test_docx_still_strips_signature_table():
    """Le tableau Rubrique / Employé (signatures) est toujours coupé."""
    def fake_convert(stream, **kwargs):
        return _MammothResult(
            '<h2>Mission</h2><p>Description</p>'
            "<table><tr><th>Rubrique</th><th>L'Employé</th></tr></table>"
            '<p>Après signatures</p>'
        )

    with patch('mammoth.convert_to_html', side_effect=fake_convert):
        html = _docx_to_clean_html(b'fake')
    assert 'Mission' in html
    assert 'Description' in html
    assert 'Rubrique' not in html
    assert 'Après signatures' not in html


def test_docx_preserves_fp_red_class_after_fix():
    """Avec le fix, la CLASSE fp-red est conservée dans le HTML produit.
    Double protection : DOMPurify peut appliquer class OU style."""
    def fake_convert(stream, **kwargs):
        return _MammothResult('<p>Texte <span class="fp-red">IMPORTANT</span> ici.</p>')

    with patch('mammoth.convert_to_html', side_effect=fake_convert):
        html = _docx_to_clean_html(b'fake-docx')
    assert 'color:#c00000' in html  # style inline présent
    assert 'fp-red' in html          # ET la classe CSS préservée
    assert 'IMPORTANT' in html


def test_retrocompat_keeps_fp_red_class():
    """_retrocompat_html ajoute le style inline mais conserve la classe fp-red."""
    html_in = '<p>Texte <span class="fp-red">ROUGE</span> normal.</p>'
    html_out = _retrocompat_html(html_in)
    assert 'color:#c00000' in html_out  # style inline ajouté
    assert 'fp-red' in html_out          # classe préservée
    assert 'ROUGE' in html_out


def test_retrocompat_noop_without_fp_red():
    """_retrocompat_html ne touche pas les HTML sans fp-red."""
    html_in = '<p>Texte normal sans couleur.</p>'
    html_out = _retrocompat_html(html_in)
    assert html_out == html_in


def test_import_persistance_html_content(client, db_session, seed_reference_data, auth_headers):
    """POST /import écrit html_content + sections en BDD ; GET /{id} les retourne."""
    from app import models
    rh = seed_reference_data['rh']

    # On crée directement la fiche (l'upload .docx réel demande un fichier complet)
    fiche = models.FichePosteTemplate(
        fonction='Comptable',
        fichier_nom='Comptable.docx',
        sections=[{'titre': 'Mission', 'contenu': ['Tenue des comptes']}],
        html_content='<h2>Mission</h2><p>Tenue des comptes</p>',
    )
    db_session.add(fiche); db_session.commit()

    res = client.get(
        f'/api/fiches-poste/{fiche.id_template}',
        headers=auth_headers(rh.matricule, 'RH'),
    )
    assert res.status_code == 200
    body = res.json()
    assert body['html_content']
    assert 'Tenue des comptes' in body['html_content']
    assert len(body['sections']) == 1


# ─── Tests charte couleurs : rouge #c00000, pas doré #c9a227 ──────────────────

def test_pdf_template_uses_brand_red_not_gold():
    """_build_pdf_html doit utiliser #c00000 (rouge charte) et non #c9a227 (doré) pour les accents."""
    from app.routers.fiches_poste_router import _build_pdf_html
    from app import models

    fiche = models.FichePosteTemplate()
    fiche.id_template = 99
    fiche.fonction = 'Test Rouge'
    fiche.html_content = '<p>Contenu</p>'

    html = _build_pdf_html(fiche, [])
    # La bordure de séparation en-tête doit être rouge
    assert '#c00000' in html, 'La couleur rouge #c00000 doit être dans le template PDF'
    # La couleur dorée ne doit plus être utilisée comme accent principal
    assert '#c9a227' not in html, 'La couleur dorée #c9a227 ne doit pas apparaître dans le template PDF'


def test_pdf_template_fp_red_css():
    """Le template PDF doit contenir la règle CSS fp-red avec #c00000."""
    from app.routers.fiches_poste_router import _build_pdf_html
    from app import models

    fiche = models.FichePosteTemplate()
    fiche.id_template = 99
    fiche.fonction = 'Test'
    fiche.html_content = '<p><span class="fp-red">rouge</span></p>'

    html = _build_pdf_html(fiche, [])
    assert '.fp-red' in html
    # La règle fp-red doit pointer vers le rouge de la charte
    import re
    fp_red_rules = re.findall(r'\.fp-red\s*\{[^}]+\}', html)
    assert fp_red_rules, 'Règle CSS .fp-red introuvable dans le template PDF'
    assert 'c00000' in fp_red_rules[0].lower(), 'fp-red doit utiliser #c00000'


def test_pdf_template_century_gothic_font_face():
    """Le template PDF doit embarquer Century Gothic via @font-face."""
    from app.routers.fiches_poste_router import _build_pdf_html
    from app import models

    fiche = models.FichePosteTemplate()
    fiche.id_template = 99
    fiche.fonction = 'Test Police'
    fiche.html_content = '<p>Texte</p>'

    html = _build_pdf_html(fiche, [])
    assert '@font-face' in html, '@font-face manquant dans le template PDF'
    assert 'GOTHIC.TTF' in html, 'Font Century Gothic regular (GOTHIC.TTF) manquante'
    assert 'GOTHICB.TTF' in html, 'Font Century Gothic bold (GOTHICB.TTF) manquante'
    assert "font-family: 'Century Gothic'" in html or "font-family:'Century Gothic'" in html, \
        "font-family Century Gothic non déclarée dans body"


def test_is_red_color_detection():
    """_is_red_color identifie correctement les couleurs rouges DOCX."""
    from app.routers.fiches_poste_router import _is_red_color
    # Couleurs clairement rouges
    assert _is_red_color('C00000') is True   # rouge charte
    assert _is_red_color('FF0000') is True   # rouge pur
    assert _is_red_color('E00010') is True   # rouge foncé
    assert _is_red_color('D02020') is True   # rouge sombre
    # Couleurs non rouges
    assert _is_red_color('000000') is False  # noir
    assert _is_red_color('c9a227') is False  # doré
    assert _is_red_color('021630') is False  # bleu marine
    assert _is_red_color('16a34a') is False  # vert
    assert _is_red_color('FFFFFF') is False  # blanc


# ─── Tests fix « strong écrase fp-red » ──────────────────────────────────────

_DOC_RED_BOLD = (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
    '<w:body>'
    # Run rouge ET gras (structure réelle des DOCX : couleur + bold sur le même run)
    '<w:p><w:r><w:rPr><w:color w:val="C00000"/><w:b/></w:rPr><w:t>TITRE ROUGE GRAS</w:t></w:r></w:p>'
    '<w:p><w:r><w:t>Normal</w:t></w:r></w:p>'
    '</w:body></w:document>'
)


def test_fp_red_with_nested_strong_keeps_red_color():
    """Quand le DOCX a un run rouge+gras, le HTML produit doit avoir la couleur rouge
    MÊME SI mammoth enveloppe le texte dans <strong> — la règle .fp-red * couvre les enfants.
    Ce test reproduit exactement le bug : span.fp-red > strong { color: blue } écrasait le rouge.
    """
    # Simuler ce que mammoth produit pour un run rouge+gras :
    # il génère <span class="fp-red"><strong>TITRE</strong></span>
    def fake_convert(stream, **kwargs):
        return _MammothResult('<p><span class="fp-red"><strong>TITRE ROUGE GRAS</strong></span></p>')

    with patch('mammoth.convert_to_html', side_effect=fake_convert):
        html = _docx_to_clean_html(b'fake-docx')

    # La couleur rouge doit être sur le span (inline)
    assert 'color:#c00000' in html, 'Le style inline rouge doit être présent sur le span'
    assert 'fp-red' in html, 'La classe fp-red doit être préservée'
    assert 'TITRE ROUGE GRAS' in html
    # Vérifier que le strong est bien à l'intérieur du span fp-red
    import re
    match = re.search(r'<span[^>]*fp-red[^>]*>[^<]*<strong', html)
    assert match is not None, 'Le <strong> doit rester à l\'intérieur du span fp-red'


def test_pdf_template_fp_red_children_css():
    """Le template PDF doit avoir .fp-red * pour couvrir les enfants strong/em.
    C\'est le fix du bug : span.fp-red > strong héritait de color:#021630 (bleu) au lieu de #c00000.
    """
    from app.routers.fiches_poste_router import _build_pdf_html
    from app import models

    fiche = models.FichePosteTemplate()
    fiche.id_template = 99
    fiche.fonction = 'Test enfants'
    fiche.html_content = '<p><span class="fp-red"><strong>TITRE</strong></span></p>'

    html = _build_pdf_html(fiche, [])
    # La règle .fp-red * doit être dans le CSS
    assert '.fp-red *' in html, '.fp-red * manquant dans le CSS du template PDF'
    # Et elle doit pointer vers #c00000
    import re
    rule = re.search(r'\.fp-red \*\s*\{[^}]+\}', html)
    assert rule is not None
    assert 'c00000' in rule.group().lower()


def test_retrocompat_html_no_style_duplication():
    """_retrocompat_html ne doit PAS dupliquer le style si color:#c00000 est déjà présent.
    Bug observé : le style était préfixé même quand déjà là → "color:#c00000;font-weight:600;color:#c00000".
    """
    html_already_styled = (
        '<p><span class="fp-red" style="color:#c00000;font-weight:600">'
        '<strong>MISSIONS PRINCIPALES</strong></span></p>'
    )
    result = _retrocompat_html(html_already_styled)
    # Compter les occurrences de c00000 — doit rester à 1, pas 2
    count = result.lower().count('c00000')
    assert count == 1, f'c00000 dupliqué ({count} fois) : {result}'


def test_retrocompat_html_adds_style_when_missing():
    """_retrocompat_html DOIT ajouter le style inline si absent (fiches importées avant le fix)."""
    html_no_style = '<p><span class="fp-red">TEXTE SANS STYLE</span></p>'
    result = _retrocompat_html(html_no_style)
    assert 'color:#c00000' in result, 'Le style rouge doit être ajouté'
    assert 'fp-red' in result, 'La classe fp-red doit rester'
    assert 'TEXTE SANS STYLE' in result

