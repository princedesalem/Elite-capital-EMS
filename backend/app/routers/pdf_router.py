"""
Router pour l'export PDF des opérations avec résumé et historique de workflow.
"""
import os
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import Response
from sqlalchemy.orm import Session
from ..db import get_db
from .. import models
from fpdf import FPDF
from datetime import datetime

# ── Century Gothic font setup (fallback to Helvetica if TTF not present) ─────
_FONTS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'fonts')
_CG_REGULAR = os.path.join(_FONTS_DIR, 'GOTHIC.TTF')
_CG_BOLD = os.path.join(_FONTS_DIR, 'GOTHICB.TTF')
_CG_ITALIC = os.path.join(_FONTS_DIR, 'GOTHICI.TTF')
# NOTE: checked dynamically per-request in PDFReport.__init__ so no restart needed

router = APIRouter(prefix='/api/pdf', tags=['pdf'])

# ── Couleurs & constantes ────────────────────────────────────────────────────
BRAND_COLOR = (17, 32, 51)       # #112033
ACCENT_COLOR = (206, 43, 43)     # #ce2b2b
HEADER_BG = (240, 242, 245)
TABLE_HEADER_BG = (17, 32, 51)
TABLE_HEADER_FG = (255, 255, 255)
TABLE_ALT_BG = (248, 249, 251)
STATUS_COLORS = {
    'validé': (39, 174, 96),
    'refusé': (231, 76, 60),
    'en attente': (243, 156, 18),
    'annulé': (149, 165, 166),
}


class PDFReport(FPDF):
    def __init__(self, title=''):
        super().__init__()
        self._title = title
        self.set_auto_page_break(auto=True, margin=20)
        # Evaluate at generation time so fonts copied after startup work immediately
        has_cg = os.path.exists(_CG_REGULAR) and os.path.exists(_CG_BOLD)
        if has_cg:
            self.add_font('CenturyGothic', '', _CG_REGULAR)
            self.add_font('CenturyGothic', 'B', _CG_BOLD)
            if os.path.exists(_CG_ITALIC):
                self.add_font('CenturyGothic', 'I', _CG_ITALIC)
        self._body_font = 'CenturyGothic' if has_cg else 'Helvetica'
        self._body_font_italic = 'I' if (not has_cg or os.path.exists(_CG_ITALIC)) else ''

    def header(self):
        self.set_font(self._body_font, 'B', 18)
        self.set_text_color(*BRAND_COLOR)
        self.cell(0, 8, 'ELITE CAPITAL GROUP', new_x='LMARGIN', new_y='NEXT')
        self.set_font(self._body_font, '', 9)
        self.set_text_color(120, 120, 120)
        self.cell(0, 5, 'EMS Platform - Document officiel', new_x='LMARGIN', new_y='NEXT')
        self.ln(2)
        # Title bar
        self.set_fill_color(*ACCENT_COLOR)
        self.set_text_color(255, 255, 255)
        self.set_font(self._body_font, 'B', 13)
        self.cell(0, 10, f'  {self._title}', fill=True, new_x='LMARGIN', new_y='NEXT')
        self.ln(4)
        self.set_text_color(0, 0, 0)

    def footer(self):
        self.set_y(-15)
        self.set_font(self._body_font, self._body_font_italic, 8)
        self.set_text_color(150, 150, 150)
        self.cell(0, 10, f'Généré le {datetime.utcnow().strftime("%d/%m/%Y à %H:%M")} - Page {self.page_no()}/{{nb}}', align='C')

    def section_title(self, title):
        self.ln(3)
        self.set_font(self._body_font, 'B', 11)
        self.set_text_color(*BRAND_COLOR)
        self.cell(0, 7, title, new_x='LMARGIN', new_y='NEXT')
        self.set_draw_color(*ACCENT_COLOR)
        self.line(self.l_margin, self.get_y(), self.w - self.r_margin, self.get_y())
        self.ln(3)
        self.set_text_color(0, 0, 0)

    def info_row(self, label, value):
        self.set_font(self._body_font, 'B', 9)
        self.cell(55, 6, label, new_x='END')
        self.set_font(self._body_font, '', 9)
        self.cell(0, 6, str(value or '-'), new_x='LMARGIN', new_y='NEXT')

    def status_badge(self, statut):
        color = STATUS_COLORS.get(str(statut or '').lower(), (100, 100, 100))
        self.set_fill_color(*color)
        self.set_text_color(255, 255, 255)
        self.set_font(self._body_font, 'B', 9)
        w = self.get_string_width(str(statut)) + 8
        self.cell(w, 7, f' {statut} ', fill=True)
        self.set_text_color(0, 0, 0)
        self.ln(8)

    def table(self, headers, rows, col_widths=None):
        if not col_widths:
            available = self.w - self.l_margin - self.r_margin
            col_widths = [available / len(headers)] * len(headers)
        # Header
        self.set_fill_color(*TABLE_HEADER_BG)
        self.set_text_color(*TABLE_HEADER_FG)
        self.set_font(self._body_font, 'B', 8)
        for i, h in enumerate(headers):
            self.cell(col_widths[i], 7, h, border=1, fill=True)
        self.ln()
        # Rows
        self.set_text_color(0, 0, 0)
        self.set_font(self._body_font, '', 8)
        for row_idx, row in enumerate(rows):
            if row_idx % 2 == 1:
                self.set_fill_color(*TABLE_ALT_BG)
                fill = True
            else:
                self.set_fill_color(255, 255, 255)
                fill = True
            for i, cell_val in enumerate(row):
                self.cell(col_widths[i], 6, str(cell_val or '-'), border=1, fill=fill)
            self.ln()


