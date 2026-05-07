"""
Service IA — Insights & Recommandations multi-pages.

Gère la collecte de contexte (KPIs adaptés à la page/onglet/filtres) puis
appelle Ollama (mistral) avec un prompt structuré demandant une sortie JSON,
avec un fallback déterministe robuste lorsque Ollama est indisponible.

Pages supportées :
  - "dashboard"       : Tableau de bord employé/manager (onglets personnel/departements)
  - "analytics"       : Analytiques RH globales avec filtres période + direction/entité
  - "score_comportemental"
  - "missions" / "conges" / "frais"

Sortie standardisée :
{
  "synthese":            "...",
  "kpis":               [{"label":"...","value":"...","trend":"...","alert":False}],
  "points_attention":   ["..."],
  "recommandations":    [{"priorite":"haute|moyenne|basse","action":"...","cible":"..."}],
  "narratif":           "...",
  "source":             "ollama|deterministic",
  "generated_at":       "ISO 8601",
  "lang":               "fr|en",
  "context":            {... echo des filtres effectivement appliqués ...}
}
"""
from __future__ import annotations

import json
import os
import re
from datetime import date, datetime, timedelta
from typing import Any, Optional

import httpx
from sqlalchemy import func
from sqlalchemy.orm import Session

from .. import models


# ── Localisation ────────────────────────────────────────────────────────────

_I18N = {
    "fr": {
        "no_data": "Aucune donnée disponible pour la période sélectionnée.",
        "synthese_title": "Synthèse exécutive",
        "kpi_title": "Indicateurs clés",
        "alerts_title": "Points d'attention",
        "reco_title": "Recommandations",
        "no_alert": "Aucune alerte majeure détectée.",
        "stable": "Profil stable, aucun indicateur négatif.",
        "effectif": "Effectif",
        "actifs": "Employés actifs",
        "conges_attente": "Congés en attente",
        "missions_attente": "Missions en attente",
        "de_ouvertes": "Demandes d'explication ouvertes",
        "mesures": "Mesures disciplinaires",
        "soldes_eleves": "Soldes congé > 36 j",
        "absences_dept_top": "Top département absences",
        "missions_longues": "Missions > 30 j non clôturées",
        "score_moyen": "Score comportemental moyen",
        "frais_attente": "Frais en attente",
        "frais_montant": "Montant total frais",
    },
    "en": {
        "no_data": "No data available for the selected period.",
        "synthese_title": "Executive summary",
        "kpi_title": "Key indicators",
        "alerts_title": "Points of attention",
        "reco_title": "Recommendations",
        "no_alert": "No major alert detected.",
        "stable": "Stable profile, no negative indicator.",
        "effectif": "Headcount",
        "actifs": "Active employees",
        "conges_attente": "Leave requests pending",
        "missions_attente": "Missions pending",
        "de_ouvertes": "Open explanation requests",
        "mesures": "Disciplinary measures",
        "soldes_eleves": "Leave balance > 36 d",
        "absences_dept_top": "Top dept. absences",
        "missions_longues": "Missions > 30 d unclosed",
        "score_moyen": "Avg behavioral score",
        "frais_attente": "Expenses pending",
        "frais_montant": "Total expenses",
    },
}


def _t(key: str, lang: str) -> str:
    return _I18N.get(lang, _I18N["fr"]).get(key, key)


# ── Fonctions utilitaires ───────────────────────────────────────────────────

def _get_previous_period(d1: date, d2: date) -> tuple[date, date]:
    """Retourne la période précédente équivalente (année N-1 si période full year, sinon X jours avant)."""
    delta = d2 - d1
    prev_end = d1 - timedelta(days=1)
    prev_start = prev_end - delta
    return prev_start, prev_end


def _calculate_trend(current: int, previous: int) -> Optional[str]:
    """Calcule +/- X% de tendance entre deux valeurs. Retourne None si impossible."""
    if previous == 0 or previous is None:
        return None
    pct = ((current - previous) / previous) * 100
    if abs(pct) < 0.5:
        return None  # Variation négligeable
    sign = "+" if pct > 0 else ""
    return f"{sign}{pct:.0f}%"


def _calculate_turnover(db: Session, d1: date, d2: date, direction_id: Optional[int] = None, entite_id: Optional[int] = None) -> float:
    """
    Calcule taux de turnover : sorties / effectif moyen sur période.
    Turnover = (nombre de sorties) / (effectif moyen du mois) × 100
    """
    q_sorties = db.query(func.count(models.Employe.matricule)).filter(
        models.Employe.statut_employe == models.StatutEmployeEnum.CONGEDIE,
        models.Employe.date_embauche >= d1,  # Embauché durant période (utilisé comme proxy pour sorties)
    )
    if direction_id is not None:
        q_sorties = q_sorties.filter(models.Employe.id_direction == direction_id)
    if entite_id is not None:
        q_sorties = q_sorties.filter(models.Employe.id_entite == entite_id)
    sorties = q_sorties.scalar() or 0

    # Effectif moyen = effectif actifs + effectif fin période / 2 (approximation)
    q_eff = db.query(models.Employe).filter(
        models.Employe.statut_employe == models.StatutEmployeEnum.ACTIF
    )
    if direction_id is not None:
        q_eff = q_eff.filter(models.Employe.id_direction == direction_id)
    if entite_id is not None:
        q_eff = q_eff.filter(models.Employe.id_entite == entite_id)
    eff_moyen = max(q_eff.count(), 1)  # Évite division par zéro

    return (sorties / eff_moyen * 100) if eff_moyen > 0 else 0.0


