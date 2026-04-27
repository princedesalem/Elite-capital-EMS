"""
Router pour le système d'évaluations et fiches de poste
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional, Dict
from datetime import date
from ..db import get_db
from .. import models
from ..utils import evaluations as eval_utils, notifications

router = APIRouter(prefix='/api/evaluations', tags=['evaluations'])


@router.post('/fiche-poste', status_code=status.HTTP_201_CREATED)
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
    Obtenir la fiche de poste d'un employé.
    """
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
        "cree_par": fiche.cree_par
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