def _get_workflow_history(id_operation: int, db: Session):
    """Get full validation workflow history for an operation."""
    validations = db.query(models.Validation).filter(
        models.Validation.id_operation == id_operation
    ).order_by(models.Validation.timestamp_action).all()

    history = []
    for val in validations:
        validateur = db.query(models.Employe).filter(
            models.Employe.matricule == val.matricule_validateur
        ).first()
        history.append({
            'role': val.role_validateur or '-',
            'nom': f"{validateur.prenom} {validateur.nom}" if validateur else str(val.matricule_validateur),
            'statut': val.statut_validation or '-',
            'date': val.timestamp_action.strftime('%d/%m/%Y %H:%M') if val.timestamp_action else '-',
            'commentaire': val.commentaire or '',
        })
    return history


def _get_employee_info(matricule: int, db: Session):
    """Get employee basic info."""
    emp = db.query(models.Employe).filter(models.Employe.matricule == matricule).first()
    if not emp:
        return {'nom': 'Inconnu', 'prenom': '', 'fonction': '', 'matricule': matricule}
    return {
        'nom': emp.nom or '',
        'prenom': emp.prenom or '',
        'fonction': emp.fonction or '',
        'matricule': emp.matricule,
    }


def _add_remplacants_section(pdf: PDFReport, id_operation: int, db: Session):
    """Add accepted replacements section to a PDF if any exist."""
    remplacants = db.query(models.RemplacantPropose).filter(
        models.RemplacantPropose.id_operation == id_operation,
        models.RemplacantPropose.est_accepte == True,
    ).all()
    if not remplacants:
        return
    pdf.section_title('Remplaçant(s) accepté(s)')
    rows = []
    for r in remplacants:
        emp = db.query(models.Employe).filter(models.Employe.matricule == r.matricule_remplacant).first()
        nom = f"{emp.prenom or ''} {emp.nom or ''}".strip() if emp else str(r.matricule_remplacant)
        fonction = emp.fonction or '-' if emp else '-'
        rows.append([str(r.matricule_remplacant), nom, fonction])
    pdf.table(
        ['Matricule', 'Nom complet', 'Fonction'],
        rows,
        col_widths=[30, 80, 60]
    )


# ── Mission PDF ──────────────────────────────────────────────────────────────