def _count_operations_by_status(db: Session, d1: date, d2: date, type_demande: Optional[str] = None, matricule: Optional[str] = None) -> dict:
    """
    Compte opérations par statut (validé/refusé/en attente).
    Retourne dict : {"validees": X, "refusees": Y, "en_attente": Z}
    """
    base_q = db.query(models.Operation).filter(
        models.Operation.date_debut >= d1,
        models.Operation.date_debut <= d2,
    )
    if type_demande:
        base_q = base_q.filter(models.Operation.type_demande == type_demande)
    if matricule:
        base_q = base_q.filter(models.Operation.matricule == matricule)

    # Normaliser les statuts (handle variations: validé/approuvé, refusé/rejeté, etc.)
    def normalize_status(s: str) -> str:
        s_lower = (s or "").lower().strip()
        if "approuv" in s_lower or "valid" in s_lower:
            return "validees"
        elif "refus" in s_lower or "rejét" in s_lower:
            return "refusees"
        else:
            return "en_attente"

    result = {"validees": 0, "refusees": 0, "en_attente": 0}
    for op in base_q.all():
        status_key = normalize_status(op.statut)
        result[status_key] += 1

    return result


def _count_new_hires(db: Session, annee: int, direction_id: Optional[int] = None, entite_id: Optional[int] = None) -> int:
    """Compte les nouvelles recrues marquées manuellement (nouvelle_recrue=True) pour une année d'embauche."""
    q = db.query(func.count(models.Employe.matricule)).filter(
        models.Employe.nouvelle_recrue == True,  # noqa: E712
        models.Employe.date_embauche >= date(annee, 1, 1),
        models.Employe.date_embauche <= date(annee, 12, 31),
    )
    if direction_id is not None:
        q = q.filter(models.Employe.id_direction == direction_id)
    if entite_id is not None:
        q = q.filter(models.Employe.id_entite == entite_id)
    return q.scalar() or 0


# ── Période ─────────────────────────────────────────────────────────────────

def _parse_period(filters: dict) -> tuple[date, date]:
    """Calcule (date_debut, date_fin) à partir des filtres reçus."""
    today = datetime.utcnow().date()
    d1 = filters.get("date_debut") or filters.get("dateDebut")
    d2 = filters.get("date_fin") or filters.get("dateFin")
    if d1 and d2:
        try:
            return (
                datetime.fromisoformat(d1).date() if isinstance(d1, str) else d1,
                datetime.fromisoformat(d2).date() if isinstance(d2, str) else d2,
            )
        except Exception:
            pass

    annee = filters.get("annee") or today.year
    try:
        annee = int(annee)
    except Exception:
        annee = today.year
    mois_raw = filters.get("mois")
    if mois_raw and str(mois_raw) not in ("tous", "all"):
        try:
            m = int(mois_raw)
            from calendar import monthrange
            return date(annee, m, 1), date(annee, m, monthrange(annee, m)[1])
        except Exception:
            pass
    return date(annee, 1, 1), date(annee, 12, 31)


# ── Collecteurs de contexte ─────────────────────────────────────────────────

def _ctx_dashboard(db: Session, current_user: dict, filters: dict, tab: str) -> dict:
    """Contexte pour le tableau de bord employé / manager / RH."""
    matricule = filters.get("matricule") or current_user.get("matricule")
    role = (current_user.get("role") or "").upper()
    d1, d2 = _parse_period(filters)

    out: dict[str, Any] = {
        "tab": tab,
        "role": role,
        "matricule": matricule,
        "periode": f"{d1.isoformat()} → {d2.isoformat()}",
    }

    emp = db.query(models.Employe).filter_by(matricule=matricule).first() if matricule else None

    if tab == "personnel":
        if emp:
            ops = db.query(models.Operation).filter(
                models.Operation.matricule == matricule,
                models.Operation.date_debut >= d1,
                models.Operation.date_debut <= d2,
            ).all()
            
            # Compter par statut
            ops_by_status = _count_operations_by_status(db, d1, d2, matricule=matricule)
            
            ops_attente = sum(1 for o in ops if (o.statut or "").lower() == "en attente")
            ops_approuvees = sum(1 for o in ops if (o.statut or "").lower() == "approuvé")
            ops_refusees = sum(1 for o in ops if (o.statut or "").lower() in ("refusé", "rejeté"))
            
            ops_par_type = {}
            for o in ops:
                ops_par_type[o.type_demande] = ops_par_type.get(o.type_demande, 0) + 1
            
            # Calculer tendance vs période précédente
            prev_d1, prev_d2 = _get_previous_period(d1, d2)
            prev_ops = db.query(func.count(models.Operation.id_operation)).filter(
                models.Operation.matricule == matricule,
                models.Operation.date_debut >= prev_d1,
                models.Operation.date_debut <= prev_d2,
            ).scalar() or 0
            ops_trend = _calculate_trend(len(ops), prev_ops)
            
            nb_de = db.query(func.count(models.DemandeExplicationV2.id_de)).filter_by(
                matricule_employe=matricule).scalar() or 0
            nb_mesures = db.query(func.count(models.MesureDisciplinaire.id_mesure)).filter_by(
                matricule=matricule).scalar() or 0
            
            out.update({
                "employe": {
                    "nom": f"{emp.prenom} {emp.nom}",
                    "fonction": emp.fonction,
                    "solde_conges": float(emp.solde_conges or 0),
                    "annee_experience": emp.annee_experience,
                },
                "operations": {
                    "total": len(ops),
                    "validees": ops_approuvees,
                    "refusees": ops_refusees,
                    "en_attente": ops_attente,
                    "par_type": ops_par_type,
                    "trend": ops_trend,
                },
                "demandes_explication": nb_de,
                "mesures_disciplinaires": nb_mesures,
            })
    else:  # departements / equipes
        # Périmètre : direction de l'utilisateur, ou tout pour RH/ADMIN/DG/PCA
        scope_q = db.query(models.Employe).filter(
            models.Employe.statut_employe == models.StatutEmployeEnum.ACTIF
        )
        if role not in {"RH", "ADMIN", "DG", "PCA"} and emp and emp.id_direction:
            scope_q = scope_q.filter(models.Employe.id_direction == emp.id_direction)

        equipe_count = scope_q.count()

        # Absences ce mois
        abs_dept = (
            db.query(models.Departement.nom, func.count(models.Operation.id_operation))
            .join(models.Employe, models.Operation.matricule == models.Employe.matricule)
            .join(models.Departement, models.Departement.dept_id == models.Employe.dept_id)
            .filter(
                models.Operation.type_demande.in_(["Congé", "Absence"]),
                models.Operation.statut == "approuvé",
                models.Operation.date_debut >= d1,
                models.Operation.date_debut <= d2,
            )
            .group_by(models.Departement.nom)
            .order_by(func.count(models.Operation.id_operation).desc())
            .limit(5)
            .all()
        )
        
        # Soldes critiques
        soldes_eleves = scope_q.filter(models.Employe.solde_conges > 36).count()
        soldes_faibles = scope_q.filter(models.Employe.solde_conges < 3).count()
        
        # Turnover et rétention (calculer avec direction scope si applicable)
        direction_id = emp.id_direction if (role not in {"RH", "ADMIN", "DG", "PCA"} and emp) else None
        turnover_pct = _calculate_turnover(db, d1, d2, direction_id=direction_id)
        retention_pct = 100 - turnover_pct
        
        # Nouvelles recrues sur la période filtrée
        annee = d1.year
        new_hires = _count_new_hires(db, annee, direction_id=direction_id)
        
        # Tendance team count vs période précédente
        prev_d1, prev_d2 = _get_previous_period(d1, d2)
        prev_scope_q = db.query(models.Employe).filter(
            models.Employe.statut_employe == models.StatutEmployeEnum.ACTIF
        )
        if role not in {"RH", "ADMIN", "DG", "PCA"} and emp and emp.id_direction:
            prev_scope_q = prev_scope_q.filter(models.Employe.id_direction == emp.id_direction)
        prev_equipe_count = prev_scope_q.count()
        team_trend = _calculate_trend(equipe_count, prev_equipe_count)

        out.update({
            "equipe_count": equipe_count,
            "team_trend": team_trend,
            "absences_par_dept": [{"departement": n, "absences": c} for n, c in abs_dept],
            "soldes_eleves": soldes_eleves,
            "soldes_faibles": soldes_faibles,
            "turnover_pct": round(turnover_pct, 1),
            "retention_pct": round(retention_pct, 1),
            "new_hires": new_hires,
        })

    return out


