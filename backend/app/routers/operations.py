from fastapi import APIRouter, Depends, HTTPException, Body, Request
from sqlalchemy.orm import Session
from ..db import get_db
from .. import models
from ..utils import access_control, notifications, workflow
from typing import List, Dict, Any
from datetime import datetime, date

router = APIRouter(prefix='/api/operations', tags=['operations'])


@router.get('/')
def list_all_operations(db: Session = Depends(get_db)) -> List[Dict[str, Any]]:
    """
    Récupère toutes les opérations (Congés, Permissions, Missions) avec leurs héritages
    """
    all_operations = []
    
    # Récupérer toutes les opérations de base
    operations = db.query(models.Operation).all()
    
    for op in operations:
        operation_data = {
            'id_operation': op.id_operation,
            'matricule': op.matricule,
            'commentaire': op.commentaire,
            'type_demande': op.type_demande,
            'statut': op.statut,
            'date_depart': op.date_depart.isoformat() if op.date_depart else None,
            'date_retour': op.date_retour.isoformat() if op.date_retour else None,
            'duree': op.duree,
            'remplacant': op.remplacant,
            'type': None,  # sera défini selon l'héritage
            'details': {}  # détails spécifiques selon le type
        }
        
        # Vérifier si c'est un Congé
        conge_link = db.query(models.CongesLink).filter(
            models.CongesLink.id_conges == op.id_operation
        ).first()
        
        if conge_link:
            operation_data['type'] = 'CONGE'
            operation_data['icon'] = '🏖️'
            all_operations.append(operation_data)
            continue
        
        # Vérifier si c'est une Permission
        perm_link = db.query(models.Permission).filter(
            models.Permission.id_permission == op.id_operation
        ).first()
        
        if perm_link:
            # Vérifier le sous-type de permission
            perm_nc = db.query(models.PermNonConventionelle).filter(
                models.PermNonConventionelle.id_perm_nc == op.id_operation
            ).first()
            
            if perm_nc:
                operation_data['type'] = 'PERMISSION_NON_CONVENTIONNELLE'
                operation_data['icon'] = '📋'
                operation_data['sub_type'] = 'Non Conventionnelle'
            else:
                # Vérifier si c'est une permission conventionnelle
                perm_conv = db.query(models.PermConventionelle).filter(
                    models.PermConventionelle.id_perm_c == op.id_operation
                ).first()
                
                if perm_conv:
                    operation_data['details']['preuve'] = perm_conv.preuve
                    
                    # Vérifier les sous-types conventionnels
                    perm_mat = db.query(models.PermMaternelle).filter(
                        models.PermMaternelle.id_perm_mat == op.id_operation
                    ).first()
                    if perm_mat:
                        operation_data['type'] = 'PERMISSION_MATERNELLE'
                        operation_data['icon'] = '👶'
                        operation_data['sub_type'] = 'Maternelle'
                        all_operations.append(operation_data)
                        continue
                    
                    perm_dec = db.query(models.PermDeces).filter(
                        models.PermDeces.id_perm_dec == op.id_operation
                    ).first()
                    if perm_dec:
                        operation_data['type'] = 'PERMISSION_DECES'
                        operation_data['icon'] = '⚰️'
                        operation_data['sub_type'] = 'Décès'
                        all_operations.append(operation_data)
                        continue
                    
                    perm_mal = db.query(models.PermMaladie).filter(
                        models.PermMaladie.id_perm_mal == op.id_operation
                    ).first()
                    if perm_mal:
                        operation_data['type'] = 'PERMISSION_MALADIE'
                        operation_data['icon'] = '🤒'
                        operation_data['sub_type'] = 'Maladie'
                        all_operations.append(operation_data)
                        continue
                    
                    perm_bap = db.query(models.PermBapteme).filter(
                        models.PermBapteme.id_perm_bap == op.id_operation
                    ).first()
                    if perm_bap:
                        operation_data['type'] = 'PERMISSION_BAPTEME'
                        operation_data['icon'] = '🎉'
                        operation_data['sub_type'] = 'Baptême'
                        all_operations.append(operation_data)
                        continue
                    
                    perm_mar = db.query(models.PermMariage).filter(
                        models.PermMariage.id_perm_mar == op.id_operation
                    ).first()
                    if perm_mar:
                        operation_data['type'] = 'PERMISSION_MARIAGE'
                        operation_data['icon'] = '💍'
                        operation_data['sub_type'] = 'Mariage'
                        all_operations.append(operation_data)
                        continue
                    
                    # Permission conventionnelle générique
                    operation_data['type'] = 'PERMISSION_CONVENTIONNELLE'
                    operation_data['icon'] = '📋'
                    operation_data['sub_type'] = 'Conventionnelle'
                else:
                    # Permission générique
                    operation_data['type'] = 'PERMISSION'
                    operation_data['icon'] = '📋'
            
            all_operations.append(operation_data)
            continue
        
        # Vérifier si c'est une Mission
        mission = db.query(models.Mission).filter(
            models.Mission.id_mission == op.id_operation
        ).first()
        
        if mission:
            mission_frais = db.query(models.Frais).filter(
                (models.Frais.id_mission == mission.id_mission) |
                (models.Frais.id_operation == op.id_operation)
            ).first()
            operation_data['type'] = 'MISSION'
            operation_data['icon'] = '✈️'
            operation_data['details'] = {
                'pays': mission.pays,
                'ville': mission.ville,
                'email_mission': mission.email_mission,
                'transport': mission.moyens_transport,
                'heure_depart': mission.heure_depart,
                'heure_retour': mission.heure_retour,
                'rapport': mission.rapport,
                'frais': {
                    'frais_transport_voyage': mission_frais.frais_transport_voyage if mission_frais else None,
                    'frais_hotel': mission_frais.frais_hotel if mission_frais else None,
                    'frais_deplacement': mission_frais.frais_deplacement if mission_frais else None,
                    'justificatif_de_frais': mission_frais.justificatif_de_frais if mission_frais else None,
                    'frais_nutrition': mission_frais.frais_nutrition if mission_frais else None,
                    'total_frais': mission_frais.total_frais if mission_frais else None,
                }
            }
            all_operations.append(operation_data)
            continue
        
        # Si aucun type n'est trouvé, c'est une opération générique
        operation_data['type'] = 'OPERATION_GENERIQUE'
        operation_data['icon'] = '📄'
        all_operations.append(operation_data)
    
    # Trier par date de départ (plus récentes d'abord)
    all_operations.sort(
        key=lambda x: x['date_depart'] if x['date_depart'] else '',
        reverse=True
    )
    
    return all_operations