@router.get('/mission/{id_mission}')
def export_mission_pdf(id_mission: int, db: Session = Depends(get_db)):
    mission = db.query(models.Mission).filter(models.Mission.id_mission == id_mission).first()
    if not mission:
        raise HTTPException(status_code=404, detail="Mission introuvable")

    operation = db.query(models.Operation).filter(models.Operation.id_operation == id_mission).first()
    if not operation:
        raise HTTPException(status_code=404, detail="Opération introuvable")

    demandeur = _get_employee_info(operation.matricule, db)

    pdf = PDFReport(title='ORDRE DE MISSION')
    pdf.alias_nb_pages()
    pdf.add_page()

    # Summary
    pdf.section_title('Informations générales')
    pdf.info_row('N° Mission:', str(id_mission))
    pdf.info_row('Demandeur:', f"{demandeur['prenom']} {demandeur['nom']} ({demandeur['matricule']})")
    pdf.info_row('Fonction:', demandeur['fonction'])
    pdf.info_row('Destination:', f"{mission.ville or ''}, {mission.pays or ''}")
    pdf.info_row('Date début:', str(operation.date_debut or '-'))
    pdf.info_row('Date fin:', str(operation.date_fin or '-'))
    pdf.info_row('Motif:', operation.motif or '-')
    pdf.info_row('Commentaire:', mission.mission_comment or '-')
    pdf.info_row('Statut:', '')
    pdf.status_badge(operation.statut or 'en attente')

    # Segments
    segments = db.query(models.MissionSegment).filter(
        models.MissionSegment.id_mission == id_mission
    ).order_by(models.MissionSegment.ordre).all()

    if segments:
        pdf.section_title(f'Destinations ({len(segments)} segment(s))')
        seg_rows = []
        for s in segments:
            seg_rows.append([
                str(s.ordre or ''),
                s.pays or '',
                s.ville or '',
                str(s.date_debut or ''),
                str(s.date_fin or ''),
                s.moyen_transport or '',
                str(s.nombre_nuits or 0),
            ])
        pdf.table(
            ['#', 'Pays', 'Ville', 'Début', 'Fin', 'Transport', 'Nuits'],
            seg_rows,
            col_widths=[10, 30, 30, 25, 25, 30, 20]
        )

    # Missionnaires
    missionnaires = db.query(models.MissionnairesMission).filter(
        models.MissionnairesMission.id_mission == id_mission
    ).all()

    if missionnaires:
        pdf.section_title(f'Missionnaires ({len(missionnaires)})')
        miss_rows = []
        for m in missionnaires:
            emp = _get_employee_info(m.matricule, db)
            miss_rows.append([
                str(m.matricule),
                f"{emp['prenom']} {emp['nom']}",
                emp['fonction'],
                m.role_mission or 'participant',
            ])
        pdf.table(
            ['Matricule', 'Nom complet', 'Fonction', 'Rôle'],
            miss_rows,
            col_widths=[25, 55, 50, 40]
        )

    # Frais
    frais = db.query(models.Frais).filter(models.Frais.id_mission == id_mission).first()
    if frais:
        pdf.section_title('Frais de mission')
        pdf.info_row('Transport:', f"{float(frais.frais_transport_voyage or 0):,.0f} FCFA")
        pdf.info_row('Hôtel:', f"{float(frais.frais_hotel or 0):,.0f} FCFA")
        pdf.info_row('Déplacement:', f"{float(frais.frais_deplacement or 0):,.0f} FCFA")
        pdf.info_row('Nutrition:', f"{float(frais.frais_nutrition or 0):,.0f} FCFA")
        pdf.info_row('Total:', f"{float(frais.total_frais or 0):,.0f} FCFA")

    # Workflow history
    history = _get_workflow_history(id_mission, db)
    pdf.section_title('Historique de validation')
    if history:
        wf_rows = [[h['role'], h['nom'], h['statut'], h['date'], h['commentaire'][:40]] for h in history]
        pdf.table(
            ['Rôle', 'Validateur', 'Décision', 'Date', 'Commentaire'],
            wf_rows,
            col_widths=[30, 40, 25, 35, 40]
        )
    else:
        pdf.set_font(pdf._body_font, pdf._body_font_italic, 9)
        pdf.cell(0, 7, 'Aucune validation enregistrée.', new_x='LMARGIN', new_y='NEXT')

    _add_remplacants_section(pdf, id_mission, db)

    content = bytes(pdf.output())
    return Response(
        content=content,
        media_type='application/pdf',
        headers={'Content-Disposition': f'attachment; filename=mission_{id_mission}.pdf'}
    )


# ── Frais Mission PDF ────────────────────────────────────────────────────────