def _ctx_analytics(db: Session, current_user: dict, filters: dict) -> dict:
    """Contexte pour la page Analytics RH globale."""
    d1, d2 = _parse_period(filters)
    direction = filters.get("direction") if filters.get("direction") not in (None, "tous", "all") else None
    entite = filters.get("entite") if filters.get("entite") not in (None, "tous", "all") else None

    # Résoudre les noms vers IDs (les filtres front envoient soit le nom soit l'ID)
    id_direction = None
    id_entite = None
    if direction:
        try:
            id_direction = int(direction)
        except (ValueError, TypeError):
            d_obj = db.query(models.Direction).filter(models.Direction.nom == direction).first()
            id_direction = d_obj.id_direction if d_obj else None
    if entite:
        try:
            id_entite = int(entite)
        except (ValueError, TypeError):
            e_obj = db.query(models.Entite).filter(models.Entite.nom == entite).first()
            id_entite = e_obj.id_entite if e_obj else None

    base_emp = db.query(models.Employe)
    if id_direction is not None:
        base_emp = base_emp.filter(models.Employe.id_direction == id_direction)
    if id_entite is not None:
        base_emp = base_emp.filter(models.Employe.id_entite == id_entite)

    nb_total = base_emp.count()
    nb_actifs = base_emp.filter(models.Employe.statut_employe == models.StatutEmployeEnum.ACTIF).count()
    hommes = base_emp.filter(models.Employe.sexe == models.SexeEnum.M).count()
    femmes = base_emp.filter(models.Employe.sexe == models.SexeEnum.F).count()

    base_op = db.query(models.Operation).filter(
        models.Operation.date_debut >= d1,
        models.Operation.date_debut <= d2,
    )

    # Comptes par statut (congés + missions globaux)
    conges_statuses = _count_operations_by_status(db, d1, d2, type_demande="Congé")
    missions_statuses = _count_operations_by_status(db, d1, d2, type_demande="Mission")
    
    conges_att = conges_statuses.get("en_attente", 0)
    conges_app = conges_statuses.get("validees", 0)
    conges_ref = conges_statuses.get("refusees", 0)
    missions_att = missions_statuses.get("en_attente", 0)
    missions_app = missions_statuses.get("validees", 0)
    missions_ref = missions_statuses.get("refusees", 0)

    today = datetime.utcnow().date()
    missions_longues = db.query(func.count(models.Operation.id_operation)).filter(
        models.Operation.type_demande == "Mission",
        models.Operation.statut == "approuvé",
        models.Operation.date_debut < today - timedelta(days=30),
    ).scalar() or 0

    de_att = db.query(func.count(models.DemandeExplicationV2.id_de)).filter(
        models.DemandeExplicationV2.statut == "EN_ATTENTE").scalar() or 0
    mesures = db.query(func.count(models.MesureDisciplinaire.id_mesure)).scalar() or 0

    soldes_eleves = base_emp.filter(
        models.Employe.solde_conges > 36,
        models.Employe.statut_employe == models.StatutEmployeEnum.ACTIF,
    ).count()

    # Top département absences
    abs_dept = (
        db.query(models.Departement.nom, func.count(models.Operation.id_operation))
        .join(models.Employe, models.Operation.matricule == models.Employe.matricule)
        .join(models.Departement, models.Departement.dept_id == models.Employe.dept_id)
        .filter(
            models.Operation.type_demande.in_(["Congé", "Absence"]),
            models.Operation.statut == "approuvé",
            models.Operation.date_debut >= d1,
            models.Operation.date_debut <= d2,
        )
        .group_by(models.Departement.nom)
        .order_by(func.count(models.Operation.id_operation).desc())
        .limit(5)
        .all()
    )
    
    # Turnover, rétention, nouvelles recrues
    turnover_pct = _calculate_turnover(db, d1, d2, direction_id=id_direction, entite_id=id_entite)
    retention_pct = 100 - turnover_pct
    new_hires = _count_new_hires(db, d1.year, direction_id=id_direction, entite_id=id_entite)
    
    # Tendance opérations vs période précédente
    prev_d1, prev_d2 = _get_previous_period(d1, d2)
    prev_total_ops = db.query(func.count(models.Operation.id_operation)).filter(
        models.Operation.date_debut >= prev_d1,
        models.Operation.date_debut <= prev_d2,
    ).scalar() or 0
    current_total_ops = base_op.count()
    ops_trend = _calculate_trend(current_total_ops, prev_total_ops)

    return {
        "periode": f"{d1.isoformat()} → {d2.isoformat()}",
        "filtres_appliques": {"direction": direction, "entite": entite},
        "effectif": {"total": nb_total, "actifs": nb_actifs, "hommes": hommes, "femmes": femmes},
        "conges": {
            "en_attente": conges_att,
            "validees": conges_app,
            "refusees": conges_ref,
            "soldes_eleves": soldes_eleves,
        },
        "missions": {
            "en_attente": missions_att,
            "validees": missions_app,
            "refusees": missions_ref,
            "longues": int(missions_longues),
        },
        "operations": {
            "total": current_total_ops,
            "trend": ops_trend,
        },
        "demandes_explication_ouvertes": int(de_att),
        "mesures_disciplinaires": int(mesures),
        "absences_par_dept": [{"departement": n, "absences": c} for n, c in abs_dept],
        "turnover_pct": round(turnover_pct, 1),
        "retention_pct": round(retention_pct, 1),
        "new_hires": new_hires,
    }


