"""
Generate suivi/roadmap Excel file for EMS project tasks.
"""
import openpyxl
from openpyxl.styles import (
    PatternFill, Font, Alignment, Border, Side, GradientFill
)
from openpyxl.utils import get_column_letter
from datetime import date

wb = openpyxl.Workbook()
ws = wb.active
ws.title = "Suivi EMS"

# ── Palette — charte EMS UNIQUEMENT (source : frontend/src/index.css) ────────
# --bleu      rgb(2,22,46)      #02162E
# --rouge     rgb(208,32,43)    #D0202B
# --gris      rgb(96,96,96)     #606060
# --sidebar   #112033 / #17283D
# --bg        #F4F5F7
# --card      #FFFFFF
BLEU        = "02162E"
BLEU_CLAIR  = "17283D"   # sidebar-bg-alt, légèrement plus clair que BLEU
ROUGE       = "D0202B"
GRIS        = "606060"
GRIS_CLAIR  = "F4F5F7"   # --bg  (fond général de l'app)
WHITE       = "FFFFFF"   # --card

# Couleurs de ligne alternées : blanc carte / fond app
ROW_LIGHT   = WHITE
ROW_ALT     = GRIS_CLAIR

# États — uniquement la palette charte
# Non débuté → rouge EMS fond clair (rouge 10% opacité simulé) + rouge texte
# En cours   → bleu EMS fond clair + blanc texte
# Terminé    → gris EMS fond clair + gris foncé texte
STATUS_COLORS = {
    "En cours":   (BLEU_CLAIR, WHITE),    # fond bleu sidebar-alt, texte blanc
    "Non débuté": ("F8D7DA",   ROUGE),    # rouge très clair + rouge EMS texte
    "Terminé":    (GRIS_CLAIR, GRIS),     # fond bg app + gris EMS texte
}

# ── Column definitions ───────────────────────────────────────────────────────
COLUMNS = [
    ("Rubrique",          28),
    ("Action",            55),
    ("Date d'insertion",  18),
    ("État",              14),
    ("Délais",            14),
    ("Date de fin",       16),
]

# ── Data ─────────────────────────────────────────────────────────────────────
TODAY = "27/04/2026"