@router.get('/frais/{id_mission}')
def export_frais_pdf(id_mission: int, db: Session = Depends(get_db)):
    mission = db.query(models.Mission).filter(models.Mission.id_mission == id_mission).first()
    if not mission:
        raise HTTPException(status_code=404, detail="Mission introuvable")

    operation = db.query(models.Operation).filter(models.Operation.id_operation == id_mission).first()
    if not operation:
        raise HTTPException(status_code=404, detail="Opération introuvable")

    miss_list = db.query(models.MissionnairesMission).filter(
        models.MissionnairesMission.id_mission == id_mission
    ).all()
    if miss_list:
        noms = []
        for mm in miss_list:
            emp = db.query(models.Employe).filter(models.Employe.matricule == mm.matricule).first()
            if emp:
                noms.append(f"{emp.prenom or ''} {emp.nom or ''}".strip())
        missionnaires_str = ', '.join(noms) if noms else '-'
    else:
        d = _get_employee_info(operation.matricule, db)
        missionnaires_str = f"{d['prenom']} {d['nom']}"

    pdf = PDFReport(title='FRAIS DE MISSION')
    pdf.alias_nb_pages()
    pdf.add_page()

    pdf.section_title('Informations de la mission')
    pdf.info_row('N° Mission:', str(id_mission))
    pdf.info_row('Missionnaire(s):', missionnaires_str)
    pdf.info_row('Destination:', f"{mission.ville or ''}, {mission.pays or ''}")
    pdf.info_row('Date début:', str(operation.date_debut or '-'))
    pdf.info_row('Date fin:', str(operation.date_fin or '-'))

    # Frais de la demande principale (table Frais)
    frais = db.query(models.Frais).filter(models.Frais.id_mission == id_mission).first()
    if frais:
        pdf.section_title('Frais déclarés')
        frais_rows = []
        if frais.frais_transport_voyage is not None:
            frais_rows.append(['Transport / Voyage', f"{float(frais.frais_transport_voyage):.2f}"])
        if frais.frais_hotel is not None:
            frais_rows.append(['Hébergement', f"{float(frais.frais_hotel):.2f}"])
        if frais.frais_deplacement is not None:
            frais_rows.append(['Déplacement', f"{float(frais.frais_deplacement):.2f}"])
        if frais.frais_nutrition is not None:
            frais_rows.append(['Nutrition / Repas', f"{float(frais.frais_nutrition):.2f}"])
        if frais_rows:
            pdf.table(['Type de frais', 'Montant'], frais_rows, col_widths=[100, 70])
        if frais.total_frais is not None:
            pdf.ln(2)
            pdf.set_font(pdf._body_font, 'B', 10)
            pdf.set_text_color(17, 32, 51)
            pdf.cell(0, 8, f"Total : {float(frais.total_frais):.2f}", new_x='LMARGIN', new_y='NEXT')
            pdf.set_text_color(0, 0, 0)

    # Frais par missionnaire (table FraisMissionnaire)
    frais_miss = db.query(models.FraisMissionnaire).filter(
        models.FraisMissionnaire.id_mission == id_mission
    ).all()
    if frais_miss:
        pdf.section_title('Frais par missionnaire')
        fm_rows = []
        total_global = 0.0
        for fm in frais_miss:
            emp = db.query(models.Employe).filter(models.Employe.matricule == fm.matricule).first()
            nom = f"{emp.prenom or ''} {emp.nom or ''}".strip() if emp else str(fm.matricule)
            transport = float(fm.frais_transport or 0)
            hotel = float(fm.frais_hotel or 0)
            deplacement = float(fm.frais_deplacement or 0)
            nutrition = float(fm.frais_nutrition or 0)
            total = float(fm.total_frais or 0)
            total_global += total
            fm_rows.append([
                nom,
                f"{transport:.2f}", f"{hotel:.2f}",
                f"{deplacement:.2f}", f"{nutrition:.2f}",
                f"{total:.2f}", fm.statut or '-'
            ])
        pdf.table(
            ['Missionnaire', 'Transport', 'Hôtel', 'Dépl.', 'Nutrition', 'Total', 'Statut'],
            fm_rows,
            col_widths=[40, 23, 23, 23, 23, 23, 20]
        )
        pdf.ln(2)
        pdf.set_font(pdf._body_font, 'B', 10)
        pdf.set_text_color(17, 32, 51)
        pdf.cell(0, 8, f"Total global : {total_global:.2f}", new_x='LMARGIN', new_y='NEXT')
        pdf.set_text_color(0, 0, 0)

    # Workflow
    history = _get_workflow_history(id_mission, db)
    pdf.section_title('Historique de validation')
    if history:
        wf_rows = [[h['role'], h['nom'], h['statut'], h['date'], h['commentaire'][:40]] for h in history]
        pdf.table(
            ['Rôle', 'Validateur', 'Décision', 'Date', 'Commentaire'],
            wf_rows,
            col_widths=[30, 40, 25, 35, 40]
        )
    else:
        pdf.set_font(pdf._body_font, pdf._body_font_italic, 9)
        pdf.cell(0, 7, 'Aucune validation enregistrée.', new_x='LMARGIN', new_y='NEXT')

    content = bytes(pdf.output())
    return Response(
        content=content,
        media_type='application/pdf',
        headers={'Content-Disposition': f'attachment; filename=frais_mission_{id_mission}.pdf'}
    )


# ── Congés PDF ───────────────────────────────────────────────────────────────

@router.get('/conges/{id_operation}')
def export_conge_pdf(id_operation: int, db: Session = Depends(get_db)):
    operation = db.query(models.Operation).filter(
        models.Operation.id_operation == id_operation,
        models.Operation.type_demande == 'Congé'
    ).first()
    if not operation:
        raise HTTPException(status_code=404, detail="Demande de congé introuvable")

    demandeur = _get_employee_info(operation.matricule, db)
    employe = db.query(models.Employe).filter(models.Employe.matricule == operation.matricule).first()

    pdf = PDFReport(title='DEMANDE DE CONGÉ')
    pdf.alias_nb_pages()
    pdf.add_page()

    pdf.section_title('Informations du demandeur')
    pdf.info_row('Matricule:', str(demandeur['matricule']))
    pdf.info_row('Nom complet:', f"{demandeur['prenom']} {demandeur['nom']}")
    pdf.info_row('Fonction:', demandeur['fonction'])
    pdf.info_row('Solde congés:', f"{float(employe.solde_conges or 0)} jours" if employe else '-')

    pdf.section_title('Détails du congé')
    pdf.info_row('N° Demande:', str(id_operation))
    pdf.info_row('Date début:', str(operation.date_debut or '-'))
    pdf.info_row('Date fin:', str(operation.date_fin or '-'))
    pdf.info_row('Durée:', f"{operation.duree_jours or '-'} jours ouvrables")
    pdf.info_row('Motif:', operation.motif or '-')
    pdf.info_row('Retour anticipé:', 'Oui' if operation.retour_anticipe else 'Non')
    if operation.retour_anticipe and operation.date_retour_anticipe:
        pdf.info_row('Date retour anticipé:', str(operation.date_retour_anticipe))
    pdf.info_row('Statut:', '')
    pdf.status_badge(operation.statut or 'en attente')

    # Workflow
    history = _get_workflow_history(id_operation, db)
    pdf.section_title('Historique de validation')
    if history:
        wf_rows = [[h['role'], h['nom'], h['statut'], h['date'], h['commentaire'][:40]] for h in history]
        pdf.table(
            ['Rôle', 'Validateur', 'Décision', 'Date', 'Commentaire'],
            wf_rows,
            col_widths=[30, 40, 25, 35, 40]
        )
    else:
        pdf.set_font(pdf._body_font, pdf._body_font_italic, 9)
        pdf.cell(0, 7, 'Aucune validation enregistrée.', new_x='LMARGIN', new_y='NEXT')

    _add_remplacants_section(pdf, id_operation, db)

    content = bytes(pdf.output())
    return Response(
        content=content,
        media_type='application/pdf',
        headers={'Content-Disposition': f'attachment; filename=conge_{id_operation}.pdf'}
    )


