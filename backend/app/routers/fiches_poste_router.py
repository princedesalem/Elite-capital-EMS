"""
Router pour la gestion des fiches de poste.
Les fiches sont importées depuis des fichiers .docx, parsées et stockées en DB.
Chaque fiche est associée à une fonction (poste) unique.
"""
import io
import os
import re
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Body, Request, Response, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from ..db import get_db
from .. import models
from ..utils import security

router = APIRouter(prefix='/api/fiches-poste', tags=['fiches-poste'])


# ── Logos entités (dupliqué depuis pdf_router pour éviter import circulaire) ───────────
_LOGOS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'logos')
_ENTITY_LOGOS = {
    'ELCAM': os.path.join(_LOGOS_DIR, 'elcam.jpg'),
    'EXCA':  os.path.join(_LOGOS_DIR, 'exca.jpg'),
    'ECG':   os.path.join(_LOGOS_DIR, 'ecg.jpg'),
}


def _get_logo_path(matricule: str, db: Session) -> Optional[str]:
    """Retourne le chemin absolu du logo de l'entité de l'employé, ou None si absent."""
    emp = db.query(models.Employe).filter(models.Employe.matricule == str(matricule)).first()
    if not emp or not emp.id_entite:
        return None
    entite = db.query(models.Entite).filter(models.Entite.id_entite == emp.id_entite).first()
    if not entite:
        return None
    path = _ENTITY_LOGOS.get((entite.nom or '').upper())
    return path if path and os.path.exists(path) else None


# Rôles ayant l'accès complet (toutes les fiches)
_FULL_ACCESS_ROLES = {'RH', 'PCA', 'ADMIN', 'AG'}
# Rôles avec scope élargi (par périmètre organisationnel)
_SCOPED_ROLES = {'DG', 'DIRECTEUR', 'RESPONSABLE'}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _detecter_fonction(filename: str) -> str:
    """Extrait le nom de la fonction depuis le nom du fichier .docx."""
    name = filename
    # Retirer l'extension
    for ext in ('.docx', '.DOCX', '.doc', '.DOC'):
        if name.endswith(ext):
            name = name[:-len(ext)]
            break
    # Retirer les préfixes courants
    prefixes = [
        'Fiche_de_poste_',
        'Fiche de poste ',
        'Fiche_de_Poste_',
        'FDP_',
        'fdp_',
    ]
    for p in prefixes:
        if name.startswith(p):
            name = name[len(p):]
            break
    # Remplacer underscores résiduels par des espaces
    return name.replace('_', ' ').strip()