rows = [
    # ── Organigramme ────────────────────────────────────────────────────────
    ("Organigramme",
     "Le responsable doit toujours être plus haut que l'employé dans le visuel de l'organigramme",
     TODAY, "Non débuté", "3 j", ""),

    # ── Missions ────────────────────────────────────────────────────────────
    ("Missions",
     "Bloquer la clôture d'une mission si une preuve de frais n'est pas téléversée",
     TODAY, "Non débuté", "1 j", ""),

    ("Missions",
     "Notifications de frais : libellé → \"Une nouvelle demande [reste du texte]\" ; bouton → \"Voir la demande\"",
     TODAY, "Non débuté", "1 j", ""),

    ("Missions",
     "Notifications : supprimer \"Nouvelle mission multi-destinations\" → utiliser uniquement \"Nouvelle mission\"",
     TODAY, "Non débuté", "0.5 j", ""),

    # ── Employés ────────────────────────────────────────────────────────────
    ("Employés",
     "Rendre le matricule alphanumérique (lettres + chiffres)",
     TODAY, "Non débuté", "1 j", ""),

    ("Employés",
     "Enregistrer le salaire à la création d'un employé ; chaque employé ne voit que son propre salaire ; le RH voit tous les salaires",
     TODAY, "Non débuté", "2 j", ""),

    ("Employés",
     "Ajouter le filtrage des employés par sexe",
     TODAY, "Non débuté", "0.5 j", ""),

    # ── Opérations / DG ─────────────────────────────────────────────────────
    ("Opérations",
     "Les opérations doivent apparaître simultanément chez les deux DG",
     TODAY, "Non débuté", "1 j", ""),

    # ── Notifications ────────────────────────────────────────────────────────
    ("Notifications",
     "Relances et notifications envoyées hors application (email + mobile push)",
     TODAY, "Non débuté", "5 j", ""),

    ("Notifications",
     "Supprimer la mention \"en tant que [rôle]\" dans toutes les notifications",
     TODAY, "Non débuté", "0.5 j", ""),

    ("Notifications",
     "Toast de notification : utiliser le bleu de la charte graphique EMS",
     TODAY, "Non débuté", "0.5 j", ""),

    # ── Biométrie ───────────────────────────────────────────────────────────
    ("Biométrie / Intégration",
     "Prévoir la connexion avec une application de biométrie pour gérer les retards",
     TODAY, "Non débuté", "10 j", ""),

    ("Biométrie / Intégration",
     "Intégration Sage Paie (automatisation des retenues salariales)",
     TODAY, "Non débuté", "15 j", ""),

    # ── Congés / Permissions ─────────────────────────────────────────────────
    ("Congés",
     "Règle : si demande créée > 3 semaines avant début du congé → modification bloquée à partir de 2 semaines avant la date de début",
     TODAY, "Non débuté", "1 j", ""),

    ("Congés / Permissions",
     "Maternité simple : corriger durée → 14 semaines (était 16) ; Maternité pathologique → 20 semaines (était 18)",
     TODAY, "Non débuté", "0.5 j", ""),

    # ── UI / UX ──────────────────────────────────────────────────────────────
    ("UI / UX",
     "Ajouter un scroll horizontal sur chaque tableau de l'application",
     TODAY, "Non débuté", "1 j", ""),

    ("UI / UX",
     "Ajouter \"et autres\" à côté du dernier pays dans l'onglet Organisation",
     TODAY, "Non débuté", "0.5 j", ""),

    # ── Sécurité ─────────────────────────────────────────────────────────────
    ("Sécurité",
     "Politique de gestion des failles zero-day (procédure, veille CVE, patch management)",
     TODAY, "Non débuté", "5 j", ""),

    # ── Performance & Évaluation ─────────────────────────────────────────────
    ("Performance & Évaluation",
     "Système de notation : respect délais validation (valideur doit valider en max 3h, sinon mauvaise note)",
     TODAY, "Non débuté", "7 j", ""),

    ("Performance & Évaluation",
     "Système de notation : comportement sur l'application",
     TODAY, "Non débuté", "5 j", ""),

    ("Performance & Évaluation",
     "Système de notation : taux de participation aux événements (liste de participation + liste de présence le jour J)",
     TODAY, "Non débuté", "7 j", ""),

    ("Performance & Évaluation",
     "Intégrer les notations dans Rubrique Parcours, Module Performance, 360°",
     TODAY, "Non débuté", "10 j", ""),

    ("Performance & Évaluation",
     "Évaluation esprit d'équipe",
     TODAY, "Non débuté", "5 j", ""),

    # ── Gestion disciplinaire ────────────────────────────────────────────────
    ("Gestion Disciplinaire",
     "Module : blâme, avertissement, sanctions, demande d'explication, conseil de discipline",
     TODAY, "Non débuté", "10 j", ""),

    ("Gestion Disciplinaire",
     "Ajouter un module Demande d'Explication (DE) dédié",
     TODAY, "Non débuté", "5 j", ""),

    # ── Reporting & Data ─────────────────────────────────────────────────────
    ("Reporting & Data",
     "Export Excel complet incluant les données sources des graphiques",
     TODAY, "Non débuté", "3 j", ""),

    ("Reporting & Data",
     "Amélioration PDF : template avec logo en haut à gauche sur tous les exports PDF",
     TODAY, "Non débuté", "3 j", ""),

    ("Reporting & Data",
     "PDF : signature automatique des validateurs lors de chaque validation",
     TODAY, "Non débuté", "4 j", ""),

    ("Reporting & Data",
     "PDF : ajouter une table de signatures",
     TODAY, "Non débuté", "2 j", ""),

    # ── IA / Copilot ─────────────────────────────────────────────────────────
    ("IA / Aide à la Décision",
     "Résumé automatique du dashboard par IA (ex : \"Ce mois-ci, Direction Commerciale +23% absences vs moyenne\")",
     TODAY, "Non débuté", "15 j", ""),

    ("IA / Aide à la Décision",
     "Recommandations contextuelles pour managers (solde congés critique, actions suggérées)",
     TODAY, "Non débuté", "10 j", ""),

    ("IA / Aide à la Décision",
     "Rapport narratif PDF en langage naturel pour comités de direction",
     TODAY, "Non débuté", "12 j", ""),

    # ── NLP & Recherche ──────────────────────────────────────────────────────
    ("NLP & Recherche",
     "Recherche employés en langage naturel → génération SQL automatique",
     TODAY, "Non débuté", "15 j", ""),

    ("NLP & Recherche",
     "Chatbot RH interne (solde congés, statut missions, etc.)",
     TODAY, "Non débuté", "20 j", ""),

    ("NLP & Recherche",
     "Extraction d'informations depuis documents/contrats pour pré-remplir les formulaires",
     TODAY, "Non débuté", "15 j", ""),

    # ── Analyse Performance ──────────────────────────────────────────────────
    ("Analyse Performance",
     "Scoring composite par département (présence + productivité + missions + formations)",
     TODAY, "Non débuté", "12 j", ""),

    ("Analyse Performance",
     "Détection de biais dans les validations congés/permissions (hommes/femmes, entités, grades)",
     TODAY, "Non débuté", "10 j", ""),

    # ── Tests ────────────────────────────────────────────────────────────────
    ("Tests",
     "Ajouter des tests automatisés pour toutes les fonctionnalités ci-dessus",
     TODAY, "Non débuté", "20 j", ""),
]