@router.get('/{id_operation}')
def get_operation_details(id_operation: int, db: Session = Depends(get_db)):
    """
    Récupère les détails d'une opération spécifique avec son héritage complet
    """
    operation = db.query(models.Operation).filter(
        models.Operation.id_operation == id_operation
    ).first()
    
    if not operation:
        raise HTTPException(status_code=404, detail="Opération non trouvée")
    
    # Construire la réponse avec tous les détails
    result = {
        'id_operation': operation.id_operation,
        'matricule': operation.matricule,
        'commentaire': operation.commentaire,
        'date_depart': operation.date_depart,
        'date_retour': operation.date_retour,
        'duree': operation.duree,
        'remplacant': operation.remplacant,
        'type': None,
        'details': {}
    }
    
    # Déterminer le type et les détails (même logique que list_all_operations)
    conge_link = db.query(models.CongesLink).filter(
        models.CongesLink.id_conges == id_operation
    ).first()
    if conge_link:
        result['type'] = 'CONGE'
        return result
    
    perm_link = db.query(models.Permission).filter(
        models.Permission.id_permission == id_operation
    ).first()
    if perm_link:
        result['type'] = 'PERMISSION'
        # Ajouter les détails de permission si nécessaire
        return result
    
    mission = db.query(models.Mission).filter(
        models.Mission.id_mission == id_operation
    ).first()
    if mission:
        mission_frais = db.query(models.Frais).filter(
            (models.Frais.id_mission == mission.id_mission) |
            (models.Frais.id_operation == id_operation)
        ).first()
        result['type'] = 'MISSION'
        result['details'] = {
            'pays': mission.pays,
            'ville': mission.ville,
            'transport': mission.moyens_transport,
            'heure_depart': mission.heure_depart,
            'heure_retour': mission.heure_retour,
            'rapport': mission.rapport,
            'frais': {
                'frais_transport_voyage': mission_frais.frais_transport_voyage if mission_frais else None,
                'frais_hotel': mission_frais.frais_hotel if mission_frais else None,
                'frais_deplacement': mission_frais.frais_deplacement if mission_frais else None,
                'justificatif_de_frais': mission_frais.justificatif_de_frais if mission_frais else None,
                'frais_nutrition': mission_frais.frais_nutrition if mission_frais else None,
                'total_frais': mission_frais.total_frais if mission_frais else None,
            }
        }
        return result
    
    result['type'] = 'OPERATION_GENERIQUE'
    return result


