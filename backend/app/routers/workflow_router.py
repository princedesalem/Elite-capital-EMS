"""
Router pour le système de workflow et validation hiérarchique
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional, Dict
from datetime import datetime
from ..db import get_db
from .. import models
from ..utils import workflow as wf_utils

router = APIRouter(prefix='/api/workflow', tags=['workflow'])


@router.get('/mes-demandes/{matricule}')
def obtenir_mes_demandes(matricule: int, db: Session = Depends(get_db)):
    """
    Obtenir toutes les demandes (opérations) créées par un employé.
    """
    operations = db.query(models.Operation).filter(
        models.Operation.matricule == matricule
    ).order_by(models.Operation.date_demande.desc()).all()
    
    return [
        {
            'id_operation': op.id_operation,
            'type_demande': op.type_demande,
            'titre': op.titre,
            'statut': op.statut,
            'date_debut': str(op.date_debut) if op.date_debut else None,
            'date_fin': str(op.date_fin) if op.date_fin else None,
            'date_depart': str(op.date_depart) if op.date_depart else None,
            'date_retour': str(op.date_retour) if op.date_retour else None,
            'duree_jours': op.duree_jours,
            'motif': op.motif,
            'date_demande': str(op.date_demande) if op.date_demande else None,
        }
        for op in operations
    ]


@router.get('/a-valider/{matricule}')
def obtenir_demandes_a_valider(matricule: int, db: Session = Depends(get_db)):
    """
    Obtenir toutes les opérations en attente de validation par cet employé.
    """
    # Trouver toutes les validations en attente pour ce matricule
    validations_en_attente = db.query(models.Validation).filter(
        models.Validation.matricule_validateur == matricule,
        models.Validation.statut_validation == 'en attente'
    ).all()
    
    operations = []
    for validation in validations_en_attente:
        operation = db.query(models.Operation).filter(
            models.Operation.id_operation == validation.id_operation
        ).first()
        
        if operation:
            # Récupérer les infos du demandeur
            demandeur = db.query(models.Employe).filter(
                models.Employe.matricule == operation.matricule
            ).first()
            
            operations.append({
                'id_operation': operation.id_operation,
                'id_validation': validation.id_validation,
                'type_demande': operation.type_demande,
                'titre': operation.titre,
                'statut': operation.statut,
                'date_debut': str(operation.date_debut) if operation.date_debut else None,
                'date_fin': str(operation.date_fin) if operation.date_fin else None,
                'date_depart': str(operation.date_depart) if operation.date_depart else None,
                'date_retour': str(operation.date_retour) if operation.date_retour else None,
                'duree_jours': operation.duree_jours,
                'motif': operation.motif,
                'date_demande': str(operation.date_demande) if operation.date_demande else None,
                'demandeur': {
                    'matricule': demandeur.matricule,
                    'nom': f"{demandeur.prenom} {demandeur.nom}",
                    'fonction': demandeur.fonction
                } if demandeur else None,
                'role_validateur': validation.role_validateur
            })
    
    return operations


@router.get('/sequence/{matricule}')
def obtenir_sequence_validation(
    matricule: int,
    id_operation: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """
    Obtenir la séquence de validation pour un employé.
    
    La séquence s'adapte selon:
    - Structure organisationnelle (dept avec/sans direction)
    - Présence de frais (ajoute DFC avant DG)
    - Rôle du demandeur (DG → RH direct)
    - Entité (ECG → AG au lieu de PCA)
    """
    employe = db.query(models.Employe).filter(models.Employe.matricule == matricule).first()
    if not employe:
        raise HTTPException(status_code=404, detail="Employé introuvable")
    
    sequence = wf_utils.determiner_sequence_validation(employe, db, id_operation)
    
    # Obtenir les matricules des validateurs
    validateurs = []
    for role in sequence:
        matricule_validateur = wf_utils.obtenir_validateur_pour_role(employe, role, db)
        
        if matricule_validateur:
            validateur = db.query(models.Employe).filter(
                models.Employe.matricule == matricule_validateur
            ).first()
            
            validateurs.append({
                "role": role,
                "matricule": matricule_validateur,
                "nom_complet": f"{validateur.prenom} {validateur.nom}" if validateur else "Inconnu"
            })
        else:
            validateurs.append({
                "role": role,
                "matricule": None,
                "nom_complet": "Non défini"
            })
    
    return {
        "sequence": sequence,
        "validateurs": validateurs
    }


@router.get('/prochain-validateur/{id_operation}')
def obtenir_prochain_validateur(id_operation: int, db: Session = Depends(get_db)):
    """
    Obtenir le prochain validateur dans la séquence pour une opération.
    """
    prochain_role, prochain_matricule = wf_utils.obtenir_prochain_validateur(id_operation, db)
    
    if not prochain_role:
        return {
            "message": "Tous les validateurs ont validé",
            "prochain_role": None,
            "prochain_validateur": None
        }
    
    validateur = None
    if prochain_matricule:
        validateur = db.query(models.Employe).filter(
            models.Employe.matricule == prochain_matricule
        ).first()
    
    return {
        "prochain_role": prochain_role,
        "prochain_matricule": prochain_matricule,
        "prochain_validateur": {
            "matricule": validateur.matricule,
            "nom_complet": f"{validateur.prenom} {validateur.nom}",
            "fonction": validateur.fonction,
            "email": validateur.email
        } if validateur else None
    }


@router.post('/valider/{id_operation}')
def valider_operation(
    id_operation: int,
    matricule_validateur: int,
    statut: str,  # 'validé' ou 'refusé'
    commentaire: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    Valider ou refuser une opération selon le workflow hiérarchique.
    """
    if statut not in ['validé', 'refusé']:
        raise HTTPException(status_code=400, detail="Statut doit être 'validé' ou 'refusé'")
    
    # Vérifier que le motif de refus est obligatoire lors d'un refus
    if statut == 'refusé' and (not commentaire or not commentaire.strip()):
        raise HTTPException(status_code=400, detail="Le motif de refus est obligatoire")
    
    success, message = wf_utils.valider_operation(
        id_operation, matricule_validateur, statut, commentaire, db
    )
    
    if not success:
        raise HTTPException(status_code=400, detail=message)
    
    # Obtenir le prochain validateur si validé
    prochain_role, prochain_matricule = wf_utils.obtenir_prochain_validateur(id_operation, db)
    
    return {
        "message": message,
        "statut": statut,
        "prochain_role": prochain_role,
        "termine": prochain_role is None
    }


