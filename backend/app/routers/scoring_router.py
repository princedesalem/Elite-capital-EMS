"""
Router — Scoring Comportemental.

Calcule automatiquement les scores pour chaque employé sur 4 dimensions :
  1. delai_validation    : % de demandes validées en < 3h (validations workflow + réponses DE)
  2. participation_evenements : % d'inscriptions confirmées comme 'present'
  3. engagement_app      : nb de connexions dans la période
  4. esprit_equipe       : score 360° moyen (reviews_360)

Les scores sont stockés dans `score_comportemental` (1 ligne / matricule / dimension / période YYYY-MM).
L'endpoint GET /api/scores/employe/{matricule} retourne le score global + détail.
"""
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from .. import models
from ..db import get_db
from ..utils.security import get_current_user

router = APIRouter(prefix='/api/scores', tags=['scoring'])

_ROLES_RH = {'RH', 'ADMIN', 'DIRECTEUR', 'DG', 'PCA'}
# Rôles qui peuvent valider des opérations workflow (congés, permissions, missions)
_ROLES_VALIDATEUR = {'RESPONSABLE', 'DIRECTEUR', 'DFC', 'RH', 'DG', 'PCA', 'AG', 'ADMIN', 'CHEF'}


def _periode_courante() -> str:
    return datetime.utcnow().strftime('%Y-%m')


def _get_role_employe(matricule: str, db: Session) -> str:
    """Retourne le nom du rôle (majuscules) de l'employé, 'EMPLOYE' par défaut."""
    emp = db.query(models.Employe).filter_by(matricule=matricule).first()
    if emp and emp.id_role:
        role_obj = db.query(models.Role).filter_by(id=emp.id_role).first()
        return (role_obj.name or 'EMPLOYE').upper() if role_obj else 'EMPLOYE'
    return 'EMPLOYE'


def _calcul_delai_validation(
    matricule: str, periode: str, db: Session, include_validations: bool = True
) -> dict:
    """
    Règle validations (uniquement si include_validations=True, i.e. rôle validateur) :
      validé < 3h entre Operation.date_demande et Validation.timestamp_action.
    Règle DE (tous les employés) : parmi les DEs dont le date_limite_reponse tombe dans
      la période ET est déjà passée :
      - répondu avant ou à la date limite → bon
      - délai dépassé sans réponse (ou réponse tardive) → mauvais
      - délai pas encore passé → non compté
    Score = (nb bons / nb total) * 100, arrondi à 1 décimale.
    """
    from calendar import monthrange
    annee, mois = int(periode[:4]), int(periode[5:7])
    last_day = monthrange(annee, mois)[1]
    d_start = datetime(annee, mois, 1)
    d_end = datetime(annee, mois, last_day, 23, 59, 59)
    now_utc = datetime.utcnow()

    # ── Validations workflow (seulement pour les rôles validateurs) ──
    total = 0
    rapides = 0
    if include_validations:
        rows = (
            db.query(models.Validation, models.Operation)
            .join(models.Operation, models.Validation.id_operation == models.Operation.id_operation)
            .filter(
                models.Operation.matricule == matricule,
                models.Validation.timestamp_action >= d_start,
                models.Validation.timestamp_action <= d_end,
            )
            .all()
        )
        total = len(rows)
        rapides = sum(
            1 for v, op in rows
            if op.date_demande and v.timestamp_action
            and (v.timestamp_action - op.date_demande).total_seconds() <= 3 * 3600
        )
    # ── Demandes d'explication (DE) dont le délai tombe dans la période et est déjà passé ──
    # Les DE dont le délai n'est pas encore dépassé ne sont pas comptées.
    des = (
        db.query(models.DemandeExplicationV2)
        .filter(
            models.DemandeExplicationV2.matricule_employe == matricule,
            models.DemandeExplicationV2.date_limite_reponse >= d_start,
            models.DemandeExplicationV2.date_limite_reponse <= d_end,
            models.DemandeExplicationV2.date_limite_reponse <= now_utc,
        )
        .all()
    )
    de_total = len(des)
    de_respectes = sum(
        1 for de in des
        if de.date_reponse is not None and de.date_reponse <= de.date_limite_reponse
    )
    total += de_total
    rapides += de_respectes
    if total == 0:
        return {'valeur': 100.0, 'total': 0, 'rapides': 0, 'de_total': 0, 'de_respectes': 0}
    return {
        'valeur': round(rapides / total * 100, 1),
        'total': total,
        'rapides': rapides,
        'de_total': de_total,
        'de_respectes': de_respectes,
    }