@router.delete('/{id_operation}')
def annuler_operation(id_operation: int, request: Request, db: Session = Depends(get_db)):
    """
    Annule une opération (congé, permission, mission) en attente de validation.
    Seules les opérations en attente peuvent être annulées.
    """
    actor_matricule, actor_role = access_control.get_actor_from_request(request)

    # Récupérer l'opération
    operation = db.query(models.Operation).filter(
        models.Operation.id_operation == id_operation
    ).first()
    
    if not operation:
        raise HTTPException(status_code=404, detail="Opération non trouvée")

    if operation.matricule != actor_matricule and not access_control.can_access_globally(str(actor_role or '').upper()):
        raise HTTPException(status_code=403, detail="Vous n'êtes pas autorisé à annuler cette opération")
    
    # Vérifier le statut
    statut_normalise = str(operation.statut or '').strip().lower()
    if statut_normalise and statut_normalise != 'en attente':
        raise HTTPException(
            status_code=400, 
            detail=f"Impossible d'annuler une opération {operation.statut}. Seules les opérations en attente peuvent être annulées."
        )
    
    if workflow.operation_est_validee_par_validateur_final(id_operation, db):
        raise HTTPException(
            status_code=400,
            detail="Impossible d'annuler une opération déjà validée par le validateur final."
        )
    
    try:
        notifications.ajouter_notifications_annulation_operation(operation, actor_matricule, db)

        # Nettoyage des tables référencées par id_operation
        db.query(models.Validation).filter(models.Validation.id_operation == id_operation).delete()
        db.query(models.Creation).filter(models.Creation.id_operation == id_operation).delete()
        db.query(models.Notification).filter(models.Notification.id_operation == id_operation).delete()
        db.query(models.Activation).filter(models.Activation.id_operation == id_operation).delete()
        db.query(models.RemplacantPropose).filter(models.RemplacantPropose.id_operation == id_operation).delete()
        db.query(models.DemandeExplication).filter(models.DemandeExplication.id_operation == id_operation).delete()

        # Sorties
        db.query(models.Sortie).filter(models.Sortie.id_operation == id_operation).delete()

        # Congés
        db.query(models.CongesLink).filter(models.CongesLink.id_conges == id_operation).delete()

        # Permissions et sous-types
        db.query(models.PermMaternelle).filter(models.PermMaternelle.id_perm_mat == id_operation).delete()
        db.query(models.PermDeces).filter(models.PermDeces.id_perm_dec == id_operation).delete()
        db.query(models.PermMaladie).filter(models.PermMaladie.id_perm_mal == id_operation).delete()
        db.query(models.PermBapteme).filter(models.PermBapteme.id_perm_bap == id_operation).delete()
        db.query(models.PermMariage).filter(models.PermMariage.id_perm_mar == id_operation).delete()
        db.query(models.PermConventionelle).filter(models.PermConventionelle.id_perm_c == id_operation).delete()
        db.query(models.PermNonConventionelle).filter(models.PermNonConventionelle.id_perm_nc == id_operation).delete()
        db.query(models.Permission).filter(models.Permission.id_permission == id_operation).delete()

        # Missions et dépendances
        mission = db.query(models.Mission).filter(models.Mission.id_mission == id_operation).first()
        if mission:
            frais_mission = db.query(models.Frais).filter(models.Frais.id_mission == mission.id_mission).all()
            for frais_row in frais_mission:
                frais_operation_id = frais_row.id_operation
                if frais_operation_id and frais_operation_id != id_operation:
                    db.query(models.Validation).filter(models.Validation.id_operation == frais_operation_id).delete()
                    db.query(models.Creation).filter(models.Creation.id_operation == frais_operation_id).delete()
                    db.query(models.Notification).filter(models.Notification.id_operation == frais_operation_id).delete()
                    db.query(models.Activation).filter(models.Activation.id_operation == frais_operation_id).delete()
                    db.query(models.RemplacantPropose).filter(models.RemplacantPropose.id_operation == frais_operation_id).delete()
                    db.query(models.DemandeExplication).filter(models.DemandeExplication.id_operation == frais_operation_id).delete()
                    frais_operation = db.query(models.Operation).filter(models.Operation.id_operation == frais_operation_id).first()
                    if frais_operation:
                        db.delete(frais_operation)
                db.delete(frais_row)

            db.query(models.MissionSegment).filter(models.MissionSegment.id_mission == mission.id_mission).delete()
            db.query(models.MissionnairesMission).filter(models.MissionnairesMission.id_mission == mission.id_mission).delete()
            db.query(models.CommentaireMission).filter(models.CommentaireMission.id_mission == mission.id_mission).delete()
            db.query(models.RelanceMission).filter(models.RelanceMission.id_mission == mission.id_mission).delete()
            db.delete(mission)

        # Demande de frais simple (si annulée via endpoint générique)
        db.query(models.Frais).filter(models.Frais.id_operation == id_operation).delete()

        # Suppression physique de l'opération
        db.delete(operation)
        db.commit()
        
        return {
            "message": f"Opération #{id_operation} annulée avec succès",
            "id_operation": id_operation
        }
        
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Erreur lors de l'annulation: {str(e)}"
        )


