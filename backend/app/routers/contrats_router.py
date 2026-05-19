"""
Router : Gestion des contrats (CDD/CDI/Stagiaire) + alertes + lettres PDF.
"""
import os
import io
from datetime import date, datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy.orm import Session
from ..db import get_db
from .. import models

router = APIRouter(prefix='/api/contrats', tags=['contrats'])

# ── Font / logo helpers (partagés avec pdf_router) ──────────────────────────
_FONTS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'fonts')
_CG_REGULAR = os.path.join(_FONTS_DIR, 'GOTHIC.TTF')
_CG_BOLD    = os.path.join(_FONTS_DIR, 'GOTHICB.TTF')
_LOGOS_DIR  = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'logos')
_ENTITY_LOGOS = {
    'ELCAM': os.path.join(_LOGOS_DIR, 'elcam.jpg'),
    'EXCA':  os.path.join(_LOGOS_DIR, 'exca.jpg'),
    'ECG':   os.path.join(_LOGOS_DIR, 'ecg.jpg'),
}
BRAND_COLOR  = (17, 32, 51)
ACCENT_COLOR = (206, 43, 43)


def _logo_path(emp, db: Session) -> Optional[str]:
    if not emp or not emp.id_entite:
        return None
    entite = db.query(models.Entite).filter(models.Entite.id_entite == emp.id_entite).first()
    if not entite:
        return None
    p = _ENTITY_LOGOS.get((entite.nom or '').upper())
    return p if p and os.path.exists(p) else None


# ── Schemas Pydantic ─────────────────────────────────────────────────────────

class ContratUpdateSchema(BaseModel):
    type_contrat: str  # CDI | CDD | Stagiaire
    date_debut_contrat: Optional[date] = None
    date_fin_contrat: Optional[date] = None


class ActionContratSchema(BaseModel):
    action: str  # renouvellement | arret | confirmation_cdi
    date_fin_nouvelle: Optional[date] = None
    signature_data: Optional[str] = None
    fait_par: str  # matricule RH


class GenerateLettreSchema(BaseModel):
    type_lettre: str  # renouvellement | arret | confirmation_cdi | info_contrat
    date_fin_nouvelle: Optional[date] = None
    signature_data: Optional[str] = None
    fait_par: str


# ── Endpoints contrat ────────────────────────────────────────────────────────

@router.get('/alertes')
def get_alertes(db: Session = Depends(get_db)):
    """Retourne toutes les alertes actives triées par urgence (J2 d'abord)."""
    alertes = (
        db.query(models.AlerteContrat)
        .filter(models.AlerteContrat.statut == models.StatutAlerteContratEnum.ACTIVE)
        .order_by(models.AlerteContrat.type_alerte.asc(), models.AlerteContrat.date_generee.asc())
        .all()
    )
    result = []
    for a in alertes:
        emp = db.query(models.Employe).filter(models.Employe.matricule == a.employe_id).first()
        result.append({
            'id': a.id,
            'employe_id': a.employe_id,
            'nom': f"{emp.prenom} {emp.nom}" if emp else a.employe_id,
            'fonction': emp.fonction if emp else None,
            'type_contrat': emp.type_contrat.value if emp and emp.type_contrat else None,
            'date_fin_contrat': emp.date_fin_contrat.isoformat() if emp and emp.date_fin_contrat else None,
            'type_alerte': a.type_alerte.value,
            'date_generee': a.date_generee.isoformat(),
        })
    return result


@router.get('/employe/{matricule}')
def get_contrat_employe(matricule: str, db: Session = Depends(get_db)):
    """Retourne les informations contrat d'un employé."""
    emp = db.query(models.Employe).filter(models.Employe.matricule == matricule).first()
    if not emp:
        raise HTTPException(status_code=404, detail='Employé non trouvé')
    return {
        'matricule': emp.matricule,
        'nom': f"{emp.prenom} {emp.nom}",
        'type_contrat': emp.type_contrat.value if emp.type_contrat else 'CDI',
        'date_debut_contrat': emp.date_debut_contrat.isoformat() if emp.date_debut_contrat else None,
        'date_fin_contrat': emp.date_fin_contrat.isoformat() if emp.date_fin_contrat else None,
    }