def _calcul_participation(matricule: str, periode: str, db: Session) -> dict:
    from calendar import monthrange
    annee, mois = int(periode[:4]), int(periode[5:7])
    last_day = monthrange(annee, mois)[1]
    d_start = datetime(annee, mois, 1)
    d_end = datetime(annee, mois, last_day, 23, 59, 59)
    inscriptions = (
        db.query(models.InscriptionEvenement)
        .filter(
            models.InscriptionEvenement.matricule == matricule,
            models.InscriptionEvenement.inscrit_le >= d_start,
            models.InscriptionEvenement.inscrit_le <= d_end,
        )
        .all()
    )
    total = len(inscriptions)
    presents = sum(1 for i in inscriptions if i.statut == 'present')
    absents = sum(1 for i in inscriptions if i.statut == 'absent')
    valeur = round(presents / total * 100, 1) if total > 0 else 100.0
    return {'valeur': valeur, 'total': total, 'presents': presents, 'absents': absents}


def _calcul_engagement(matricule: str, periode: str, db: Session) -> dict:
    from calendar import monthrange
    annee, mois = int(periode[:4]), int(periode[5:7])
    last_day = monthrange(annee, mois)[1]
    d_start = datetime(annee, mois, 1)
    d_end = datetime(annee, mois, last_day, 23, 59, 59)
    connexions = (
        db.query(models.SessionUtilisation)
        .filter(
            models.SessionUtilisation.matricule == matricule,
            models.SessionUtilisation.date_connexion >= d_start,
            models.SessionUtilisation.date_connexion <= d_end,
        )
        .count()
    )
    # Normalisation : 20+ connexions/mois = score 100
    valeur = min(round(connexions / 20 * 100, 1), 100.0)
    return {'valeur': valeur, 'connexions': connexions}


def _calcul_esprit_equipe(matricule: str, db: Session) -> dict:
    reviews = (
        db.query(models.Review360)
        .filter(models.Review360.reviewee_id == matricule)
        .all()
    )
    if not reviews:
        return {'valeur': 50.0, 'nb_evaluateurs': 0}
    scores_flat = []
    for r in reviews:
        if isinstance(r.scores, list):
            scores_flat.extend([s for s in r.scores if isinstance(s, (int, float))])
    valeur = round(sum(scores_flat) / len(scores_flat) * 10, 1) if scores_flat else 50.0
    return {'valeur': min(valeur, 100.0), 'nb_evaluateurs': len(reviews)}


def _upsert_score(matricule: str, dimension: str, valeur: float, periode: str, details: dict, db: Session):
    existing = db.query(models.ScoreComportemental).filter_by(
        matricule=matricule, dimension=dimension, periode=periode
    ).first()
    if existing:
        existing.valeur = valeur
        existing.details = details
        existing.updated_at = datetime.utcnow()
    else:
        db.add(models.ScoreComportemental(
            matricule=matricule,
            dimension=dimension,
            valeur=valeur,
            periode=periode,
            details=details,
        ))


def _calcul_delai_annee(matricule: str, annee: int, db: Session, include_validations: bool = True) -> dict:
    if not include_validations:
        return {'valeur': 100.0, 'total': 0, 'rapides': 0}
    rows = (
        db.query(models.Validation, models.Operation)
        .join(models.Operation, models.Validation.id_operation == models.Operation.id_operation)
        .filter(
            models.Operation.matricule == matricule,
            func.year(models.Validation.timestamp_action) == annee,
        )
        .all()
    )
    total = len(rows)
    if total == 0:
        return {'valeur': 100.0, 'total': 0, 'rapides': 0}
    rapides = sum(
        1 for v, op in rows
        if op.date_demande and v.timestamp_action
        and (v.timestamp_action - op.date_demande).total_seconds() <= 3 * 3600
    )
    return {'valeur': round(rapides / total * 100, 1), 'total': total, 'rapides': rapides}


def _calcul_participation_annee(matricule: str, annee: int, db: Session) -> dict:
    base = (
        db.query(models.InscriptionEvenement)
        .filter(
            models.InscriptionEvenement.matricule == matricule,
            func.year(models.InscriptionEvenement.inscrit_le) == annee,
        )
    )
    total = base.count()
    presents = base.filter(models.InscriptionEvenement.statut == 'present').count()
    absents = (
        db.query(models.InscriptionEvenement)
        .filter(
            models.InscriptionEvenement.matricule == matricule,
            models.InscriptionEvenement.statut == 'absent',
            func.year(models.InscriptionEvenement.inscrit_le) == annee,
        )
        .count()
    )
    valeur = round(presents / total * 100, 1) if total > 0 else 100.0
    return {'valeur': valeur, 'total': total, 'presents': presents, 'absents': absents}


