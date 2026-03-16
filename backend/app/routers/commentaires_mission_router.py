"""
Router pour les commentaires de mission en temps réel
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime
from pydantic import BaseModel
from ..db import get_db
from .. import models
from ..utils import notifications
import json

router = APIRouter(prefix='/api/missions/commentaires', tags=['commentaires-missions'])

class CommentaireCreate(BaseModel):
    id_mission: int
    matricule: int
    commentaire: str

class CommentaireResponse(BaseModel):
    id_commentaire: int
    id_mission: int
    matricule: int
    auteur_nom: str
    auteur_fonction: str
    commentaire: str
    date_creation: datetime
    lu_par: List[int]

    class Config:
        from_attributes = True


@router.post('/creer', status_code=status.HTTP_201_CREATED)
def creer_commentaire(
    data: CommentaireCreate,
    db: Session = Depends(get_db)
):
    """
    Créer un commentaire sur une mission en cours.
    Les validateurs seront notifiés en temps réel.
    """
    # Vérifier que la mission existe
    mission = db.query(models.Mission).filter(
        models.Mission.id_mission == data.id_mission
    ).first()
    
    if not mission:
        raise HTTPException(status_code=404, detail="Mission introuvable")
    
    # Vérifier que l'employé existe
    employe = db.query(models.Employe).filter(
        models.Employe.matricule == data.matricule
    ).first()
    
    if not employe:
        raise HTTPException(status_code=404, detail="Employé introuvable")
    
    # Créer le commentaire
    commentaire = models.CommentaireMission(
        id_mission=data.id_mission,
        matricule=data.matricule,
        commentaire=data.commentaire,
        lu_par=json.dumps([data.matricule])  # L'auteur a "lu" son propre commentaire
    )
    db.add(commentaire)
    db.commit()
    db.refresh(commentaire)
    
    # Récupérer l'opération liée
    operation = db.query(models.Operation).filter(
        models.Operation.id_operation == mission.id_mission
    ).first()
    
    if operation:
        # Notifier tous les validateurs de cette opération
        validateurs = db.query(models.Validation).filter(
            models.Validation.id_operation == operation.id_operation,
            models.Validation.matricule != data.matricule  # Pas l'auteur
        ).all()
        
        for validation in validateurs:
            notifications.creer_notification(
                matricule=validation.matricule,
                type_notification='COMMENTAIRE_MISSION',
                titre=f"💬 Nouveau commentaire sur mission #{mission.id_mission}",
                message=f"{employe.prenom} {employe.nom} : {data.commentaire[:100]}{'...' if len(data.commentaire) > 100 else ''}",
                id_operation=operation.id_operation,
                db=db
            )
    
    return {
        "id_commentaire": commentaire.id_commentaire,
        "message": "Commentaire créé avec succès",
        "notifies": len(validateurs) if operation else 0
    }


@router.get('/{id_mission}', response_model=List[CommentaireResponse])
def lister_commentaires(
    id_mission: int,
    db: Session = Depends(get_db)
):
    """
    Récupérer tous les commentaires d'une mission.
    """
    commentaires = db.query(
        models.CommentaireMission,
        models.Employe
    ).join(
        models.Employe,
        models.CommentaireMission.matricule == models.Employe.matricule
    ).filter(
        models.CommentaireMission.id_mission == id_mission
    ).order_by(
        models.CommentaireMission.date_creation.desc()
    ).all()
    
    results = []
    for comm, emp in commentaires:
        lu_par_list = json.loads(comm.lu_par) if comm.lu_par else []
        results.append({
            "id_commentaire": comm.id_commentaire,
            "id_mission": comm.id_mission,
            "matricule": comm.matricule,
            "auteur_nom": f"{emp.prenom} {emp.nom}",
            "auteur_fonction": emp.fonction,
            "commentaire": comm.commentaire,
            "date_creation": comm.date_creation,
            "lu_par": lu_par_list
        })
    
    return results


@router.post('/{id_commentaire}/marquer-lu')
def marquer_commentaire_lu(
    id_commentaire: int,
    matricule: int,
    db: Session = Depends(get_db)
):
    """
    Marquer un commentaire comme lu par un utilisateur.
    """
    commentaire = db.query(models.CommentaireMission).filter(
        models.CommentaireMission.id_commentaire == id_commentaire
    ).first()
    
    if not commentaire:
        raise HTTPException(status_code=404, detail="Commentaire introuvable")
    
    lu_par_list = json.loads(commentaire.lu_par) if commentaire.lu_par else []
    
    if matricule not in lu_par_list:
        lu_par_list.append(matricule)
        commentaire.lu_par = json.dumps(lu_par_list)
        db.commit()
    
    return {"message": "Commentaire marqué comme lu"}


@router.get('/mission/{id_mission}/non-lus/{matricule}')
def compter_non_lus(
    id_mission: int,
    matricule: int,
    db: Session = Depends(get_db)
):
    """
    Compter le nombre de commentaires non lus pour un utilisateur sur une mission.
    """
    commentaires = db.query(models.CommentaireMission).filter(
        models.CommentaireMission.id_mission == id_mission
    ).all()
    
    non_lus = 0
    for comm in commentaires:
        lu_par_list = json.loads(comm.lu_par) if comm.lu_par else []
        if matricule not in lu_par_list:
            non_lus += 1
    
    return {"non_lus": non_lus}
