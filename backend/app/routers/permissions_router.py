"""
Router pour la gestion des permissions conventionnelles et non-conventionnelles
"""
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import date, timedelta
from ..db import get_db
from .. import models
from ..utils import permissions as perm_utils, workflow, notifications
import os

router = APIRouter(prefix='/api/permissions', tags=['permissions'])


@router.get('/types-conventionnels')
def obtenir_types_conventionnels():
    """
    Obtenir la liste des types de permissions conventionnelles disponibles.
    """
    return {
        "types": perm_utils.DUREES_PERMISSIONS_CONVENTIONNELLES,
        "delai_preuves_jours": perm_utils.DELAI_TELECHARGEMENT_PREUVES,
        "note": "Les permissions conventionnelles ne déduisent PAS du solde de congés (max 10 jours sauf exceptions médicales)"
    }


@router.post('/conventionnelle', status_code=status.HTTP_201_CREATED)
def creer_permission_conventionnelle(
    matricule: int,
    type_permission: str,
    sous_type: Optional[str] = None,
    matricule_createur: Optional[int] = None,
    duree: int = None,
    date_debut: date = None,
    date_fin: date = None,
    motif: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    Créer une demande de permission conventionnelle.
    
    Types disponibles: maternelle, deces, maladie, bapteme, mariage
    """
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
                detail="Seuls RH et ADMIN peuvent initier une permission pour autrui"
            )
    
    # Vérifier que le type est valide
    est_valide, message_validation, duree_calculee = perm_utils.verifier_type_permission_conventionnelle(
        type_permission, sous_type
    )
    
    if not est_valide:
        raise HTTPException(status_code=400, detail=message_validation)
    
    # Utiliser la durée calculée si non fournie
    if duree is None:
        duree = duree_calculee
    
    # Créer l'opération
    operation = models.Operation(
        matricule=matricule,
        type_demande='Permission',
        statut='en attente',
        date_debut=date_debut,
        date_fin=date_fin,
        duree_jours=duree,
        motif=motif,
        cree_par=createur
    )
    db.add(operation)
    db.flush()
    
    # Créer l'enregistrement de permission conventionnelle
    success, message = perm_utils.creer_permission_conventionnelle(
        operation.id_operation,
        type_permission,
        duree or 0,
        db,
        sous_type=sous_type
    )
    
    if not success:
        db.rollback()
        raise HTTPException(status_code=400, detail=message)
    
    db.commit()
    
    # Notifier le premier validateur
    prochain_role, prochain_matricule = workflow.obtenir_prochain_validateur(operation.id_operation, db)
    if prochain_matricule:
        notifications.creer_notification(
            matricule=prochain_matricule,
            type_notification='VALIDATION',
            titre=f"Permission conventionnelle ({type_permission})",
            message=f"{employe.prenom} {employe.nom} demande une permission conventionnelle",
            id_operation=operation.id_operation,
            db=db
        )
    
    return {
        "id_operation": operation.id_operation,
        "type_permission": type_permission,
        "sous_type": sous_type,
        "duree_demandee": duree,
        "date_limite_preuves": (date.today() + timedelta(days=60)).isoformat(),
        "message": "Permission conventionnelle créée. N'oubliez pas de téléverser les preuves dans les 60 jours."
    }


@router.post('/non-conventionnelle', status_code=status.HTTP_201_CREATED)
def creer_permission_non_conventionnelle(
    matricule: int,
    duree: int,
    date_debut: date,
    date_fin: date,
    matricule_createur: Optional[int] = None,
    motif: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    Créer une demande de permission non-conventionnelle (déduit du solde de congés).
    """
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
                detail="Seuls RH et ADMIN peuvent initier une permission pour autrui"
            )
    
    # Vérifier le solde
    if employe.solde_conges < duree:
        raise HTTPException(
            status_code=400, 
            detail=f"Solde insuffisant. Solde actuel: {employe.solde_conges} jours, demandé: {duree} jours"
        )
    
    # Créer l'opération
    operation = models.Operation(
        matricule=matricule,
        type_demande='Permission',
        statut='en attente',
        date_debut=date_debut,
        date_fin=date_fin,
        duree_jours=duree,
        motif=motif,
        cree_par=createur
    )
    db.add(operation)
    db.flush()
    
    # Créer l'enregistrement de permission non-conventionnelle
    success, message = perm_utils.creer_permission_non_conventionnelle(
        operation.id_operation,
        duree,
        employe,
        db
    )
    
    if not success:
        db.rollback()
        raise HTTPException(status_code=400, detail=message)
    
    db.commit()
    
    # Notifier
    prochain_role, prochain_matricule = workflow.obtenir_prochain_validateur(operation.id_operation, db)
    if prochain_matricule:
        notifications.creer_notification(
            matricule=prochain_matricule,
            type_notification='VALIDATION',
            titre=f"Permission non-conventionnelle",
            message=f"{employe.prenom} {employe.nom} demande {duree} jours de permission",
            id_operation=operation.id_operation,
            db=db
        )
    
    return {
        "id_operation": operation.id_operation,
        "duree_jours": duree,
        "solde_avant": float(employe.solde_conges),
        "message": "Permission non-conventionnelle créée. Le solde sera déduit après validation complète."
    }