# ── Permission PDF ───────────────────────────────────────────────────────────

@router.get('/permission/{id_operation}')
def export_permission_pdf(id_operation: int, db: Session = Depends(get_db)):
    operation = db.query(models.Operation).filter(
        models.Operation.id_operation == id_operation,
        models.Operation.type_demande == 'Permission'
    ).first()
    if not operation:
        raise HTTPException(status_code=404, detail="Demande de permission introuvable")

    demandeur = _get_employee_info(operation.matricule, db)
    perm = db.query(models.Permission).filter(models.Permission.id_permission == id_operation).first()
    perm_conv = db.query(models.PermConventionelle).filter(models.PermConventionelle.id_perm_c == id_operation).first()

    pdf = PDFReport(title='DEMANDE DE PERMISSION')
    pdf.alias_nb_pages()
    pdf.add_page()

    pdf.section_title('Informations du demandeur')
    pdf.info_row('Matricule:', str(demandeur['matricule']))
    pdf.info_row('Nom complet:', f"{demandeur['prenom']} {demandeur['nom']}")
    pdf.info_row('Fonction:', demandeur['fonction'])

    pdf.section_title('Détails de la permission')
    pdf.info_row('N° Demande:', str(id_operation))
    perm_type = 'Conventionnelle' if perm_conv else 'Non conventionnelle'
    pdf.info_row('Type:', perm_type)
    pdf.info_row('Date début:', str(operation.date_debut or '-'))
    pdf.info_row('Date fin:', str(operation.date_fin or '-'))
    pdf.info_row('Durée:', f"{operation.duree_jours or '-'} jours")
    pdf.info_row('Motif:', operation.motif or '-')
    if perm_conv:
        pdf.info_row('Preuves téléversées:', 'Oui' if perm_conv.preuves_televersees else 'Non')
        if perm_conv.date_limite_preuves:
            pdf.info_row('Date limite preuves:', str(perm_conv.date_limite_preuves))
    pdf.info_row('Statut:', '')
    pdf.status_badge(operation.statut or 'en attente')

    # Workflow
    history = _get_workflow_history(id_operation, db)
    pdf.section_title('Historique de validation')
    if history:
        wf_rows = [[h['role'], h['nom'], h['statut'], h['date'], h['commentaire'][:40]] for h in history]
        pdf.table(
            ['Rôle', 'Validateur', 'Décision', 'Date', 'Commentaire'],
            wf_rows,
            col_widths=[30, 40, 25, 35, 40]
        )
    else:
        pdf.set_font(pdf._body_font, pdf._body_font_italic, 9)
        pdf.cell(0, 7, 'Aucune validation enregistrée.', new_x='LMARGIN', new_y='NEXT')

    _add_remplacants_section(pdf, id_operation, db)

    content = bytes(pdf.output())
    return Response(
        content=content,
        media_type='application/pdf',
        headers={'Content-Disposition': f'attachment; filename=permission_{id_operation}.pdf'}
    )


# ── Sortie PDF ───────────────────────────────────────────────────────────────