@router.get('/historique-validations/{id_operation}')
def obtenir_historique_validations(id_operation: int, db: Session = Depends(get_db)):
    """
    Obtenir l'historique de toutes les validations pour une opération.
    """
    validations = db.query(models.Validation).filter(
        models.Validation.id_operation == id_operation
    ).order_by(models.Validation.timestamp_action).all()
    
    result = []
    for val in validations:
        validateur = db.query(models.Employe).filter(
            models.Employe.matricule == val.matricule_validateur
        ).first()
        
        result.append({
            "id_validation": val.id_validation,
            "role_validateur": val.role_validateur,
            "matricule_validateur": val.matricule_validateur,
            "nom_validateur": f"{validateur.prenom} {validateur.nom}" if validateur else "Inconnu",
            "statut_validation": val.statut_validation,
            "commentaire": val.commentaire,
            "date_validation": val.timestamp_action
        })
    
    return result


@router.get('/mes-demandes/{matricule}')
def obtenir_mes_demandes(matricule: int, db: Session = Depends(get_db)):
    """
    Obtenir toutes les demandes créées par un employé avec leur statut de validation.
    """
    operations = db.query(models.Operation).filter(
        models.Operation.matricule == matricule
    ).order_by(models.Operation.date_demande.desc()).all()
    
    result = []
    for op in operations:
        # Obtenir le prochain validateur
        prochain_role, prochain_matricule = wf_utils.obtenir_prochain_validateur(op.id_operation, db)
        
        # Obtenir les validations déjà faites
        validations_count = db.query(models.Validation).filter(
            models.Validation.id_operation == op.id_operation,
            models.Validation.statut_validation == 'validé'
        ).count()
        
        result.append({
            "id_operation": op.id_operation,
            "type_demande": op.type_demande,
            "date_debut": op.date_debut,
            "date_fin": op.date_fin,
            "duree_jours": op.duree_jours,
            "statut": op.statut,
            "date_demande": op.date_demande,
            "validations_completees": validations_count,
            "prochain_validateur_role": prochain_role,
            "validation_terminee": prochain_role is None
        })
    
    return result