def _calcul_engagement_annee(matricule: str, annee: int, db: Session) -> dict:
    connexions = (
        db.query(models.SessionUtilisation)
        .filter(
            models.SessionUtilisation.matricule == matricule,
            func.year(models.SessionUtilisation.date_connexion) == annee,
        )
        .count()
    )
    # Normalisation : 240+ connexions/an (20/mois * 12) = score 100
    valeur = min(round(connexions / 240 * 100, 1), 100.0)
    return {'valeur': valeur, 'connexions': connexions}


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get('/employe/{matricule}/annee/{annee}')
def score_employe_annee(
    matricule: str,
    annee: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Score annuel agrégé sur l'année entière."""
    role = (current_user.get('role') or '').upper()
    if current_user['matricule'] != matricule and role not in _ROLES_RH:
        raise HTTPException(status_code=403, detail="Accès refusé.")

    is_val = _get_role_employe(matricule, db) in _ROLES_VALIDATEUR
    d1 = _calcul_delai_annee(matricule, annee, db, include_validations=is_val)
    d2 = _calcul_participation_annee(matricule, annee, db)
    d3 = _calcul_engagement_annee(matricule, annee, db)
    d4 = _calcul_esprit_equipe(matricule, db)

    global_score = round((d1['valeur'] + d2['valeur'] + d3['valeur'] + d4['valeur']) / 4, 1)

    return {
        'matricule': matricule,
        'periode': str(annee),
        'score_global': global_score,
        'dimensions': {
            'delai_validation': d1,
            'participation_evenements': d2,
            'engagement_app': d3,
            'esprit_equipe': d4,
        },
    }


@router.get('/employe/{matricule}')
def score_employe(
    matricule: str,
    periode: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """
    Retourne le score comportemental global + détail par dimension.
    Visible par l'employé lui-même et les rôles RH/ADMIN/DIRECTEUR/DG/PCA.
    """
    role = (current_user.get('role') or '').upper()
    if current_user['matricule'] != matricule and role not in _ROLES_RH:
        raise HTTPException(status_code=403, detail="Accès refusé.")

    p = periode or _periode_courante()

    # (re)calcul à la demande
    is_val = _get_role_employe(matricule, db) in _ROLES_VALIDATEUR
    d1 = _calcul_delai_validation(matricule, p, db, include_validations=is_val)
    d2 = _calcul_participation(matricule, p, db)
    d3 = _calcul_engagement(matricule, p, db)
    d4 = _calcul_esprit_equipe(matricule, db)

    _upsert_score(matricule, 'delai_validation', d1['valeur'], p, d1, db)
    _upsert_score(matricule, 'participation_evenements', d2['valeur'], p, d2, db)
    _upsert_score(matricule, 'engagement_app', d3['valeur'], p, d3, db)
    _upsert_score(matricule, 'esprit_equipe', d4['valeur'], p, d4, db)
    db.commit()

    global_score = round(
        (d1['valeur'] + d2['valeur'] + d3['valeur'] + d4['valeur']) / 4, 1
    )

    return {
        'matricule': matricule,
        'periode': p,
        'score_global': global_score,
        'dimensions': {
            'delai_validation': d1,
            'participation_evenements': d2,
            'engagement_app': d3,
            'esprit_equipe': d4,
        },
    }


@router.get('/entreprise')
def score_entreprise(
    periode: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """
    Score moyen entreprise depuis les scores stockés — RH/ADMIN/DIRECTEUR/DG/PCA.
    Retourne : score_moyen, 4 dimensions moyennées, top 3, bottom 3, distribution.
    """
    role = (current_user.get('role') or '').upper()
    if role not in _ROLES_RH:
        raise HTTPException(status_code=403, detail='Accès refusé.')

    p = periode or _periode_courante()
    _DIMS = ['delai_validation', 'participation_evenements', 'engagement_app', 'esprit_equipe']

    scores_db = (
        db.query(models.ScoreComportemental)
        .filter(models.ScoreComportemental.periode == p)
        .all()
    )

    if not scores_db:
        return {
            'periode': p,
            'score_moyen': None,
            'nb_employes': 0,
            'dimensions': {d: None for d in _DIMS},
            'top_performers': [],
            'bottom_performers': [],
            'distribution': {'excellent': 0, 'bien': 0, 'moyen': 0, 'insuffisant': 0},
        }

    # Regrouper par matricule
    by_emp: dict = {}
    for s in scores_db:
        if s.matricule not in by_emp:
            by_emp[s.matricule] = {}
        by_emp[s.matricule][s.dimension] = float(s.valeur)

    matricules = list(by_emp.keys())
    employes_map = {
        e.matricule: e
        for e in db.query(models.Employe).filter(models.Employe.matricule.in_(matricules)).all()
    }

    emp_scores = []
    for mat, dims in by_emp.items():
        if len(dims) < len(_DIMS):
            continue
        global_s = round(sum(dims.values()) / len(_DIMS), 1)
        emp = employes_map.get(mat)
        emp_scores.append({
            'matricule': mat,
            'prenom': emp.prenom if emp else '',
            'nom': emp.nom if emp else mat,
            'fonction': emp.fonction if emp else '',
            'score_global': global_s,
            'dimensions': dims,
        })

    emp_scores.sort(key=lambda x: x['score_global'], reverse=True)
    n = len(emp_scores)

    dim_avgs = {}
    for dk in _DIMS:
        vals = [by_emp[m][dk] for m in by_emp if dk in by_emp[m]]
        dim_avgs[dk] = round(sum(vals) / len(vals), 1) if vals else None

    score_moyen = round(sum(e['score_global'] for e in emp_scores) / n, 1) if n else None

    distribution = {'excellent': 0, 'bien': 0, 'moyen': 0, 'insuffisant': 0}
    for e in emp_scores:
        v = e['score_global']
        if v >= 80:
            distribution['excellent'] += 1
        elif v >= 65:
            distribution['bien'] += 1
        elif v >= 50:
            distribution['moyen'] += 1
        else:
            distribution['insuffisant'] += 1

    top3 = emp_scores[:3]
    bot3 = (emp_scores[-3:])[::-1] if n > 3 else emp_scores[::-1]

    return {
        'periode': p,
        'score_moyen': score_moyen,
        'nb_employes': n,
        'dimensions': dim_avgs,
        'top_performers': top3,
        'bottom_performers': bot3,
        'distribution': distribution,
    }


@router.get('/equipe/{id_direction}')
def score_equipe(
    id_direction: int,
    periode: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Score moyen d'une équipe — réservé RH/ADMIN/DIRECTEUR/DG/PCA."""
    role = (current_user.get('role') or '').upper()
    if role not in _ROLES_RH:
        raise HTTPException(status_code=403, detail="Accès refusé.")

    p = periode or _periode_courante()
    employes = db.query(models.Employe).filter_by(id_direction=id_direction).all()
    if not employes:
        return {'id_direction': id_direction, 'periode': p, 'score_moyen': None, 'membres': []}

    resultats = []
    for emp in employes:
        is_val = _get_role_employe(emp.matricule, db) in _ROLES_VALIDATEUR
        d1 = _calcul_delai_validation(emp.matricule, p, db, include_validations=is_val)
        d2 = _calcul_participation(emp.matricule, p, db)
        d3 = _calcul_engagement(emp.matricule, p, db)
        d4 = _calcul_esprit_equipe(emp.matricule, db)
        g = round((d1['valeur'] + d2['valeur'] + d3['valeur'] + d4['valeur']) / 4, 1)
        resultats.append({
            'matricule': emp.matricule,
            'nom': f"{emp.prenom} {emp.nom}",
            'score_global': g,
        })

    score_moyen = round(sum(r['score_global'] for r in resultats) / len(resultats), 1)
    return {
        'id_direction': id_direction,
        'periode': p,
        'score_moyen': score_moyen,
        'membres': resultats,
    }


@router.post('/recalcul-tous')
def recalcul_tous(
    periode: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """
    Recalcule les scores comportementaux pour tous les employés actifs.
    Réservé aux rôles RH / ADMIN / DG / PCA.
    """
    role = (current_user.get('role') or '').upper()
    if role not in _ROLES_RH:
        raise HTTPException(status_code=403, detail='Accès refusé.')

    p = periode or _periode_courante()

    employes = (
        db.query(models.Employe)
        .filter(models.Employe.statut_employe == models.StatutEmployeEnum.ACTIF)
        .all()
    )

    for emp in employes:
        is_val = _get_role_employe(emp.matricule, db) in _ROLES_VALIDATEUR
        d1 = _calcul_delai_validation(emp.matricule, p, db, include_validations=is_val)
        d2 = _calcul_participation(emp.matricule, p, db)
        d3 = _calcul_engagement(emp.matricule, p, db)
        d4 = _calcul_esprit_equipe(emp.matricule, db)
        _upsert_score(emp.matricule, 'delai_validation', d1['valeur'], p, d1, db)
        _upsert_score(emp.matricule, 'participation_evenements', d2['valeur'], p, d2, db)
        _upsert_score(emp.matricule, 'engagement_app', d3['valeur'], p, d3, db)
        _upsert_score(emp.matricule, 'esprit_equipe', d4['valeur'], p, d4, db)

    db.commit()
    return {'recalcules': len(employes), 'periode': p}
