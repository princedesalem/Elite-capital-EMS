"""
Router pour le système de notifications
"""
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel
import re

from ..db import get_db
from .. import models
from ..utils import notifications as notif_utils


def _enrichir_notif(titre, message, id_operation, db):
    """Résout les matricules bruts et 'son opération' dans les notifications stockées."""
    def _sub(t):
        if not t:
            return t

        def _r(m):
            try:
                e = db.query(models.Employe).filter(
                    models.Employe.matricule == int(m.group(1))
                ).first()
                return f"{e.prenom} {e.nom}" if e else m.group(0)
            except Exception:
                return m.group(0)

        t = re.sub(r"[Ll]'[Ee]mploy[\xe9e]\s+(\d+)", _r, t)
        t = re.sub(r"(?<!['])[Ee]mploy[\xe9e]\s+(\d+)", _r, t)
        return t

    titre = _sub(titre or '')
    message = _sub(message or '')
    if id_operation and ('son op' in message or 'son op' in titre):
        try:
            op = db.query(models.Operation).filter(
                models.Operation.id_operation == id_operation
            ).first()
            if op:
                _tp = (op.type_demande or 'opération').lower()
                _lp = f"la {_tp} \u00ab {op.titre} \u00bb" if op.titre else f"la {_tp}"
                titre = titre.replace('son opération', _lp)
                message = message.replace('son opération', _lp)
        except Exception:
            pass
    return titre, message
from ..utils import security
from ..utils import webpush as webpush_utils

router = APIRouter(prefix='/api/notifications', tags=['notifications'])


class PushKeysPayload(BaseModel):
    p256dh: str
    auth: str


class PushSubscriptionPayload(BaseModel):
    endpoint: str
    keys: PushKeysPayload


class PushSubscribePayload(BaseModel):
    matricule: int
    subscription: PushSubscriptionPayload


class PushUnsubscribePayload(BaseModel):
    matricule: Optional[int] = None
    endpoint: str


def _get_token_context(request: Request):
    auth = request.headers.get('authorization')
    if not auth or not auth.lower().startswith('bearer '):
        raise HTTPException(status_code=401, detail='Token manquant')

    token = auth.split(None, 1)[1]
    try:
        payload = security.jwt.decode(token, security.SECRET_KEY, algorithms=[security.ALGORITHM])
    except Exception:
        raise HTTPException(status_code=401, detail='Token invalide')

    role = str(payload.get('role') or '').strip().upper()
    matricule = payload.get('matricule') or payload.get('sub')
    try:
        matricule = int(matricule)
    except Exception:
        raise HTTPException(status_code=401, detail='Token sans matricule valide')

    return matricule, role


@router.get('/push/vapid-public-key')
def get_vapid_public_key():
    """Expose VAPID public key for browser push subscription."""
    return {
        'configured': webpush_utils.is_webpush_configured(),
        'public_key': webpush_utils.vapid_public_key(),
    }


@router.post('/push/subscribe')
def subscribe_push(
    payload: PushSubscribePayload,
    request: Request,
    db: Session = Depends(get_db)
):
    requester_matricule, requester_role = _get_token_context(request)
    if requester_role not in {'ADMIN', 'RH', 'DG', 'PCA', 'AG'} and requester_matricule != payload.matricule:
        raise HTTPException(status_code=403, detail='Action non autorisée pour ce matricule')

    employe = db.query(models.Employe).filter(models.Employe.matricule == payload.matricule).first()
    if not employe:
        raise HTTPException(status_code=404, detail='Employé introuvable')

    existing = db.query(models.PushSubscription).filter(
        models.PushSubscription.endpoint == payload.subscription.endpoint
    ).first()

    if existing:
        existing.matricule = payload.matricule
        existing.p256dh = payload.subscription.keys.p256dh
        existing.auth = payload.subscription.keys.auth
        existing.user_agent = request.headers.get('user-agent')
        existing.active = True
        existing.updated_at = datetime.utcnow()
    else:
        db.add(models.PushSubscription(
            matricule=payload.matricule,
            endpoint=payload.subscription.endpoint,
            p256dh=payload.subscription.keys.p256dh,
            auth=payload.subscription.keys.auth,
            user_agent=request.headers.get('user-agent'),
            active=True,
        ))

    db.commit()
    return {'message': 'Abonnement push enregistré'}


