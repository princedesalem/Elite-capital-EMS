"""
Router pour le système d'évaluations et fiches de poste
"""
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from datetime import date, datetime
from ..db import get_db
from .. import models
from ..utils import evaluations as eval_utils, notifications, security
from ..utils.evaluation_routing import determiner_evaluateur

router = APIRouter(prefix='/api/evaluations', tags=['evaluations'])


# ---------------------------------------------------------------------------
# Grille d'évaluation — 3 axes, 10 critères, total max = 100 pts
# ---------------------------------------------------------------------------
AXES = [
    {
        "id": "techniques",
        "label": "Compétences Techniques",
        "poids": 40,
        "criteres": [
            {"id": "outils",    "label": "Maîtrise des outils métier"},
            {"id": "qualite",   "label": "Qualité du travail"},
            {"id": "temps",     "label": "Gestion du temps et des priorités"},
            {"id": "autonomie", "label": "Autonomie et résolution de problèmes"},
        ],
    },
    {
        "id": "comportement",
        "label": "Comportement Professionnel",
        "poids": 30,
        "criteres": [
            {"id": "equipe",    "label": "Esprit d'équipe et communication"},
            {"id": "regles",    "label": "Respect des règles et procédures"},
            {"id": "presence",  "label": "Présence et ponctualité"},
        ],
    },
    {
        "id": "resultats",
        "label": "Résultats & Objectifs",
        "poids": 30,
        "criteres": [
            {"id": "objectifs",    "label": "Atteinte des objectifs fixés"},
            {"id": "initiative",   "label": "Initiative et amélioration continue"},
            {"id": "adaptabilite", "label": "Adaptabilité et gestion du changement"},
        ],
    },
]

TOTAL_CRITERES = sum(len(ax["criteres"]) for ax in AXES)  # 10


def _calc_note(axes_data: dict) -> float:
    """Calcule la note /100 depuis le dict axes {axe_id: {critere_id: note/10}}."""
    total = 0.0
    for axe in AXES:
        ax_data = axes_data.get(axe["id"]) or {}
        nb = len(axe["criteres"])
        ax_sum = sum(float(ax_data.get(c["id"], 0)) for c in axe["criteres"])
        # chaque critère /10 ; axe contribue axe["poids"] pts au total
        total += (ax_sum / (nb * 10)) * axe["poids"]
    return round(total, 2)


def _token_matricule(request: Request) -> Optional[str]:
    auth = request.headers.get("authorization", "")
    if not auth.lower().startswith("bearer "):
        return None
    try:
        payload = security.jwt.decode(
            auth.split(None, 1)[1], security.SECRET_KEY, algorithms=[security.ALGORITHM]
        )
        return payload.get("matricule") or payload.get("sub")
    except Exception:
        return None


# ---------------------------------------------------------------------------
# Nouveaux endpoints
# ---------------------------------------------------------------------------

@router.get('/axes')
def get_axes():
    """Retourne la grille d'évaluation (axes + critères) pour le frontend."""
    return AXES


