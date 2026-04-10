"""
Router pour la gestion des missions avec rapports et frais
"""
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Body, Request, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import date, time, datetime, timedelta
from pydantic import BaseModel
from ..db import get_db
from .. import models
from ..utils import missions as mission_utils, workflow, notifications, activation_cloture, access_control
import os
import json

# Schémas Pydantic pour les missions multi-segments
class SegmentMission(BaseModel):
    pays: str
    country_code: Optional[str] = None
    ville: str
    date_debut: date
    date_fin: date
    heure_depart: Optional[time] = None
    heure_arrivee: Optional[time] = None
    heure_retour: Optional[time] = None
    moyen_transport: Optional[str] = 'aerien'  # Transport spécifique pour ce segment

class MissionMultiSegments(BaseModel):
    matricule: int  # Matricule de l'initiateur (créateur de la mission)
    matricules_missionnaires: List[int]  # Liste de tous les missionnaires (incluant l'initiateur)
    email_contact: Optional[str] = None  # Email de contact pour cette mission
    motif: Optional[str] = None
    mission_comment: Optional[str] = None  # Commentaire / titre libre de la mission
    segments: List[SegmentMission]  # Chaque segment a son propre moyen_transport

router = APIRouter(prefix='/api/missions', tags=['missions'])

ROLES_INITIATION_MISSION = {'RESPONSABLE', 'DIRECTEUR', 'RH', 'DG', 'PCA', 'ADMIN'}


def _get_frais_entities(id_operation: int, db: Session):
    operation = db.query(models.Operation).filter(
        models.Operation.id_operation == id_operation,
        models.Operation.type_demande == 'Frais de mission'
    ).first()
    if not operation:
        return None, None, None, None

    frais = db.query(models.Frais).filter(
        (models.Frais.id_operation == id_operation) |
        (models.Frais.id_frais == id_operation)
    ).first()
    if not frais:
        return operation, None, None, None

    mission_operation = db.query(models.Operation).filter(
        models.Operation.id_operation == frais.id_mission,
        models.Operation.type_demande == 'Mission'
    ).first()
    mission = db.query(models.Mission).filter(models.Mission.id_mission == frais.id_mission).first()
    return operation, frais, mission_operation, mission


@router.get('/rechercher-employes')
def rechercher_employes(q: str = '', matricule_initiateur: Optional[int] = None, db: Session = Depends(get_db)):
    """
    Rechercher des employés pour les ajouter comme missionnaires.
    Filtre selon la hiérarchie de l'initiateur :
      - PCA / AG / ADMIN / RH : tous les employés actifs
      - DG : employés de la même entité
      - DIRECTEUR : employés de la même direction + DG de l'entité
      - RESPONSABLE : employés du même département + directeur de la direction + DG de l'entité
    """
    from sqlalchemy import or_

    if not q or len(q) < 2:
        return {"employes": []}

    text_filter = (
        models.Employe.nom.ilike(f'%{q}%') |
        models.Employe.prenom.ilike(f'%{q}%') |
        models.Employe.matricule.like(f'%{q}%')
    )

    base_query = db.query(models.Employe).filter(
        models.Employe.statut_employe == 'ACTIF',
        text_filter
    )

    if matricule_initiateur:
        initiateur = db.query(models.Employe).filter(models.Employe.matricule == matricule_initiateur).first()
        if initiateur:
            role = access_control.get_actor_role_from_db(matricule_initiateur, db)

            if role not in {'PCA', 'AG', 'ADMIN', 'RH'}:
                # Trouver les DG de la même entité via rôle DB
                dg_matricules = []
                if initiateur.id_entite:
                    dg_role = db.query(models.Role).filter(models.Role.name == 'DG').first()
                    if dg_role:
                        dg_emps = db.query(models.Employe).join(
                            models.Utilisateur,
                            models.Utilisateur.matricule == models.Employe.matricule
                        ).filter(
                            models.Utilisateur.role_id == dg_role.id,
                            models.Employe.id_entite == initiateur.id_entite
                        ).all()
                        dg_matricules = [emp.matricule for emp in dg_emps]

                if role == 'DG':
                    if initiateur.id_entite:
                        base_query = base_query.filter(models.Employe.id_entite == initiateur.id_entite)

                elif role == 'DIRECTEUR':
                    conditions = []
                    if initiateur.id_direction:
                        conditions.append(models.Employe.id_direction == initiateur.id_direction)
                    if dg_matricules:
                        conditions.append(models.Employe.matricule.in_(dg_matricules))
                    if conditions:
                        base_query = base_query.filter(or_(*conditions))

                else:  # RESPONSABLE ou autre rôle hiérarchique
                    conditions = []
                    if initiateur.dept_id:
                        conditions.append(models.Employe.dept_id == initiateur.dept_id)
                    if initiateur.id_direction:
                        direction = db.query(models.Direction).filter(
                            models.Direction.id_direction == initiateur.id_direction
                        ).first()
                        if direction and direction.id_directeur:
                            conditions.append(models.Employe.matricule == direction.id_directeur)
                    if dg_matricules:
                        conditions.append(models.Employe.matricule.in_(dg_matricules))
                    if conditions:
                        base_query = base_query.filter(or_(*conditions))

    employes = base_query.limit(10).all()
    return {
        "employes": [
            {
                "matricule": emp.matricule,
                "nom_complet": f"{emp.prenom} {emp.nom}",
                "fonction": emp.fonction,
                "email": emp.email
            }
            for emp in employes
        ]
    }