# ── Helper: thin border (--border EMS = #e5e7eb) ────────────────────────────
thin = Side(style="thin", color="E5E7EB")   # --border de l'app
border_all = Border(left=thin, right=thin, top=thin, bottom=thin)

# ── Write header — fond BLEU_CLAIR (#17283D) ─────────────────────────────────
header_fill   = PatternFill("solid", fgColor=BLEU_CLAIR)
header_font   = Font(bold=True, color=WHITE, name="Calibri", size=11)
header_align  = Alignment(horizontal="center", vertical="center", wrap_text=True)

for col_idx, (col_name, col_width) in enumerate(COLUMNS, start=1):
    cell = ws.cell(row=1, column=col_idx, value=col_name)
    cell.fill   = header_fill
    cell.font   = header_font
    cell.alignment = header_align
    cell.border = border_all
    ws.column_dimensions[get_column_letter(col_idx)].width = col_width

ws.row_dimensions[1].height = 30
ws.freeze_panes = "A2"

# ── Write data rows ──────────────────────────────────────────────────────────
data_font  = Font(name="Calibri", size=10)
data_align = Alignment(vertical="top", wrap_text=True)

prev_rubrique = None
rubrique_fill_toggle = True

for row_idx, (rubrique, action, date_insert, etat, delais, date_fin) in enumerate(rows, start=2):
    # Alternate rubrique background
    if rubrique != prev_rubrique:
        rubrique_fill_toggle = not rubrique_fill_toggle
        prev_rubrique = rubrique

    row_bg = ROW_ALT if rubrique_fill_toggle else ROW_LIGHT
    status_bg, status_fg = STATUS_COLORS.get(etat, (row_bg, "000000"))

    values = [rubrique, action, date_insert, etat, delais, date_fin]

    for col_idx, value in enumerate(values, start=1):
        cell = ws.cell(row=row_idx, column=col_idx, value=value)
        cell.font   = Font(name="Calibri", size=10, color=GRIS)
        cell.border = border_all
        cell.alignment = data_align

        # État column: badge charte
        if col_idx == 4:
            cell.fill = PatternFill("solid", fgColor=status_bg)
            cell.font = Font(name="Calibri", size=10, bold=True,
                             color=status_fg)
            cell.alignment = Alignment(horizontal="center",
                                        vertical="center", wrap_text=False)
        # Rubrique column: légèrement accentuée
        elif col_idx == 1:
            cell.fill = PatternFill("solid", fgColor=row_bg)
            cell.font = Font(name="Calibri", size=10, bold=True, color=BLEU)
        elif col_idx in (3, 5, 6):
            cell.fill = PatternFill("solid", fgColor=row_bg)
            cell.alignment = Alignment(horizontal="center",
                                        vertical="top", wrap_text=False)
        else:
            cell.fill = PatternFill("solid", fgColor=row_bg)

    ws.row_dimensions[row_idx].height = 36

# ── Auto-filter on headers ────────────────────────────────────────────────────
ws.auto_filter.ref = f"A1:{get_column_letter(len(COLUMNS))}1"

# ── Title row at very top ─────────────────────────────────────────────────────
ws.insert_rows(1)
title_cell = ws.cell(row=1, column=1,
    value="SUIVI DES FONCTIONNALITÉS EMS — Roadmap 2026")
ws.merge_cells(start_row=1, start_column=1,
               end_row=1, end_column=len(COLUMNS))
title_cell.fill = PatternFill("solid", fgColor=BLEU)
title_cell.font = Font(bold=True, color=WHITE, name="Calibri", size=14)
title_cell.alignment = Alignment(horizontal="center", vertical="center")
ws.row_dimensions[1].height = 40

# ── Re-apply filter ref after row insert ─────────────────────────────────────
ws.auto_filter.ref = f"A2:{get_column_letter(len(COLUMNS))}2"

# ── Save ──────────────────────────────────────────────────────────────────────
out_path = r"c:\Users\cedri\OneDrive - ELITE CAPITAL Group S.A\Documents\EMS\extranet\SUIVI_FONCTIONNALITES_EMS_2026.xlsx"
wb.save(out_path)
print(f"Saved → {out_path}")