@router.post('/push/unsubscribe')
def unsubscribe_push(
    payload: PushUnsubscribePayload,
    request: Request,
    db: Session = Depends(get_db)
):
    requester_matricule, requester_role = _get_token_context(request)
    target_matricule = payload.matricule or requester_matricule

    if requester_role not in {'ADMIN', 'RH', 'DG', 'PCA', 'AG'} and requester_matricule != target_matricule:
        raise HTTPException(status_code=403, detail='Action non autorisée pour ce matricule')

    subscription = db.query(models.PushSubscription).filter(
        models.PushSubscription.endpoint == payload.endpoint,
        models.PushSubscription.matricule == target_matricule,
    ).first()

    if not subscription:
        return {'message': 'Abonnement déjà supprimé'}

    db.delete(subscription)
    db.commit()
    return {'message': 'Abonnement push supprimé'}


@router.post('/push/test/{matricule}')
def push_test_notification(
    matricule: int,
    request: Request,
    db: Session = Depends(get_db)
):
    requester_matricule, requester_role = _get_token_context(request)
    if requester_role not in {'ADMIN', 'RH', 'DG', 'PCA', 'AG'} and requester_matricule != matricule:
        raise HTTPException(status_code=403, detail='Action non autorisée pour ce matricule')

    success, msg = notif_utils.creer_notification(
        matricule=matricule,
        type_notification=models.TypeNotificationEnum.AUTRE,
        titre='Test notification push',
        message='Votre navigateur est bien abonné aux notifications push EMS.',
        db=db,
    )
    if not success:
        raise HTTPException(status_code=400, detail=msg)

    return {'message': 'Notification push de test créée'}


@router.get('/non-lues/{matricule}')
def obtenir_notifications_non_lues(matricule: int, db: Session = Depends(get_db)):
    """
    Obtenir toutes les notifications non lues d'un employé.
    """
    notifications = db.query(models.Notification).filter(
        models.Notification.matricule == matricule,
        models.Notification.lue == False  # noqa: E712
    ).order_by(models.Notification.date_creation.desc()).all()

    result = []
    for n in notifications:
        t, m = _enrichir_notif(n.titre, n.message, n.id_operation, db)
        op = (
            db.query(models.Operation)
            .filter(models.Operation.id_operation == n.id_operation)
            .first()
        ) if n.id_operation else None
        result.append({
            "id_notification": n.id_notification,
            "type_notification": n.type_notification,
            "titre": t,
            "message": m,
            "lue": n.lue,
            "date_creation": n.date_creation,
            "id_operation": n.id_operation,
            "type_demande": op.type_demande if op else None,
            "workflow_bucket": 'envoye' if (op and op.matricule == n.matricule) else 'recu',
        })
    return result


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
    
    result = []
    for n in notifications:
        t, m = _enrichir_notif(n.titre, n.message, n.id_operation, db)
        op = (
            db.query(models.Operation)
            .filter(models.Operation.id_operation == n.id_operation)
            .first()
        ) if n.id_operation else None
        result.append({
            "id_notification": n.id_notification,
            "type_notification": n.type_notification,
            "titre": t,
            "message": m,
            "lue": n.lue,
            "date_creation": n.date_creation,
            "date_lecture": n.date_lecture,
            "id_operation": n.id_operation,
            "type_demande": op.type_demande if op else None,
            "workflow_bucket": 'envoye' if (op and op.matricule == n.matricule) else 'recu',
        })
    return result


@router.put('/{id_notification}/marquer-lue')
def marquer_comme_lue(id_notification: int, db: Session = Depends(get_db)):
    """
    Marquer une notification comme lue.
    """
    success = notif_utils.marquer_notification_comme_lue(id_notification, db)

    if not success:
        raise HTTPException(status_code=404, detail="Notification introuvable")

    return {"message": "Notification marquée comme lue"}


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
