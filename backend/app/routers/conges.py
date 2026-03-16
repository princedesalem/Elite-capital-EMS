"""
Router pour la gestion des congés avec toutes les règles métier
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import date, datetime
from ..db import get_db
from .. import models, schemas
from ..utils import business_logic, activation_cloture, workflow, notifications

router = APIRouter(prefix='/api/conges', tags=['conges'])


@router.post('/demande', status_code=status.HTTP_201_CREATED)
def creer_demande_conge(
    matricule: int,
    date_debut: date,
    date_fin: date,
    motif: Optional[str] = None,
    matricule_createur: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """
    Créer une nouvelle demande de congé avec toutes les vérifications.
    """
    # Récupérer l'employé
    employe = db.query(models.Employe).filter(models.Employe.matricule == matricule).first()
    if not employe:
        raise HTTPException(status_code=404, detail="Employé introuvable")

    createur = matricule_createur if matricule_createur is not None else matricule
    if createur != matricule:
        est_rh = workflow.verifier_role_employe(createur, 'RH', db)
        est_admin = workflow.verifier_role_employe(createur, 'ADMIN', db)
        if not (est_rh or est_admin):
            raise HTTPException(
                status_code=403,
                detail="Seuls RH et ADMIN peuvent initier un congé pour autrui"
            )
    
    # Vérifier l'éligibilité (1 an d'ancienneté)
    eligible, message = business_logic.verifier_eligibilite_conges(employe)
    if not eligible:
        raise HTTPException(status_code=400, detail=message)
    
    # Calculer la durée en jours ouvrables
    duree = business_logic.calculer_jours_ouvrables(date_debut, date_fin)
    
    if duree <= 0:
        raise HTTPException(status_code=400, detail="La durée des congés doit être positive")
    
    # Vérifier le solde
    solde_ok, message_solde, solde_actuel = business_logic.verifier_solde_conges(employe, duree)
    if not solde_ok:
        raise HTTPException(status_code=400, detail=message_solde)
    
    # Vérifier les chevauchements
    chevauchement, message_chevauchement = business_logic.verifier_chevauchement_operations(
        employe, date_debut, date_fin, db
    )
    if chevauchement:
        raise HTTPException(status_code=400, detail=message_chevauchement)
    
    # Créer l'opération
    operation = models.Operation(
        matricule=matricule,
        type_demande='Congé',
        statut='en attente',
        date_debut=date_debut,
        date_fin=date_fin,
        duree_jours=duree,
        motif=motif,
        date_demande=datetime.now(),
        cree_par=createur
    )
    db.add(operation)
    db.commit()
    db.refresh(operation)
    
    # Déterminer le premier validateur et notifier
    prochain_role, prochain_matricule = workflow.obtenir_prochain_validateur(operation.id_operation, db)
    
    if prochain_matricule:
        notifications.creer_notification(
            matricule=prochain_matricule,
            type_notification='VALIDATION',
            titre=f"Nouvelle demande de congé",
            message=f"{employe.prenom} {employe.nom} demande {duree} jours de congé du {date_debut} au {date_fin}",
            id_operation=operation.id_operation,
            db=db
        )
    
    return {
        "id_operation": operation.id_operation,
        "duree_jours": duree,
        "solde_restant": solde_actuel - duree,
        "prochain_validateur": prochain_role,
        "message": "Demande de congé créée avec succès"
    }


@router.get('/eligibilite/{matricule}')
def verifier_eligibilite(matricule: int, db: Session = Depends(get_db)):
    """
    Vérifier si un employé est éligible aux congés (1 an d'ancienneté requis).
    """
    employe = db.query(models.Employe).filter(models.Employe.matricule == matricule).first()
    if not employe:
        raise HTTPException(status_code=404, detail="Employé introuvable")
    
    eligible, message = business_logic.verifier_eligibilite_conges(employe)
    
    return {
        "eligible": eligible,
        "message": message,
        "date_embauche": employe.date_embauche,
        "solde_conges": float(employe.solde_conges or 0)
    }


@router.get('/solde/{matricule}')
def obtenir_solde(matricule: int, db: Session = Depends(get_db)):
    """
    Obtenir le solde de congés d'un employé.
    """
    employe = db.query(models.Employe).filter(models.Employe.matricule == matricule).first()
    if not employe:
        raise HTTPException(status_code=404, detail="Employé introuvable")
    
    return {
        "matricule": matricule,
        "nom_complet": f"{employe.prenom} {employe.nom}",
        "solde_conges": float(employe.solde_conges or 0),
        "date_derniere_maj": employe.date_derniere_maj_solde
    }


@router.post('/calculer-duree')
def calculer_duree_conge(date_debut: date, date_fin: date):
    """
    Calculer la durée en jours ouvrables (exclut vendredi et samedi).
    """
    duree = business_logic.calculer_jours_ouvrables(date_debut, date_fin)
    
    return {
        "date_debut": date_debut,
        "date_fin": date_fin,
        "duree_jours_ouvrables": duree,
        "note": "Les week-ends (vendredi et samedi) sont exclus selon la Convention Collective"
    }


@router.post('/activation/{id_operation}/demandeur')
def activer_conge_demandeur(
    id_operation: int,
    matricule_demandeur: int,
    db: Session = Depends(get_db)
):
    """
    Activation d'un congé par le demandeur (première étape de la double validation).
    """
    success, message = activation_cloture.activer_operation_demandeur(
        id_operation, matricule_demandeur, db
    )
    
    if not success:
        raise HTTPException(status_code=400, detail=message)
    
    return {"message": message}


@router.post('/activation/{id_operation}/rh')
def activer_conge_rh(
    id_operation: int,
    matricule_rh: int,
    db: Session = Depends(get_db)
):
    """
    Activation d'un congé par RH (deuxième étape - déduit le solde).
    """
    success, message = activation_cloture.activer_operation_rh(
        id_operation, matricule_rh, db
    )
    
    if not success:
        raise HTTPException(status_code=400, detail=message)
    
    return {"message": message}


@router.post('/cloture/{id_operation}/demandeur')
def cloturer_conge_demandeur(
    id_operation: int,
    matricule_demandeur: int,
    retour_anticipe: bool = False,
    date_retour_anticipe: Optional[date] = None,
    db: Session = Depends(get_db)
):
    """
    Clôture d'un congé par le demandeur avec possibilité de retour anticipé.
    """
    success, message = activation_cloture.cloturer_operation_demandeur(
        id_operation, matricule_demandeur, db, retour_anticipe, date_retour_anticipe
    )
    
    if not success:
        raise HTTPException(status_code=400, detail=message)
    
    return {"message": message}


@router.post('/cloture/{id_operation}/rh')
def cloturer_conge_rh(
    id_operation: int,
    matricule_rh: int,
    db: Session = Depends(get_db)
):
    """
    Clôture finale d'un congé par RH.
    """
    success, message = activation_cloture.cloturer_operation_rh(
        id_operation, matricule_rh, db
    )
    
    if not success:
        raise HTTPException(status_code=400, detail=message)
    
    return {"message": message}


@router.get('/historique/{matricule}')
def obtenir_historique_conges(
    matricule: int,
    annee: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """
    Obtenir l'historique des congés d'un employé.
    """
    query = db.query(models.Operation).filter(
        models.Operation.matricule == matricule,
        models.Operation.type_demande == 'Congé'
    )
    
    if annee:
        query = query.filter(
            db.func.year(models.Operation.date_debut) == annee
        )
    
    operations = query.order_by(models.Operation.date_debut.desc()).all()
    
    return [
        {
            "id_operation": op.id_operation,
            "date_debut": op.date_debut,
            "date_fin": op.date_fin,
            "duree_jours": op.duree_jours,
            "statut": op.statut,
            "date_demande": op.date_demande,
            "retour_anticipe": op.retour_anticipe,
            "date_retour_anticipe": op.date_retour_anticipe
        }
        for op in operations
    ]
