"""
Router pour la gestion des remplaçants automatiques
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import date
from ..db import get_db
from .. import models
from ..utils import remplacants as rempl_utils, notifications

router = APIRouter(prefix='/api/remplacants', tags=['remplacants'])


@router.get('/propositions/{id_operation}')
def obtenir_remplacants_proposes(id_operation: int, db: Session = Depends(get_db)):
    """
    Obtenir les remplaçants proposés automatiquement pour une opération.
    """
    operation = db.query(models.Operation).filter(
        models.Operation.id_operation == id_operation
    ).first()
    
    if not operation:
        raise HTTPException(status_code=404, detail="Opération introuvable")
    
    # Récupérer les remplaçants proposés
    propositions = db.query(models.RemplacantPropose).filter(
        models.RemplacantPropose.id_operation == id_operation
    ).order_by(models.RemplacantPropose.ordre_proposition).all()
    
    result = []
    for prop in propositions:
        employe = db.query(models.Employe).filter(
            models.Employe.matricule == prop.matricule_remplacant
        ).first()
        
        if employe:
            result.append({
                "id_remplacant_propose": prop.id_remplacant_propose,
                "matricule": employe.matricule,
                "nom_complet": f"{employe.prenom} {employe.nom}",
                "fonction": employe.fonction,
                "departement_id": employe.dept_id,
                "direction_id": employe.id_direction,
                "ordre_proposition": prop.ordre_proposition,
                "est_accepte": prop.est_accepte
            })
    
    return result


@router.post('/generer/{id_operation}')
def generer_remplacants(
    id_operation: int,
    limite: int = 5,
    db: Session = Depends(get_db)
):
    """
    Générer automatiquement une liste de remplaçants proposés.
    
    Ordre de priorité:
    1. Subordonnés directs du même département
    2. Collègues du même département
    3. Employés de la même direction
    4. Employés de la même entité
    """
    operation = db.query(models.Operation).filter(
        models.Operation.id_operation == id_operation
    ).first()
    
    if not operation:
        raise HTTPException(status_code=404, detail="Opération introuvable")
    
    employe = db.query(models.Employe).filter(
        models.Employe.matricule == operation.matricule
    ).first()
    
    if not employe:
        raise HTTPException(status_code=404, detail="Employé introuvable")
    
    # Générer les remplaçants
    remplacants = rempl_utils.trouver_remplacants_automatiques(employe, db, limite)
    
    if not remplacants:
        return {
            "message": "Aucun remplaçant disponible trouvé",
            "remplacants": []
        }
    
    # Enregistrer les propositions
    success, message = rempl_utils.enregistrer_remplacants_proposes(
        id_operation, remplacants, db
    )
    
    if not success:
        raise HTTPException(status_code=400, detail=message)
    
    # Notifier les remplaçants proposés
    for remplacant in remplacants:
        notifications.creer_notification(
            matricule=remplacant.matricule,
            type_notification='AUTRE',
            titre="Proposition de remplacement",
            message=f"Vous êtes proposé comme remplaçant pour {employe.prenom} {employe.nom}",
            id_operation=id_operation,
            db=db
        )
    
    return {
        "message": f"{len(remplacants)} remplaçant(s) proposé(s)",
        "remplacants": [
            {
                "matricule": r.matricule,
                "nom_complet": f"{r.prenom} {r.nom}",
                "fonction": r.fonction
            }
            for r in remplacants
        ]
    }


@router.post('/{id_operation}/accepter/{matricule_remplacant}')
def accepter_remplacant(
    id_operation: int,
    matricule_remplacant: int,
    db: Session = Depends(get_db)
):
    """
    Accepter un remplaçant proposé.
    """
    success, message = rempl_utils.accepter_remplacant(
        id_operation, matricule_remplacant, db
    )
    
    if not success:
        raise HTTPException(status_code=400, detail=message)
    
    # Notifier le remplaçant accepté
    operation = db.query(models.Operation).filter(
        models.Operation.id_operation == id_operation
    ).first()
    
    employe = db.query(models.Employe).filter(
        models.Employe.matricule == operation.matricule
    ).first()
    
    notifications.creer_notification(
        matricule=matricule_remplacant,
        type_notification='AUTRE',
        titre="Remplacement confirmé",
        message=f"Vous avez été choisi pour remplacer {employe.prenom} {employe.nom}",
        id_operation=id_operation,
        db=db
    )
    
    return {"message": message}


@router.get('/disponibilite/{matricule}')
def verifier_disponibilite(
    matricule: int,
    date_debut: date,
    date_fin: date,
    db: Session = Depends(get_db)
):
    """
    Vérifier si un employé est disponible sur une période donnée.
    """
    disponible, operations_conflits = rempl_utils.verifier_disponibilite_remplacant(
        matricule, date_debut, date_fin, db
    )
    
    return {
        "disponible": disponible,
        "periodes_indisponibles": [
            {
                "id_operation": op.id_operation,
                "date_debut": op.date_debut,
                "date_fin": op.date_fin,
                "type_demande": op.type_demande
            }
            for op in operations_conflits
        ] if operations_conflits else []
    }


@router.get('/mes-remplacements/{matricule}')
def obtenir_mes_remplacements(matricule: int, db: Session = Depends(get_db)):
    """
    Obtenir toutes les opérations pour lesquelles un employé a été accepté comme remplaçant.
    """
    propositions = db.query(models.RemplacantPropose).filter(
        models.RemplacantPropose.matricule_remplacant == matricule,
        models.RemplacantPropose.est_accepte == True
    ).all()
    
    result = []
    for prop in propositions:
        operation = db.query(models.Operation).filter(
            models.Operation.id_operation == prop.id_operation
        ).first()
        
        if operation:
            employe_absent = db.query(models.Employe).filter(
                models.Employe.matricule == operation.matricule
            ).first()
            
            result.append({
                "id_operation": operation.id_operation,
                "type_demande": operation.type_demande,
                "date_debut": operation.date_debut,
                "date_fin": operation.date_fin,
                "statut": operation.statut,
                "employe_absent": {
                    "matricule": employe_absent.matricule,
                    "nom_complet": f"{employe_absent.prenom} {employe_absent.nom}",
                    "fonction": employe_absent.fonction
                } if employe_absent else None
            })
    
    return result