def _ctx_score_comportemental(db: Session, filters: dict) -> dict:
    """Contexte pour la page Score Comportemental."""
    d1, d2 = _parse_period(filters)
    
    # Demandes d'explication period courant
    de_total = db.query(func.count(models.DemandeExplicationV2.id_de)).filter(
        models.DemandeExplicationV2.cree_le >= d1,
        models.DemandeExplicationV2.cree_le <= d2,
    ).scalar() or 0
    de_attente = db.query(func.count(models.DemandeExplicationV2.id_de)).filter(
        models.DemandeExplicationV2.cree_le >= d1,
        models.DemandeExplicationV2.cree_le <= d2,
        models.DemandeExplicationV2.statut == "EN_ATTENTE").scalar() or 0
    
    # Mesures disciplinaires period courant
    mesures_total = db.query(func.count(models.MesureDisciplinaire.id_mesure)).filter(
        models.MesureDisciplinaire.date_mesure >= d1,
        models.MesureDisciplinaire.date_mesure <= d2,
    ).scalar() or 0
    
    # Period précédent pour tendances
    prev_d1, prev_d2 = _get_previous_period(d1, d2)
    prev_de_total = db.query(func.count(models.DemandeExplicationV2.id_de)).filter(
        models.DemandeExplicationV2.cree_le >= prev_d1,
        models.DemandeExplicationV2.cree_le <= prev_d2,
    ).scalar() or 0
    prev_mesures_total = db.query(func.count(models.MesureDisciplinaire.id_mesure)).filter(
        models.MesureDisciplinaire.date_mesure >= prev_d1,
        models.MesureDisciplinaire.date_mesure <= prev_d2,
    ).scalar() or 0
    
    # Tendances
    de_trend = _calculate_trend(de_total, prev_de_total)
    mesures_trend = _calculate_trend(mesures_total, prev_mesures_total)
    
    return {
        "periode": f"{d1.isoformat()} → {d2.isoformat()}",
        "demandes_explication": {"total": int(de_total), "en_attente": int(de_attente), "trend": de_trend},
        "mesures_disciplinaires": {"total": int(mesures_total), "trend": mesures_trend},
    }


def collect_context(db: Session, current_user: dict, page: str, tab: Optional[str], filters: dict) -> dict:
    page = (page or "dashboard").lower()
    tab = tab or "personnel"
    if page == "analytics":
        return _ctx_analytics(db, current_user, filters)
    if page == "score_comportemental":
        return _ctx_score_comportemental(db, filters)
    return _ctx_dashboard(db, current_user, filters, tab)


# ── Ollama ──────────────────────────────────────────────────────────────────

def call_ollama(prompt: str, timeout: float = 45.0) -> Optional[str]:
    base_url = os.environ.get("OLLAMA_BASE_URL", "http://ollama:11434")
    try:
        resp = httpx.post(
            f"{base_url}/api/generate",
            json={"model": "mistral", "prompt": prompt, "stream": False, "options": {"temperature": 0.3}},
            timeout=timeout,
        )
        resp.raise_for_status()
        return (resp.json().get("response") or "").strip() or None
    except Exception:
        return None