def _parse_docx(file_bytes: bytes) -> list:
    """Parse un .docx et retourne une liste de sections [{titre, contenu:[str]}].
    Parcourt le corps du document dans l'ordre (paragraphes ET tableaux)
    pour ne pas rater le contenu stocké dans des cellules Word.
    """
    try:
        from docx import Document
        from docx.text.paragraph import Paragraph as DocxParagraph
        from docx.table import Table as DocxTable
    except ImportError:
        raise HTTPException(
            status_code=500,
            detail="python-docx non installé. Contactez l'administrateur."
        )

    doc = Document(io.BytesIO(file_bytes))
    sections: list = []
    current: dict | None = None

    def _is_heading(para) -> bool:
        style_name = (para.style.name or '').lower()
        text = para.text.strip()
        if not text:
            return False
        # Styles Word anglais ET français (Heading 1 / Titre 1)
        if 'heading' in style_name or 'titre' in style_name or style_name in ('title', 'subtitle'):
            return True
        # Texte entièrement en majuscules
        if text.isupper() and 2 < len(text) < 120:
            return True
        # Paragraphe court entièrement en rouge = convention titre dans ces documents
        if len(text) < 120 and para.runs:
            try:
                colored_runs = [r for r in para.runs if r.text.strip()]
                if colored_runs and all(
                    r.font.color.rgb is not None
                    and r.font.color.rgb[0] > 150
                    and r.font.color.rgb[1] < 100
                    and r.font.color.rgb[2] < 100
                    for r in colored_runs
                ):
                    return True
            except Exception:
                pass
        return False

    def _para_rich_text(para) -> str:
        """Retourne le texte du paragraphe avec marqueurs **gras** et [r]rouge[/r]."""
        if not para.runs:
            return para.text
        parts = []
        for run in para.runs:
            text = run.text
            if not text:
                continue
            is_bold = run.bold is True
            is_red = False
            try:
                rgb = run.font.color.rgb
                if rgb and rgb[0] > 180 and rgb[1] < 80 and rgb[2] < 80:
                    is_red = True
            except Exception:
                pass
            if is_red:
                text = f'[r]{text}[/r]'
            elif is_bold:
                text = f'**{text}**'
            parts.append(text)
        result = ''.join(parts)
        return result if result.strip() else ''

    # Compteur de liste numérotée par section (réinitialisé à chaque nouveau titre)
    _numbered_counter: list = [0]

    def _is_numbered_list(para) -> bool:
        """Détecte si le paragraphe est une liste numérotée Word (pas une puce)."""
        style_name = (para.style.name or '').lower()
        if 'number' in style_name or 'numéro' in style_name or 'list number' in style_name:
            return True
        try:
            pPr = para._p.pPr
            if pPr is None:
                return False
            numPr = pPr.numPr
            if numPr is None:
                return False
            # Chercher le format dans le document via nsmap
            from lxml import etree
            nsmap = para._p.nsmap
            wns = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
            numFmt_elem = para._p.find('.//' + wns + 'numFmt')
            if numFmt_elem is not None:
                fmt = numFmt_elem.get(wns + 'val', '')
                return fmt not in ('bullet', 'none', '')
        except Exception:
            pass
        return False

    def _add_para(para):
        nonlocal current
        text = para.text.strip()
        if not text:
            return
        if _is_heading(para):
            current = {'titre': text, 'contenu': []}
            sections.append(current)
            _numbered_counter[0] = 0  # reset counter on new section
        else:
            if current is None:
                current = {'titre': '', 'contenu': []}
                sections.append(current)
            rich = _para_rich_text(para)
            # Détecter les paragraphes de liste (puces ou numérotés)
            has_numPr = False
            try:
                pPr = para._p.pPr
                if pPr is not None and pPr.numPr is not None:
                    has_numPr = True
            except Exception:
                pass
            style_is_list = 'list' in (para.style.name or '').lower()
            is_numbered = has_numPr and _is_numbered_list(para)
            is_bullet = (has_numPr or style_is_list) and not is_numbered
            if is_numbered and rich:
                _numbered_counter[0] += 1
                rich = f'{_numbered_counter[0]}. ' + rich
            elif is_bullet and rich:
                rich = '• ' + rich
            if rich:
                current['contenu'].append(rich)

    def _process_table(table):
        nonlocal current
        for row in table.rows:
            # Dédupliquer les cellules fusionnées (python-docx les retourne en double)
            seen: list = []
            seen_set: set = set()
            for cell in row.cells:
                # Collecter le riche texte de la cellule, en détectant les puces intra-cellule
                lines = []
                for p in cell.paragraphs:
                    if not p.text.strip():
                        continue
                    rich = _para_rich_text(p)
                    # Puce dans une cellule
                    is_list = False
                    try:
                        pPr = p._p.pPr
                        if pPr is not None and pPr.numPr is not None:
                            is_list = True
                    except Exception:
                        pass
                    if not is_list and 'list' in (p.style.name or '').lower():
                        is_list = True
                    if is_list and rich:
                        rich = '• ' + rich
                    if rich:
                        lines.append(rich)
                cell_text = '\n'.join(lines).strip()
                if cell_text and cell_text not in seen_set:
                    seen.append(cell_text)
                    seen_set.add(cell_text)

            if not seen:
                continue

            # Cellule unique → potentiellement un titre de section
            if len(seen) == 1:
                rich_text = seen[0]
                # Extraire le texte brut (sans marqueurs **bold** ni [r]rouge[/r])
                plain = re.sub(r'\*\*|\[r\]|\[/r\]', '', rich_text).strip()
                is_sec = (
                    (plain.isupper() and 2 < len(plain) < 120)
                    or
                    # Entièrement rouge ET court (convention titres de ces documents)
                    (rich_text.startswith('[r]') and rich_text.endswith('[/r]') and 2 < len(plain) < 120)
                )
                if is_sec:
                    current = {'titre': plain, 'contenu': []}
                    sections.append(current)
                    continue

            line = ' | '.join(seen)
            if current is None:
                current = {'titre': '', 'contenu': []}
                sections.append(current)
            current['contenu'].append(line)

    # Parcourir le corps XML dans l'ordre pour respecter l'entrelacement paragraphes/tableaux
    for child in doc.element.body:
        tag = child.tag
        if tag.endswith('}p'):
            _add_para(DocxParagraph(child, doc))
        elif tag.endswith('}tbl'):
            _process_table(DocxTable(child, doc))

    # Fusionner les sections sans titre consécutives
    merged: list = []
    for s in sections:
        if s['titre'] == '' and merged and merged[-1]['titre'] == '':
            merged[-1]['contenu'].extend(s['contenu'])
        else:
            merged.append(s)

    # Marqueurs de début de la section validation/signature
    STOP_PHRASES = ['fiche de validation', 'nom | date | signature']
    STOP_TABLE_ROLES = [
        'responsable si', 'directeur organisation', 'directeur organisation & projets',
        'responsables ressources humaines', 'responsable ressources humaines', 'administrateur général',
    ]

    def _normalize(s: str) -> str:
        """Normalise les apostrophes typographiques Word (’) en ASCII."""
        return s.lower().replace('\u2019', "'").replace('\u2018', "'")

    def _is_stop_line(line: str) -> bool:
        ll = _normalize(line)
        for phrase in STOP_PHRASES:
            if phrase in ll:
                return True
        # Tableau "Rubrique | L'Employé(e)" (apostrophe droite ou typographique)
        if 'rubrique' in ll and "l'employ" in ll:
            return True
        # Lignes seules générées par le tableau de signature
        if ll.strip() in ('nom', 'signature', 'date'):
            return True
        return False

    def _looks_like_approval_table(lines: list) -> bool:
        text = ' '.join(lines).lower()
        return sum(1 for r in STOP_TABLE_ROLES if r in text) >= 3

    # Tronquer chaque section à la première ligne d'arrêt (plutôt que supprimer la section entière)
    cleaned: list = []
    for s in merged:
        contenu = s.get('contenu', [])
        titre = s.get('titre', '')
        if _is_stop_line(titre):
            continue
        truncated = []
        for line in contenu:
            if _is_stop_line(line):
                break
            truncated.append(line)
        if truncated and _looks_like_approval_table(truncated):
            continue
        if truncated or titre:
            cleaned.append({'titre': titre, 'contenu': truncated})

    return cleaned


def _retrocompat_html(html: str) -> str:
    """Convertit les spans class='fp-red' → style inline (fiches importées avant le style_map inline)."""
    if not html or 'fp-red' not in html:
        return html
    from bs4 import BeautifulSoup
    soup = BeautifulSoup(html, 'html.parser')
    for span in soup.find_all('span', class_='fp-red'):
        existing = span.get('style', '')
        # Ne pas dupliquer si le style est déjà présent
        if 'c00000' not in existing.lower():
            span['style'] = ('color:#c00000;font-weight:600;' + existing).strip(';')
        # NE PAS supprimer class="fp-red" — la CSS frontend s'en sert comme filet
    return str(soup)


def _fiche_to_dict(f: models.FichePosteTemplate) -> dict:
    raw_html = getattr(f, 'html_content', None) or ''
    return {
        'id_template': f.id_template,
        'fonction': f.fonction,
        'fichier_nom': f.fichier_nom,
        'sections': f.sections or [],
        'html_content': _retrocompat_html(raw_html),
        'cree_par': f.cree_par,
        'date_creation': f.date_creation.isoformat() if f.date_creation else None,
        'date_modification': f.date_modification.isoformat() if f.date_modification else None,
    }


# ---------------------------------------------------------------------------
# Helpers : conversion HTML mammoth + nettoyage
# ---------------------------------------------------------------------------

def _is_red_color(hex6: str) -> bool:
    """Retourne True si la couleur hex 6 chars est rouge-ish (R≥150, G<80, B<80)."""
    try:
        c = hex6.upper().strip('#')
        if len(c) != 6:
            return False
        r, g, b = int(c[0:2], 16), int(c[2:4], 16), int(c[4:6], 16)
        return r >= 150 and g < 80 and b < 80
    except Exception:
        return False


