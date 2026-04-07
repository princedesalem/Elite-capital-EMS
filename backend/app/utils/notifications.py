"""
Système de notifications et d'alertes
"""
from datetime import datetime, date, timedelta
from typing import List, Dict, Optional
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, event, select, delete
from ..models import (
    Employe, Operation, Notification, TypeNotificationEnum, Validation,
    AlerteCongesAnnuelle, Activation, TypeActionEnum, StatutFinalEnum,
    PushSubscription
)
from decimal import Decimal
from . import webpush


def envoyer_alerte_conges_fin_annee(db: Session):
    """
    Envoie des alertes hebdomadaires pendant les 3 derniers mois de l'année
    pour rappeler aux employés de prendre leurs congés.
    
    À exécuter chaque semaine (cron job).
    
    Args:
        db: Session de base de données
    """
    today = date.today()
    
    # Vérifier si on est dans les 3 derniers mois (octobre, novembre, décembre)
    if today.month < 10:
        return
    
    # Trouver tous les employés avec un solde de congés > 0
    employes = db.query(Employe).filter(
        Employe.solde_conges > 0,
        Employe.statut_employe == 'ACTIF'
    ).all()
    
    for employe in employes:
        # Vérifier s'il existe déjà une alerte pour cette année
        alerte_existante = db.query(AlerteCongesAnnuelle).filter(
            and_(
                AlerteCongesAnnuelle.matricule == employe.matricule,
                AlerteCongesAnnuelle.annee == today.year
            )
        ).first()
        
        if alerte_existante:
            # Mettre à jour le compteur d'alertes
            alerte_existante.alertes_envoyees += 1
            alerte_existante.date_alerte = datetime.now()
        else:
            # Créer une nouvelle alerte
            alerte_existante = AlerteCongesAnnuelle(
                matricule=employe.matricule,
                annee=today.year,
                solde_restant=employe.solde_conges,
                alertes_envoyees=1
            )
            db.add(alerte_existante)
        
        # Créer une notification
        jours_restants = (date(today.year, 12, 31) - today).days
        
        notification = Notification(
            matricule=employe.matricule,
            type_notification=TypeNotificationEnum.ALERTE_CONGES,
            titre=f"Rappel: {employe.solde_conges} jour(s) de congés restant(s)",
            message=f"Il vous reste {employe.solde_conges} jour(s) de congés à prendre avant la fin de l'année. "
                   f"Vous avez {jours_restants} jours pour en bénéficier."
        )
        db.add(notification)
        
        # Envoyer également au RH
        from .activation_cloture import creer_notification_rh
        creer_notification_rh(
            None,
            f"Congés restants: {employe.prenom} {employe.nom}",
            f"{employe.prenom} {employe.nom} a encore {employe.solde_conges} jour(s) de congés restants",
            db
        )
    
    db.commit()


def envoyer_rappel_depart_conges(db: Session):
    """
    Envoie des rappels au RH pour les départs en congés prévus.
    À exécuter quotidiennement (cron job).
    
    Args:
        db: Session de base de données
    """
    today = date.today()
    demain = today + timedelta(days=1)
    
    # Trouver les opérations qui commencent demain et sont validées
    operations = db.query(Operation).join(
        Activation,
        Activation.id_operation == Operation.id_operation
    ).filter(
        and_(
            Operation.date_depart == demain,
            Activation.type_action == TypeActionEnum.ACTIVATION,
            Activation.statut_final == StatutFinalEnum.COMPLETE
        )
    ).all()
    
    for operation in operations:
        employe = db.query(Employe).filter(Employe.matricule == operation.matricule).first()
        
        if employe:
            # Notifier le RH
            from .activation_cloture import creer_notification_rh
            creer_notification_rh(
                operation.id_operation,
                f"Rappel départ: {employe.prenom} {employe.nom}",
                f"{employe.prenom} {employe.nom} part en opération demain ({demain})",
                db
            )
    
    db.commit()


def envoyer_rappel_retour_conges(db: Session):
    """
    Envoie des rappels au RH pour les retours de congés prévus.
    À exécuter quotidiennement (cron job).
    
    Args:
        db: Session de base de données
    """
    today = date.today()
    demain = today + timedelta(days=1)
    
    # Trouver les opérations qui se terminent demain
    operations = db.query(Operation).join(
        Activation,
        Activation.id_operation == Operation.id_operation
    ).filter(
        and_(
            Operation.date_retour == demain,
            Activation.type_action == TypeActionEnum.ACTIVATION,
            Activation.statut_final == StatutFinalEnum.COMPLETE,
            ~db.query(Activation).filter(
                and_(
                    Activation.id_operation == Operation.id_operation,
                    Activation.type_action == TypeActionEnum.CLOTURE,
                    Activation.statut_final == StatutFinalEnum.COMPLETE
                )
            ).exists()
        )
    ).all()
    
    for operation in operations:
        employe = db.query(Employe).filter(Employe.matricule == operation.matricule).first()
        
        if employe:
            # Notifier le RH
            from .activation_cloture import creer_notification_rh
            creer_notification_rh(
                operation.id_operation,
                f"Rappel retour: {employe.prenom} {employe.nom}",
                f"{employe.prenom} {employe.nom} revient demain ({demain}) de son opération",
                db
            )
            
            # Notifier l'employé
            notification = Notification(
                matricule=employe.matricule,
                type_notification=TypeNotificationEnum.RAPPEL_RETOUR,
                titre="Rappel de retour",
                message=f"Votre opération se termine demain ({demain}). "
                       f"N'oubliez pas de la clôturer dans les 48h.",
                id_operation=operation.id_operation
            )
            db.add(notification)
    
    db.commit()