def _build_prompt(page: str, tab: str, ctx: dict, lang: str, depth: str) -> str:
    lang_label = "français" if lang == "fr" else "English"
    depth_instr = {
        "court": "Sois très synthétique : 3 bullets max par section.",
        "moyen": "Synthèse claire avec 4-6 KPIs et 3-4 recommandations.",
        "détaillé": "Rapport complet avec narratif structuré, KPIs détaillés, recommandations priorisées (haute/moyenne/basse).",
        "detaille": "Rapport complet avec narratif structuré, KPIs détaillés, recommandations priorisées (haute/moyenne/basse).",
    }.get(depth, "Synthèse claire avec 4-6 KPIs et 3-4 recommandations.")

    return (
        f"Tu es un consultant RH senior. Analyse les données ci-dessous et "
        f"génère STRICTEMENT un JSON valide en {lang_label}, sans texte avant/après, "
        f"avec EXACTEMENT cette structure :\n"
        '{\n'
        '  "synthese": "<paragraphe synthétique 3-5 phrases>",\n'
        '  "kpis": [{"label":"<nom>","value":"<valeur>","trend":"<+/-X% ou null>","alert":<true|false>}],\n'
        '  "points_attention": ["<alerte 1>", "<alerte 2>"],\n'
        '  "recommandations": [{"priorite":"haute|moyenne|basse","action":"<action concrete>","cible":"<qui>"}],\n'
        '  "narratif": "<rapport narratif 200-350 mots>"\n'
        '}\n\n'
        f"Page : {page} | Onglet : {tab}\n"
        f"Niveau de détail : {depth_instr}\n"
        f"Données :\n{json.dumps(ctx, ensure_ascii=False, indent=2, default=str)}\n\n"
        "IMPORTANT : retourne UNIQUEMENT le JSON, rien d'autre."
    )


def _extract_json(text: str) -> Optional[dict]:
    """Extrait le premier objet JSON valide d'un texte (gère les blocs ```json ```)."""
    if not text:
        return None
    # Bloc ```json ... ```
    m = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
    if m:
        try:
            return json.loads(m.group(1))
        except Exception:
            pass
    # Premier { ... } équilibré
    start = text.find("{")
    while start != -1:
        depth = 0
        for i in range(start, len(text)):
            if text[i] == "{":
                depth += 1
            elif text[i] == "}":
                depth -= 1
                if depth == 0:
                    candidate = text[start:i + 1]
                    try:
                        return json.loads(candidate)
                    except Exception:
                        break
        start = text.find("{", start + 1)
    return None


# ── Fallback déterministe ───────────────────────────────────────────────────

def _fallback_dashboard_personnel(ctx: dict, lang: str) -> dict:
    e = ctx.get("employe") or {}
    ops = ctx.get("operations") or {}
    solde = e.get("solde_conges", 0) or 0
    nb_de = ctx.get("demandes_explication", 0)
    nb_mesures = ctx.get("mesures_disciplinaires", 0)

    kpis = [
        {"label": "Opérations totales", "value": str(ops.get("total", 0)),
         "trend": ops.get("trend"), "alert": False},
        {"label": "Validées", "value": str(ops.get("validees", 0)),
         "trend": None, "alert": False},
        {"label": "Refusées", "value": str(ops.get("refusees", 0)),
         "trend": None, "alert": ops.get("refusees", 0) > 0},
        {"label": "En attente", "value": str(ops.get("en_attente", 0)),
         "trend": None, "alert": ops.get("en_attente", 0) > 0},
        {"label": "Solde congé", "value": f"{solde:.1f} j",
         "trend": None, "alert": solde > 36 or solde < 3},
        {"label": "Demandes explication", "value": str(nb_de),
         "trend": None, "alert": nb_de > 0},
        {"label": "Mesures disciplinaires", "value": str(nb_mesures),
         "trend": None, "alert": nb_mesures > 0},
    ]
    
    points = []
    if solde > 36:
        points.append(f"Solde de congé élevé ({solde:.1f} j) — risque de perte de jours en fin d'année.")
    if ops.get("en_attente", 0) > 0:
        points.append(f"{ops['en_attente']} opération(s) en attente de validation.")
    if ops.get("refusees", 0) > 0:
        points.append(f"{ops['refusees']} opération(s) refusée(s) — vérifier les motifs.")
    if nb_mesures >= 2:
        points.append("Plusieurs mesures disciplinaires — vigilance accrue requise.")
    if nb_de > 0:
        points.append(f"{nb_de} demande(s) d'explication au dossier.")

    recs = []
    if solde > 36:
        recs.append({"priorite": "haute", "action": "Planifier la prise de congé avant fin d'exercice",
                     "cible": e.get("nom") or "Employé"})
    if ops.get("en_attente", 0) > 2:
        recs.append({"priorite": "moyenne", "action": "Relancer la hiérarchie pour validation des opérations",
                     "cible": "Manager direct"})
    if ops.get("refusees", 0) > 0:
        recs.append({"priorite": "basse", "action": "Analyser les raisons de refus et ajuster les demandes futures",
                     "cible": "Employé + Manager"})
    if nb_mesures >= 2:
        recs.append({"priorite": "haute", "action": "Programmer un entretien de recadrage et un plan de suivi",
                     "cible": "RH + Manager"})
    if not recs:
        recs.append({"priorite": "basse", "action": "Maintenir le suivi régulier — profil stable",
                     "cible": "Manager"})

    nom = e.get("nom", "Employé")
    synth = (
        f"{nom} : {ops.get('total', 0)} opération(s) ({ops.get('validees', 0)} validées, "
        f"{ops.get('refusees', 0)} refusées, {ops.get('en_attente', 0)} en attente). "
        f"Solde congé : {solde:.1f} j. {nb_de} DE, {nb_mesures} mesure(s) disciplinaire(s)."
    )
    narratif = synth + " " + (" ".join(points) if points else "Profil stable, aucune alerte.")
    return {"synthese": synth, "kpis": kpis, "points_attention": points or [_t("no_alert", lang)],
            "recommandations": recs, "narratif": narratif}