@router.get('/a-valider/{matricule_validateur}')
def obtenir_operations_a_valider(matricule_validateur: int, db: Session = Depends(get_db)):
    """
    Obtenir toutes les opérations en attente de validation par un validateur.
    """
    # Obtenir le rôle du validateur
    role_validateur = wf_utils.obtenir_role_validateur(matricule_validateur, db)
    
    # Obtenir toutes les opérations (pas de filtre statut - n'existe pas sur Operation)
    # Le statut est déterminé par les validations workflow
    operations_attente = db.query(models.Operation).all()

    operations_a_valider = []
    
    for op in operations_attente:
        # Vérifier si c'est le tour de ce validateur
        prochain_role, prochain_matricule = wf_utils.obtenir_prochain_validateur(op.id_operation, db)
        
        if not (prochain_role == role_validateur and prochain_matricule == matricule_validateur):
            continue

        if prochain_role:
            employe = db.query(models.Employe).filter(
                models.Employe.matricule == op.matricule
            ).first()
            
            operations_a_valider.append({
                "id_operation": op.id_operation,
                "type_demande": op.type_demande,
                "date_debut": op.date_debut,
                "date_fin": op.date_fin,
                "duree_jours": op.duree_jours,
                "motif": op.motif,
                "demandeur": {
                    "matricule": employe.matricule,
                    "nom_complet": f"{employe.prenom} {employe.nom}",
                    "fonction": employe.fonction,
                    "departement_id": employe.dept_id
                } if employe else None,
                "date_demande": op.date_demande
            })
    
    return operations_a_valider


@router.get('/operations-visibles/{matricule}')
def obtenir_operations_visibles(matricule: int, db: Session = Depends(get_db)):
    """
    Obtenir toutes les opérations visibles par un employé selon son rôle.
    
    Visibilité:
    - EMPLOYE: Ses propres opérations
    - RESPONSABLE: Département
    - DIRECTEUR: Direction
    - DG: Entité
    - RH/PCA/AG: Toutes les opérations
    """
    operations = wf_utils.obtenir_operations_visibles(matricule, db)
    
    result = []
    for op in operations:
        employe = db.query(models.Employe).filter(
            models.Employe.matricule == op.matricule
        ).first()
        
        prochain_role, _ = wf_utils.obtenir_prochain_validateur(op.id_operation, db)
        
        result.append({
            "id_operation": op.id_operation,
            "type_demande": op.type_demande,
            "date_debut": op.date_debut,
            "date_fin": op.date_fin,
            "statut": op.statut,
            "demandeur": {
                "matricule": employe.matricule,
                "nom_complet": f"{employe.prenom} {employe.nom}",
                "fonction": employe.fonction
            } if employe else None,
            "prochain_validateur_role": prochain_role
        })
    
    return result


@router.get('/peut-creer-pour-autrui/{matricule}')
def peut_creer_pour_autrui(matricule: int, db: Session = Depends(get_db)):
    """
    Vérifier si un employé peut créer des demandes pour autrui.
    
    Règle: Supérieurs hiérarchiques (RESPONSABLE, DIRECTEUR, DG) et RH peuvent 
    créer des missions pour leurs subordonnés.
    """
    peut_creer = wf_utils.peut_creer_demande_pour_autrui(matricule, db)
    
    role = wf_utils.obtenir_role_validateur(matricule, db)
    
    return {
        "peut_creer_pour_autrui": peut_creer,
        "role": role,
        "message": "Peut créer des demandes pour ses subordonnés" if peut_creer else "Ne peut créer que ses propres demandes"
    }