def notifier_validation_operation(
    id_operation: int,
    statut: str,
    validateur_role: str,
    commentaire: Optional[str],
    db: Session
):
    """
    Notifie le demandeur et le RH du statut de validation d'une opération.
    
    Args:
        id_operation: ID de l'opération
        statut: 'validé' ou 'refusé'
        validateur_role: Rôle du validateur
        commentaire: Commentaire du validateur
        db: Session de base de données
    """
    operation = db.query(Operation).filter(Operation.id_operation == id_operation).first()
    
    if not operation:
        return
    
    type_notif = TypeNotificationEnum.VALIDATION if statut == 'validé' else TypeNotificationEnum.REFUS
    
    # Notifier le demandeur
    message = f"Votre opération a été {statut} par le {validateur_role}."
    if commentaire:
        message += f"\nCommentaire: {commentaire}"
    
    notification = Notification(
        matricule=operation.matricule,
        type_notification=type_notif,
        titre=f"Opération {statut}",
        message=message,
        id_operation=id_operation
    )
    db.add(notification)
    
    # Notifier le RH
    from .activation_cloture import creer_notification_rh
    _emp = db.query(Employe).filter(Employe.matricule == operation.matricule).first()
    _nom_employe = f"{_emp.prenom} {_emp.nom}" if _emp else f"Employé #{operation.matricule}"
    creer_notification_rh(
        id_operation,
        f"Opération {statut}",
        f"L'opération de {_nom_employe} a été {statut} par le {validateur_role}",
        db
    )

    db.commit()
    
    # TODO: Envoyer emails


def obtenir_notifications_non_lues(matricule: int, db: Session) -> List[Dict]:
    """
    Récupère toutes les notifications non lues d'un employé.
    
    Args:
        matricule: Matricule de l'employé
        db: Session de base de données
    
    Returns:
        Liste des notifications non lues
    """
    notifications = db.query(Notification).filter(
        and_(
            Notification.matricule == matricule,
            Notification.lue == False
        )
    ).order_by(Notification.date_creation.desc()).all()
    
    return [
        {
            'id_notification': n.id_notification,
            'type': n.type_notification.value if n.type_notification else None,
            'titre': n.titre,
            'message': n.message,
            'date_creation': n.date_creation.isoformat() if n.date_creation else None,
            'id_operation': n.id_operation
        }
        for n in notifications
    ]


def marquer_notification_comme_lue(id_notification: int, db: Session) -> bool:
    """
    Marque une notification comme lue.
    
    Args:
        id_notification: ID de la notification
        db: Session de base de données
    
    Returns:
        True si succès, False sinon
    """
    notification = db.query(Notification).filter(
        Notification.id_notification == id_notification
    ).first()
    
    if notification:
        notification.lue = True
        notification.date_lecture = datetime.now()
        db.commit()
        return True
    
    return False


def compter_notifications_non_lues(matricule: int, db: Session) -> int:
    """
    Compte le nombre de notifications non lues d'un employé.
    
    Args:
        matricule: Matricule de l'employé
        db: Session de base de données
    
    Returns:
        Nombre de notifications non lues
    """
    return db.query(Notification).filter(
        and_(
            Notification.matricule == matricule,
            Notification.lue == False
        )
    ).count()


def envoyer_notification_evaluation(matricule: int, message: str, db: Session):
    """
    Envoie une notification concernant une évaluation.
    
    Args:
        matricule: Matricule de l'employé
        message: Message de la notification
        db: Session de base de données
    """
    notification = Notification(
        matricule=matricule,
        type_notification=TypeNotificationEnum.EVALUATION,
        titre="Évaluation",
        message=message
    )
    db.add(notification)
    db.commit()


def creer_notification_personnalisee(
    matricule: int,
    titre: str,
    message: str,
    type_notification: TypeNotificationEnum,
    id_operation: Optional[int],
    db: Session
):
    """
    Crée une notification personnalisée.
    
    Args:
        matricule: Matricule du destinataire
        titre: Titre de la notification
        message: Message de la notification
        type_notification: Type de notification
        id_operation: ID de l'opération concernée (optionnel)
        db: Session de base de données
    """
    notification = Notification(
        matricule=matricule,
        type_notification=type_notification,
        titre=titre,
        message=message,
        id_operation=id_operation
    )
    db.add(notification)
    db.commit()