@router.post('/initier', status_code=status.HTTP_201_CREATED)
def initier_evaluation(
    payload: Dict[str, Any],
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Initie une évaluation pour un employé.
    Détermine automatiquement l'évaluateur (N+1) via la hiérarchie.

    Body JSON: { "matricule": "EMP001", "periode_label": "2024" }
    """
    matricule = str(payload.get("matricule") or "").strip().upper()
    if not matricule:
        raise HTTPException(status_code=400, detail="matricule requis")

    emp = db.query(models.Employe).filter(models.Employe.matricule == matricule).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employé introuvable")

    # Vérifier qu'il n'y a pas déjà une éval EN_ATTENTE ou EN_COURS
    existing = db.query(models.Evaluation).filter(
        models.Evaluation.matricule == matricule,
        models.Evaluation.statut.in_([
            models.StatutEvaluationEnum.EN_ATTENTE_AUTO_EVAL,
            models.StatutEvaluationEnum.EN_COURS,
        ])
    ).first()
    if existing:
        raise HTTPException(
            status_code=409,
            detail=f"Une évaluation est déjà en cours (id={existing.id_eval})"
        )

    evaluateur = determiner_evaluateur(matricule, db)

    eval_obj = models.Evaluation(
        matricule=matricule,
        id_fiche=None,
        id_periode=None,
        evaluateur_matricule=evaluateur["matricule"] if evaluateur else None,
        evaluateur_role=evaluateur["role"] if evaluateur else None,
        statut=models.StatutEvaluationEnum.EN_ATTENTE_AUTO_EVAL,
        date_creation=datetime.utcnow(),
    )
    db.add(eval_obj)
    db.commit()
    db.refresh(eval_obj)

    return {
        "id_eval": eval_obj.id_eval,
        "matricule": matricule,
        "statut": eval_obj.statut.value,
        "evaluateur": evaluateur,
        "message": "Évaluation initiée. L'employé peut maintenant compléter son auto-évaluation.",
    }


@router.post('/{id_eval}/soumettre-auto')
def soumettre_auto(
    id_eval: int,
    payload: Dict[str, Any],
    request: Request,
    db: Session = Depends(get_db),
):
    """
    L'employé soumet son auto-évaluation.

    Body JSON:
    {
      "axes": {
        "techniques":   {"outils": 8, "qualite": 7, "temps": 9, "autonomie": 8},
        "comportement": {"equipe": 9, "regles": 8, "presence": 10},
        "resultats":    {"objectifs": 8, "initiative": 7, "adaptabilite": 8}
      },
      "commentaire": "..."
    }
    """
    actor = _token_matricule(request)
    eval_obj = db.query(models.Evaluation).filter(models.Evaluation.id_eval == id_eval).first()
    if not eval_obj:
        raise HTTPException(status_code=404, detail="Évaluation introuvable")

    if actor and str(actor).upper() != str(eval_obj.matricule).upper():
        raise HTTPException(status_code=403, detail="Vous ne pouvez soumettre que votre propre auto-évaluation")

    if eval_obj.statut != models.StatutEvaluationEnum.EN_ATTENTE_AUTO_EVAL:
        raise HTTPException(status_code=400, detail=f"Statut actuel '{eval_obj.statut.value}' — auto-évaluation non attendue")

    axes_data: dict = payload.get("axes") or {}
    # Valider que tous les critères sont renseignés et dans [0,10]
    for axe in AXES:
        ax = axes_data.get(axe["id"]) or {}
        for c in axe["criteres"]:
            val = ax.get(c["id"])
            if val is None:
                raise HTTPException(
                    status_code=422,
                    detail=f"Critère manquant : {axe['label']} / {c['label']}"
                )
            if not (0 <= float(val) <= 10):
                raise HTTPException(
                    status_code=422,
                    detail=f"Note invalide pour {c['label']} : {val} (doit être entre 0 et 10)"
                )

    note = _calc_note(axes_data)
    eval_obj.auto_evaluation = {"axes": axes_data, "commentaire": payload.get("commentaire", ""), "note": note}
    eval_obj.statut = models.StatutEvaluationEnum.EN_COURS
    eval_obj.date_soumission_auto = datetime.utcnow()
    db.commit()

    # Notifier l'évaluateur si connu
    if eval_obj.evaluateur_matricule:
        emp = db.query(models.Employe).filter(models.Employe.matricule == eval_obj.matricule).first()
        nom = f"{emp.prenom} {emp.nom}" if emp else eval_obj.matricule
        notifications.creer_notification(
            matricule=eval_obj.evaluateur_matricule,
            type_notification='EVALUATION',
            titre="Auto-évaluation soumise",
            message=f"{nom} a soumis son auto-évaluation. Veuillez procéder à l'évaluation hiérarchique.",
            db=db,
        )

    return {
        "id_eval": id_eval,
        "statut": eval_obj.statut.value,
        "note_auto": note,
        "message": "Auto-évaluation soumise. En attente de l'évaluation hiérarchique.",
    }


@router.post('/{id_eval}/evaluer')
def evaluer_par_n1(
    id_eval: int,
    payload: Dict[str, Any],
    request: Request,
    db: Session = Depends(get_db),
):
    """
    L'évaluateur (N+1) soumet son évaluation.

    Body JSON: même structure que /soumettre-auto
    """
    actor = _token_matricule(request)
    eval_obj = db.query(models.Evaluation).filter(models.Evaluation.id_eval == id_eval).first()
    if not eval_obj:
        raise HTTPException(status_code=404, detail="Évaluation introuvable")

    if eval_obj.statut != models.StatutEvaluationEnum.EN_COURS:
        raise HTTPException(status_code=400, detail=f"Statut actuel '{eval_obj.statut.value}' — évaluation N+1 non attendue")

    # Contrôle : seul l'évaluateur désigné peut évaluer (ou un admin/RH)
    if actor and eval_obj.evaluateur_matricule:
        actor_upper = str(actor).upper()
        eval_mat = str(eval_obj.evaluateur_matricule).upper()
        if actor_upper != eval_mat:
            # Vérifier si c'est un RH/ADMIN
            utilisateur = db.query(models.Utilisateur).filter(
                models.Utilisateur.matricule == actor_upper
            ).first()
            actor_role = (utilisateur.role.name if utilisateur and utilisateur.role else "").upper()
            if actor_role not in {"RH", "ADMIN"}:
                raise HTTPException(
                    status_code=403,
                    detail="Seul l'évaluateur désigné (ou RH/ADMIN) peut évaluer cet employé"
                )

    axes_data: dict = payload.get("axes") or {}
    for axe in AXES:
        ax = axes_data.get(axe["id"]) or {}
        for c in axe["criteres"]:
            val = ax.get(c["id"])
            if val is None:
                raise HTTPException(
                    status_code=422,
                    detail=f"Critère manquant : {axe['label']} / {c['label']}"
                )
            if not (0 <= float(val) <= 10):
                raise HTTPException(
                    status_code=422,
                    detail=f"Note invalide pour {c['label']} : {val} (doit être entre 0 et 10)"
                )

    note_n1 = _calc_note(axes_data)

    # Note finale = moyenne auto-eval (30%) + N+1 (70%)
    note_auto = float((eval_obj.auto_evaluation or {}).get("note", 0))
    note_finale = round(note_auto * 0.3 + note_n1 * 0.7, 2)

    eval_obj.evaluation_n1 = {
        "axes": axes_data,
        "commentaire": payload.get("commentaire", ""),
        "note": note_n1,
        "evaluateur_matricule": str(actor or eval_obj.evaluateur_matricule),
    }
    eval_obj.note_finale = note_finale
    eval_obj.statut = models.StatutEvaluationEnum.TERMINE
    eval_obj.date_evaluation_n1 = datetime.utcnow()
    eval_obj.date_finalisation = datetime.utcnow()
    db.commit()

    # Notifier l'employé
    notifications.creer_notification(
        matricule=eval_obj.matricule,
        type_notification='EVALUATION',
        titre="Évaluation terminée",
        message=f"Votre évaluation est terminée. Note finale : {note_finale}/100",
        db=db,
    )

    return {
        "id_eval": id_eval,
        "statut": eval_obj.statut.value,
        "note_auto": note_auto,
        "note_n1": note_n1,
        "note_finale": note_finale,
        "message": "Évaluation terminée.",
    }


@router.get('/{id_eval}/detail')
def detail_evaluation(
    id_eval: int,
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Détail complet d'une évaluation (auto-eval + N+1 + notes).
    Visible par l'employé concerné et son évaluateur.
    """
    actor = _token_matricule(request)
    eval_obj = db.query(models.Evaluation).filter(models.Evaluation.id_eval == id_eval).first()
    if not eval_obj:
        raise HTTPException(status_code=404, detail="Évaluation introuvable")

    if actor:
        actor_upper = str(actor).upper()
        emp_upper = str(eval_obj.matricule).upper()
        eval_upper = str(eval_obj.evaluateur_matricule or "").upper()
        if actor_upper not in {emp_upper, eval_upper}:
            # Vérifier rôle privilégié
            utilisateur = db.query(models.Utilisateur).filter(
                models.Utilisateur.matricule == actor_upper
            ).first()
            actor_role = (utilisateur.role.name if utilisateur and utilisateur.role else "").upper()
            if actor_role not in {"RH", "ADMIN"}:
                raise HTTPException(status_code=403, detail="Accès refusé")

    emp = db.query(models.Employe).filter(models.Employe.matricule == eval_obj.matricule).first()
    eval_emp = (
        db.query(models.Employe)
        .filter(models.Employe.matricule == eval_obj.evaluateur_matricule)
        .first()
        if eval_obj.evaluateur_matricule
        else None
    )

    return {
        "id_eval": eval_obj.id_eval,
        "matricule": eval_obj.matricule,
        "employe_nom": f"{emp.prenom} {emp.nom}" if emp else eval_obj.matricule,
        "employe_fonction": emp.fonction if emp else None,
        "evaluateur_matricule": eval_obj.evaluateur_matricule,
        "evaluateur_nom": f"{eval_emp.prenom} {eval_emp.nom}" if eval_emp else None,
        "evaluateur_role": eval_obj.evaluateur_role,
        "statut": eval_obj.statut.value,
        "axes": AXES,
        "auto_evaluation": eval_obj.auto_evaluation,
        "evaluation_n1": eval_obj.evaluation_n1,
        "note_finale": float(eval_obj.note_finale) if eval_obj.note_finale else None,
        "date_creation": eval_obj.date_creation,
        "date_soumission_auto": eval_obj.date_soumission_auto,
        "date_evaluation_n1": eval_obj.date_evaluation_n1,
    }


@router.get('/mes-evaluations-v2/{matricule}')
def mes_evaluations_v2(matricule: str, db: Session = Depends(get_db)):
    """Version enrichie : inclut le détail du workflow pour le frontend."""
    evals = (
        db.query(models.Evaluation)
        .filter(models.Evaluation.matricule == matricule)
        .order_by(models.Evaluation.date_creation.desc())
        .all()
    )

    result = []
    for e in evals:
        eval_emp = (
            db.query(models.Employe)
            .filter(models.Employe.matricule == e.evaluateur_matricule)
            .first()
            if e.evaluateur_matricule
            else None
        )
        result.append({
            "id_eval": e.id_eval,
            "statut": e.statut.value,
            "note_finale": float(e.note_finale) if e.note_finale else None,
            "note_auto": float((e.auto_evaluation or {}).get("note", 0)) if e.auto_evaluation else None,
            "note_n1": float((e.evaluation_n1 or {}).get("note", 0)) if e.evaluation_n1 else None,
            "evaluateur_nom": f"{eval_emp.prenom} {eval_emp.nom}" if eval_emp else None,
            "evaluateur_role": e.evaluateur_role,
            "date_creation": e.date_creation,
            "date_soumission_auto": e.date_soumission_auto,
            "date_evaluation_n1": e.date_evaluation_n1,
        })
    return result


@router.get('/a-evaluer-v2/{matricule_evaluateur}')
def a_evaluer_v2(matricule_evaluateur: str, db: Session = Depends(get_db)):
    """Évaluations EN_COURS assignées à cet évaluateur."""
    evals = (
        db.query(models.Evaluation)
        .filter(
            models.Evaluation.evaluateur_matricule == matricule_evaluateur,
            models.Evaluation.statut == models.StatutEvaluationEnum.EN_COURS,
        )
        .all()
    )
    result = []
    for e in evals:
        emp = db.query(models.Employe).filter(models.Employe.matricule == e.matricule).first()
        result.append({
            "id_eval": e.id_eval,
            "matricule": e.matricule,
            "employe_nom": f"{emp.prenom} {emp.nom}" if emp else e.matricule,
            "employe_fonction": emp.fonction if emp else None,
            "note_auto": float((e.auto_evaluation or {}).get("note", 0)) if e.auto_evaluation else None,
            "date_soumission_auto": e.date_soumission_auto,
        })
    return result



def creer_fiche_poste(
    matricule: str,
    objectifs: List[Dict],  # [{"titre": "...", "description": "...", "poids": 25}, ...]
    cree_par: int,
    db: Session = Depends(get_db)
):
    """
    Créer une fiche de poste avec objectifs pondérés (total doit être 100%).
    
    Exemple: [
        {"titre": "Atteindre objectif ventes", "description": "...", "poids": 40},
        {"titre": "Satisfaction client", "description": "...", "poids": 30},
        {"titre": "Innovation", "description": "...", "poids": 30}
    ]
    """
    # Vérifier que le total des poids = 100
    total_poids = sum(obj.get('poids', 0) for obj in objectifs)
    if total_poids != 100:
        raise HTTPException(
            status_code=400, 
            detail=f"Le total des pondérations doit être 100% (actuel: {total_poids}%)"
        )
    
    success, message, fiche = eval_utils.creer_fiche_de_poste(
        matricule, objectifs, cree_par, db
    )
    
    if not success:
        raise HTTPException(status_code=400, detail=message)
    
    # Notifier l'employé
    employe = db.query(models.Employe).filter(models.Employe.matricule == matricule).first()
    if employe:
        notifications.creer_notification(
            matricule=matricule,
            type_notification='EVALUATION',
            titre="Fiche de poste créée",
            message=f"Votre fiche de poste a été créée avec {len(objectifs)} objectif(s)",
            db=db
        )
    
    return {
        "id_fiche_de_poste": fiche.id_fiche,
        "matricule": matricule,
        "nombre_objectifs": len(objectifs),
        "message": message
    }


@router.get('/fiche-poste/{matricule}')
def obtenir_fiche_poste(matricule: str, db: Session = Depends(get_db)):
    """
    Obtenir la fiche de poste assignée à un employé.

    Cherche d'abord la fiche-template assignée manuellement (Employe.id_fiche_poste).
    Fallback : ancienne table Fiche_de_poste (objectifs personnalisés).
    """
    emp = db.query(models.Employe).filter(models.Employe.matricule == matricule).first()
    if emp and emp.id_fiche_poste:
        tpl = (
            db.query(models.FichePosteTemplate)
            .filter(models.FichePosteTemplate.id_template == emp.id_fiche_poste)
            .first()
        )
        if tpl:
            return {
                "id_template": tpl.id_template,
                "fonction": tpl.fonction,
                "sections": tpl.sections or [],
                "html_content": getattr(tpl, 'html_content', None) or '',
                "matricule": matricule,
                "source": "template",
            }

    # Fallback : chercher par fonction (et auto-assigner pour les appels suivants)
    if emp and emp.fonction:
        tpl = (
            db.query(models.FichePosteTemplate)
            .filter(models.FichePosteTemplate.fonction == emp.fonction)
            .first()
        )
        if tpl:
            # Auto-assignation silencieuse
            emp.id_fiche_poste = tpl.id_template
            db.commit()
            return {
                "id_template": tpl.id_template,
                "fonction": tpl.fonction,
                "sections": tpl.sections or [],
                "html_content": getattr(tpl, 'html_content', None) or '',
                "matricule": matricule,
                "source": "template",
            }

    fiche = db.query(models.FicheDePoste).filter(
        models.FicheDePoste.matricule == matricule
    ).order_by(models.FicheDePoste.date_creation.desc()).first()

    if not fiche:
        raise HTTPException(status_code=404, detail="Fiche de poste introuvable")

    return {
        "id_fiche_de_poste": fiche.id_fiche,
        "matricule": fiche.matricule,
        "objectifs": fiche.objectifs,
        "date_creation": fiche.date_creation,
        "cree_par": fiche.cree_par,
        "source": "objectifs",
    }


@router.post('/periode', status_code=status.HTTP_201_CREATED)
def creer_periode_evaluation(
    date_debut: date,
    date_fin: date,
    cree_par: int,
    db: Session = Depends(get_db)
):
    """
    Créer une période d'évaluation (généralement annuelle).
    """
    success, message, periode = eval_utils.creer_periode_evaluation(
        date_debut, date_fin, cree_par, db
    )
    
    if not success:
        raise HTTPException(status_code=400, detail=message)
    
    return {
        "id_periode_evaluation": periode.id_periode,
        "date_debut": date_debut,
        "date_fin": date_fin,
        "message": message
    }


@router.get('/periodes')
def obtenir_periodes_evaluation(db: Session = Depends(get_db)):
    """
    Obtenir toutes les périodes d'évaluation.
    """
    periodes = db.query(models.PeriodeEvaluation).order_by(
        models.PeriodeEvaluation.date_debut.desc()
    ).all()
    
    return [
        {
            "id_periode_evaluation": p.id_periode,
            "date_debut": p.date_debut,
            "date_fin": p.date_fin,
            "cree_par": p.cree_par
        }
        for p in periodes
    ]


@router.post('/auto-evaluation', status_code=status.HTTP_201_CREATED)
def soumettre_auto_evaluation(
    id_evaluation: int,
    matricule: str,
    reponses: List[Dict],  # [{"objectif_id": 1, "note": 4, "commentaire": "..."}, ...]
    db: Session = Depends(get_db)
):
    """
    Soumettre une auto-évaluation (pondération: 10%).
    """
    success, message = eval_utils.soumettre_auto_evaluation(
        id_evaluation, matricule, reponses, db
    )
    
    if not success:
        raise HTTPException(status_code=400, detail=message)
    
    return {"message": message}


@router.post('/evaluation-hierarchique', status_code=status.HTTP_201_CREATED)
def soumettre_evaluation_hierarchique(
    id_evaluation: int,
    evaluateur_matricule: str,
    evaluateur_role: str,  # RESPONSABLE, DIRECTEUR, RH, DG
    notes: List[Dict],  # [{"objectif_id": 1, "note": 4}, ...]
    commentaire: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    Soumettre une évaluation hiérarchique.
    
    Pondérations:
    - RESPONSABLE: 25%
    - DIRECTEUR: 25%
    - RH: 20%
    - DG: 20%
    """
    roles_valides = ['RESPONSABLE', 'DIRECTEUR', 'RH', 'DG']
    if evaluateur_role.upper() not in roles_valides:
        raise HTTPException(
            status_code=400, 
            detail=f"Rôle invalide. Rôles valides: {roles_valides}"
        )
    
    success, message = eval_utils.soumettre_evaluation_hierarchique(
        id_evaluation, evaluateur_matricule, evaluateur_role.upper(), notes, commentaire, db
    )
    
    if not success:
        raise HTTPException(status_code=400, detail=message)
    
    return {"message": message}


@router.get('/{id_evaluation}')
def obtenir_evaluation_complete(id_evaluation: int, db: Session = Depends(get_db)):
    """
    Obtenir une évaluation complète avec toutes les notes et la note finale.
    """
    evaluation = eval_utils.obtenir_evaluation_complete(id_evaluation, db)
    
    if not evaluation:
        raise HTTPException(status_code=404, detail="Évaluation introuvable")
    
    return evaluation


@router.post('/{id_evaluation}/calculer-note-finale')
def calculer_note_finale(id_evaluation: int, db: Session = Depends(get_db)):
    """
    Calculer la note finale pondérée une fois toutes les évaluations soumises.
    
    Pondération totale:
    - Auto-évaluation: 10%
    - Responsable: 25%
    - Directeur: 25%
    - RH: 20%
    - DG: 20%
    = 100%
    """
    evaluation = db.query(models.EvaluationEmploye).filter(
        models.EvaluationEmploye.id_eval == id_evaluation
    ).first()
    
    if not evaluation:
        raise HTTPException(status_code=404, detail="Évaluation introuvable")
    
    note_finale = eval_utils.calculer_note_finale(evaluation, db)
    
    if note_finale is None:
        raise HTTPException(
            status_code=400, 
            detail="Impossible de calculer la note finale. Toutes les évaluations ne sont pas encore soumises."
        )
    
    # Notifier l'employé
    notifications.creer_notification(
        matricule=evaluation.matricule,
        type_notification='EVALUATION',
        titre="Évaluation terminée",
        message=f"Votre évaluation est terminée. Note finale: {note_finale}/5",
        db=db
    )
    
    return {
        "id_evaluation": id_evaluation,
        "note_finale": note_finale,
        "statut": "TERMINE",
        "message": "Note finale calculée avec succès"
    }


@router.get('/mes-evaluations/{matricule}')
def obtenir_mes_evaluations(matricule: str, db: Session = Depends(get_db)):
    """
    Obtenir toutes les évaluations d'un employé.
    """
    evaluations = db.query(models.EvaluationEmploye).filter(
        models.EvaluationEmploye.matricule == matricule
    ).order_by(models.EvaluationEmploye.date_creation.desc()).all()
    
    result = []
    for e in evaluations:
        evals_json = e.evaluations or {}
        result.append({
            "id_evaluation": e.id_eval,
            "date_creation": e.date_creation,
            "statut": e.statut,
            "note_finale": float(e.note_finale) if e.note_finale else None,
            "auto_evaluation_faite": e.auto_evaluation is not None,
            "evaluation_responsable_faite": evals_json.get('responsable') is not None,
            "evaluation_directeur_faite": evals_json.get('directeur') is not None,
            "evaluation_rh_faite": evals_json.get('rh') is not None,
            "evaluation_dg_faite": evals_json.get('dg') is not None
        })
    return result


@router.get('/a-evaluer/{matricule_evaluateur}')
def obtenir_evaluations_a_faire(
    matricule_evaluateur: str,
    role_evaluateur: str,
    db: Session = Depends(get_db)
):
    """
    Obtenir les évaluations qu'un évaluateur doit encore faire.
    """
    # Trouver les employés sous la responsabilité de l'évaluateur
    # selon son rôle (RESPONSABLE: dept, DIRECTEUR: direction, etc.)
    
    evaluations_a_faire = []
    
    # Logique à implémenter selon le rôle
    # Pour l'instant, retourner toutes les évaluations en cours
    
    evaluations = db.query(models.EvaluationEmploye).filter(
        models.EvaluationEmploye.statut == 'EN_COURS'
    ).all()
    
    for ev in evaluations:
        # Vérifier si l'évaluateur a déjà évalué
        evals_json = ev.evaluations or {}
        if evals_json.get(role_evaluateur.lower()) is None:
            employe = db.query(models.Employe).filter(
                models.Employe.matricule == ev.matricule
            ).first()
            
            evaluations_a_faire.append({
                "id_evaluation": ev.id_eval,
                "matricule": ev.matricule,
                "nom_complet": f"{employe.prenom} {employe.nom}" if employe else "Inconnu",
                "fonction": employe.fonction if employe else None
            })
    
    return evaluations_a_faire