@router.post('/{id_operation}/televerser-preuves')
async def televerser_preuves(
    id_operation: int,
    fichier: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """
    Téléverser les preuves pour une permission conventionnelle.
    """
    operation = db.query(models.Operation).filter(
        models.Operation.id_operation == id_operation
    ).first()
    
    if not operation:
        raise HTTPException(status_code=404, detail="Opération introuvable")
    
    # Créer le dossier uploads s'il n'existe pas
    upload_dir = "uploads/preuves_permissions"
    os.makedirs(upload_dir, exist_ok=True)
    
    # Sauvegarder le fichier
    file_path = os.path.join(upload_dir, f"{id_operation}_{fichier.filename}")
    
    with open(file_path, "wb") as f:
        content = await fichier.read()
        f.write(content)
    
    # Enregistrer dans la BDD
    success, message = perm_utils.televerser_preuves_permission(
        id_operation, file_path, db
    )
    
    if not success:
        raise HTTPException(status_code=400, detail=message)
    
    return {
        "message": "Preuves téléversées avec succès",
        "chemin_fichier": file_path
    }


@router.get('/{id_operation}/verifier-preuves')
def verifier_preuves(id_operation: int, db: Session = Depends(get_db)):
    """
    Vérifier si les preuves d'une permission conventionnelle ont été fournies dans les délais.
    """
    en_regle, message, jours_restants = perm_utils.verifier_delai_preuves_permission(
        id_operation, db
    )
    
    return {
        "en_regle": en_regle,
        "message": message,
        "jours_restants": jours_restants
    }


@router.get('/mes-permissions/{matricule}')
def obtenir_mes_permissions(
    matricule: int,
    annee: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """
    Obtenir toutes les permissions d'un employé via jointure sur Permission table.
    """
    query = db.query(models.Operation).join(
        models.Permission,
        models.Operation.id_operation == models.Permission.id_permission
    ).filter(
        models.Operation.matricule == matricule
    )
    
    if annee:
        query = query.filter(
            db.func.year(models.Operation.date_debut) == annee
        )
    
    operations = query.order_by(models.Operation.date_debut.desc()).all()
    
    result = []
    for op in operations:
        # Vérifier si conventionnelle
        perm_conv = db.query(models.PermConventionelle).filter(
            models.PermConventionelle.id_perm_c == op.id_operation
        ).first()
        
        item = {
            "id_operation": op.id_operation,
            "date_debut": op.date_debut,
            "date_fin": op.date_fin,
            "duree_jours": op.duree_jours,
            "statut": op.statut,
            "type": "Conventionnelle" if perm_conv else "Non-conventionnelle",
            "motif": op.motif
        }
        
        if perm_conv:
            item["preuves_televersees"] = perm_conv.preuves_televersees
            item["date_limite_preuves"] = perm_conv.date_limite_preuves
        
        result.append(item)
    
    return result