@router.put('/employe/{matricule}')
def update_contrat_employe(matricule: str, body: ContratUpdateSchema, db: Session = Depends(get_db)):
    """Met à jour le type de contrat et les dates d'un employé."""
    emp = db.query(models.Employe).filter(models.Employe.matricule == matricule).first()
    if not emp:
        raise HTTPException(status_code=404, detail='Employé non trouvé')
    old_contrat = getattr(emp.type_contrat, 'value', '') or ''
    try:
        emp.type_contrat = models.TypeContratEnum(body.type_contrat)
    except ValueError:
        raise HTTPException(status_code=400, detail='type_contrat invalide')
    emp.date_debut_contrat = body.date_debut_contrat
    emp.date_fin_contrat = body.date_fin_contrat if body.type_contrat != 'CDI' else None
    db.commit()
    # Enregistrer la promotion dans le parcours si CDD/Stagiaire → CDI
    new_contrat = body.type_contrat
    if old_contrat and new_contrat and old_contrat != new_contrat:
        try:
            from ..utils import parcours as _parcours
            _parcours.record_employee_diff(
                db, matricule,
                {'type_contrat': old_contrat},
                {'type_contrat': new_contrat},
            )
        except Exception:
            pass
    return {'ok': True}


@router.post('/action/{matricule}')
def action_contrat(matricule: str, body: ActionContratSchema, db: Session = Depends(get_db)):
    """Traite une alerte : renouvellement / arrêt / confirmation CDI."""
    emp = db.query(models.Employe).filter(models.Employe.matricule == matricule).first()
    if not emp:
        raise HTTPException(status_code=404, detail='Employé non trouvé')

    valid_actions = {'renouvellement', 'arret', 'confirmation_cdi'}
    if body.action not in valid_actions:
        raise HTTPException(status_code=400, detail='Action invalide')

    # Fermer les alertes actives pour cet employé
    alertes = (
        db.query(models.AlerteContrat)
        .filter(
            models.AlerteContrat.employe_id == matricule,
            models.AlerteContrat.statut == models.StatutAlerteContratEnum.ACTIVE,
        )
        .all()
    )
    for a in alertes:
        a.statut = models.StatutAlerteContratEnum.TRAITEE
        a.action = models.ActionAlerteContratEnum(body.action)
        a.date_traitee = datetime.utcnow()
        a.traite_par = body.fait_par

    # Appliquer l'action sur le contrat
    old_contrat = getattr(emp.type_contrat, 'value', '') or ''
    if body.action == 'renouvellement':
        if not body.date_fin_nouvelle:
            raise HTTPException(status_code=400, detail='date_fin_nouvelle requise pour renouvellement')
        emp.date_fin_contrat = body.date_fin_nouvelle
    elif body.action == 'confirmation_cdi':
        emp.type_contrat = models.TypeContratEnum.CDI
        emp.date_fin_contrat = None
    # arret → ne pas modifier le contrat, juste logger

    db.commit()
    # Enregistrer la promotion dans le parcours si confirmation CDI
    if body.action == 'confirmation_cdi' and old_contrat and old_contrat != 'CDI':
        try:
            from ..utils import parcours as _parcours
            _parcours.record_employee_diff(
                db, matricule,
                {'type_contrat': old_contrat},
                {'type_contrat': 'CDI'},
                actor=body.fait_par,
            )
        except Exception:
            pass
    return {'ok': True, 'action': body.action}


@router.post('/lettre/{matricule}')
def generer_lettre(matricule: str, body: GenerateLettreSchema, db: Session = Depends(get_db)):
    """Génère une lettre PDF et retourne le PDF en bytes."""
    emp = db.query(models.Employe).filter(models.Employe.matricule == matricule).first()
    if not emp:
        raise HTTPException(status_code=404, detail='Employé non trouvé')

    pdf_bytes = _build_lettre_pdf(emp, body, db)

    # Enregistrement en base
    lettre = models.LettreRH(
        employe_id=matricule,
        type_lettre=models.TypeLettreRHEnum(body.type_lettre),
        pdf_path=None,
        signature_data=body.signature_data,
        genere_par=body.fait_par,
        date_fin_nouvelle=body.date_fin_nouvelle,
    )
    db.add(lettre)
    db.commit()

    nom_fichier = f"lettre_{body.type_lettre}_{matricule}_{date.today().isoformat()}.pdf"
    return Response(
        content=pdf_bytes,
        media_type='application/pdf',
        headers={'Content-Disposition': f'attachment; filename="{nom_fichier}"'},
    )


@router.get('/lettres/{matricule}')
def historique_lettres(matricule: str, db: Session = Depends(get_db)):
    """Retourne l'historique des lettres générées pour un employé."""
    lettres = (
        db.query(models.LettreRH)
        .filter(models.LettreRH.employe_id == matricule)
        .order_by(models.LettreRH.date_generation.desc())
        .all()
    )
    return [
        {
            'id': l.id,
            'type_lettre': l.type_lettre.value,
            'date_generation': l.date_generation.isoformat(),
            'genere_par': l.genere_par,
            'date_fin_nouvelle': l.date_fin_nouvelle.isoformat() if l.date_fin_nouvelle else None,
        }
        for l in lettres
    ]