def nettoyer_anciennes_notifications(jours: int, db: Session):
    """
    Supprime les notifications lues de plus de X jours.
    À exécuter périodiquement (cron job).
    
    Args:
        jours: Nombre de jours de rétention
        db: Session de base de données
    """
    date_limite = datetime.now() - timedelta(days=jours)
    
    db.query(Notification).filter(
        and_(
            Notification.lue == True,
            Notification.date_lecture < date_limite
        )
    ).delete()
    
    db.commit()


def envoyer_resume_notifications_hebdomadaire(matricule: int, db: Session):
    """
    Envoie un résumé hebdomadaire des notifications importantes.
    
    Args:
        matricule: Matricule de l'employé
        db: Session de base de données
    """
    date_semaine = datetime.now() - timedelta(days=7)
    
    notifications_semaine = db.query(Notification).filter(
        and_(
            Notification.matricule == matricule,
            Notification.date_creation >= date_semaine
        )
    ).all()
    
    if notifications_semaine:
        resume = f"Résumé de la semaine: {len(notifications_semaine)} notification(s)\n\n"
        
        for notif in notifications_semaine:
            resume += f"- [{notif.type_notification.value}] {notif.titre}\n"
        
        notification = Notification(
            matricule=matricule,
            type_notification=TypeNotificationEnum.AUTRE,
            titre="Résumé hebdomadaire",
            message=resume
        )
        db.add(notification)
        db.commit()
        
        # TODO: Envoyer email


def creer_notification(
    matricule: int,
    type_notification: TypeNotificationEnum,
    titre: str,
    message: str,
    id_operation: Optional[int] = None,
    db: Session = None
) -> tuple[bool, str]:
    """
    Fonction utilitaire simple pour créer une notification.
    
    Args:
        matricule: Matricule du destinataire
        type_notification: Type de notification (enum ou string)
        titre: Titre de la notification
        message: Message de la notification
        id_operation: ID de l'opération concernée (optionnel)
        db: Session de base de données
    
    Returns:
        Tuple (succès, message)
    """
    try:
        # Convertir string en enum si nécessaire
        if isinstance(type_notification, str):
            type_notification = TypeNotificationEnum[type_notification.upper()]
        
        notification = Notification(
            matricule=matricule,
            type_notification=type_notification,
            titre=titre,
            message=message,
            id_operation=id_operation
        )
        db.add(notification)
        db.commit()
        
        return True, "Notification créée avec succès"
    except Exception as e:
        db.rollback()
        return False, f"Erreur lors de la création de la notification: {str(e)}"


def ajouter_notifications_annulation_operation(
    operation: Operation,
    actor_matricule: Optional[int],
    db: Session
) -> None:
    if not operation:
        return

    recipients = {operation.matricule}
    validations = db.query(Validation).filter(
        Validation.id_operation == operation.id_operation
    ).all()
    for validation in validations:
        if validation.matricule_validateur:
            recipients.add(validation.matricule_validateur)

    actor = None
    if actor_matricule:
        actor = db.query(Employe).filter(Employe.matricule == actor_matricule).first()

    actor_label = f"{actor.prenom} {actor.nom}" if actor else f"l'utilisateur {actor_matricule}" if actor_matricule else 'un utilisateur autorisé'
    type_demande = operation.type_demande or 'demande'
    titre = f"{type_demande} annulée"
    message = (
        f"La demande #{operation.id_operation} ({type_demande}) a été annulée par {actor_label}."
    )

    for matricule in recipients:
        db.add(Notification(
            matricule=matricule,
            type_notification=TypeNotificationEnum.AUTRE,
            titre=titre,
            message=message,
            id_operation=None
        ))


@event.listens_for(Notification, 'after_insert')
def _dispatch_webpush_after_notification_insert(mapper, connection, target):
    """Send web push for each inserted notification when VAPID is configured."""
    if not webpush.is_webpush_configured():
        return

    try:
        stmt = select(
            PushSubscription.id_push_subscription,
            PushSubscription.endpoint,
            PushSubscription.p256dh,
            PushSubscription.auth,
        ).where(
            PushSubscription.matricule == target.matricule,
            PushSubscription.active == True  # noqa: E712
        )
        subscriptions = connection.execute(stmt).mappings().all()
        if not subscriptions:
            return

        stale_ids = []
        for sub in subscriptions:
            subscription_info = {
                'endpoint': sub['endpoint'],
                'keys': {
                    'p256dh': sub['p256dh'],
                    'auth': sub['auth'],
                },
            }
            sent, reason = webpush.send_webpush(
                subscription_info=subscription_info,
                title=target.titre or 'Nouvelle notification EMS',
                body=target.message or '',
                data={
                    'id_notification': target.id_notification,
                    'id_operation': target.id_operation,
                    'url': '/rh/notifications',
                },
            )
            if not sent and reason == 'gone':
                stale_ids.append(sub['id_push_subscription'])

        if stale_ids:
            connection.execute(
                delete(PushSubscription).where(
                    PushSubscription.id_push_subscription.in_(stale_ids)
                )
            )
    except Exception:
        # Push failures must never block business transactions.
        return