def _fallback_dashboard_equipes(ctx: dict, lang: str) -> dict:
    eff = ctx.get("equipe_count", 0)
    abs_top = ctx.get("absences_par_dept") or []
    soldes_eleves = ctx.get("soldes_eleves", 0)
    soldes_faibles = ctx.get("soldes_faibles", 0)
    turnover_pct = ctx.get("turnover_pct", 0)
    retention_pct = ctx.get("retention_pct", 100)
    new_hires = ctx.get("new_hires", 0)
    team_trend = ctx.get("team_trend")

    kpis = [
        {"label": _t("actifs", lang), "value": str(eff), "trend": team_trend, "alert": False},
        {"label": "Turnover annuel", "value": f"{turnover_pct:.1f}%",
         "trend": None, "alert": turnover_pct > 15},
        {"label": "Rétention", "value": f"{retention_pct:.1f}%",
         "trend": None, "alert": retention_pct < 85},
        {"label": "Nouvelles recrues", "value": str(new_hires),
         "trend": None, "alert": new_hires > 0},
        {"label": _t("soldes_eleves", lang), "value": str(soldes_eleves),
         "trend": None, "alert": soldes_eleves > 0},
        {"label": "Soldes critiques (<3 j)", "value": str(soldes_faibles),
         "trend": None, "alert": soldes_faibles > 0},
    ]
    if abs_top:
        kpis.append({"label": _t("absences_dept_top", lang),
                     "value": f"{abs_top[0]['departement']} ({abs_top[0]['absences']})",
                     "trend": None, "alert": abs_top[0]["absences"] > 5})

    points = []
    if turnover_pct > 15:
        points.append(f"Turnover élevé ({turnover_pct:.1f}%) — risque de départ massif.")
    if retention_pct < 85:
        points.append(f"Rétention faible ({retention_pct:.1f}%) — vigilance requise.")
    if new_hires > 5:
        points.append(f"{new_hires} nouvelles recrues à intégrer.")
    if soldes_eleves > 0:
        points.append(f"{soldes_eleves} collaborateur(s) avec un solde supérieur à 36 jours.")
    if abs_top and abs_top[0]["absences"] > 5:
        points.append(f"Absentéisme élevé dans le département {abs_top[0]['departement']} "
                      f"({abs_top[0]['absences']} absences).")

    recs = []
    if turnover_pct > 15:
        recs.append({"priorite": "haute",
                     "action": "Audit RH sur rétention et conditions de travail",
                     "cible": "RH + DG"})
    if retention_pct < 85:
        recs.append({"priorite": "haute",
                     "action": "Plan de fidélisation : revue salaires et carrière",
                     "cible": "Comité de direction"})
    if new_hires > 5:
        recs.append({"priorite": "moyenne",
                     "action": "Renforcer l'onboarding et le mentorat",
                     "cible": "RH + Managers"})
    if soldes_eleves > 0:
        recs.append({"priorite": "moyenne",
                     "action": f"Planifier la prise de congé pour {soldes_eleves} employé(s) à solde élevé",
                     "cible": "Managers d'équipe"})
    if abs_top and abs_top[0]["absences"] > 5:
        recs.append({"priorite": "moyenne",
                     "action": f"Analyser les causes d'absentéisme au département {abs_top[0]['departement']}",
                     "cible": "RH + Manager département"})
    if not recs:
        recs.append({"priorite": "basse", "action": "Continuer le suivi mensuel des indicateurs",
                     "cible": "Managers"})

    synth = (
        f"Effectif : {eff} | Turnover : {turnover_pct:.1f}% | Rétention : {retention_pct:.1f}% | "
        f"Nouvelles recrues : {new_hires} | Soldes élevés : {soldes_eleves} | Soldes critiques : {soldes_faibles} | "
        + (f"Top absences : {abs_top[0]['departement']} ({abs_top[0]['absences']})." if abs_top else "Absences normales.")
    )
    return {"synthese": synth, "kpis": kpis,
            "points_attention": points or [_t("no_alert", lang)],
            "recommandations": recs, "narratif": synth + " " + " ".join(points)}