# ── PDF builder ──────────────────────────────────────────────────────────────

_TITRES_LETTRES = {
    'renouvellement': 'LETTRE DE RENOUVELLEMENT DE CONTRAT',
    'arret': "LETTRE D'ARRÊT DE CONTRAT",
    'confirmation_cdi': 'LETTRE DE CONFIRMATION EN CDI',
    'info_contrat': 'INFORMATION RELATIVE AU CONTRAT',
}

_CORPS_LETTRES = {
    'renouvellement': (
        "Nous avons le plaisir de vous informer que votre contrat de travail "
        "à durée déterminée est renouvelé pour une nouvelle période. "
        "La nouvelle date d'échéance est fixée au {date_fin}. "
        "\n\nVous voudrez bien nous retourner un exemplaire signé de la présente lettre "
        "en guise d'acceptation."
    ),
    'arret': (
        "Nous vous informons que votre contrat de travail à durée déterminée "
        "arrivera à son terme à la date prévue et ne sera pas renouvelé. "
        "\n\nNous vous remercions pour votre collaboration et vous souhaitons "
        "plein succès dans vos projets futurs."
    ),
    'confirmation_cdi': (
        "Nous avons le plaisir de vous confirmer votre intégration définitive "
        "au sein de notre entreprise sous la forme d'un Contrat à Durée Indéterminée (CDI), "
        "avec effet à compter de ce jour. "
        "\n\nVos conditions de travail demeurent inchangées par rapport à votre précédent contrat."
    ),
    'info_contrat': (
        "Veuillez trouver ci-après les informations relatives à votre situation contractuelle "
        "au sein de notre organisation."
    ),
}