@router.get('/sortie/{id_operation}')
def export_sortie_pdf(id_operation: int, db: Session = Depends(get_db)):
    operation = db.query(models.Operation).filter(
        models.Operation.id_operation == id_operation,
        models.Operation.type_demande == 'Sortie'
    ).first()
    if not operation:
        raise HTTPException(status_code=404, detail="Demande de sortie introuvable")

    demandeur = _get_employee_info(operation.matricule, db)
    sortie = db.query(models.Sortie).filter(models.Sortie.id_operation == id_operation).first()

    pdf = PDFReport(title='DEMANDE DE SORTIE')
    pdf.alias_nb_pages()
    pdf.add_page()

    pdf.section_title('Informations du demandeur')
    pdf.info_row('Matricule:', str(demandeur['matricule']))
    pdf.info_row('Nom complet:', f"{demandeur['prenom']} {demandeur['nom']}")
    pdf.info_row('Fonction:', demandeur['fonction'])

    pdf.section_title('Détails de la sortie')
    pdf.info_row('N° Demande:', str(id_operation))
    pdf.info_row('Date:', str(operation.date_debut or '-'))
    if sortie:
        pdf.info_row('Heure de sortie:', str(sortie.heure_sortie) if sortie.heure_sortie else '-')
        # Calcul de la durée si heure_retour disponible
        heure_retour = getattr(sortie, 'heure_retour', None)
        if sortie.heure_sortie and heure_retour:
            from datetime import datetime as _dt, timedelta as _td
            def _to_minutes(t):
                return t.hour * 60 + t.minute
            start_min = _to_minutes(sortie.heure_sortie)
            end_min = _to_minutes(heure_retour)
            diff_min = end_min - start_min
            if diff_min < 0:
                diff_min += 24 * 60  # overnight
            hours, minutes = divmod(diff_min, 60)
            duree_str = f"{hours}h{minutes:02d}" if hours else f"{minutes} min"
            pdf.info_row('Heure de retour:', str(heure_retour))
            pdf.info_row('Durée:', duree_str)
        elif heure_retour:
            pdf.info_row('Heure de retour:', str(heure_retour))
        pdf.info_row('Commentaire:', sortie.commentaire or '-')
    pdf.info_row('Motif:', operation.motif or '-')
    pdf.info_row('Statut:', '')
    pdf.status_badge(operation.statut or 'en attente')

    # Workflow
    history = _get_workflow_history(id_operation, db)
    pdf.section_title('Historique de validation')
    if history:
        wf_rows = [[h['role'], h['nom'], h['statut'], h['date'], h['commentaire'][:40]] for h in history]
        pdf.table(
            ['Rôle', 'Validateur', 'Décision', 'Date', 'Commentaire'],
            wf_rows,
            col_widths=[30, 40, 25, 35, 40]
        )
    else:
        pdf.set_font(pdf._body_font, pdf._body_font_italic, 9)
        pdf.cell(0, 7, 'Aucune validation enregistrée.', new_x='LMARGIN', new_y='NEXT')

    content = bytes(pdf.output())
    return Response(
        content=content,
        media_type='application/pdf',
        headers={'Content-Disposition': f'attachment; filename=sortie_{id_operation}.pdf'}
    )


# ── Helpers ───────────────────────────────────────────────────────────────────

def _build_lookup_dicts(db):
    """Build ID → name lookup dicts for Departement, Entite, Direction."""
    depts = {d.dept_id: (d.nom or f'Dept {d.dept_id}') for d in db.query(models.Departement).all()}
    entites = {e.id_entite: (e.nom or f'Entité {e.id_entite}') for e in db.query(models.Entite).all()}
    directions = {d.id_direction: (d.nom or f'Dir {d.id_direction}') for d in db.query(models.Direction).all()}
    return depts, entites, directions


def _auth_check(request):
    from ..utils import security as _sec
    allowed = {'ADMIN', 'RH', 'DG', 'PCA', 'AG', 'DIRECTEUR'}
    auth = request.headers.get('authorization', '')
    if not auth.lower().startswith('bearer '):
        raise HTTPException(status_code=401, detail='Non authentifié')
    try:
        token_data = _sec.jwt.decode(auth.split(None, 1)[1], _sec.SECRET_KEY, algorithms=[_sec.ALGORITHM])
        role = str(token_data.get('role') or '').upper()
    except Exception:
        raise HTTPException(status_code=401, detail='Token invalide')
    if role not in allowed:
        raise HTTPException(status_code=403, detail='Accès refusé')
    return role


# ── Rapport Employés PDF ─────────────────────────────────────────────────────