def _fallback_analytics(ctx: dict, lang: str) -> dict:
    eff = ctx.get("effectif") or {}
    cg = ctx.get("conges") or {}
    ms = ctx.get("missions") or {}
    abs_top = ctx.get("absences_par_dept") or []
    de = ctx.get("demandes_explication_ouvertes", 0)
    mes = ctx.get("mesures_disciplinaires", 0)
    ops = ctx.get("operations") or {}
    turnover_pct = ctx.get("turnover_pct", 0)
    retention_pct = ctx.get("retention_pct", 100)
    new_hires = ctx.get("new_hires", 0)

    kpis = [
        {"label": _t("effectif", lang), "value": str(eff.get("total", 0)), "trend": None, "alert": False},
        {"label": _t("actifs", lang), "value": str(eff.get("actifs", 0)), "trend": None, "alert": False},
        {"label": "H / F", "value": f"{eff.get('hommes', 0)} / {eff.get('femmes', 0)}",
         "trend": None, "alert": False},
        {"label": "Turnover annuel", "value": f"{turnover_pct:.1f}%",
         "trend": None, "alert": turnover_pct > 15},
        {"label": "Rétention", "value": f"{retention_pct:.1f}%",
         "trend": None, "alert": retention_pct < 85},
        {"label": "Nouvelles recrues", "value": str(new_hires),
         "trend": None, "alert": new_hires > 5},
        {"label": "Opérations totales", "value": str(ops.get("total", 0)),
         "trend": ops.get("trend"), "alert": False},
        {"label": "Congés validés", "value": str(cg.get("validees", 0)),
         "trend": None, "alert": False},
        {"label": "Congés en attente", "value": str(cg.get("en_attente", 0)),
         "trend": None, "alert": cg.get("en_attente", 0) > 5},
        {"label": "Congés refusés", "value": str(cg.get("refusees", 0)),
         "trend": None, "alert": cg.get("refusees", 0) > 0},
        {"label": "Missions validées", "value": str(ms.get("validees", 0)),
         "trend": None, "alert": False},
        {"label": "Missions en attente", "value": str(ms.get("en_attente", 0)),
         "trend": None, "alert": ms.get("en_attente", 0) > 0},
        {"label": "Missions refusées", "value": str(ms.get("refusees", 0)),
         "trend": None, "alert": ms.get("refusees", 0) > 0},
        {"label": _t("missions_longues", lang), "value": str(ms.get("longues", 0)),
         "trend": None, "alert": ms.get("longues", 0) > 0},
        {"label": _t("soldes_eleves", lang), "value": str(cg.get("soldes_eleves", 0)),
         "trend": None, "alert": cg.get("soldes_eleves", 0) > 0},
        {"label": _t("de_ouvertes", lang), "value": str(de), "trend": None, "alert": de > 0},
        {"label": _t("mesures", lang), "value": str(mes), "trend": None, "alert": mes > 5},
    ]
    if abs_top:
        kpis.append({"label": _t("absences_dept_top", lang),
                     "value": f"{abs_top[0]['departement']} ({abs_top[0]['absences']})",
                     "trend": None, "alert": abs_top[0]["absences"] > 10})

    points = []
    if turnover_pct > 15:
        points.append(f"Turnover élevé ({turnover_pct:.1f}%) — analyse des départs recommandée.")
    if retention_pct < 85:
        points.append(f"Rétention faible ({retention_pct:.1f}%) — risque de stabilité.")
    if new_hires > 5:
        points.append(f"{new_hires} nouvelles recrues à intégrer et former.")
    if cg.get("en_attente", 0) > 5:
        points.append(f"Volume élevé de congés en attente ({cg['en_attente']}) — délai de traitement à surveiller.")
    if cg.get("refusees", 0) > 0:
        points.append(f"{cg['refusees']} demande(s) de congé refusée(s) — vérifier les justifications.")
    if ms.get("en_attente", 0) > 0:
        points.append(f"{ms['en_attente']} mission(s) en attente de validation.")
    if ms.get("refusees", 0) > 0:
        points.append(f"{ms['refusees']} mission(s) refusée(s).")
    if ms.get("longues", 0) > 0:
        points.append(f"{ms['longues']} mission(s) en cours depuis plus de 30 jours sans clôture.")
    if de > 0:
        points.append(f"{de} demande(s) d'explication non traitée(s).")
    if cg.get("soldes_eleves", 0) > 0:
        points.append(f"{cg['soldes_eleves']} employé(s) avec solde > 36 j (risque de perte).")
    if abs_top and abs_top[0]["absences"] > 10:
        points.append(f"Absentéisme concentré sur {abs_top[0]['departement']} ({abs_top[0]['absences']} absences).")

    recs = []
    if turnover_pct > 15:
        recs.append({"priorite": "haute", "action": "Audit RH sur rétention et conditions",
                     "cible": "RH + DG"})
    if retention_pct < 85:
        recs.append({"priorite": "haute", "action": "Plan de fidélisation prioritaire",
                     "cible": "Comité de direction"})
    if new_hires > 5:
        recs.append({"priorite": "moyenne", "action": "Renforcer onboarding et mentorat",
                     "cible": "RH + Managers"})
    if cg.get("en_attente", 0) > 5:
        recs.append({"priorite": "haute", "action": "Traiter en priorité les demandes de congé en attente",
                     "cible": "Managers + RH"})
    if cg.get("refusees", 0) > 0:
        recs.append({"priorite": "moyenne", "action": "Analyser et communiquer les motifs de refus",
                     "cible": "RH + Managers"})
    if ms.get("longues", 0) > 0:
        recs.append({"priorite": "haute",
                     "action": f"Clôturer les {ms['longues']} mission(s) longue(s) et déclencher les remboursements",
                     "cible": "Comptabilité + Missionnaires"})
    if cg.get("soldes_eleves", 0) > 0:
        recs.append({"priorite": "moyenne",
                     "action": "Établir un plan d'écoulement des soldes congé élevés avant fin d'exercice",
                     "cible": "RH"})
    if abs_top and abs_top[0]["absences"] > 10:
        recs.append({"priorite": "moyenne",
                     "action": f"Audit absentéisme sur {abs_top[0]['departement']} (causes, ergonomie, charge)",
                     "cible": "RH + Manager département"})
    if de > 0:
        recs.append({"priorite": "moyenne",
                     "action": "Relancer le traitement des demandes d'explication ouvertes",
                     "cible": "Managers concernés"})
    if not recs:
        recs.append({"priorite": "basse", "action": "Maintenir le suivi mensuel des indicateurs RH",
                     "cible": "Direction RH"})

    synth = (
        f"Sur la période {ctx.get('periode')}, l'organisation compte {eff.get('total', 0)} employé(s) "
        f"({eff.get('actifs', 0)} actifs, {eff.get('hommes', 0)} H / {eff.get('femmes', 0)} F). "
        f"Turnover : {turnover_pct:.1f}%, Rétention : {retention_pct:.1f}%, Nouvelles recrues : {new_hires}. "
        f"Opérations : {ops.get('total', 0)} au total ({cg.get('validees', 0)} congés validés, "
        f"{ms.get('validees', 0)} missions validées). "
        f"{cg.get('en_attente', 0)} demande(s) de congé en attente, {ms.get('en_attente', 0)} mission(s) à valider."
    )
    narratif = (
        f"**1. Synthèse exécutive**\n{synth}\n\n"
        f"**2. Points d'attention**\n"
        + ("\n".join(f"- {p}" for p in points) if points else f"- {_t('no_alert', lang)}")
        + "\n\n**3. Recommandations stratégiques**\n"
        + "\n".join(f"- [{r['priorite'].upper()}] {r['action']} (→ {r['cible']})" for r in recs)
    )
    return {"synthese": synth, "kpis": kpis,
            "points_attention": points or [_t("no_alert", lang)],
            "recommandations": recs, "narratif": narratif}