def _build_lettre_pdf(emp, body: GenerateLettreSchema, db: Session) -> bytes:
    from fpdf import FPDF
    import base64

    pdf = FPDF(format='A4')
    pdf.set_auto_page_break(auto=True, margin=20)
    pdf.add_page()

    # Fonts
    has_cg = os.path.exists(_CG_REGULAR) and os.path.exists(_CG_BOLD)
    if has_cg:
        pdf.add_font('CenturyGothic', '', _CG_REGULAR, uni=True)
        pdf.add_font('CenturyGothic', 'B', _CG_BOLD, uni=True)
        font_name = 'CenturyGothic'
    else:
        font_name = 'Helvetica'

    # Logo
    logo = _logo_path(emp, db)
    if logo:
        pdf.image(logo, x=155, y=8, w=40)

    # En-tête entité
    pdf.set_font(font_name, 'B', 14)
    pdf.set_text_color(*BRAND_COLOR)
    pdf.set_xy(14, 12)
    pdf.cell(0, 8, 'ELITE CAPITAL GROUP', ln=1)

    pdf.set_font(font_name, '', 9)
    pdf.set_text_color(80, 80, 80)
    pdf.set_x(14)
    pdf.cell(0, 5, f"Direction des Ressources Humaines", ln=1)
    pdf.ln(8)

    # Ligne de séparation
    pdf.set_draw_color(*ACCENT_COLOR)
    pdf.set_line_width(0.8)
    pdf.line(14, pdf.get_y(), 196, pdf.get_y())
    pdf.ln(6)

    # Date et lieu
    pdf.set_font(font_name, '', 9)
    pdf.set_text_color(80, 80, 80)
    pdf.set_x(14)
    today_str = date.today().strftime('%d/%m/%Y')
    pdf.cell(0, 5, f"Yaoundé, le {today_str}", align='R', ln=1)
    pdf.ln(4)

    # Destinataire
    pdf.set_font(font_name, 'B', 10)
    pdf.set_text_color(*BRAND_COLOR)
    pdf.set_x(14)
    pdf.cell(0, 6, f"À : {emp.prenom} {emp.nom}", ln=1)
    if emp.fonction:
        pdf.set_font(font_name, '', 9)
        pdf.set_text_color(80, 80, 80)
        pdf.set_x(14)
        pdf.cell(0, 5, f"Fonction : {emp.fonction}", ln=1)
    pdf.ln(8)

    # Titre lettre
    titre = _TITRES_LETTRES.get(body.type_lettre, 'LETTRE RH')
    pdf.set_font(font_name, 'B', 13)
    pdf.set_text_color(*BRAND_COLOR)
    pdf.set_x(14)
    pdf.cell(0, 8, titre, align='C', ln=1)
    pdf.ln(4)
    pdf.set_draw_color(*BRAND_COLOR)
    pdf.set_line_width(0.4)
    pdf.line(14, pdf.get_y(), 196, pdf.get_y())
    pdf.ln(8)

    # Objet
    pdf.set_font(font_name, 'B', 10)
    pdf.set_text_color(*BRAND_COLOR)
    pdf.set_x(14)
    type_c = emp.type_contrat.value if emp.type_contrat else 'CDD'
    pdf.cell(0, 6, f"Objet : {titre.title()} — {type_c}", ln=1)
    pdf.ln(4)

    # Formule d'appel
    civilite = 'Madame' if (emp.sexe and emp.sexe.value == 'F') else 'Monsieur'
    pdf.set_font(font_name, '', 10)
    pdf.set_text_color(40, 40, 40)
    pdf.set_x(14)
    pdf.cell(0, 6, f"{civilite} {emp.prenom} {emp.nom},", ln=1)
    pdf.ln(3)

    # Corps
    corps_template = _CORPS_LETTRES.get(body.type_lettre, '')
    date_fin_str = body.date_fin_nouvelle.strftime('%d/%m/%Y') if body.date_fin_nouvelle else '—'
    corps = corps_template.format(date_fin=date_fin_str)

    pdf.set_font(font_name, '', 10)
    pdf.set_x(14)
    pdf.multi_cell(182, 6, corps)
    pdf.ln(10)

    # Bloc infos contrat
    pdf.set_fill_color(240, 244, 250)
    pdf.set_draw_color(*BRAND_COLOR)
    pdf.set_line_width(0.3)
    pdf.rect(14, pdf.get_y(), 182, 28, 'DF')
    y0 = pdf.get_y() + 4
    pdf.set_font(font_name, 'B', 9)
    pdf.set_text_color(*BRAND_COLOR)
    pdf.set_xy(18, y0)
    pdf.cell(88, 5, f"Type de contrat : {type_c}", ln=0)
    pdf.set_xy(106, y0)
    pdf.cell(88, 5, f"Date d'embauche : {emp.date_embauche.strftime('%d/%m/%Y') if emp.date_embauche else '—'}", ln=1)
    pdf.set_font(font_name, '', 9)
    pdf.set_text_color(60, 60, 60)
    pdf.set_xy(18, y0 + 8)
    date_fin_contrat_str = emp.date_fin_contrat.strftime('%d/%m/%Y') if emp.date_fin_contrat else 'Indéterminée'
    pdf.cell(88, 5, f"Date de fin : {date_fin_contrat_str}", ln=0)
    if body.date_fin_nouvelle:
        pdf.set_xy(106, y0 + 8)
        pdf.cell(88, 5, f"Nouvelle échéance : {date_fin_str}", ln=1)
    pdf.ln(20)

    # Formule de politesse
    pdf.set_font(font_name, '', 10)
    pdf.set_text_color(40, 40, 40)
    pdf.set_x(14)
    pdf.multi_cell(182, 6,
        "Veuillez agréer, " + civilite + ", l'expression de nos salutations distinguées.")
    pdf.ln(10)

    # Espace signature RH
    y_sig = pdf.get_y()
    pdf.set_font(font_name, 'B', 9)
    pdf.set_text_color(*BRAND_COLOR)
    pdf.set_xy(14, y_sig)
    pdf.cell(88, 5, 'La Direction des Ressources Humaines', ln=0)
    pdf.set_xy(106, y_sig)
    pdf.cell(88, 5, f"{civilite} {emp.prenom} {emp.nom}", ln=1)

    # Signature canvas (base64 PNG)
    if body.signature_data:
        try:
            # Peut commencer par "data:image/png;base64,"
            sig_b64 = body.signature_data.split(',')[-1]
            sig_bytes = base64.b64decode(sig_b64)
            sig_path = f"/tmp/sig_{emp.matricule}_{int(datetime.utcnow().timestamp())}.png"
            with open(sig_path, 'wb') as f:
                f.write(sig_bytes)
            pdf.image(sig_path, x=106, y=y_sig + 6, w=60, h=20)
            try:
                os.remove(sig_path)
            except OSError:
                pass
        except Exception:
            pass

    # Pied de page
    pdf.set_y(-20)
    pdf.set_font(font_name, '', 7)
    pdf.set_text_color(150, 150, 150)
    pdf.line(14, pdf.get_y(), 196, pdf.get_y())
    pdf.ln(2)
    pdf.cell(0, 4, 'ELITE CAPITAL GROUP S.A — Document généré par EMS — Confidentiel', align='C')

    return pdf.output(dest='S').encode('latin-1') if isinstance(pdf.output(dest='S'), str) else bytes(pdf.output(dest='S'))