@router.patch('/{id_operation}')
def modifier_operation(
    id_operation: int,
    payload: Dict[str, Any] = Body(...),
    request: Request = None,
    db: Session = Depends(get_db)
):
    """
    Modifie une opération en attente (dates et motif).
    """
    operation = db.query(models.Operation).filter(
        models.Operation.id_operation == id_operation
    ).first()

    if not operation:
        raise HTTPException(status_code=404, detail="Opération non trouvée")

    if request is not None:
        actor_matricule, actor_role = access_control.get_actor_from_request(request)
        if operation.matricule != actor_matricule and not access_control.can_access_globally(str(actor_role or '').upper()):
            raise HTTPException(status_code=403, detail="Vous n'êtes pas autorisé à modifier cette opération")

    if operation.statut and str(operation.statut).lower() != 'en attente':
        raise HTTPException(
            status_code=400,
            detail="Seules les opérations en attente peuvent être modifiées"
        )

    if workflow.operation_a_deja_ete_validee(id_operation, db):
        raise HTTPException(
            status_code=400,
            detail="Impossible de modifier une opération après la première validation"
        )

    try:
        date_debut_str = payload.get('date_debut')
        date_fin_str = payload.get('date_fin')
        motif = payload.get('motif')

        if date_debut_str:
            nouvelle_date_debut = date.fromisoformat(str(date_debut_str))
            operation.date_debut = nouvelle_date_debut
            operation.date_depart = nouvelle_date_debut

        if date_fin_str:
            nouvelle_date_fin = date.fromisoformat(str(date_fin_str))
            operation.date_fin = nouvelle_date_fin
            operation.date_retour = nouvelle_date_fin

        if operation.date_debut and operation.date_fin:
            delta = (operation.date_fin - operation.date_debut).days + 1
            operation.duree_jours = max(delta, 1)
            operation.duree = max(delta, 1)

        if motif is not None:
            operation.motif = str(motif)
            operation.commentaire = str(motif)

        operation.est_modifie = True
        operation.date_modification = datetime.utcnow()

        db.commit()
        db.refresh(operation)

        return {
            "message": f"Opération #{id_operation} modifiée avec succès",
            "id_operation": operation.id_operation,
            "date_debut": operation.date_debut.isoformat() if operation.date_debut else None,
            "date_fin": operation.date_fin.isoformat() if operation.date_fin else None,
            "motif": operation.motif,
            "duree_jours": operation.duree_jours
        }
    except ValueError:
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail="Format de date invalide. Utilise YYYY-MM-DD"
        )
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Erreur lors de la modification: {str(e)}"
        )