# Namespace OOXML Word
_W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'


def _inject_fp_red_style(file_bytes: bytes) -> bytes:
    """Pré-traite le DOCX avec ElementTree (robuste) :
    Ajoute <w:rStyle w:val="FPRed"/> sur chaque run dont w:color/@w:val est rouge-ish.
    Ajoute la définition du style dans word/styles.xml.
    Mammoth mappe ensuite r[style-name='FPRed'] => span.fp-red.
    """
    import zipfile as _zipfile
    import xml.etree.ElementTree as ET

    try:
        with _zipfile.ZipFile(io.BytesIO(file_bytes)) as zin:
            files = {name: zin.read(name) for name in zin.namelist()}
    except Exception:
        return file_bytes

    doc_key = 'word/document.xml'
    if doc_key not in files:
        return file_bytes

    # ── 1. Modifier word/document.xml ─────────────────────────────────────
    try:
        doc_xml_str = files[doc_key].decode('utf-8', errors='replace')
        # Conserver le header XML + la déclaration de namespaces exacte
        # en enregistrant tous les namespaces avant parsing
        ns_map: dict = {}
        for event, (prefix, uri) in ET.iterparse(io.BytesIO(files[doc_key]), events=['start-ns']):
            ns_map[prefix] = uri
            ET.register_namespace(prefix, uri)
        # Enregistrer les namespaces courants
        ET.register_namespace('w', _W)

        root = ET.fromstring(doc_xml_str)

        W = f'{{{_W}}}'
        red_injected = 0

        for r_elem in root.iter(f'{W}r'):
            rpr = r_elem.find(f'{W}rPr')
            if rpr is None:
                continue
            color_el = rpr.find(f'{W}color')
            if color_el is None:
                continue
            val = color_el.get(f'{W}val') or color_el.get('w:val', '')
            if not val:
                # Chercher aussi sans namespace explicite
                for attr_key, attr_val in color_el.attrib.items():
                    if 'val' in attr_key.lower():
                        val = attr_val
                        break
            if val and _is_red_color(val):
                # Vérifier qu'il n'y a pas déjà un rStyle
                if rpr.find(f'{W}rStyle') is None:
                    r_style = ET.Element(f'{W}rStyle')
                    r_style.set(f'{W}val', 'FPRed')
                    rpr.insert(0, r_style)
                    red_injected += 1

        if red_injected > 0:
            # Ré-sérialiser le document XML
            new_xml = ET.tostring(root, encoding='unicode', xml_declaration=False)
            # Restaurer la déclaration XML en tête
            if doc_xml_str.startswith('<?xml'):
                decl_end = doc_xml_str.index('?>') + 2
                new_xml = doc_xml_str[:decl_end] + '\n' + new_xml
            files[doc_key] = new_xml.encode('utf-8')

    except Exception:
        # En cas d'erreur ElementTree, retomber sur le regex (méthode de secours)
        doc_xml = files[doc_key].decode('utf-8', errors='replace')

        def _mark_red_re(m: 're.Match') -> str:
            rpr = m.group(0)
            val_m = re.search(r'w:val="([0-9A-Fa-f]{6})"', rpr)
            if val_m and _is_red_color(val_m.group(1)) and '<w:rStyle' not in rpr:
                # Insérer rStyle juste après <w:rPr> (avec ou sans attributs)
                rpr = re.sub(r'(<w:rPr[^>]*>)', r'\1<w:rStyle w:val="FPRed"/>', rpr, count=1)
            return rpr

        doc_xml = re.sub(r'<w:rPr[^>]*>.*?</w:rPr>', _mark_red_re, doc_xml, flags=re.DOTALL)
        files[doc_key] = doc_xml.encode('utf-8')

    # ── 2. Ajouter la définition du style FPRed dans word/styles.xml ──────
    styles_key = 'word/styles.xml'
    if styles_key in files:
        styles_xml = files[styles_key].decode('utf-8', errors='replace')
        if 'FPRed' not in styles_xml:
            fp_red_def = (
                '<w:style w:type="character" w:customStyle="1" w:styleId="FPRed">'
                '<w:name w:val="FPRed"/>'
                '<w:rPr><w:color w:val="C00000"/><w:b/></w:rPr>'
                '</w:style>'
            )
            styles_xml = re.sub(r'</w:styles>', fp_red_def + '</w:styles>', styles_xml)
            files[styles_key] = styles_xml.encode('utf-8')

    buf = io.BytesIO()
    with _zipfile.ZipFile(buf, 'w', _zipfile.ZIP_DEFLATED) as zout:
        for name, data in files.items():
            zout.writestr(name, data)
    return buf.getvalue()


