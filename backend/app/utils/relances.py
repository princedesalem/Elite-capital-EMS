"""Relances automatiques toutes les 15 minutes en heures ouvr\u00e9es.

Deux cas d'usage :

1. **Validateurs en attente** (`relancer_validateurs_en_attente`) :
   pour chaque op\u00e9ration `en attente`, identifie le validateur courant via
   `workflow.obtenir_prochain_validateur` et cr\u00e9e une notification
   `RELANCE_VALIDATION` si la derni\u00e8re notif `VALIDATION` non lue date de
   plus de 15 min. Si le prochain r\u00f4le est DG, tous les DG en attente sont
   relanc\u00e9s.

2. **Notifs non lues** (`relancer_notifs_non_lues`) :
   pour chaque `Notification` `lue=False` cr\u00e9\u00e9e il y a plus de 15 minutes et
   dont le dernier rappel hors-app date de plus de 15 minutes (ou n'a jamais
   eu lieu), r\u00e9-\u00e9met email + web push **sans cr\u00e9er de doublon en base**.

Le job ne s'ex\u00e9cute qu'en heures ouvr\u00e9es (L-V, 8h-18h, heure serveur).
"""
from datetime import datetime, timedelta
from typing import Set, Tuple
from sqlalchemy.orm import Session

from ..models import (
    Notification,
    Operation,
    Employe,
    PushSubscription,
    TypeNotificationEnum,
)
from . import webpush
from . import email as email_utils
from . import workflow


# Seuil : ne relancer que si la derni\u00e8re notif/dernier rappel a > 15 minutes.
SEUIL_RELANCE_MINUTES = 15


def en_heures_ouvrees(now: datetime | None = None) -> bool:
    """Retourne True si `now` (ou maintenant) tombe en heures ouvr\u00e9es.

    Plage : lundi-vendredi, 08:00 \u2264 heure < 18:00, heure du serveur.
    """
    now = now or datetime.now()
    return now.weekday() < 5 and 8 <= now.hour < 18


def _envoyer_canaux_externes(notification: Notification, db: Session) -> None:
    """R\u00e9-\u00e9met email + web push pour une notification donn\u00e9e.

    Ne cr\u00e9e aucune ligne suppl\u00e9mentaire dans `Notification` : ce sont juste
    les canaux hors-app qui sont resoll\u00e9cit\u00e9s. Les \u00e9checs sont silencieux.
    """
    employe = db.query(Employe).filter(Employe.matricule == notification.matricule).first()

    # Email
    try:
        if (
            getattr(email_utils, 'SMTP_ENABLED', False)
            and employe is not None
            and employe.email
            and getattr(employe, 'notif_email_enabled', True)
        ):
            email_utils.send_email(
                to=employe.email,
                subject=f"[EMS] Rappel : {notification.titre or 'Notification'}",
                body=(notification.message or '').strip(),
            )
    except Exception:
        pass

    # Web push
    try:
        if webpush.is_webpush_configured():
            subs = db.query(PushSubscription).filter(
                PushSubscription.matricule == notification.matricule,
                PushSubscription.active == True,  # noqa: E712
            ).all()
            for sub in subs:
                webpush.send_webpush(
                    subscription_info={
                        'endpoint': sub.endpoint,
                        'keys': {'p256dh': sub.p256dh, 'auth': sub.auth},
                    },
                    title=f"Rappel : {notification.titre or 'Notification EMS'}",
                    body=(notification.message or '').strip(),
                    data={
                        'id_notification': notification.id_notification,
                        'id_operation': notification.id_operation,
                        'url': '/rh/notifications',
                    },
                )
    except Exception:
        pass


