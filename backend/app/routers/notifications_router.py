"""
Router pour le système de notifications
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from ..db import get_db
from .. import models
from ..utils import notifications as notif_utils

router = APIRouter(prefix='/api/notifications', tags=['notifications'])


@router.get('/non-lues/{matricule}')
def obtenir_notifications_non_lues(matricule: int, db: Session = Depends(get_db)):
    """
    Obtenir toutes les notifications non lues d'un employé.
    """
    notifications = notif_utils.obtenir_notifications_non_lues(matricule, db)
    
    return [
        {
            "id_notification": n.id_notification,
            "type_notification": n.type_notification,
            "titre": n.titre,
            "message": n.message,
            "date_creation": n.date_creation,
            "id_operation": n.id_operation
        }
        for n in notifications
    ]


@router.get('/toutes/{matricule}')
def obtenir_toutes_notifications(
    matricule: int,
    limite: int = 50,
    db: Session = Depends(get_db)
):
    """
    Obtenir toutes les notifications d'un employé (lues et non lues).
    """
    notifications = db.query(models.Notification).filter(
        models.Notification.matricule == matricule
    ).order_by(models.Notification.date_creation.desc()).limit(limite).all()
    
    return [
        {
            "id_notification": n.id_notification,
            "type_notification": n.type_notification,
            "titre": n.titre,
            "message": n.message,
            "lue": n.lue,
            "date_creation": n.date_creation,
            "date_lecture": n.date_lecture,
            "id_operation": n.id_operation
        }
        for n in notifications
    ]


@router.put('/{id_notification}/marquer-lue')
def marquer_comme_lue(id_notification: int, db: Session = Depends(get_db)):
    """
    Marquer une notification comme lue.
    """
    success, message = notif_utils.marquer_notification_comme_lue(id_notification, db)
    
    if not success:
        raise HTTPException(status_code=404, detail=message)
    
    return {"message": message}


@router.put('/marquer-toutes-lues/{matricule}')
def marquer_toutes_lues(matricule: int, db: Session = Depends(get_db)):
    """
    Marquer toutes les notifications d'un employé comme lues.
    """
    notifications = db.query(models.Notification).filter(
        models.Notification.matricule == matricule,
        models.Notification.lue == False
    ).all()
    
    count = 0
    for notif in notifications:
        notif.lue = True
        notif.date_lecture = datetime.now()
        count += 1
    
    db.commit()
    
    return {
        "message": f"{count} notification(s) marquée(s) comme lue(s)"
    }


@router.get('/compteur/{matricule}')
def compter_non_lues(matricule: int, db: Session = Depends(get_db)):
    """
    Compter le nombre de notifications non lues.
    """
    count = notif_utils.compter_notifications_non_lues(matricule, db)
    
    return {
        "matricule": matricule,
        "non_lues": count
    }


@router.delete('/{id_notification}')
def supprimer_notification(id_notification: int, db: Session = Depends(get_db)):
    """
    Supprimer une notification.
    """
    notification = db.query(models.Notification).filter(
        models.Notification.id_notification == id_notification
    ).first()
    
    if not notification:
        raise HTTPException(status_code=404, detail="Notification introuvable")
    
    db.delete(notification)
    db.commit()
    
    return {"message": "Notification supprimée"}


@router.get('/par-type/{matricule}/{type_notification}')
def obtenir_notifications_par_type(
    matricule: int,
    type_notification: str,
    db: Session = Depends(get_db)
):
    """
    Obtenir les notifications d'un type spécifique.
    
    Types: VALIDATION, REFUS, ALERTE_CONGES, RAPPEL_DEPART, RAPPEL_RETOUR, 
           DEMANDE_MISSION, DEMANDE_EXPLICATION, EVALUATION, CLOTURE_REQUISE, AUTRE
    """
    try:
        type_enum = models.TypeNotificationEnum[type_notification.upper()]
    except KeyError:
        raise HTTPException(status_code=400, detail=f"Type de notification invalide: {type_notification}")
    
    notifications = db.query(models.Notification).filter(
        models.Notification.matricule == matricule,
        models.Notification.type_notification == type_enum
    ).order_by(models.Notification.date_creation.desc()).all()
    
    return [
        {
            "id_notification": n.id_notification,
            "titre": n.titre,
            "message": n.message,
            "lue": n.lue,
            "date_creation": n.date_creation,
            "id_operation": n.id_operation
        }
        for n in notifications
    ]


@router.post('/test-alerte-conges')
def tester_alerte_conges(db: Session = Depends(get_db)):
    """
    Tester l'envoi d'alertes de congés de fin d'année (normalement job hebdomadaire Oct-Déc).
    """
    notif_utils.envoyer_alerte_conges_fin_annee(db)
    
    return {"message": "Alertes de congés envoyées"}


@router.post('/creer')
def creer_notification_manuelle(
    matricule: int,
    type_notification: str,
    titre: str,
    message: str,
    id_operation: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """
    Créer une notification manuelle (admin).
    """
    try:
        type_enum = models.TypeNotificationEnum[type_notification.upper()]
    except KeyError:
        raise HTTPException(status_code=400, detail=f"Type de notification invalide: {type_notification}")
    
    success, msg = notif_utils.creer_notification(
        matricule=matricule,
        type_notification=type_enum,
        titre=titre,
        message=message,
        id_operation=id_operation,
        db=db
    )
    
    if not success:
        raise HTTPException(status_code=400, detail=msg)
    
    return {"message": "Notification créée"}