def _pdf_to_clean_html(file_bytes: bytes) -> str:
    """Extrait le texte d'un PDF et le convertit en HTML structuré.

    Détecte automatiquement :
    - Titres : lignes courtes en MAJUSCULES
    - Listes numérotées : lignes commençant par "1.", "2.", etc.
    - Puces : lignes commençant par •, -, *
    - Texte courant : paragraphes normaux
    """
    try:
        from pdfminer.high_level import extract_pages
        from pdfminer.layout import LTTextContainer, LTChar, LTTextLine
    except ImportError:
        return '<p><em>pdfminer.six non installé.</em></p>'

    import re as _re

    # Extraction ligne par ligne avec taille de police
    lines_with_size: list[tuple[str, float]] = []
    try:
        for page_layout in extract_pages(io.BytesIO(file_bytes)):
            for element in page_layout:
                if not isinstance(element, LTTextContainer):
                    continue
                for text_line in element:
                    if not hasattr(text_line, 'get_text'):
                        continue
                    text = text_line.get_text().strip()
                    if not text:
                        continue
                    # Taille de police dominante sur cette ligne
                    sizes = [
                        c.size for c in text_line
                        if isinstance(c, LTChar) and c.size > 0
                    ]
                    avg_size = sum(sizes) / len(sizes) if sizes else 10.0
                    lines_with_size.append((text, avg_size))
    except Exception:
        return '<p><em>Erreur lors de la lecture du PDF.</em></p>'

    if not lines_with_size:
        return '<p><em>Aucun texte extractible dans ce PDF.</em></p>'

    # Taille de corps "normale" (médiane)
    sorted_sizes = sorted(s for _, s in lines_with_size)
    median_size = sorted_sizes[len(sorted_sizes) // 2] if sorted_sizes else 10.0

    html_parts: list[str] = []
    # Liste courante en cours de construction
    list_type: str | None = None  # 'ol' | 'ul' | None
    list_items: list[str] = []

    def _flush_list():
        nonlocal list_type, list_items
        if not list_items:
            list_type = None
            return
        tag = list_type
        html_parts.append(f'<{tag}>')
        for item in list_items:
            html_parts.append(f'<li>{item}</li>')
        html_parts.append(f'</{tag}>')
        list_type = None
        list_items = []

    _num_re = _re.compile(r'^(\d+)\.\s+(.+)$', _re.DOTALL)
    _bullet_chars = ('•', '·', '◦', '▪', '▸', '–', '-', '*', '►', '○')

    for raw_text, size in lines_with_size:
        text = raw_text.strip()
        if not text:
            continue

        # Détecter type de ligne
        num_match = _num_re.match(text)
        is_bullet = any(text.startswith(c) for c in _bullet_chars)
        is_big = size > median_size * 1.15
        is_heading = (
            is_big
            or (text.isupper() and 3 < len(text) < 120)
        )
        # Supprimer le "fiche de validation" et lignes d'entête tableau Word
        lower = text.lower()
        if any(kw in lower for kw in ('fiche de validation', 'rubrique', "l'employé", 'l\'employe', 'signature')):
            continue

        if is_heading and not num_match and not is_bullet:
            _flush_list()
            escaped = text.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
            html_parts.append(f'<h3><span class="fp-red" style="color:#c00000;font-weight:600">{escaped}</span></h3>')

        elif num_match:
            content = num_match.group(2).strip()
            escaped = content.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
            if list_type == 'ol':
                list_items.append(escaped)
            else:
                _flush_list()
                list_type = 'ol'
                list_items = [escaped]

        elif is_bullet:
            content = text.lstrip('•·◦▪▸–-*►○').strip()
            escaped = content.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
            if list_type == 'ul':
                list_items.append(escaped)
            else:
                _flush_list()
                list_type = 'ul'
                list_items = [escaped]

        else:
            _flush_list()
            escaped = text.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
            html_parts.append(f'<p>{escaped}</p>')

    _flush_list()
    return '\n'.join(html_parts)


def _docx_to_clean_html(file_bytes: bytes) -> str:
    """Convertit le .docx en HTML fidèle (mammoth) et supprime les 2 dernières
    parties (tableau de signatures + fiche de validation).

    Préserve la couleur rouge en pré-traitant le DOCX XML pour injecter le
    character style 'FPRed' sur les runs rouges, puis en mappant ce style
    vers span.fp-red via le style_map mammoth.
    """
    try:
        import mammoth
    except ImportError:
        return ''
    try:
        from bs4 import BeautifulSoup
    except ImportError:
        BeautifulSoup = None

    # Pré-traiter le DOCX pour marquer les runs rouges avec le style FPRed
    file_bytes = _inject_fp_red_style(file_bytes)

    # style_map : r[style-name='FPRed'] est le seul mapping nécessaire.
    # r[color='...'] n'est PAS supporté par mammoth → ignoré avec warning.
    style_map = "r[style-name='FPRed'] => span.fp-red"

    try:
        result = mammoth.convert_to_html(
            io.BytesIO(file_bytes),
            style_map=style_map,
            convert_image=mammoth.images.img_element(lambda image: {'src': ''}),
        )
        html = result.value or ''
    except Exception:
        try:
            result = mammoth.convert_to_html(io.BytesIO(file_bytes))
            html = result.value or ''
        except Exception:
            return ''

    if not html:
        return ''

    # Nettoyage : couper depuis le 1er tableau contenant "Rubrique" + "Employé"
    if BeautifulSoup is not None:
        try:
            soup = BeautifulSoup(html, 'html.parser')

            # 1) Supprimer toutes les images (logos / filigranes)
            for img in soup.find_all('img'):
                img.decompose()

            # 2) Supprimer les paragraphes/divs en position absolue (filigranes WordArt)
            for tag in soup.find_all(True):
                style_attr = (tag.get('style') or '').lower()
                cls_list = ' '.join(tag.get('class') or []).lower()
                if 'position:absolute' in style_attr.replace(' ', '') \
                        or 'wordart' in cls_list \
                        or 'mso-wordart' in style_attr:
                    tag.decompose()

            tables = soup.find_all('table')
            cut_node = None
            for t in tables:
                txt = (t.get_text(' ') or '').lower().replace('\u2019', "'").replace('\u2018', "'")
                if 'rubrique' in txt and "l'employ" in txt:
                    cut_node = t
                    break
                if 'fiche de validation' in txt:
                    cut_node = t
                    break

            if cut_node is not None:
                successors = list(cut_node.find_all_next())
                for sib in successors:
                    sib.decompose()
                cut_node.decompose()

            for p in soup.find_all(['p', 'h1', 'h2', 'h3', 'h4']):
                txt = (p.get_text(' ') or '').lower()
                if 'fiche de validation' in txt:
                    for sib in list(p.find_all_next()):
                        sib.decompose()
                    p.decompose()
                    break

            # 3) Convertir class="fp-red" → style inline (rétro-compat fiches déjà en DB)
            for span in soup.find_all('span', class_='fp-red'):
                span['style'] = 'color:#c00000;font-weight:600'
                # Garder class="fp-red" : CSS frontend comme filet de sécurité

            # 4) Fusionner les <ol> consécutifs en un seul (numérotation 1,2,3,...)
            for ol in list(soup.find_all('ol')):
                prev = ol.find_previous_sibling()
                if prev and prev.name == 'ol':
                    for li in ol.find_all('li', recursive=False):
                        li.extract()
                        prev.append(li)
                    ol.decompose()

            # 5) Supprimer les balises vides résultantes
            for tag in soup.find_all(['p', 'span', 'div']):
                if not tag.get_text(strip=True) and not tag.find_all(['img', 'br', 'table']):
                    tag.decompose()

            html = str(soup)
        except Exception:
            pass
    else:
        m = re.search(r'<table[^>]*>(?=[\s\S]*?(?:Rubrique|fiche de validation))', html, re.IGNORECASE)
        if m:
            html = html[:m.start()]

    return html.strip()


# ---------------------------------------------------------------------------
# Helpers : scope par rôle
# ---------------------------------------------------------------------------

def _decode_token(request: Request) -> Optional[dict]:
    """Décode le JWT de la requête. Retourne None si absent/invalide."""
    auth = request.headers.get('authorization') or ''
    if not auth.lower().startswith('bearer '):
        return None
    token = auth.split(None, 1)[1]
    try:
        return security.jwt.decode(token, security.SECRET_KEY, algorithms=[security.ALGORITHM])
    except Exception:
        return None


def _user_context(request: Request, db: Session) -> dict:
    """Retourne {role, matricule, employe} pour l'utilisateur courant, ou {} si non authentifié."""
    payload = _decode_token(request)
    if not payload:
        return {}
    role = str(payload.get('role') or '').strip().upper()
    matricule = payload.get('matricule') or payload.get('sub')
    if matricule is None:
        return {'role': role}
    matricule_str = str(matricule).strip().upper()
    emp = db.query(models.Employe).filter(models.Employe.matricule == matricule_str).first()
    return {'role': role, 'matricule': matricule_str, 'employe': emp}


def _scoped_fonctions(ctx: dict, db: Session) -> Optional[set]:
    """Retourne l'ensemble des fonctions visibles selon le rôle de l'utilisateur.
    None  = accès complet (pas de filtrage).
    set() = aucun accès.
    """
    role = (ctx.get('role') or '').strip().upper()
    # Accès complet : RH, ADMIN, PCA, AG → court-circuit immediat (aucun filtrage)
    if role in _FULL_ACCESS_ROLES:
        return None
    emp = ctx.get('employe')
    if not emp:
        return set()
    q = db.query(models.Employe.fonction).filter(
        models.Employe.fonction.isnot(None),
        models.Employe.statut_employe == models.StatutEmployeEnum.ACTIF,
    )
    if role == 'DG' and emp.id_entite:
        q = q.filter(models.Employe.id_entite == emp.id_entite)
    elif role == 'DIRECTEUR' and emp.id_direction:
        q = q.filter(models.Employe.id_direction == emp.id_direction)
    elif role == 'RESPONSABLE' and emp.dept_id:
        q = q.filter(models.Employe.dept_id == emp.dept_id)
    else:
        # Rôle non reconnu / pas de scope → accès interdit aux listes
        return set()
    return {r[0] for r in q.distinct().all() if r[0]}


def _auto_assigner_par_fonction(fiche: models.FichePosteTemplate, db: Session) -> int:
    """Assigne automatiquement la fiche à tous les employés actifs ayant la même fonction.
    Retourne le nombre d'employés mis à jour."""
    if not fiche.fonction:
        return 0
    # Trouver les employés actifs avec cette fonction
    emps = (
        db.query(models.Employe)
        .filter(
            models.Employe.fonction == fiche.fonction,
            models.Employe.statut_employe == models.StatutEmployeEnum.ACTIF,
        )
        .all()
    )
    count = 0
    for emp in emps:
        if emp.id_fiche_poste != fiche.id_template:
            emp.id_fiche_poste = fiche.id_template
            count += 1
    if count:
        db.commit()
    return count


def _titulaires_for(fiche: models.FichePosteTemplate, db: Session) -> list:
    """Retourne les employés actuellement assignés manuellement à cette fiche."""
    rows = (
        db.query(models.Employe)
        .filter(
            models.Employe.id_fiche_poste == fiche.id_template,
            models.Employe.statut_employe == models.StatutEmployeEnum.ACTIF,
        )
        .order_by(models.Employe.nom, models.Employe.prenom)
        .all()
    )
    return [
        {
            'matricule': e.matricule,
            'nom': e.nom,
            'prenom': e.prenom,
            'fonction': e.fonction,
            'photo_url': getattr(e, 'photo_url', None),
        }
        for e in rows
    ]


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get('/', summary='Lister toutes les fiches de poste')
def lister_fiches(request: Request, db: Session = Depends(get_db)):
    ctx = _user_context(request, db)
    allowed = _scoped_fonctions(ctx, db)  # None = tout, set() = rien

    q = db.query(models.FichePosteTemplate).order_by(models.FichePosteTemplate.fonction)
    if allowed is not None:
        if not allowed:
            return []
        q = q.filter(models.FichePosteTemplate.fonction.in_(allowed))
    fiches = q.all()
    result = []
    for f in fiches:
        d = _fiche_to_dict(f)
        d['titulaires'] = _titulaires_for(f, db)
        d['nb_titulaires'] = len(d['titulaires'])
        result.append(d)
    return result


@router.get('/ma-fiche', summary='Fiche de poste de l\'employé connecté')
def ma_fiche(matricule: str, db: Session = Depends(get_db)):
    """Retourne la fiche assignée à l'employé.
    Priorité : id_fiche_poste (assignation manuelle/auto) → fallback par fonction.
    """
    emp = (
        db.query(models.Employe)
        .filter(models.Employe.matricule == matricule)
        .first()
    )
    if not emp:
        raise HTTPException(status_code=404, detail='Employé introuvable')

    fiche = None
    # 1) Assignation directe
    if emp.id_fiche_poste:
        fiche = (
            db.query(models.FichePosteTemplate)
            .filter(models.FichePosteTemplate.id_template == emp.id_fiche_poste)
            .first()
        )
    # 2) Fallback par fonction (et auto-assigner pour la suite)
    if fiche is None and emp.fonction:
        fiche = (
            db.query(models.FichePosteTemplate)
            .filter(models.FichePosteTemplate.fonction == emp.fonction)
            .first()
        )
        if fiche:
            emp.id_fiche_poste = fiche.id_template
            db.commit()

    if not fiche:
        raise HTTPException(status_code=404, detail="Aucune fiche de poste pour ce poste")

    fiche_dict = _fiche_to_dict(fiche)
    fiche_dict['titulaires'] = _titulaires_for(fiche, db)
    return fiche_dict


@router.get('/fonctions-sans-fiche', summary='Fonctions en DB sans fiche de poste associée')
def fonctions_sans_fiche(db: Session = Depends(get_db)):
    """Retourne les fonctions distinctes des employés qui n'ont pas encore de fiche."""
    # Fonctions déjà couvertes
    fiches_fonctions = {
        row[0]
        for row in db.query(models.FichePosteTemplate.fonction).all()
    }
    # Fonctions des employés actifs
    rows = (
        db.query(models.Employe.fonction)
        .filter(models.Employe.fonction.isnot(None))
        .filter(models.Employe.statut_employe == models.StatutEmployeEnum.ACTIF)
        .distinct()
        .all()
    )
    manquantes = sorted({r[0] for r in rows if r[0] and r[0] not in fiches_fonctions})
    return {'fonctions': manquantes}


_ACCEPTED_EXTENSIONS = ('.docx', '.doc', '.pdf')


@router.post('/preview-import', summary='Prévisualiser le contenu d\'un .docx/.pdf sans l\'enregistrer')
async def preview_import(fichier: UploadFile = File(...)):
    """
    Reçoit un fichier .docx ou .pdf, détecte la fonction depuis le nom du fichier
    et retourne les sections parsées sans rien écrire en base.
    """
    fname = (fichier.filename or '').lower()
    if not fname.endswith(_ACCEPTED_EXTENSIONS):
        raise HTTPException(status_code=400, detail='Seuls les fichiers .docx et .pdf sont acceptés')

    file_bytes = await fichier.read()
    fonction_detectee = _detecter_fonction(fichier.filename)
    is_pdf = fname.endswith('.pdf')

    if is_pdf:
        sections = []
        html_content = _pdf_to_clean_html(file_bytes)
    else:
        sections = _parse_docx(file_bytes)
        html_content = _docx_to_clean_html(file_bytes)

    return {
        'fonction_detectee': fonction_detectee,
        'fichier_nom': fichier.filename,
        'nb_sections': len(sections),
        'sections': sections,
        'html_content': html_content,
    }


@router.post('/import', status_code=status.HTTP_201_CREATED, summary='Importer une fiche de poste depuis un .docx ou .pdf')
async def importer_fiche(
    fichier: UploadFile = File(...),
    fonction: str = Form(...),
    cree_par: str = Form(None),
    db: Session = Depends(get_db),
):
    """
    Importe un fichier .docx ou .pdf et crée (ou met à jour) la fiche de poste pour la fonction donnée.
    - Si une fiche existe déjà pour cette fonction, elle est remplacée.
    - La fonction peut être modifiée par le RH par rapport à la détection automatique.
    """
    fname = (fichier.filename or '').lower()
    if not fname.endswith(_ACCEPTED_EXTENSIONS):
        raise HTTPException(status_code=400, detail='Seuls les fichiers .docx et .pdf sont acceptés')
    if not fonction.strip():
        raise HTTPException(status_code=400, detail='Le nom de la fonction est obligatoire')

    file_bytes = await fichier.read()
    is_pdf = fname.endswith('.pdf')
    if is_pdf:
        sections = []
        html_content = _pdf_to_clean_html(file_bytes)
    else:
        sections = _parse_docx(file_bytes)
        html_content = _docx_to_clean_html(file_bytes)
    fonction = fonction.strip()

    # Upsert
    existing = (
        db.query(models.FichePosteTemplate)
        .filter(models.FichePosteTemplate.fonction == fonction)
        .first()
    )
    if existing:
        existing.fichier_nom = fichier.filename
        existing.sections = sections
        existing.html_content = html_content
        existing.date_modification = datetime.utcnow()
        db.commit()
        db.refresh(existing)
        _auto_assigner_par_fonction(existing, db)
        return {**_fiche_to_dict(existing), 'action': 'mise_a_jour'}
    else:
        fiche = models.FichePosteTemplate(
            fonction=fonction,
            fichier_nom=fichier.filename,
            sections=sections,
            html_content=html_content,
            cree_par=cree_par or None,
            date_creation=datetime.utcnow(),
        )
        db.add(fiche)
        db.commit()
        db.refresh(fiche)
        _auto_assigner_par_fonction(fiche, db)
        return {**_fiche_to_dict(fiche), 'action': 'creation'}


@router.post('/sync-toutes-fonctions', summary='Synchroniser les fiches de poste pour tous les employés')
def sync_toutes_fonctions(request: Request, db: Session = Depends(get_db)):
    """Assigne automatiquement chaque fiche à tous les employés ayant la même fonction.
    Utile pour initialiser les assignations sur une base existante.
    Réservé aux rôles RH+.
    """
    ctx = _user_context(request, db)
    role = (ctx.get('role') or '').strip().upper()
    if role not in _FULL_ACCESS_ROLES:
        raise HTTPException(status_code=403, detail='Accès refusé')

    fiches = db.query(models.FichePosteTemplate).all()
    total = 0
    details = []
    for fiche in fiches:
        n = _auto_assigner_par_fonction(fiche, db)
        if n:
            details.append({'fonction': fiche.fonction, 'assignes': n})
            total += n
    return {'total_assignes': total, 'details': details}


@router.get('/{id_template}', summary='Obtenir une fiche par son ID')
def obtenir_fiche(id_template: int, db: Session = Depends(get_db)):
    fiche = (
        db.query(models.FichePosteTemplate)
        .filter(models.FichePosteTemplate.id_template == id_template)
        .first()
    )
    if not fiche:
        raise HTTPException(status_code=404, detail='Fiche introuvable')
    return _fiche_to_dict(fiche)


@router.put('/{id_template}', summary='Modifier les sections d\'une fiche')
def modifier_fiche(
    id_template: int,
    data: dict = Body(...),
    db: Session = Depends(get_db),
):
    fiche = (
        db.query(models.FichePosteTemplate)
        .filter(models.FichePosteTemplate.id_template == id_template)
        .first()
    )
    if not fiche:
        raise HTTPException(status_code=404, detail='Fiche introuvable')

    for field in ('sections', 'fonction', 'fichier_nom'):
        if field in data:
            setattr(fiche, field, data[field])
    fiche.date_modification = datetime.utcnow()
    db.commit()
    db.refresh(fiche)
    return _fiche_to_dict(fiche)


@router.delete('/{id_template}', status_code=status.HTTP_204_NO_CONTENT, summary='Supprimer une fiche de poste')
def supprimer_fiche(id_template: int, db: Session = Depends(get_db)):
    fiche = (
        db.query(models.FichePosteTemplate)
        .filter(models.FichePosteTemplate.id_template == id_template)
        .first()
    )
    if not fiche:
        raise HTTPException(status_code=404, detail='Fiche introuvable')
    db.delete(fiche)
    db.commit()


@router.patch('/{id_template}/titulaires', summary='Assigner manuellement des employés à une fiche')
def assigner_titulaires(
    id_template: int,
    request: Request,
    data: dict = Body(...),
    db: Session = Depends(get_db),
):
    """Met à jour la liste des titulaires (matricules) d'une fiche.
    Tous les employés précédemment assignés qui ne sont plus dans la liste sont détachés.
    Body : { matricules: [str, ...] }
    """
    ctx = _user_context(request, db)
    role = (ctx.get('role') or '').strip().upper()
    if role not in _FULL_ACCESS_ROLES:
        raise HTTPException(status_code=403, detail="Accès refusé")

    fiche = db.query(models.FichePosteTemplate).filter(
        models.FichePosteTemplate.id_template == id_template
    ).first()
    if not fiche:
        raise HTTPException(status_code=404, detail='Fiche introuvable')

    raw = data.get('matricules') or []
    if not isinstance(raw, list):
        raise HTTPException(status_code=400, detail='matricules doit être une liste')
    new_set = {str(m).strip().upper() for m in raw if str(m).strip()}

    # Détacher les anciens titulaires absents de la nouvelle liste
    current = db.query(models.Employe).filter(
        models.Employe.id_fiche_poste == id_template
    ).all()
    for e in current:
        if e.matricule.upper() not in new_set:
            e.id_fiche_poste = None

    # Attacher les nouveaux
    if new_set:
        emps = db.query(models.Employe).filter(
            models.Employe.matricule.in_(list(new_set))
        ).all()
        for e in emps:
            e.id_fiche_poste = id_template

    fiche.date_modification = datetime.utcnow()
    db.commit()
    db.refresh(fiche)
    out = _fiche_to_dict(fiche)
    out['titulaires'] = _titulaires_for(fiche, db)
    out['nb_titulaires'] = len(out['titulaires'])
    return out


@router.patch('/{id_template}/fonction', summary='[LEGACY] Réassigner une fiche à une autre fonction', deprecated=True)
def reassigner_fiche(
    id_template: int,
    request: Request,
    data: dict = Body(...),
    db: Session = Depends(get_db),
):
    """DEPRECATED : utiliser PATCH /{id_template}/titulaires."""
    ctx = _user_context(request, db)
    role = (ctx.get('role') or '').strip().upper()
    if role not in _FULL_ACCESS_ROLES:
        raise HTTPException(status_code=403, detail="Accès refusé")

    nouvelle = (data.get('fonction') or '').strip()
    if not nouvelle:
        raise HTTPException(status_code=400, detail='Le nom de la fonction est obligatoire')

    fiche = db.query(models.FichePosteTemplate).filter(
        models.FichePosteTemplate.id_template == id_template
    ).first()
    if not fiche:
        raise HTTPException(status_code=404, detail='Fiche introuvable')

    if fiche.fonction != nouvelle:
        collision = db.query(models.FichePosteTemplate).filter(
            models.FichePosteTemplate.fonction == nouvelle,
            models.FichePosteTemplate.id_template != id_template,
        ).first()
        if collision:
            raise HTTPException(status_code=409, detail=f"Une fiche existe déjà pour la fonction « {nouvelle} »")
        fiche.fonction = nouvelle
        fiche.date_modification = datetime.utcnow()
        db.commit()
        db.refresh(fiche)
    return _fiche_to_dict(fiche)


# ── OL counter fix ────────────────────────────────────────────────────────────

_OL_RESET_TAGS = {'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr'}


def _in_ol(el, root) -> bool:
    """Return True if el is nested inside an <ol> element (not counting root)."""
    from bs4 import Tag as _Tag
    p = el.parent
    while p and p is not root:
        if isinstance(p, _Tag) and p.name == 'ol':
            return True
        p = p.parent
    return False


def _fix_ol_counters(html: str) -> str:
    """Fix <ol start="…"> so TipTap-generated split lists count 1 2 3 instead of 1 1 1.

    Uses document-order traversal: finds every <ol> not nested inside another
    <ol> and numbers them continuously, resetting ONLY at heading elements
    (h1-h6, hr). <ul>, <table>, <p>, <div> do NOT reset the counter.
    """
    if not html or '<ol' not in html:
        return html
    from bs4 import BeautifulSoup, Tag
    soup = BeautifulSoup(f'<div>{html}</div>', 'html.parser')
    root = soup.find('div')
    cumulative = 0
    for el in root.descendants:
        if not isinstance(el, Tag):
            continue
        if el.name in _OL_RESET_TAGS and not _in_ol(el, root):
            cumulative = 0
        elif el.name == 'ol' and not _in_ol(el, root):
            direct_li = [c for c in el.children if isinstance(c, Tag) and c.name == 'li']
            if cumulative > 0:
                el['start'] = str(cumulative + 1)
            cumulative += len(direct_li)
    return root.decode_contents()


def _build_pdf_html(fiche: models.FichePosteTemplate, titulaires: list, logo_path: Optional[str] = None) -> str:
    """Construit l'HTML complet pour l'export PDF (en-tête + html_content)."""
    html_body = (fiche.html_content or '').strip()
    html_body = _fix_ol_counters(html_body)
    if not html_body:
        # Fallback : reconstruire depuis sections JSON
        parts = []
        for s in (fiche.sections or []):
            titre = (s.get('titre') or '').strip()
            if titre:
                parts.append(f'<h2>{titre}</h2>')
            for line in (s.get('contenu') or []):
                parts.append(f'<p>{line}</p>')
        html_body = '\n'.join(parts)

    titulaires_html = ''
    if titulaires:
        items = ', '.join(f"{t['prenom']} {t['nom']}" for t in titulaires)
        label = 'Titulaires' if len(titulaires) > 1 else 'Titulaire'
        titulaires_html = (
            f'<div class="titulaires"><span class="lbl">{label} du poste : </span>'
            f'<span class="vals">{items}</span></div>'
        )

    # Chemin absolu des fonts dans le container (ou sur l'hôte si hors Docker)
    import os as _os
    _fonts_dir = _os.path.join(_os.path.dirname(__file__), '..', 'fonts')
    _fonts_dir = _os.path.abspath(_fonts_dir)
    _font_regular = _os.path.join(_fonts_dir, 'GOTHIC.TTF').replace('\\', '/')
    _font_bold    = _os.path.join(_fonts_dir, 'GOTHICB.TTF').replace('\\', '/')
    _font_italic  = _os.path.join(_fonts_dir, 'GOTHICI.TTF').replace('\\', '/')

    return f"""<!doctype html>
<html lang=\"fr\"><head><meta charset=\"utf-8\"/><title>Fiche de poste – {fiche.fonction}</title>
<style>
  @font-face {{ font-family: 'Century Gothic'; font-weight: 400; font-style: normal;  src: url('file://{_font_regular}'); }}
  @font-face {{ font-family: 'Century Gothic'; font-weight: 700; font-style: normal;  src: url('file://{_font_bold}'); }}
  @font-face {{ font-family: 'Century Gothic'; font-weight: 400; font-style: italic;  src: url('file://{_font_italic}'); }}
  @page {{ size: A4; margin: 6mm 14mm 18mm 14mm; }}
  html, body {{ margin: 0; padding: 0; }}
  body {{ font-family: 'Century Gothic', CenturyGothic, 'AppleGothic', sans-serif; font-size: 10.5pt; color: #1a1a1a; }}
  .head {{ background: #021630; color: #fff; padding: 14px 18px; border-bottom: 3px solid #c00000; overflow: hidden; }}
  .head h1 {{ color: #fff !important; margin: 4px 0 2px 0; font-size: 14pt; letter-spacing: 0.02em; }}
  .head .fct {{ font-size: 11pt; font-weight: 600; color: #c9d8f0; }}
  .titulaires {{ margin-top: 8px; padding-top: 6px; border-top: 1px solid rgba(255,255,255,0.18); font-size: 9pt; }}
  .titulaires .lbl {{ opacity: 0.7; }}
  .titulaires .vals {{ font-weight: 600; color: #f0f4ff; }}
  .body {{ padding: 14px 4px; }}
  table {{ border-collapse: collapse; width: 100%; margin: 8px 0; }}
  td, th {{ border: 1px solid #d1d5db; padding: 6px 9px; vertical-align: top; }}
  h1, h2, h3 {{ color: #021630; }}
  h2 {{ font-size: 11.5pt; border-bottom: 1px solid #c00000; padding-bottom: 3px; margin: 14px 0 6px; }}
  ul {{ padding-left: 18px; list-style-type: disc; }}
  ol {{ padding-left: 22px; margin: 4px 0; list-style-type: decimal; }}
  li {{ margin: 2px 0; }}
  p {{ margin: 4px 0; }}
  .fp-red {{ color: #c00000 !important; font-weight: 600; }}
  .fp-red * {{ color: #c00000 !important; }}
  .head-logo {{ height: 60px; width: auto; display: block; margin: 0 0 24px 0; }}
  img:not(.head-logo) {{ display: none !important; }}
</style></head>
<body>
  {f'<img src="file://{logo_path}" class="head-logo" alt="logo" />' if logo_path else ''}
  <div class=\"head\">
    <div class=\"head-text\">
      <h1>FICHE DE POSTE</h1>
      <div class=\"fct\">{fiche.fonction}</div>
      {titulaires_html}
    </div>
  </div>
  <div class=\"body\">{html_body}</div>
</body></html>"""


@router.get('/{id_template}/pdf', summary='Exporter une fiche de poste en PDF')
def exporter_pdf(id_template: int, request: Request, matricule: Optional[str] = Query(None), db: Session = Depends(get_db)):
    """Génère un PDF du rendu HTML mammoth (sans les sections de signatures)."""
    fiche = db.query(models.FichePosteTemplate).filter(
        models.FichePosteTemplate.id_template == id_template
    ).first()
    if not fiche:
        raise HTTPException(status_code=404, detail='Fiche introuvable')

    # Vérification scope
    ctx = _user_context(request, db)
    role = (ctx.get('role') or '').strip().upper()
    emp_ctx = ctx.get('employe')
    own_fiche_id = emp_ctx.id_fiche_poste if emp_ctx else None

    if role in _FULL_ACCESS_ROLES:
        pass  # tout autorisé
    else:
        # Autorisé si : fiche assignée directement OU même fonction que l'employé
        is_own = (own_fiche_id == fiche.id_template)
        is_same_fonction = (emp_ctx is not None and emp_ctx.fonction == fiche.fonction)
        if is_own or is_same_fonction:
            pass  # accès autorisé
        else:
            allowed = _scoped_fonctions(ctx, db)
            if allowed is None or (allowed and fiche.fonction in allowed):
                pass  # scope plus large autorisé
            else:
                raise HTTPException(status_code=403, detail='Accès refusé à cette fiche')

    titulaires_rows = _titulaires_for(fiche, db)
    titulaires_data = [
        {'matricule': t['matricule'], 'nom': t['nom'] or '', 'prenom': t['prenom'] or ''}
        for t in titulaires_rows
    ]

    logo_path = _get_logo_path(matricule, db) if matricule else None
    full_html = _build_pdf_html(fiche, titulaires_data, logo_path)

    # Tenter WeasyPrint
    try:
        from weasyprint import HTML  # type: ignore
        pdf_bytes = HTML(string=full_html).write_pdf()
    except Exception:
        # Fallback : retourner l'HTML imprimable (le navigateur peut imprimer en PDF)
        return Response(
            content=full_html,
            media_type='text/html; charset=utf-8',
            headers={'Content-Disposition': f'inline; filename=\"fiche_{id_template}.html\"'},
        )

    safe_name = re.sub(r'[^A-Za-z0-9._-]+', '_', fiche.fonction or f'fiche_{id_template}')
    return Response(
        content=pdf_bytes,
        media_type='application/pdf',
        headers={'Content-Disposition': f'attachment; filename=\"fiche_poste_{safe_name}.pdf\"'},
    )