def _fallback_score_comportemental(ctx: dict, lang: str) -> dict:
    de = ctx.get("demandes_explication") or {"total": 0, "en_attente": 0, "trend": None}
    mes = ctx.get("mesures_disciplinaires") or {"total": 0, "trend": None}
    
    de_total = de.get("total", 0)
    de_attente = de.get("en_attente", 0)
    de_trend = de.get("trend")
    mesures_total = mes.get("total", 0)
    mesures_trend = mes.get("trend")

    kpis = [
        {"label": "Demandes d'explication (total)", "value": str(de_total),
         "trend": de_trend, "alert": de_total > 2},
        {"label": "Demandes d'explication (en attente)", "value": str(de_attente),
         "trend": None, "alert": de_attente > 1},
        {"label": "Mesures disciplinaires", "value": str(mesures_total),
         "trend": mesures_trend, "alert": mesures_total > 3},
    ]

    points = []
    if de_total > 2:
        points.append(f"Volume de demandes d'explication élevé ({de_total}) — nécessite suivi rapproché.")
    if de_attente > 0:
        points.append(f"{de_attente} demande(s) d'explication en cours de traitement.")
    if de_trend and "+" in de_trend:
        points.append(f"Tendance à la hausse ({de_trend}) des demandes d'explication — vigilance accrue.")
    if mesures_total > 3:
        points.append(f"Nombre significatif de mesures disciplinaires ({mesures_total}) — enquête recommandée.")
    if mesures_trend and "+" in mesures_trend:
        points.append(f"Tendance à la hausse ({mesures_trend}) des mesures disciplinaires.")

    recs = []
    if de_total > 2:
        recs.append({"priorite": "haute", "action": "Audit comportemental : analyser les causes des DE",
                     "cible": "RH + Managers"})
    if de_attente > 0:
        recs.append({"priorite": "haute", "action": "Finaliser les demandes d'explication en cours",
                     "cible": "RH + Managers"})
    if mesures_total > 3:
        recs.append({"priorite": "haute", "action": "Examen des mesures disciplinaires : proportionnalité et régularité",
                     "cible": "Direction RH"})
    if de_trend and "+" in de_trend:
        recs.append({"priorite": "moyenne", "action": "Mettre en place un plan de prévention (communication, formation)",
                     "cible": "RH + Managers"})
    if not recs:
        recs.append({"priorite": "basse", "action": "Comportements conformes — continuer suivi régulier",
                     "cible": "Managers"})

    synth = (
        f"Demandes d'explication : {de_total} (dont {de_attente} en attente). "
        f"Mesures disciplinaires : {mesures_total}."
        f"{f' Tendance DE: {de_trend} | Tendance mesures: {mesures_trend}' if (de_trend or mesures_trend) else ''}"
    )
    narratif = synth + " " + (" ".join(points) if points else "Situation comportementale stable.")
    return {"synthese": synth, "kpis": kpis,
            "points_attention": points or [_t("no_alert", lang)],
            "recommandations": recs, "narratif": narratif}


def deterministic_fallback(page: str, tab: str, ctx: dict, lang: str) -> dict:
    if page == "analytics":
        return _fallback_analytics(ctx, lang)
    if page == "score_comportemental":
        return _fallback_score_comportemental(ctx, lang)
    if page == "dashboard" and tab == "personnel":
        return _fallback_dashboard_personnel(ctx, lang)
    if page == "dashboard":
        return _fallback_dashboard_equipes(ctx, lang)
    # default minimal
    return {
        "synthese": _t("no_data", lang),
        "kpis": [],
        "points_attention": [_t("no_alert", lang)],
        "recommandations": [{"priorite": "basse", "action": "Aucune action requise", "cible": "—"}],
        "narratif": _t("no_data", lang),
    }



# ── Orchestrateur ───────────────────────────────────────────────────────────

def generate_insights(
    db: Session,
    current_user: dict,
    page: str,
    tab: Optional[str],
    filters: Optional[dict],
    lang: str = "fr",
    depth: str = "détaillé",
) -> dict:
    filters = filters or {}
    lang = lang if lang in {"fr", "en"} else "fr"
    page = (page or "dashboard").lower()
    tab = (tab or "").lower() or "personnel"

    ctx = collect_context(db, current_user, page, tab, filters)

    prompt = _build_prompt(page, tab, ctx, lang, depth)
    raw = call_ollama(prompt)
    parsed = _extract_json(raw) if raw else None

    if parsed and isinstance(parsed, dict) and parsed.get("synthese"):
        result = {
            "synthese": str(parsed.get("synthese") or ""),
            "kpis": parsed.get("kpis") or [],
            "points_attention": parsed.get("points_attention") or [],
            "recommandations": parsed.get("recommandations") or [],
            "narratif": str(parsed.get("narratif") or ""),
            "source": "ollama",
        }
    else:
        fb = deterministic_fallback(page, tab, ctx, lang)
        fb["source"] = "deterministic"
        result = fb

    result["generated_at"] = datetime.utcnow().isoformat()
    result["lang"] = lang
    result["context"] = ctx
    return result