@router.get('/report/employees')
def export_employees_report_pdf(request: Request, db: Session = Depends(get_db)):
    """Export a comprehensive PDF report of all employees (actifs, suspendus, congédiés)."""
    _auth_check(request)
    depts, entites, directions = _build_lookup_dicts(db)
    from collections import Counter

    all_employees = db.query(models.Employe).order_by(models.Employe.nom).all()
    actifs = [e for e in all_employees if e.statut_employe == models.StatutEmployeEnum.ACTIF]
    suspendus = [e for e in all_employees if e.statut_employe == models.StatutEmployeEnum.SUSPENDU]
    congedies = [e for e in all_employees if e.statut_employe == models.StatutEmployeEnum.CONGEDIE]

    emp_headers = ['Mat.', 'Nom', 'Prénom', 'Fonction', 'Département', 'Entité', 'Direction']
    emp_widths = [14, 30, 26, 38, 30, 28, 24]  # sum = 190

    def emp_row(e):
        return [
            str(e.matricule or ''),
            (e.nom or '')[:18],
            (e.prenom or '')[:16],
            (e.fonction or '-')[:24],
            (depts.get(e.dept_id) or '-')[:18],
            (entites.get(e.id_entite) or '-')[:16],
            (directions.get(e.id_direction) or '-')[:14],
        ]

    pdf = PDFReport(title='RAPPORT — ANNUAIRE EMPLOYÉS')
    pdf.alias_nb_pages()

    # ── Page 1 : Résumé ──
    pdf.add_page()
    pdf.section_title(f'Résumé — {datetime.utcnow().strftime("%d/%m/%Y")}')
    pdf.info_row('Total employés:', str(len(all_employees)))
    pdf.info_row('Actifs:', str(len(actifs)))
    pdf.info_row('Suspendus:', str(len(suspendus)))
    pdf.info_row('Congédiés:', str(len(congedies)))

    dept_counter = Counter(depts.get(e.dept_id, 'Non renseigné') for e in all_employees)
    if dept_counter:
        pdf.section_title('Répartition par département')
        pdf.table(['Département', 'Nb. Employés'],
                  [(k, str(v)) for k, v in dept_counter.most_common()],
                  col_widths=[150, 40])

    entite_counter = Counter(entites.get(e.id_entite, 'Non renseigné') for e in all_employees)
    if entite_counter:
        pdf.section_title('Répartition par entité')
        pdf.table(['Entité', 'Nb. Employés'],
                  [(k, str(v)) for k, v in entite_counter.most_common()],
                  col_widths=[150, 40])

    # ── Page 2 : Actifs ──
    pdf.add_page()
    pdf.section_title(f'Employés actifs ({len(actifs)})')
    if actifs:
        pdf.table(emp_headers, [emp_row(e) for e in actifs], col_widths=emp_widths)
    else:
        pdf.set_font(pdf._body_font, pdf._body_font_italic, 9)
        pdf.cell(0, 7, 'Aucun employé actif.', new_x='LMARGIN', new_y='NEXT')

    # ── Page 3 : Suspendus ──
    pdf.add_page()
    pdf.section_title(f'Employés suspendus ({len(suspendus)})')
    if suspendus:
        pdf.table(emp_headers, [emp_row(e) for e in suspendus], col_widths=emp_widths)
    else:
        pdf.set_font(pdf._body_font, pdf._body_font_italic, 9)
        pdf.cell(0, 7, 'Aucun employé suspendu.', new_x='LMARGIN', new_y='NEXT')

    # ── Page 4 : Congédiés ──
    pdf.add_page()
    pdf.section_title(f'Employés congédiés ({len(congedies)})')
    if congedies:
        pdf.table(emp_headers, [emp_row(e) for e in congedies], col_widths=emp_widths)
    else:
        pdf.set_font(pdf._body_font, pdf._body_font_italic, 9)
        pdf.cell(0, 7, 'Aucun employé congédié.', new_x='LMARGIN', new_y='NEXT')

    content = bytes(pdf.output())
    return Response(
        content=content,
        media_type='application/pdf',
        headers={'Content-Disposition': f'attachment; filename=rapport_employes_{datetime.utcnow().strftime("%Y%m%d")}.pdf'},
    )


# ── Rapport Analytique PDF ───────────────────────────────────────────────────