@router.get('/stats-validations/{matricule_validateur}')
def obtenir_stats_validations(matricule_validateur: int, db: Session = Depends(get_db)):
    """
    Obtenir des statistiques sur les validations d'un validateur.
    """
    validations = db.query(models.Validation).filter(
        models.Validation.matricule_validateur == matricule_validateur
    ).all()
    
    total = len(validations)
    valides = len([v for v in validations if v.statut_validation == 'validé'])
    refuses = len([v for v in validations if v.statut_validation == 'refusé'])
    
    return {
        "total_validations": total,
        "valides": valides,
        "refuses": refuses,
        "taux_validation": round((valides / total * 100) if total > 0 else 0, 2)
    }


@router.get('/mes-validations/{matricule_validateur}')
def obtenir_mes_validations(matricule_validateur: int, db: Session = Depends(get_db)):
    """
    Obtenir toutes les demandes validées par ce validateur.
    """
    validations = db.query(models.Validation).filter(
        models.Validation.matricule_validateur == matricule_validateur,
        models.Validation.statut_validation == 'validé'
    ).order_by(models.Validation.timestamp_action.desc()).all()
    
    operations_validees = []
    for validation in validations:
        operation = db.query(models.Operation).filter(
            models.Operation.id_operation == validation.id_operation
        ).first()
        
        if operation:
            demandeur = db.query(models.Employe).filter(
                models.Employe.matricule == operation.matricule
            ).first()
            
            operations_validees.append({
                'id_operation': operation.id_operation,
                'id_validation': validation.id_validation,
                'type_demande': operation.type_demande,
                'titre': operation.titre,
                'date_debut': str(operation.date_debut) if operation.date_debut else None,
                'date_fin': str(operation.date_fin) if operation.date_fin else None,
                'date_depart': str(operation.date_depart) if operation.date_depart else None,
                'date_retour': str(operation.date_retour) if operation.date_retour else None,
                'duree_jours': operation.duree_jours,
                'motif': operation.motif,
                'date_demande': str(operation.date_demande) if operation.date_demande else None,
                'date_validation': str(validation.timestamp_action) if validation.timestamp_action else None,
                'commentaire_validation': validation.commentaire,
                'demandeur': {
                    'matricule': demandeur.matricule,
                    'nom': f"{demandeur.prenom} {demandeur.nom}",
                    'fonction': demandeur.fonction
                } if demandeur else None,
                'role_validateur': validation.role_validateur
            })
    
    return operations_validees


@router.get('/mes-refus/{matricule_validateur}')
def obtenir_mes_refus(matricule_validateur: int, db: Session = Depends(get_db)):
    """
    Obtenir toutes les demandes refusées par ce validateur.
    """
    validations = db.query(models.Validation).filter(
        models.Validation.matricule_validateur == matricule_validateur,
        models.Validation.statut_validation == 'refusé'
    ).order_by(models.Validation.timestamp_action.desc()).all()
    
    operations_refusees = []
    for validation in validations:
        operation = db.query(models.Operation).filter(
            models.Operation.id_operation == validation.id_operation
        ).first()
        
        if operation:
            demandeur = db.query(models.Employe).filter(
                models.Employe.matricule == operation.matricule
            ).first()
            
            operations_refusees.append({
                'id_operation': operation.id_operation,
                'id_validation': validation.id_validation,
                'type_demande': operation.type_demande,
                'titre': operation.titre,
                'date_debut': str(operation.date_debut) if operation.date_debut else None,
                'date_fin': str(operation.date_fin) if operation.date_fin else None,
                'date_depart': str(operation.date_depart) if operation.date_depart else None,
                'date_retour': str(operation.date_retour) if operation.date_retour else None,
                'duree_jours': operation.duree_jours,
                'motif': operation.motif,
                'date_demande': str(operation.date_demande) if operation.date_demande else None,
                'date_refus': str(validation.timestamp_action) if validation.timestamp_action else None,
                'motif_refus': validation.commentaire,
                'demandeur': {
                    'matricule': demandeur.matricule,
                    'nom': f"{demandeur.prenom} {demandeur.nom}",
                    'fonction': demandeur.fonction
                } if demandeur else None,
                'role_validateur': validation.role_validateur
            })
    
    return operations_refusees


