"""D\u00e9tection des retards \u00e0 partir des pointages biom\u00e9triques.

Module utilitaire associ\u00e9 \u00e0 la table `POINTAGE`. Aujourd'hui :
- seuil par d\u00e9faut : 8h00 (heure th\u00e9orique d'arriv\u00e9e),
- tol\u00e9rance : 15 minutes.

Une notification `RETARD_POINTAGE` est cr\u00e9\u00e9e si l'\u00e9cart d\u00e9passe la tol\u00e9rance.
Le c\u00e2blage \u00e0 un device r\u00e9el (ZKTeco/Suprema/...) reste \u00e0 faire ; ce module
fournit le contrat applicatif stable.
"""
from datetime import time, datetime
from typing import Optional, Tuple
from sqlalchemy.orm import Session

from ..models import Pointage, Notification, TypeNotificationEnum


HEURE_THEORIQUE_DEFAUT = time(8, 0)
TOLERANCE_MINUTES = 15


def calculer_retard_minutes(
    heure_arrivee: time,
    heure_theorique: time = HEURE_THEORIQUE_DEFAUT,
) -> int:
    """Retourne le retard en minutes (>=0). 0 si arriv\u00e9e \u00e0 l'heure ou en avance."""
    if heure_arrivee is None:
        return 0
    delta = (
        heure_arrivee.hour * 60 + heure_arrivee.minute
        - heure_theorique.hour * 60 - heure_theorique.minute
    )
    return max(0, delta)


def detecter_retard(
    pointage: Pointage,
    db: Session,
    heure_theorique: time = HEURE_THEORIQUE_DEFAUT,
    tolerance_minutes: int = TOLERANCE_MINUTES,
) -> Tuple[int, bool]:
    """Calcule le retard, met \u00e0 jour le pointage et notifie si retard significatif.

    Retourne (retard_minutes, notif_envoyee).
    """
    retard = calculer_retard_minutes(pointage.heure_arrivee, heure_theorique)
    pointage.retard_minutes = retard
    notif_envoyee = False
    if retard > tolerance_minutes:
        db.add(Notification(
            matricule=pointage.matricule,
            type_notification=TypeNotificationEnum.RETARD_POINTAGE,
            titre=f"Retard de pointage : {retard} min",
            message=(
                f"Votre arriv\u00e9e \u00e0 {pointage.heure_arrivee.strftime('%H:%M')} "
                f"est en retard de {retard} minutes (heure th\u00e9orique : "
                f"{heure_theorique.strftime('%H:%M')})."
            ),
            id_operation=None,
        ))
        notif_envoyee = True
    db.commit()
    return retard, notif_envoyee