@router.get('/report/analytics')
def export_analytics_report_pdf(request: Request, db: Session = Depends(get_db)):
    """Export a multi-page PDF analytics report (effectifs, congés, missions, permissions, sorties)."""
    _auth_check(request)
    depts, entites, directions = _build_lookup_dicts(db)
    from collections import Counter

    pdf = PDFReport(title='RAPPORT ANALYTIQUE RH')
    pdf.alias_nb_pages()

    # ── Page 1 : Effectifs ──
    pdf.add_page()
    pdf.section_title(f'Effectifs au {datetime.utcnow().strftime("%d/%m/%Y")}')
    all_emps = db.query(models.Employe).all()
    actifs_c = sum(1 for e in all_emps if e.statut_employe == models.StatutEmployeEnum.ACTIF)
    suspendus_c = sum(1 for e in all_emps if e.statut_employe == models.StatutEmployeEnum.SUSPENDU)
    congedies_c = sum(1 for e in all_emps if e.statut_employe == models.StatutEmployeEnum.CONGEDIE)
    pdf.info_row('Total employés:', str(len(all_emps)))
    pdf.info_row('Actifs:', str(actifs_c))
    pdf.info_row('Suspendus:', str(suspendus_c))
    pdf.info_row('Congédiés:', str(congedies_c))

    dept_counter = Counter(depts.get(e.dept_id, 'Non renseigné') for e in all_emps)
    if dept_counter:
        pdf.section_title('Répartition par département')
        pdf.table(['Département', 'Nb.'],
                  [(k, str(v)) for k, v in dept_counter.most_common(15)],
                  col_widths=[150, 40])

    entite_counter = Counter(entites.get(e.id_entite, 'Non renseigné') for e in all_emps)
    if entite_counter:
        pdf.section_title('Répartition par entité')
        pdf.table(['Entité', 'Nb.'],
                  [(k, str(v)) for k, v in entite_counter.most_common(15)],
                  col_widths=[150, 40])

    # ── Page 2 : Congés ──
    pdf.add_page()
    pdf.section_title('Congés')
    conges = (db.query(models.Operation)
              .filter(models.Operation.type_demande == 'Congé')
              .order_by(models.Operation.date_debut.desc()).all())
    val_c = sum(1 for c in conges if str(c.statut or '').lower() == 'validé')
    att_c = sum(1 for c in conges if str(c.statut or '').lower() == 'en attente')
    ref_c = sum(1 for c in conges if str(c.statut or '').lower() == 'refusé')
    jours_c = sum(float(c.duree_jours or 0) for c in conges if str(c.statut or '').lower() == 'validé')
    pdf.info_row('Total demandes:', str(len(conges)))
    pdf.info_row('Validées:', str(val_c))
    pdf.info_row('En attente:', str(att_c))
    pdf.info_row('Refusées:', str(ref_c))
    pdf.info_row('Jours accordés:', f'{jours_c:.1f} j')
    if conges:
        pdf.section_title('50 dernières demandes de congé')
        pdf.table(
            ['Mat.', 'Début', 'Fin', 'Durée', 'Motif', 'Statut'],
            [[str(c.matricule or ''), str(c.date_debut or '')[:10], str(c.date_fin or '')[:10],
              f'{c.duree_jours or 0} j', (c.motif or '-')[:25], str(c.statut or '-')]
             for c in conges[:50]],
            col_widths=[18, 24, 24, 18, 70, 36],
        )

    # ── Page 3 : Missions ──
    pdf.add_page()
    pdf.section_title('Missions')
    mission_rows = (
        db.query(models.Operation, models.Mission)
        .join(models.Mission, models.Mission.id_mission == models.Operation.id_operation)
        .order_by(models.Operation.date_debut.desc())
        .all()
    )
    cloturees_m = sum(1 for op, m in mission_rows if str(op.statut or '').lower() in {'clôturée', 'cloturee', 'validé'})
    encours_m = sum(1 for op, m in mission_rows if str(op.statut or '').lower() in {'en cours', 'en attente'})
    pdf.info_row('Total missions:', str(len(mission_rows)))
    pdf.info_row('Clôturées / validées:', str(cloturees_m))
    pdf.info_row('En cours / En attente:', str(encours_m))
    if mission_rows:
        pdf.section_title('50 dernières missions')
        pdf.table(
            ['Mat.', 'Début', 'Fin', 'Pays', 'Ville', 'Statut'],
            [[str(op.matricule or ''), str(op.date_debut or '')[:10], str(op.date_fin or '')[:10],
              (m.pays or '-')[:18], (m.ville or '-')[:20], str(op.statut or '-')]
             for op, m in mission_rows[:50]],
            col_widths=[18, 24, 24, 36, 40, 48],
        )

    # ── Page 4 : Permissions ──
    pdf.add_page()
    pdf.section_title('Permissions')
    permissions = (db.query(models.Operation)
                   .filter(models.Operation.type_demande == 'Permission')
                   .order_by(models.Operation.date_debut.desc()).all())
    val_p = sum(1 for p in permissions if str(p.statut or '').lower() == 'validé')
    att_p = sum(1 for p in permissions if str(p.statut or '').lower() == 'en attente')
    ref_p = sum(1 for p in permissions if str(p.statut or '').lower() == 'refusé')
    jours_p = sum(float(p.duree_jours or 0) for p in permissions if str(p.statut or '').lower() == 'validé')
    pdf.info_row('Total demandes:', str(len(permissions)))
    pdf.info_row('Validées:', str(val_p))
    pdf.info_row('En attente:', str(att_p))
    pdf.info_row('Refusées:', str(ref_p))
    pdf.info_row('Jours accordés:', f'{jours_p:.1f} j')
    if permissions:
        pdf.section_title('50 dernières permissions')
        pdf.table(
            ['Mat.', 'Début', 'Fin', 'Durée', 'Motif', 'Statut'],
            [[str(p.matricule or ''), str(p.date_debut or '')[:10], str(p.date_fin or '')[:10],
              f'{p.duree_jours or 0} j', (p.motif or '-')[:25], str(p.statut or '-')]
             for p in permissions[:50]],
            col_widths=[18, 24, 24, 18, 70, 36],
        )

    # ── Page 5 : Sorties ──
    pdf.add_page()
    pdf.section_title('Sorties')
    sorties = (db.query(models.Sortie)
               .order_by(models.Sortie.date_sortie.desc()).all())
    val_s = sum(1 for s in sorties if str(s.statut or '').lower() == 'validé')
    att_s = sum(1 for s in sorties if str(s.statut or '').lower() == 'en attente')
    pdf.info_row('Total sorties:', str(len(sorties)))
    pdf.info_row('Validées:', str(val_s))
    pdf.info_row('En attente:', str(att_s))
    if sorties:
        pdf.section_title('50 dernières sorties')
        pdf.table(
            ['Mat.', 'Date', 'Heure', 'Commentaire', 'Statut'],
            [[str(s.matricule or ''), str(s.date_sortie or '')[:10], str(s.heure_sortie or '-')[:5],
              (s.commentaire or '-')[:40], str(s.statut or '-')]
             for s in sorties[:50]],
            col_widths=[18, 28, 20, 88, 36],
        )

    pdf.section_title(f'Rapport généré le {datetime.utcnow().strftime("%d/%m/%Y à %H:%M")} UTC')

    content = bytes(pdf.output())
    return Response(
        content=content,
        media_type='application/pdf',
        headers={'Content-Disposition': f'attachment; filename=rapport_analytique_{datetime.utcnow().strftime("%Y%m%d")}.pdf'},
    )