@router.get('/progression/{id_operation}')
def obtenir_progression_validation(id_operation: int, db: Session = Depends(get_db)):
    """
    Obtenir la progression complète de validation d'une opération pour affichage Teams.
    
    Retourne:
    - sequence: Liste des rôles à valider dans l'ordre
    - etapes: Liste détaillée avec statut de chaque étape
    - progression: Pourcentage de completion
    - statut_final: État actuel de la demande
    """
    operation = db.query(models.Operation).filter(
        models.Operation.id_operation == id_operation
    ).first()
    
    if not operation:
        raise HTTPException(status_code=404, detail="Operation introuvable")
    
    employe = db.query(models.Employe).filter(
        models.Employe.matricule == operation.matricule
    ).first()
    
    # Obtenir la séquence de validation
    sequence = wf_utils.determiner_sequence_validation(employe, db, id_operation)
    
    # Inverser la séquence pour afficher AG en haut
    sequence = list(reversed(sequence))
    
    # Obtenir les validations réalisées
    validations = db.query(models.Validation).filter(
        models.Validation.id_operation == id_operation
    ).order_by(models.Validation.timestamp_action).all()
    
    validations_dict = {v.role_validateur: v for v in validations}
    
    # Construire les étapes
    etapes = []
    for idx, role in enumerate(sequence):
        validation = validations_dict.get(role)
        
        if validation:
            statut = validation.statut_validation  # 'validé' ou 'refusé'
            validateur = db.query(models.Employe).filter(
                models.Employe.matricule == validation.matricule_validateur
            ).first()
            
            etapes.append({
                "numero": idx + 1,
                "role": role,
                "statut": statut,
                "validateur": f"{validateur.prenom} {validateur.nom}" if validateur else "Inconnu",
                "matricule_validateur": validation.matricule_validateur,
                "date": validation.timestamp_action.isoformat() if validation.timestamp_action else None,
                "commentaire": validation.commentaire,
                "icone": "✅" if statut == "validé" else "❌"
            })
        else:
            # Étape non encore effectuée
            etapes.append({
                "numero": idx + 1,
                "role": role,
                "statut": "en attente",
                "validateur": None,
                "matricule_validateur": None,
                "date": None,
                "commentaire": None,
                "icone": "⏳"
            })
    
    # Calculer la progression
    validees = len([e for e in etapes if e['statut'] == 'validé'])
    refusees = len([e for e in etapes if e['statut'] == 'refusé'])
    progression = round((validees / len(etapes) * 100) if etapes else 0, 0) if refusees == 0 else 0
    
    # Déterminer le statut final
    if refusees > 0:
        statut_final = "REFUSÉE"
    elif validees == len(etapes):
        statut_final = "APPROUVÉE"
    else:
        statut_final = f"EN COURS ({validees}/{len(etapes)})"
    
    return {
        "id_operation": id_operation,
        "type_demande": operation.type_demande,
        "demandeur": {
            "matricule": employe.matricule,
            "nom_complet": f"{employe.prenom} {employe.nom}",
            "fonction": employe.fonction
        } if employe else None,
        "date_demande": operation.date_demande.isoformat() if operation.date_demande else None,
        "sequence": sequence,
        "etapes": etapes,
        "progression": int(progression),
        "statut_final": statut_final,
        "total_etapes": len(etapes),
        "etapes_validees": validees,
        "etapes_refusees": refusees
    }