def relancer_notifs_non_lues(db: Session, now: datetime | None = None) -> int:
    """R\u00e9-\u00e9met email + push pour chaque notification non lue de plus de 15 min.

    Ne cr\u00e9e jamais de nouvelle notification en base ; met simplement \u00e0 jour
    `dernier_rappel_at`. Retourne le nombre de notifications relanc\u00e9es.
    """
    now = now or datetime.now()
    seuil = now - timedelta(minutes=SEUIL_RELANCE_MINUTES)

    notifs = db.query(Notification).filter(
        Notification.lue == False,  # noqa: E712
        Notification.date_creation < seuil,
    ).all()

    relancees = 0
    for notif in notifs:
        # Anti-spam : ne pas re-relancer la m\u00eame notification \u00e0 < 15 min d'\u00e9cart.
        if notif.dernier_rappel_at and notif.dernier_rappel_at > seuil:
            continue
        _envoyer_canaux_externes(notif, db)
        notif.dernier_rappel_at = now
        relancees += 1
    if relancees:
        db.commit()
    return relancees


def relancer_validateurs_en_attente(db: Session, now: datetime | None = None) -> int:
    """Relance le validateur courant pour chaque op\u00e9ration en attente.

    Cr\u00e9e une notification `RELANCE_VALIDATION` (si la derni\u00e8re notif
    VALIDATION/RELANCE_VALIDATION pour ce destinataire et cette op\u00e9ration date
    de plus de 15 minutes). Cette notification d\u00e9clenche elle-m\u00eame email +
    push via les events `after_insert` existants.
    """
    now = now or datetime.now()
    seuil = now - timedelta(minutes=SEUIL_RELANCE_MINUTES)

    operations = db.query(Operation).filter(
        Operation.statut == 'en attente'
    ).all()

    relancees = 0
    for op in operations:
        role, matricule = workflow.obtenir_prochain_validateur(op.id_operation, db)
        if not role:
            continue

        # D\u00e9terminer la liste des matricules \u00e0 relancer (plusieurs DG possibles).
        if (role or '').upper() == 'DG':
            from .workflow import obtenir_tous_matricules_dg
            tous_dg = obtenir_tous_matricules_dg(db)
            # Exclure ceux qui ont d\u00e9j\u00e0 valid\u00e9 cette \u00e9tape.
            from ..models import Validation
            deja = {
                v.matricule_validateur
                for v in db.query(Validation).filter(
                    Validation.id_operation == op.id_operation,
                    Validation.statut_validation == 'valid\u00e9',
                    Validation.role_validateur == 'DG',
                ).all()
            }
            cibles = [m for m in tous_dg if m not in deja]
        else:
            cibles = [matricule] if matricule else []

        for cible in cibles:
            # Y a-t-il d\u00e9j\u00e0 une notif r\u00e9cente (< 15 min) pour ce destinataire et cette op\u00e9ration ?
            recente = db.query(Notification).filter(
                Notification.matricule == cible,
                Notification.id_operation == op.id_operation,
                Notification.type_notification.in_([
                    TypeNotificationEnum.VALIDATION,
                    TypeNotificationEnum.RELANCE_VALIDATION,
                ]),
                Notification.date_creation > seuil,
            ).first()
            if recente:
                continue

            titre = f"Rappel : validation en attente"
            type_demande = (op.type_demande or 'demande').lower()
            message = (
                f"Une {type_demande} attend votre validation depuis "
                f"plus de {SEUIL_RELANCE_MINUTES} minutes (op\u00e9ration #{op.id_operation})."
            )
            db.add(Notification(
                matricule=cible,
                type_notification=TypeNotificationEnum.RELANCE_VALIDATION,
                titre=titre,
                message=message,
                id_operation=op.id_operation,
            ))
            relancees += 1

    if relancees:
        db.commit()
    return relancees


def executer_relances(db: Session, now: datetime | None = None) -> Tuple[int, int]:
    """Point d'entr\u00e9e du job 15 min : ex\u00e9cute les deux passes en heures ouvr\u00e9es.

    Retourne (nb_relances_validateurs, nb_relances_notifs_non_lues).
    En dehors des heures ouvr\u00e9es : retourne (0, 0) sans toucher la base.
    """
    if not en_heures_ouvrees(now):
        return 0, 0
    nb_validateurs = relancer_validateurs_en_attente(db, now=now)
    nb_unread = relancer_notifs_non_lues(db, now=now)
    return nb_validateurs, nb_unread