@router.get('/verifier-chevauchement/{matricule}')
def verifier_chevauchement_missions(
    matricule: int,
    date_debut: date,
    date_fin: date,
    id_operation_exclure: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """
    Vérifier si l'employé a déjà une mission active ou prévue pendant la période donnée.
    Retourne un conflit si une mission existe dans la même plage de dates.
    """
    # Requête pour trouver des missions qui se chevauchent
    missions_chevauchantes = db.query(models.Operation).join(
        models.Mission, models.Mission.id_mission == models.Operation.id_operation
    ).filter(
        models.Operation.matricule == matricule,
        models.Operation.type_demande == 'Mission',
        models.Operation.statut.notin_(['refusé', 'annulé']),
        # Vérifier le chevauchement de dates
        models.Operation.date_debut <= date_fin,
        models.Operation.date_fin >= date_debut
    )
    
    # Exclure la mission en cours de modification si fournie
    if id_operation_exclure:
        missions_chevauchantes = missions_chevauchantes.filter(
            models.Operation.id_operation != id_operation_exclure
        )
    
    missions_list = missions_chevauchantes.all()
    
    if missions_list:
        return {
            "conflit": True,
            "message": "Une mission est déjà prévue pendant cette période",
            "missions_existantes": [
                {
                    "id_operation": m.id_operation,
                    "date_debut": str(m.date_debut),
                    "date_fin": str(m.date_fin),
                    "statut": m.statut
                }
                for m in missions_list
            ]
        }
    
    return {"conflit": False, "message": "Aucun chevauchement détecté"}


@router.post('/creer', status_code=status.HTTP_201_CREATED)
def creer_mission(
    matricule: int,
    pays: str,
    ville: str,
    moyens_transport: List[str],  # ['routiere', 'aerien', 'ferroviaire', 'maritime']
    date_debut: date,
    date_fin: date,
    country_code: Optional[str] = None,
    heure_depart: Optional[time] = None,
    heure_retour: Optional[time] = None,
    email_mission: Optional[str] = None,
    motif: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    Créer une nouvelle mission.
    
    Moyens de transport disponibles: routiere, aerien, ferroviaire, maritime (sélection multiple)
    """
    employe = db.query(models.Employe).filter(models.Employe.matricule == matricule).first()
    if not employe:
        raise HTTPException(status_code=404, detail="Employé introuvable")

    role_initiateur = (workflow.obtenir_role_validateur(matricule, db) or '').upper()
    if role_initiateur not in ROLES_INITIATION_MISSION:
        raise HTTPException(
            status_code=403,
            detail="Initiation mission interdite pour ce rôle"
        )
    
    # Vérifier que les moyens de transport sont valides
    moyens_valides = ['routiere', 'routier', 'aerien', 'ferroviaire', 'maritime']
    for moyen in moyens_transport:
        if moyen.lower() not in moyens_valides:
            raise HTTPException(
                status_code=400, 
                detail=f"Moyen de transport '{moyen}' invalide. Valides: {moyens_valides}"
            )
    
    # Vérifier qu'il n'y a pas de chevauchement avec une autre mission
    missions_chevauchantes = db.query(models.Operation).join(
        models.Mission, models.Mission.id_mission == models.Operation.id_operation
    ).filter(
        models.Operation.matricule == matricule,
        models.Operation.type_demande == 'Mission',
        models.Operation.statut.notin_(['refusé', 'annulé']),
        models.Operation.date_debut <= date_fin,
        models.Operation.date_fin >= date_debut
    ).all()
    
    if missions_chevauchantes:
        raise HTTPException(
            status_code=400,
            detail="Une mission est déjà prévue pendant cette période"
        )

    # Validation anti-contournement: pays/ville doivent venir de la référence géographique.
    from ..utils.world_geo_service import (
        GEO_VALIDATION_UNAVAILABLE_MESSAGE,
        validate_country_city,
    )
    geo_ok, geo_message, geo_data = validate_country_city(
        country_name=pays,
        city_name=ville,
        country_code=country_code,
    )
    if not geo_ok:
        status_code = 503 if geo_message == GEO_VALIDATION_UNAVAILABLE_MESSAGE else 400
        raise HTTPException(status_code=status_code, detail=geo_message)

    pays = geo_data['country_name']
    ville = geo_data['city_name']
    
    # Créer l'opération
    operation = models.Operation(
        matricule=matricule,
        type_demande='Mission',
        statut='en attente',
        date_debut=date_debut,
        date_fin=date_fin,
        motif=motif,
        cree_par=matricule
    )
    db.add(operation)
    db.flush()
    
    # Créer la mission
    success, message = mission_utils.creer_mission(
        operation.id_operation,
        pays,
        ville,
        moyens_transport,
        heure_depart,
        heure_retour,
        email_mission,
        db
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
            titre=f"Nouvelle mission",
            message=f"{employe.prenom} {employe.nom} demande une mission à {ville}, {pays}",
            id_operation=operation.id_operation,
            db=db
        )
    
    return {
        "id_operation": operation.id_operation,
        "id_mission": mission.id_mission,
        "pays": pays,
        "ville": ville,
        "moyens_transport": moyens_transport,
        "date_limite_rapport": mission.date_limite_rapport,
        "message": "Mission créée. Vous devrez téléverser un rapport dans les 48h après votre retour."
    }


@router.post('/creer-multi-segments', status_code=status.HTTP_201_CREATED)
def creer_mission_multi_segments(
    mission_data: MissionMultiSegments = Body(...),
    db: Session = Depends(get_db)
):
    """
    Créer une mission avec plusieurs segments (destinations multiples) et plusieurs missionnaires.
    
    Exemple: Une mission de 18 jours avec 9 jours à Douala et 9 jours à Kribi, avec 3 employés.
    Chaque segment peut avoir son propre pays, ville, dates, et frais d'hôtel.
    """
    matricule = mission_data.matricule
    
    # Vérifier que l'employé initiateur existe
    employe = db.query(models.Employe).filter(models.Employe.matricule == matricule).first()
    if not employe:
        raise HTTPException(status_code=404, detail="Employé initiateur introuvable")

    role_initiateur = (workflow.obtenir_role_validateur(matricule, db) or '').upper()
    if role_initiateur not in ROLES_INITIATION_MISSION:
        raise HTTPException(
            status_code=403,
            detail="Initiation mission interdite pour ce rôle"
        )
    
    # Vérifier qu'il y a au moins un segment
    if not mission_data.segments or len(mission_data.segments) == 0:
        raise HTTPException(status_code=400, detail="Au moins un segment est requis")
    
    # Vérifier qu'il y a au moins un missionnaire
    if not mission_data.matricules_missionnaires or len(mission_data.matricules_missionnaires) == 0:
        raise HTTPException(status_code=400, detail="Au moins un missionnaire est requis")
    
    # Vérifier que tous les missionnaires existent
    missionnaires_invalides = []
    for mat in mission_data.matricules_missionnaires:
        emp = db.query(models.Employe).filter(models.Employe.matricule == mat).first()
        if not emp:
            missionnaires_invalides.append(mat)
    
    if missionnaires_invalides:
        raise HTTPException(
            status_code=404,
            detail=f"Employés introuvables: {', '.join(map(str, missionnaires_invalides))}"
        )

    from ..utils.world_geo_service import (
        GEO_VALIDATION_UNAVAILABLE_MESSAGE,
        validate_country_city,
    )
    for segment in mission_data.segments:
        geo_ok, geo_message, geo_data = validate_country_city(
            country_name=segment.pays,
            city_name=segment.ville,
            country_code=segment.country_code,
        )
        if not geo_ok:
            status_code = 503 if geo_message == GEO_VALIDATION_UNAVAILABLE_MESSAGE else 400
            raise HTTPException(status_code=status_code, detail=geo_message)
        segment.pays = geo_data['country_name']
        segment.ville = geo_data['city_name']
        segment.country_code = geo_data['country_code']
    
    # Vérifier que les moyens de transport sont valides
    moyens_valides = ['routiere', 'routier', 'aerien', 'ferroviaire', 'maritime']
    for segment in mission_data.segments:
        moyen = segment.moyen_transport or 'aerien'
        if moyen.lower() not in moyens_valides:
            raise HTTPException(
                status_code=400,
                detail=f"Moyen de transport '{moyen}' invalide. Valides: {moyens_valides}"
            )
    
    # Calculer date début/fin globale de la mission
    date_debut_mission = min(seg.date_debut for seg in mission_data.segments)
    date_fin_mission = max(seg.date_fin for seg in mission_data.segments)
    
    # Vérifier qu'il n'y a pas de chevauchement pour chaque missionnaire
    conflits = []
    for mat in mission_data.matricules_missionnaires:
        missions_chevauchantes = db.query(models.Operation).join(
            models.Mission, models.Mission.id_mission == models.Operation.id_operation
        ).filter(
            models.Operation.matricule == mat,
            models.Operation.type_demande == 'Mission',
            models.Operation.statut.notin_(['refusé', 'annulé']),
            models.Operation.date_debut <= date_fin_mission,
            models.Operation.date_fin >= date_debut_mission
        ).all()
        
        if missions_chevauchantes:
            emp = db.query(models.Employe).filter(models.Employe.matricule == mat).first()
            conflits.append(f"{emp.prenom} {emp.nom} (Mat: {mat})")
    
    if conflits:
        raise HTTPException(
            status_code=400,
            detail=f"Ces employés ont déjà une mission pendant cette période: {', '.join(conflits)}"
        )
    
    # Créer l'opération
    premier_segment = mission_data.segments[0]
    operation = models.Operation(
        matricule=matricule,
        type_demande='Mission',
        statut='en attente',
        date_debut=date_debut_mission,
        date_fin=date_fin_mission,
        motif=mission_data.motif,
        cree_par=matricule
    )
    db.add(operation)
    db.flush()
    
    # Créer la mission principale (avec les données du premier segment)
    date_limite_rapport = date_fin_mission + timedelta(days=2)
    
    # Collecter tous les moyens de transport des segments pour la compatibilité
    tous_transports = list(set([seg.moyen_transport for seg in mission_data.segments if seg.moyen_transport]))
    
    mission = models.Mission(
        id_mission=operation.id_operation,
        pays=premier_segment.pays,
        ville=premier_segment.ville,
        email_mission=mission_data.email_contact,
        moyens_transport=tous_transports if tous_transports else ['aerien'],
        heure_depart=premier_segment.heure_depart,
        heure_retour=mission_data.segments[-1].heure_depart if len(mission_data.segments) > 1 else premier_segment.heure_depart,
        date_limite_rapport=date_limite_rapport,
        mission_comment=mission_data.mission_comment
    )
    db.add(mission)
    db.flush()
    
    # Créer les segments
    for i, segment_data in enumerate(mission_data.segments):
        # Calculer le nombre de nuits (pour information)
        delta = segment_data.date_fin - segment_data.date_debut
        nombre_nuits = delta.days
        
        segment = models.MissionSegment(
            id_mission=mission.id_mission,
            pays=segment_data.pays,
            ville=segment_data.ville,
            date_debut=segment_data.date_debut,
            date_fin=segment_data.date_fin,
            heure_depart=segment_data.heure_depart,
            heure_arrivee=segment_data.heure_arrivee,
            heure_retour=segment_data.heure_retour,
            nombre_nuits=nombre_nuits,
            ordre=i + 1,
            moyen_transport=segment_data.moyen_transport or 'aerien'
        )
        db.add(segment)
    
    # Créer les entrées pour les missionnaires
    for idx, mat in enumerate(mission_data.matricules_missionnaires):
        role = 'responsable' if mat == matricule else 'participant'
        missionnaire = models.MissionnairesMission(
            id_mission=mission.id_mission,
            matricule=mat,
            role_mission=role
        )
        db.add(missionnaire)
    
    db.commit()
    
    # Récupérer les noms des missionnaires pour la notification
    noms_missionnaires = []
    for mat in mission_data.matricules_missionnaires:
        emp = db.query(models.Employe).filter(models.Employe.matricule == mat).first()
        if emp:
            noms_missionnaires.append(f"{emp.prenom} {emp.nom}")
    
    # Notifier le premier validateur
    prochain_role, prochain_matricule = workflow.obtenir_prochain_validateur(operation.id_operation, db)
    if prochain_matricule:
        destinations = ", ".join([f"{seg.ville} ({seg.pays})" for seg in mission_data.segments])
        missionnaires_str = ", ".join(noms_missionnaires[:3])  # Limiter à 3 noms
        if len(noms_missionnaires) > 3:
            missionnaires_str += f" et {len(noms_missionnaires) - 3} autre(s)"
        
        notifications.creer_notification(
            matricule=prochain_matricule,
            type_notification='VALIDATION',
            titre=f"Nouvelle mission multi-destinations",
            message=f"Mission pour {len(noms_missionnaires)} employé(s) ({missionnaires_str}) vers: {destinations}",
            id_operation=operation.id_operation,
            db=db
        )

    # Notifier chaque missionnaire (hors initiateur)
    comment_label = f' "{mission_data.mission_comment}"' if mission_data.mission_comment else ''
    destinations_str = ", ".join([f"{seg.ville} ({seg.pays})" for seg in mission_data.segments])
    for mat in mission_data.matricules_missionnaires:
        if mat != matricule:
            notifications.creer_notification(
                matricule=mat,
                type_notification='INFO',
                titre=f"Vous avez été assigné à une mission{comment_label}",
                message=f"Vous êtes missionnaire pour la mission vers {destinations_str} (du {date_debut_mission} au {date_fin_mission}). Veuillez soumettre votre demande de frais une fois la mission validée.",
                id_operation=operation.id_operation,
                db=db
            )

    return {
        "id_operation": operation.id_operation,
        "id_mission": mission.id_mission,
        "segments_count": len(mission_data.segments),
        "missionnaires_count": len(mission_data.matricules_missionnaires),
        "date_debut": str(date_debut_mission),
        "date_fin": str(date_fin_mission),
        "date_limite_rapport": str(date_limite_rapport),
        "message": f"Mission créée avec {len(mission_data.segments)} destination(s) et {len(mission_data.matricules_missionnaires)} missionnaire(s). Vous devrez téléverser un rapport dans les 48h après votre retour."
    }


@router.get('/{id_mission}/missionnaires')
def obtenir_missionnaires_mission(id_mission: int, db: Session = Depends(get_db)):
    """
    Obtenir tous les missionnaires d'une mission avec leurs informations.
    """
    missionnaires = db.query(models.MissionnairesMission).filter(
        models.MissionnairesMission.id_mission == id_mission
    ).all()
    
    result = []
    for miss in missionnaires:
        employe = db.query(models.Employe).filter(
            models.Employe.matricule == miss.matricule
        ).first()
        
        if employe:
            result.append({
                "matricule": miss.matricule,
                "nom_complet": f"{employe.prenom} {employe.nom}",
                "fonction": employe.fonction,
                "role_mission": miss.role_mission,
                "date_ajout": str(miss.date_ajout) if miss.date_ajout else None
            })
    
    return {
        "id_mission": id_mission,
        "missionnaires_count": len(result),
        "missionnaires": result
    }


@router.get('/{id_mission}/segments')
def obtenir_segments_mission(id_mission: int, db: Session = Depends(get_db)):
    """
    Obtenir tous les segments d'une mission.
    """
    segments = db.query(models.MissionSegment).filter(
        models.MissionSegment.id_mission == id_mission
    ).order_by(models.MissionSegment.ordre).all()
    
    return {
        "id_mission": id_mission,
        "segments": [
            {
                "id_segment": seg.id_segment,
                "pays": seg.pays,
                "ville": seg.ville,
                "date_debut": str(seg.date_debut),
                "date_fin": str(seg.date_fin),
                "heure_arrivee": str(seg.heure_arrivee) if seg.heure_arrivee else None,
                "heure_depart": str(seg.heure_depart) if seg.heure_depart else None,
                "frais_hotel_unitaire": float(seg.frais_hotel_unitaire) if seg.frais_hotel_unitaire else 0,
                "frais_hotel_total": float(seg.frais_hotel_total) if seg.frais_hotel_total else 0,
                "nombre_nuits": seg.nombre_nuits,
                "ordre": seg.ordre
            }
            for seg in segments
        ]
    }


@router.put('/{id_operation}/modifier')
def modifier_mission(
    id_operation: int,
    request: Request,
    pays: str = Query(...),
    ville: str = Query(...),
    moyens_transport: List[str] = Query(...),
    date_debut: date = Query(...),
    date_fin: date = Query(...),
    country_code: Optional[str] = None,
    heure_depart: Optional[time] = None,
    heure_retour: Optional[time] = None,
    heure_arrivee: Optional[time] = None,
    email: Optional[str] = None,
    motif: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    Modifier une mission existante.
    Une mission ne peut être modifiée que par son initiateur et seulement si elle n'est pas clôturée.
    """
    # Vérifier que l'opération existe
    operation = db.query(models.Operation).filter(models.Operation.id_operation == id_operation).first()
    if not operation:
        raise HTTPException(status_code=404, detail="Opération introuvable")

    if request is not None:
        actor_matricule, actor_role = access_control.get_actor_from_request(request)
        if operation.matricule != actor_matricule and not access_control.can_access_globally(str(actor_role or '').upper()):
            raise HTTPException(status_code=403, detail="Vous n'êtes pas autorisé à modifier cette mission")
    
    # Vérifier que c'est bien une mission
    mission = db.query(models.Mission).filter(models.Mission.id_mission == id_operation).first()
    if not mission:
        raise HTTPException(status_code=404, detail="Mission introuvable")

    if operation.statut and str(operation.statut).lower() != 'en attente':
        raise HTTPException(status_code=400, detail="Seules les demandes en attente peuvent être modifiées")

    if workflow.operation_a_deja_ete_validee(id_operation, db):
        raise HTTPException(status_code=400, detail="Impossible de modifier une mission après la première validation")
    
    # Note: La vérification de l'initiateur peut être ajoutée ici si nécessaire
    # Pour l'instant, toute mission non clôturée peut être modifiée
    
    # Vérifier les moyens de transport
    moyens_valides = ['routiere', 'routier', 'aerien', 'ferroviaire', 'maritime']
    for moyen in moyens_transport:
        if moyen.lower() not in moyens_valides:
            raise HTTPException(
                status_code=400, 
                detail=f"Moyen de transport '{moyen}' invalide. Valides: {moyens_valides}"
            )

    from ..utils.world_geo_service import validate_country_city
    geo_ok, geo_message, geo_data = validate_country_city(
        country_name=pays,
        city_name=ville,
        country_code=country_code,
    )
    if not geo_ok:
        raise HTTPException(status_code=400, detail=geo_message)

    pays = geo_data['country_name']
    ville = geo_data['city_name']
    
    # Mettre à jour l'opération
    operation.date_debut = date_debut
    operation.date_fin = date_fin
    operation.motif = motif
    operation.commentaire = motif
    operation.est_modifie = True
    operation.date_modification = datetime.utcnow()
    
    # Mettre à jour la mission
    mission.pays = pays
    mission.ville = ville
    mission.moyens_transport = moyens_transport
    mission.heure_depart = heure_depart
    mission.heure_retour = heure_retour
    mission.heure_arrivee = heure_arrivee
    mission.email_mission = email
    
    db.commit()
    
    return {
        "id_operation": id_operation,
        "message": "Mission modifiée avec succès",
        "pays": pays,
        "ville": ville
    }


@router.post('/{id_operation}/televerser-rapport')
async def televerser_rapport(
    id_operation: int,
    matricule: int,
    fichier: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """
    Téléverser le rapport de mission (obligatoire dans les 48h après retour).
    Seuls les missionnaires assignés peuvent téléverser.
    """
    operation = db.query(models.Operation).filter(
        models.Operation.id_operation == id_operation
    ).first()
    
    if not operation:
        raise HTTPException(status_code=404, detail="Opération introuvable")
    
    # Seuls les missionnaires assignés peuvent téléverser le rapport
    is_missionnaire = db.query(models.MissionnairesMission).filter(
        models.MissionnairesMission.id_mission == id_operation,
        models.MissionnairesMission.matricule == matricule
    ).first() is not None
    if not is_missionnaire:
        raise HTTPException(status_code=403, detail="Seuls les missionnaires assignés peuvent téléverser le rapport")
    
    # Créer le dossier uploads
    upload_dir = "uploads/rapports_missions"
    os.makedirs(upload_dir, exist_ok=True)
    
    # Sauvegarder le fichier
    file_path = os.path.join(upload_dir, fichier.filename)
    
    with open(file_path, "wb") as f:
        content = await fichier.read()
        f.write(content)
    
    # Enregistrer dans la BDD
    success, message = mission_utils.televerser_rapport_mission(
        id_operation, file_path, matricule, db
    )
    
    if not success:
        raise HTTPException(status_code=400, detail=message)

    # Notifier tous les validateurs de la séquence
    employe_op = db.query(models.Employe).filter(models.Employe.matricule == operation.matricule).first()
    if employe_op:
        sequence = workflow.determiner_sequence_validation(employe_op, db, id_operation)
        notifies = set()
        for role in sequence:
            mat_v = workflow.obtenir_validateur_pour_role(employe_op, role, db)
            if mat_v and mat_v not in notifies:
                notifies.add(mat_v)
                notifications.creer_notification(
                    matricule=mat_v,
                    type_notification='INFO',
                    titre='Rapport de mission téléversé',
                    message=f'Le rapport pour la mission #{id_operation} a été téléversé. Vous pouvez le consulter en lecture seule.',
                    id_operation=id_operation,
                    db=db
                )

    return {
        "message": "Rapport téléversé avec succès",
        "chemin_fichier": file_path
    }


@router.get('/{id_operation}/verifier-rapport')
def verifier_rapport(id_operation: int, db: Session = Depends(get_db)):
    """
    Vérifier si le rapport de mission a été fourni dans les délais.
    """
    en_regle, message = mission_utils.verifier_rapport_mission(id_operation, db)
    
    return {
        "en_regle": en_regle,
        "message": message
    }


@router.get('/{id_operation}/statut-mission')
def obtenir_statut_mission(id_operation: int, db: Session = Depends(get_db)):
    """
    Obtenir le statut complet d'une mission : activation, validation, etc.
    """
    from ..utils.activation_cloture import est_operation_active
    from ..utils.workflow import obtenir_prochain_validateur
    
    operation = db.query(models.Operation).filter(
        models.Operation.id_operation == id_operation
    ).first()
    
    if not operation:
        raise HTTPException(status_code=404, detail="Opération introuvable")
    
    mission = db.query(models.Mission).filter(
        models.Mission.id_mission == id_operation
    ).first()
    
    if not mission:
        raise HTTPException(status_code=404, detail="Mission introuvable")
    
    # Vérifier workflow validation
    prochain_role, prochain_matricule = obtenir_prochain_validateur(id_operation, db)
    validation_complete = (prochain_role is None)  # Plus de validateurs = complète
    
    # Vérifier activation
    est_active = est_operation_active(id_operation, db)
    
    # Vérifier si rapport téléversé
    rapport_fourni = mission.rapport_televerse or False
    
    # Vérifier si des frais existent déjà
    frais_existants = db.query(models.Frais).filter(
        (models.Frais.id_mission == id_operation) | (models.Frais.id_operation == id_operation)
    ).first()
    
    return {
        "id_operation": id_operation,
        "est_active": est_active,
        "validation_complete": validation_complete,
        "peut_demander_frais": validation_complete,  # Frais seulement après validation complète
        "rapport_fourni": rapport_fourni,
        "rapport_televerse": rapport_fourni,
        "date_telechargement_rapport": mission.date_telechargement_rapport.isoformat() if mission.date_telechargement_rapport else None,
        "frais_deja_demandes": frais_existants is not None,
        "prochain_validateur": prochain_role
    }


@router.post('/{id_operation}/demande-frais', status_code=status.HTTP_201_CREATED)
def creer_demande_frais(
    id_operation: int,
    matricule: int,
    matricule_createur: Optional[int] = None,
    frais_transport: float = 0,
    frais_hotel: float = 0,
    frais_deplacement: float = 0,
    frais_nutrition: float = 0,
    justificatif: Optional[str] = None,
    preuves_paiement: Optional[List[dict]] = None,  # [{"type": "ticket", "montant": 100, "description": "..."}]
    db: Session = Depends(get_db)
):
    """
    Créer une demande de frais pour une mission.
    
    Cette demande nécessitera la validation du DFC (Directeur Financier et Comptable).
    """
    operation = db.query(models.Operation).filter(
        models.Operation.id_operation == id_operation
    ).first()
    
    if not operation:
        raise HTTPException(status_code=404, detail="Opération introuvable")
    
    if operation.type_demande != 'Mission':
        raise HTTPException(status_code=400, detail="Cette opération n'est pas une mission")

    createur = matricule_createur if matricule_createur is not None else matricule
    if createur != matricule:
        est_rh = workflow.verifier_role_employe(createur, 'RH', db)
        est_admin = workflow.verifier_role_employe(createur, 'ADMIN', db)
        if not (est_rh or est_admin):
            raise HTTPException(
                status_code=403,
                detail="Seuls RH et ADMIN peuvent initier des frais pour autrui"
            )
    
    # Créer la demande de frais
    success, message, frais = mission_utils.creer_demande_frais(
        id_operation=id_operation,
        matricule=matricule,
        frais_transport_voyage=frais_transport,
        frais_hotel=frais_hotel,
        frais_deplacement=frais_deplacement,
        frais_nutrition=frais_nutrition,
        justificatif=justificatif,
        preuves_paiement=preuves_paiement or [],
        db=db
    )
    
    if not success:
        raise HTTPException(status_code=400, detail=message)
    
    # Auto-valider si le demandeur est PCA/AG (séquence de validation vide)
    workflow.auto_valider_si_sequence_vide(frais.id_frais, matricule, db)
    
    return {
        "id_frais": frais.id_frais,
        "id_operation": frais.id_operation,
        "id_mission": id_operation,
        "total_frais": float(frais.total_frais),
        "message": message,
        "workflow": "Consulter l'overlay workflow de l'opération de frais"
    }


@router.get('/frais/{id_operation}')
def obtenir_detail_frais(id_operation: int, db: Session = Depends(get_db)):
    operation, frais, mission_operation, mission = _get_frais_entities(id_operation, db)

    if not operation or not frais:
        raise HTTPException(status_code=404, detail='Demande de frais introuvable')

    demandeur_emp = db.query(models.Employe).filter(models.Employe.matricule == operation.matricule).first()
    return {
        'id_operation': operation.id_operation,
        'id_frais': frais.id_frais,
        'id_mission': frais.id_mission,
        'statut': operation.statut,
        'date_demande': operation.date_demande,
        'demandeur': {
            'matricule': operation.matricule,
            'nom': demandeur_emp.nom if demandeur_emp else None,
            'prenom': demandeur_emp.prenom if demandeur_emp else None,
            'fonction': demandeur_emp.fonction if demandeur_emp else None,
        },
        'motif': operation.motif,
        'justificatif': frais.justificatif_de_frais,
        'frais_transport_voyage': float(frais.frais_transport_voyage or 0),
        'frais_hotel': float(frais.frais_hotel or 0),
        'frais_deplacement': float(frais.frais_deplacement or 0),
        'frais_nutrition': float(frais.frais_nutrition or 0),
        'total_frais': float(frais.total_frais or 0),
        'preuves_paiement': (json.loads(frais.preuves_paiement) if isinstance(frais.preuves_paiement, str) else frais.preuves_paiement) if frais.preuves_paiement else [],
        'mission': {
            'id_operation': mission_operation.id_operation if mission_operation else frais.id_mission,
            'titre': mission_operation.titre if mission_operation else None,
            'date_debut': mission_operation.date_debut if mission_operation else None,
            'date_fin': mission_operation.date_fin if mission_operation else None,
            'pays': mission.pays if mission else None,
            'ville': mission.ville if mission else None,
            'moyens_transport': (json.loads(mission.moyens_transport) if mission and isinstance(mission.moyens_transport, str) else (mission.moyens_transport if mission and mission.moyens_transport else [])),
            'heure_arrivee': None,
            'heure_retour': mission.heure_retour if mission else None,
        },
        'frais_valides_missionnaire': mission.frais_valides_missionnaire if mission else False,
        'frais_valides_rh': mission.frais_valides_rh if mission else False,
        'frais_payes': mission.frais_payes if mission else False,
        'date_validation_frais_missionnaire': mission.date_validation_frais_missionnaire.isoformat() if mission and mission.date_validation_frais_missionnaire else None,
        'date_validation_frais_rh': mission.date_validation_frais_rh.isoformat() if mission and mission.date_validation_frais_rh else None,
        'date_paiement_frais': mission.date_paiement_frais.isoformat() if mission and mission.date_paiement_frais else None,
    }



@router.put('/frais/{id_operation}/modifier')
def modifier_demande_frais(
    id_operation: int,
    frais_transport: float = 0,
    frais_hotel: float = 0,
    frais_deplacement: float = 0,
    frais_nutrition: float = 0,
    justificatif: Optional[str] = None,
    request: Request = None,
    db: Session = Depends(get_db)
):
    operation, frais, _, _ = _get_frais_entities(id_operation, db)

    if not operation or not frais:
        raise HTTPException(status_code=404, detail='Demande de frais introuvable')

    if request is not None:
        actor_matricule, actor_role = access_control.get_actor_from_request(request)
        if operation.matricule != actor_matricule and not access_control.can_access_globally(str(actor_role or '').upper()):
            raise HTTPException(status_code=403, detail="Vous n'êtes pas autorisé à modifier cette demande")

    if operation.statut and str(operation.statut).lower() != 'en attente':
        raise HTTPException(status_code=400, detail='Seules les demandes en attente peuvent être modifiées')

    if workflow.operation_a_deja_ete_validee(id_operation, db):
        raise HTTPException(status_code=400, detail='Impossible de modifier une opération après la première validation')

    total_frais = float(frais_transport or 0) + float(frais_hotel or 0) + float(frais_deplacement or 0) + float(frais_nutrition or 0)

    frais.frais_transport_voyage = frais_transport
    frais.frais_hotel = frais_hotel
    frais.frais_deplacement = frais_deplacement
    frais.frais_nutrition = frais_nutrition
    frais.total_frais = total_frais
    frais.justificatif_de_frais = justificatif

    operation.motif = justificatif
    operation.commentaire = justificatif
    operation.est_modifie = True
    operation.date_modification = datetime.utcnow()

    db.commit()
    db.refresh(operation)
    db.refresh(frais)

    return {
        'message': 'Demande de frais modifiée avec succès',
        'id_operation': operation.id_operation,
        'id_mission': frais.id_mission,
        'total_frais': float(frais.total_frais or 0),
        'justificatif': frais.justificatif_de_frais,
    }


@router.delete('/frais/{id_operation}')
def annuler_demande_frais(id_operation: int, request: Request, db: Session = Depends(get_db)):
    actor_matricule, actor_role = access_control.get_actor_from_request(request)
    operation, frais, _, _ = _get_frais_entities(id_operation, db)

    if not operation or not frais:
        raise HTTPException(status_code=404, detail='Demande de frais introuvable')

    if operation.matricule != actor_matricule and not access_control.can_access_globally(str(actor_role or '').upper()):
        raise HTTPException(status_code=403, detail="Vous n'êtes pas autorisé à annuler cette demande")

    if operation.statut and str(operation.statut).lower() != 'en attente':
        raise HTTPException(status_code=400, detail='Seules les demandes en attente peuvent être annulées')

    if workflow.operation_est_validee_par_validateur_final(id_operation, db):
        raise HTTPException(status_code=400, detail='Impossible d’annuler une opération déjà validée par le validateur final')

    notifications.ajouter_notifications_annulation_operation(operation, actor_matricule, db)

    db.query(models.Creation).filter(models.Creation.id_operation == id_operation).delete()
    db.query(models.Validation).filter(models.Validation.id_operation == id_operation).delete()
    db.query(models.Notification).filter(models.Notification.id_operation == id_operation).delete()
    db.query(models.Activation).filter(models.Activation.id_operation == id_operation).delete()
    db.query(models.RemplacantPropose).filter(models.RemplacantPropose.id_operation == id_operation).delete()
    db.query(models.DemandeExplication).filter(models.DemandeExplication.id_operation == id_operation).delete()

    db.delete(frais)
    db.delete(operation)
    db.commit()

    return {
        'message': 'Demande de frais annulée avec succès',
        'id_operation': id_operation,
    }


@router.delete('/frais/{id_frais}/supprimer-preuve')
def supprimer_preuve_frais(
    id_frais: int,
    matricule: int,
    index: int,
    db: Session = Depends(get_db)
):
    frais = db.query(models.Frais).filter(models.Frais.id_frais == id_frais).first()
    if not frais:
        raise HTTPException(status_code=404, detail="Frais introuvable")
    is_missionnaire = db.query(models.MissionnairesMission).filter(
        models.MissionnairesMission.id_mission == frais.id_mission,
        models.MissionnairesMission.matricule == matricule
    ).first() is not None
    if not is_missionnaire:
        raise HTTPException(status_code=403, detail="Seuls les missionnaires assignés peuvent supprimer les preuves")
    raw = frais.preuves_paiement
    if isinstance(raw, str):
        try:
            preuves = json.loads(raw)
        except Exception:
            preuves = []
    elif isinstance(raw, list):
        preuves = list(raw)
    else:
        preuves = []
    if index < 0 or index >= len(preuves):
        raise HTTPException(status_code=404, detail="Preuve introuvable à cet index")
    preuve = preuves[index]
    chemin = ''
    if isinstance(preuve, dict):
        chemin = preuve.get('fichier') or preuve.get('chemin_fichier') or preuve.get('chemin') or ''
    if chemin and os.path.exists(chemin):
        os.remove(chemin)
    preuves.pop(index)
    frais.preuves_paiement = json.dumps(preuves)
    db.commit()
    return {"message": "Preuve supprimée avec succès"}


@router.post('/frais/{id_frais}/televerser-preuves')
async def televerser_preuves_frais(
    id_frais: int,
    type_preuve: str,  # ticket, recu, facture, etc.
    matricule: int = Query(..., description="Matricule du missionnaire"),
    fichier: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """
    Téléverser les preuves de paiement pour une demande de frais.
    Seuls les missionnaires assignés à la mission peuvent téléverser.
    """
    frais = db.query(models.Frais).filter(models.Frais.id_frais == id_frais).first()
    if not frais:
        raise HTTPException(status_code=404, detail="Frais introuvable")
    
    # Vérifier que l'utilisateur est un missionnaire assigné à cette mission
    is_missionnaire = db.query(models.MissionnairesMission).filter(
        models.MissionnairesMission.id_mission == frais.id_mission,
        models.MissionnairesMission.matricule == matricule
    ).first() is not None
    if not is_missionnaire:
        raise HTTPException(status_code=403, detail="Seuls les missionnaires assignés peuvent téléverser les preuves")
    
    # Créer le dossier uploads
    upload_dir = "uploads/preuves_frais"
    os.makedirs(upload_dir, exist_ok=True)
    
    # Sauvegarder le fichier
    file_path = os.path.join(upload_dir, fichier.filename)
    
    with open(file_path, "wb") as f:
        content = await fichier.read()
        f.write(content)
    
    # Enregistrer dans la BDD
    success, message = mission_utils.televerser_preuves_frais(
        frais.id_frais, type_preuve, file_path, db
    )
    
    if not success:
        raise HTTPException(status_code=400, detail=message)
    
    return {
        "message": "Preuve téléversée avec succès",
        "chemin_fichier": file_path
    }


@router.get('/mes-missions/{matricule}')
def obtenir_mes_missions(
    matricule: int,
    annee: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """
    Obtenir toutes les missions d'un employé.
    """
    query = db.query(models.Operation).filter(
        models.Operation.matricule == matricule,
        models.Operation.type_demande == 'Mission'
    )
    
    if annee:
        query = query.filter(
            db.func.year(models.Operation.date_debut) == annee
        )
    
    operations = query.order_by(models.Operation.date_debut.desc()).all()
    
    result = []
    for op in operations:
        mission = db.query(models.Mission).filter(
            models.Mission.id_mission == op.id_operation
        ).first()
        
        frais = db.query(models.Frais).filter(
            models.Frais.id_mission == op.id_operation
        ).first()
        
        missionnaires_rows = db.query(models.MissionnairesMission).filter(
            models.MissionnairesMission.id_mission == op.id_operation
        ).all()
        missionnaires_noms = []
        for mm in missionnaires_rows:
            emp = db.query(models.Employe).filter(models.Employe.matricule == mm.matricule).first()
            if emp:
                missionnaires_noms.append(f"{emp.prenom} {emp.nom}")

        item = {
            "id_operation": op.id_operation,
            "matricule": op.matricule,
            "date_debut": op.date_debut,
            "date_fin": op.date_fin,
            "statut": op.statut,
            "pays": mission.pays if mission else None,
            "ville": mission.ville if mission else None,
            "moyens_transport": (json.loads(mission.moyens_transport) if mission and isinstance(mission.moyens_transport, str) else (mission.moyens_transport if mission and mission.moyens_transport else [])),
            "rapport_televerse": mission.rapport_televerse if mission else False,
            "date_limite_rapport": mission.date_limite_rapport if mission else None,
            "a_des_frais": frais is not None,
            "total_frais": float(frais.total_frais) if frais else 0,
            "missionnaires_noms": missionnaires_noms,
            "mission_comment": mission.mission_comment if mission else None,
        }
        
        result.append(item)
    
    return result


@router.post('/activation/{id_operation}/rh')
def activer_mission_rh(
    id_operation: int,
    matricule_rh: int,
    db: Session = Depends(get_db)
):
    success, message = activation_cloture.activer_operation_rh(
        id_operation, matricule_rh, db
    )
    if not success:
        raise HTTPException(status_code=400, detail=message)
    return {'message': message}


@router.post('/activation/{id_operation}/demandeur')
def activer_mission_demandeur(
    id_operation: int,
    matricule_demandeur: int,
    db: Session = Depends(get_db)
):
    success, message = activation_cloture.activer_operation_demandeur(
        id_operation, matricule_demandeur, db
    )
    if not success:
        raise HTTPException(status_code=400, detail=message)
    return {'message': message}


@router.post('/cloture/{id_operation}/demandeur')
def cloturer_mission_demandeur(
    id_operation: int,
    matricule_demandeur: int,
    retour_anticipe: bool = False,
    date_retour_anticipe: Optional[date] = None,
    db: Session = Depends(get_db)
):
    success, message = activation_cloture.cloturer_operation_demandeur(
        id_operation, matricule_demandeur, db, retour_anticipe, date_retour_anticipe
    )
    if not success:
        raise HTTPException(status_code=400, detail=message)
    return {'message': message}


@router.post('/cloture/{id_operation}/rh')
def cloturer_mission_rh(
    id_operation: int,
    matricule_rh: int,
    db: Session = Depends(get_db)
):
    success, message = activation_cloture.cloturer_operation_rh(
        id_operation, matricule_rh, db
    )
    if not success:
        raise HTTPException(status_code=400, detail=message)
    return {'message': message}


@router.get('/stats-missions/{matricule}')
def obtenir_stats_missions(matricule: int, db: Session = Depends(get_db)):
    """
    Obtenir des statistiques sur les missions d'un employé.
    """
    missions = db.query(models.Operation).filter(
        models.Operation.matricule == matricule,
        models.Operation.type_demande == 'Mission'
    ).all()
    
    total_missions = len(missions)
    missions_en_cours = len([m for m in missions if m.statut == 'en cours'])
    missions_terminees = len([m for m in missions if m.statut == 'terminé'])
    
    # Calculer le total des frais
    total_frais = 0
    for mission in missions:
        frais = db.query(models.Frais).filter(
            models.Frais.id_mission == mission.id_operation
        ).first()
        if frais:
            total_frais += float(frais.total_frais or 0)
    
    return {
        "total_missions": total_missions,
        "missions_en_cours": missions_en_cours,
        "missions_terminees": missions_terminees,
        "total_frais_demandes": total_frais
    }


@router.get('/toutes-missions-ig')
def obtenir_toutes_missions_ig(db: Session = Depends(get_db)):
    """
    Vue Inspecteur Général: Retourne toutes les missions (en cours et terminées).
    Accessible uniquement pour les utilisateurs avec fonction IG ou RH.
    """
    from sqlalchemy import func
    
    # Requête pour obtenir toutes les missions avec les informations des employés
    missions_query = db.query(
        models.Mission.id_mission,
        models.Mission.pays,
        models.Mission.ville,
        models.Mission.rapport_televerse,
        models.Mission.date_telechargement_rapport,
        models.Mission.frais_valides_missionnaire,
        models.Mission.frais_valides_rh,
        models.Mission.frais_payes,
        models.Operation.date_debut,
        models.Operation.date_fin,
        models.Operation.statut,
        models.Operation.matricule,
        models.Employe.nom,
        models.Employe.prenom,
        models.Employe.fonction
    ).join(
        models.Operation,
        models.Mission.id_mission == models.Operation.id_operation
    ).join(
        models.Employe,
        models.Operation.matricule == models.Employe.matricule
    ).order_by(
        models.Operation.date_debut.desc()
    ).all()
    
    missions_list = []
    for mission in missions_query:
        # Compter le nombre de missionnaires pour cette mission
        nb_missionnaires = db.query(func.count(models.MissionnairesMission.matricule)).filter(
            models.MissionnairesMission.id_mission == mission.id_mission
        ).scalar() or 1
        
        # Compter le nombre de segments (destinations)
        nb_segments = db.query(func.count(models.MissionSegment.id_segment)).filter(
            models.MissionSegment.id_mission == mission.id_mission
        ).scalar() or 1
        
        missions_list.append({
            "id_mission": mission.id_mission,
            "pays": mission.pays,
            "ville": mission.ville,
            "date_debut": mission.date_debut.isoformat() if mission.date_debut else None,
            "date_fin": mission.date_fin.isoformat() if mission.date_fin else None,
            "statut": mission.statut,
            "rapport_televerse": mission.rapport_televerse,
            "date_telechargement_rapport": mission.date_telechargement_rapport.isoformat() if mission.date_telechargement_rapport else None,
            "matricule": mission.matricule,
            "nom_employe": f"{mission.prenom} {mission.nom}",
            "fonction_employe": mission.fonction,
            "nb_missionnaires": nb_missionnaires,
            "nb_segments": nb_segments,
            "frais_valides_missionnaire": mission.frais_valides_missionnaire or False,
            "frais_valides_rh": mission.frais_valides_rh or False,
            "frais_payes": mission.frais_payes or False
        })
    
    return {
        "missions": missions_list,
        "total": len(missions_list)
    }


@router.post('/{id_mission}/valider-frais-missionnaire')
def valider_frais_missionnaire(
    id_mission: int,
    data: dict,
    db: Session = Depends(get_db)
):
    """
    Le missionnaire valide que les frais de mission sont corrects.
    Première étape de la validation avant paiement par le RH.
    """
    mission = db.query(models.Mission).filter(models.Mission.id_mission == id_mission).first()
    if not mission:
        raise HTTPException(status_code=404, detail="Mission non trouvée")
    
    matricule = data.get('matricule')
    if not matricule:
        raise HTTPException(status_code=400, detail="Matricule requis")
    
    # Vérifier que l'employé fait partie des missionnaires
    missionnaire = db.query(models.MissionnairesMission).filter(
        models.MissionnairesMission.id_mission == id_mission,
        models.MissionnairesMission.matricule == matricule
    ).first()
    
    operation = db.query(models.Operation).filter(models.Operation.id_operation == id_mission).first()
    
    # Si pas dans MissionnairesMission, vérifier si c'est le demandeur principal
    if not missionnaire and (not operation or operation.matricule != matricule):
        raise HTTPException(status_code=403, detail="Vous n'êtes pas missionnaire sur cette mission")
    
    # Valider les frais
    mission.frais_valides_missionnaire = True
    mission.date_validation_frais_missionnaire = datetime.utcnow()
    
    db.commit()
    
    # Créer une notification pour le RH
    rh_employees = db.query(models.Employe).filter(
        models.Employe.fonction.ilike('%RH%')
    ).all()

    _emp_miss = db.query(models.Employe).filter(models.Employe.matricule == matricule).first()
    _nom_miss = f"{_emp_miss.prenom} {_emp_miss.nom}" if _emp_miss else f"Matricule {matricule}"
    _op_miss = db.query(models.Operation).filter(models.Operation.id_operation == id_mission).first()
    _titre_miss = (_op_miss.titre or f"Mission #{id_mission}") if _op_miss else f"Mission #{id_mission}"

    for rh in rh_employees:
        notifications.creer_notification(
            matricule=rh.matricule,
            type_notification=models.TypeNotificationEnum.VALIDATION,
            titre=f"Paiement frais requis – {_titre_miss}",
            message=f"{_nom_miss} a confirmé la réception des frais pour la mission #{id_mission} ({_titre_miss}). Rendez-vous dans Frais de Mission (onglet Reçu) pour valider le paiement.",
            id_operation=id_mission,
            db=db
        )
    
    return {
        "message": "Frais validés par le missionnaire",
        "frais_valides_missionnaire": True,
        "date_validation": mission.date_validation_frais_missionnaire.isoformat()
    }


@router.post('/{id_mission}/valider-paiement-rh')
def valider_paiement_rh(
    id_mission: int,
    data: dict,
    db: Session = Depends(get_db)
):
    """
    Le RH valide que les frais ont été payés.
    Deuxième étape de validation, permet la clôture de la mission.
    """
    mission = db.query(models.Mission).filter(models.Mission.id_mission == id_mission).first()
    if not mission:
        raise HTTPException(status_code=404, detail="Mission non trouvée")
    
    matricule = data.get('matricule')
    if not matricule:
        raise HTTPException(status_code=400, detail="Matricule requis")
    
    # Vérifier que l'utilisateur est RH (via rôle DB ou champ fonction)
    employe = db.query(models.Employe).filter(models.Employe.matricule == matricule).first()
    if not employe:
        raise HTTPException(status_code=403, detail="Employé introuvable")
    _utilisateur = db.query(models.Utilisateur).filter(models.Utilisateur.matricule == matricule).first()
    _role_db = None
    if _utilisateur:
        _role_obj = db.query(models.Role).filter(models.Role.id == _utilisateur.role_id).first()
        _role_db = (_role_obj.name or '').upper() if _role_obj else None
    _est_rh = (
        (_role_db in ('RH', 'ADMIN', 'PCA', 'AG')) or
        (employe.fonction and 'RH' in employe.fonction.upper())
    )
    if not _est_rh:
        raise HTTPException(status_code=403, detail="Seul le RH peut valider le paiement des frais")
    
    # Vérifier que le missionnaire a validé les frais
    if not mission.frais_valides_missionnaire:
        raise HTTPException(
            status_code=400, 
            detail="Le missionnaire doit d'abord valider les frais avant le paiement RH"
        )
    
    # Valider le paiement
    mission.frais_valides_rh = True
    mission.frais_payes = True
    mission.date_validation_frais_rh = datetime.utcnow()
    mission.date_paiement_frais = datetime.utcnow()
    
    db.commit()
    
    # Notifier le/les missionnaire(s)
    # Récupérer tous les missionnaires
    missionnaires = db.query(models.MissionnairesMission).filter(
        models.MissionnairesMission.id_mission == id_mission
    ).all()
    
    operation = db.query(models.Operation).filter(models.Operation.id_operation == id_mission).first()
    
    # Notifier tous les missionnaires
    matricules_notifies = set()
    if operation:
        matricules_notifies.add(operation.matricule)
    
    for miss in missionnaires:
        matricules_notifies.add(miss.matricule)
    
    for mat in matricules_notifies:
        notifications.creer_notification(
            matricule=mat,
            type_notification=models.TypeNotificationEnum.AUTRE,
            titre=f"Paiement frais – Mission #{id_mission} confirmé",
            message=f"Le RH a validé le paiement de vos frais pour la mission #{id_mission}.",
            id_operation=id_mission,
            db=db
        )

    # Notifier les validateurs du workflow
    _validateurs_pay = db.query(models.Validation).filter(
        models.Validation.id_operation == id_mission,
        models.Validation.statut_validation == 'validé'
    ).all()
    _op_pay = db.query(models.Operation).filter(models.Operation.id_operation == id_mission).first()
    _titre_pay = (_op_pay.titre or f"Mission #{id_mission}") if _op_pay else f"Mission #{id_mission}"
    for _v in _validateurs_pay:
        if _v.matricule_validateur and _v.matricule_validateur not in matricules_notifies:
            notifications.creer_notification(
                matricule=_v.matricule_validateur,
                type_notification=models.TypeNotificationEnum.AUTRE,
                titre=f"Paiement frais – {_titre_pay}",
                message=f"Les frais de la mission #{id_mission} ({_titre_pay}) ont été payés et confirmés par le RH.",
                id_operation=id_mission,
                db=db
            )

    return {
        "message": "Paiement validé par le RH",
        "frais_payes": True,
        "date_paiement": mission.date_paiement_frais.isoformat()
    }


@router.get('/{id_mission}/statut-paiement-frais')
def obtenir_statut_paiement_frais(id_mission: int, db: Session = Depends(get_db)):
    """
    Retourne le statut de paiement des frais d'une mission.
    """
    mission = db.query(models.Mission).filter(models.Mission.id_mission == id_mission).first()
    if not mission:
        raise HTTPException(status_code=404, detail="Mission non trouvée")

    frais = db.query(models.Frais).filter(models.Frais.id_mission == id_mission).first()

    return {
        "id_mission": id_mission,
        "id_frais": frais.id_frais if frais else None,
        "id_frais_operation": frais.id_operation if frais else None,
        "frais_valides_missionnaire": mission.frais_valides_missionnaire or False,
        "frais_valides_rh": mission.frais_valides_rh or False,
        "frais_payes": mission.frais_payes or False,
        "date_validation_frais_missionnaire": mission.date_validation_frais_missionnaire.isoformat() if mission.date_validation_frais_missionnaire else None,
        "date_validation_frais_rh": mission.date_validation_frais_rh.isoformat() if mission.date_validation_frais_rh else None,
        "date_paiement_frais": mission.date_paiement_frais.isoformat() if mission.date_paiement_frais else None
    }


@router.get('/{id_operation}/rapport')
def obtenir_rapport_mission(id_operation: int, db: Session = Depends(get_db)):
    """
    Retourne les informations du rapport téléversé pour une mission.
    """
    mission = db.query(models.Mission).filter(models.Mission.id_mission == id_operation).first()
    if not mission:
        raise HTTPException(status_code=404, detail="Mission introuvable")

    if not mission.rapport_televerse or not mission.rapport:
        return {"rapport_televerse": False, "fichier": None, "date": None}

    chemin = mission.rapport
    nom_fichier = chemin.split('/')[-1] if '/' in chemin else chemin
    return {
        "rapport_televerse": True,
        "fichier": {
            "chemin": chemin,
            "nom_fichier": nom_fichier,
            "url": f"/api/{chemin.lstrip('/')}",
        },
        "date": mission.date_telechargement_rapport.isoformat() if mission.date_telechargement_rapport else None,
    }


@router.delete('/{id_operation}/supprimer-rapport')
def supprimer_rapport_mission(
    id_operation: int,
    matricule: int,
    db: Session = Depends(get_db)
):
    is_missionnaire = db.query(models.MissionnairesMission).filter(
        models.MissionnairesMission.id_mission == id_operation,
        models.MissionnairesMission.matricule == matricule
    ).first() is not None
    if not is_missionnaire:
        raise HTTPException(status_code=403, detail="Seuls les missionnaires assignés peuvent supprimer le rapport")
    mission = db.query(models.Mission).filter(models.Mission.id_mission == id_operation).first()
    if not mission:
        raise HTTPException(status_code=404, detail="Mission introuvable")
    if not mission.rapport_televerse or not mission.rapport:
        raise HTTPException(status_code=404, detail="Aucun rapport à supprimer")
    if os.path.exists(mission.rapport):
        os.remove(mission.rapport)
    mission.rapport = None
    mission.rapport_televerse = False
    mission.date_telechargement_rapport = None
    db.commit()
    return {"message": "Rapport supprimé avec succès"}


@router.post('/{id_mission}/marquer-paye')
def marquer_frais_paye(id_mission: int, request: Request, db: Session = Depends(get_db)):
    """
    RH ou ADMIN marque les frais d'une mission comme payés.
    Déclenche une notification aux missionnaires.
    """
    actor_matricule, actor_role = access_control.get_actor_from_request(request)
    if not access_control.can_access_globally(str(actor_role or '').upper()):
        raise HTTPException(status_code=403, detail="Seuls RH et ADMIN peuvent marquer les frais comme payés")

    mission = db.query(models.Mission).filter(models.Mission.id_mission == id_mission).first()
    if not mission:
        raise HTTPException(status_code=404, detail="Mission introuvable")

    mission.frais_payes = True
    mission.frais_valides_rh = True
    mission.date_paiement_frais = datetime.utcnow()
    mission.date_validation_frais_rh = datetime.utcnow()
    db.commit()

    # Notifier les missionnaires
    missionnaires = db.query(models.MissionnairesMission).filter(
        models.MissionnairesMission.id_mission == id_mission
    ).all()
    operation = db.query(models.Operation).filter(models.Operation.id_operation == id_mission).first()
    matricules_notifies = set()
    if operation:
        matricules_notifies.add(operation.matricule)
    for miss in missionnaires:
        matricules_notifies.add(miss.matricule)
    for mat in matricules_notifies:
        notifications.creer_notification(
            matricule=mat,
            type_notification=models.TypeNotificationEnum.AUTRE,
            titre=f"Paiement frais – Mission #{id_mission} confirmé",
            message=f"Le RH a confirmé le paiement des frais pour la mission #{id_mission}.",
            id_operation=id_mission,
            db=db
        )

    return {"message": "Frais marqués comme payés", "id_mission": id_mission, "frais_payes": True}


@router.get('/en-tant-que-missionnaire/{matricule}')
def obtenir_missions_en_tant_que_missionnaire(matricule: int, db: Session = Depends(get_db)):
    """
    Retourne les missions où l'utilisateur est missionnaire (pas l'initiateur).
    Doit être défini AVANT /{id_mission} pour éviter la capture par le paramètre dynamique.
    """
    missionnaire_rows = db.query(models.MissionnairesMission).filter(
        models.MissionnairesMission.matricule == matricule
    ).all()
    mission_ids = [mm.id_mission for mm in missionnaire_rows]
    if not mission_ids:
        return []
    operations = db.query(models.Operation).filter(
        models.Operation.id_operation.in_(mission_ids),
        models.Operation.type_demande == 'Mission'
    ).order_by(models.Operation.date_debut.desc()).all()
    result = []
    for op in operations:
        mission = db.query(models.Mission).filter(models.Mission.id_mission == op.id_operation).first()
        initiateur = db.query(models.Employe).filter(models.Employe.matricule == op.matricule).first()
        mm_rows = db.query(models.MissionnairesMission).filter(
            models.MissionnairesMission.id_mission == op.id_operation
        ).all()
        missionnaires_noms = []
        for mm in mm_rows:
            emp = db.query(models.Employe).filter(models.Employe.matricule == mm.matricule).first()
            if emp:
                missionnaires_noms.append(f"{emp.prenom} {emp.nom}")
        frais = db.query(models.Frais).filter(models.Frais.id_mission == op.id_operation).first()
        moyens_transport = []
        if mission and mission.moyens_transport:
            raw = mission.moyens_transport
            if isinstance(raw, str):
                try:
                    moyens_transport = json.loads(raw)
                except Exception:
                    moyens_transport = [raw]
            else:
                moyens_transport = raw
        activation = db.query(models.Activation).filter(
            models.Activation.id_operation == op.id_operation,
            models.Activation.type_action == models.TypeActionEnum.ACTIVATION
        ).first()
        cloture = db.query(models.Activation).filter(
            models.Activation.id_operation == op.id_operation,
            models.Activation.type_action == models.TypeActionEnum.CLOTURE
        ).first()
        result.append({
            "id_operation": op.id_operation,
            "date_debut": op.date_debut,
            "date_fin": op.date_fin,
            "statut": op.statut,
            "pays": mission.pays if mission else None,
            "ville": mission.ville if mission else None,
            "mission_comment": mission.mission_comment if mission else None,
            "moyens_transport": moyens_transport,
            "rapport_televerse": mission.rapport_televerse if mission else False,
            "a_des_frais": frais is not None,
            "total_frais": float(frais.total_frais) if frais else 0,
            "missionnaires_noms": missionnaires_noms,
            "initiateur_matricule": op.matricule,
            "initiateur_nom": f"{initiateur.prenom} {initiateur.nom}" if initiateur else f"#{op.matricule}",
            # Activation fields needed by initRowEtatFromApi
            "activation_demandeur_fait": activation.demandeur_fait if activation else False,
            "activation_rh_fait": activation.rh_fait if activation else False,
            "activation_complete": (activation.statut_final == models.StatutFinalEnum.COMPLETE) if activation else False,
            "activation_date_demandeur": activation.date_demandeur if activation else None,
            "activation_date_rh": activation.date_rh if activation else None,
            # Cloture fields
            "cloture_demandeur_fait": cloture.demandeur_fait if cloture else False,
            "cloture_complete": (cloture.statut_final == models.StatutFinalEnum.COMPLETE) if cloture else False,
            # Payment fields
            "frais_payes": mission.frais_payes if mission else False,
            "frais_valides_missionnaire": mission.frais_valides_missionnaire if mission else False,
            "frais_valides_rh": mission.frais_valides_rh if mission else False,
            "type_demande": "Mission",
            "motif": op.motif,
        })
    return result


@router.get('/{id_mission}')
def obtenir_detail_mission(id_mission: int, db: Session = Depends(get_db)):
    """
    Retourne le détail complet d'une mission: infos de base, segments, missionnaires.
    Cet endpoint doit rester en DERNIER dans le router car son paramètre dynamique
    /{id_mission} pourrait sinon capturer des routes statiques définies après lui.
    """
    mission = db.query(models.Mission).filter(models.Mission.id_mission == id_mission).first()
    if not mission:
        raise HTTPException(status_code=404, detail="Mission introuvable")

    operation = db.query(models.Operation).filter(models.Operation.id_operation == id_mission).first()
    initiateur_emp = db.query(models.Employe).filter(models.Employe.matricule == operation.matricule).first() if operation else None

    segments = db.query(models.MissionSegment).filter(
        models.MissionSegment.id_mission == id_mission
    ).order_by(models.MissionSegment.ordre).all()

    missionnaires_db = db.query(models.MissionnairesMission).filter(
        models.MissionnairesMission.id_mission == id_mission
    ).all()

    missionnaires_list = []
    for mm in missionnaires_db:
        emp = db.query(models.Employe).filter(models.Employe.matricule == mm.matricule).first()
        missionnaires_list.append({
            "matricule": mm.matricule,
            "nom_complet": f"{emp.prenom} {emp.nom}" if emp else f"#{mm.matricule}",
            "fonction": emp.fonction if emp else None,
            "email": emp.email if emp else None,
            "role_mission": mm.role_mission,
        })

    return {
        "id_mission": id_mission,
        "motif": operation.motif if operation else None,
        "initiateur_nom": f"{initiateur_emp.prenom} {initiateur_emp.nom}" if initiateur_emp else None,
        "mission_comment": mission.mission_comment,
        "email_contact": mission.email_mission,
        "pays": mission.pays,
        "ville": mission.ville,
        "date_debut": str(operation.date_debut) if operation and operation.date_debut else None,
        "date_fin": str(operation.date_fin) if operation and operation.date_fin else None,
        "statut": operation.statut if operation else None,
        "rapport_televerse": mission.rapport_televerse or False,
        "rapport_chemin": mission.rapport.replace("\\", "/") if mission.rapport else None,
        "frais_payes": mission.frais_payes or False,
        "frais_valides_missionnaire": mission.frais_valides_missionnaire or False,
        "frais_valides_rh": mission.frais_valides_rh or False,
        "segments": [
            {
                "id_segment": s.id_segment,
                "pays": s.pays,
                "ville": s.ville,
                "date_debut": str(s.date_debut) if s.date_debut else None,
                "date_fin": str(s.date_fin) if s.date_fin else None,
                "moyen_transport": s.moyen_transport,
                "heure_depart": str(s.heure_depart) if s.heure_depart else None,
                "heure_arrivee": str(s.heure_arrivee) if s.heure_arrivee else None,
                "heure_retour": str(s.heure_retour) if s.heure_retour else None,
                "nombre_nuits": s.nombre_nuits,
                "ordre": s.ordre,
            }
            for s in segments
        ],
        "missionnaires": missionnaires_list,
    }

