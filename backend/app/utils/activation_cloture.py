"""
Système d'activation et de clôture des opérations
Validation double: Demandeur + RH
"""
from datetime import datetime, date, timedelta
from typing import Tuple, Dict, Optional
from sqlalchemy.orm import Session
from ..models import (
    Operation, Activation, Employe, Mission, PermConventionelle,
    Notification, TypeNotificationEnum, TypeActionEnum, StatutFinalEnum
)


DELAI_CLOTURE = 2  # 48 heures après date de retour
DELAI_RAPPORT_MISSION = 2  # 48 heures pour rapport de mission


def activer_operation_demandeur(
    id_operation: int,
    matricule_demandeur: int,
    db: Session
) -> Tuple[bool, str]:
    """
    Le demandeur active son opération manuellement.
    L'activation n'est complète que lorsque le RH la valide aussi.
    
    Args:
        id_operation: ID de l'opération
        matricule_demandeur: Matricule du demandeur
        db: Session de base de données
    
    Returns:
        Tuple (succès, message)
    """
    operation = db.query(Operation).filter(Operation.id_operation == id_operation).first()
    
    if not operation:
        return False, "Opération introuvable"
    
    if operation.matricule != matricule_demandeur:
        return False, "Vous n'êtes pas autorisé à activer cette opération"
    
    # Vérifier si activation existe déjà
    activation = db.query(Activation).filter(
        Activation.id_operation == id_operation,
        Activation.type_action == TypeActionEnum.ACTIVATION
    ).first()
    
    if not activation:
        # Créer nouvelle activation
        activation = Activation(
            id_operation=id_operation,
            type_action=TypeActionEnum.ACTIVATION,
            demandeur_fait=True,
            date_demandeur=datetime.now(),
            rh_fait=False,
            statut_final=StatutFinalEnum.EN_ATTENTE
        )
        db.add(activation)
    else:
        if activation.demandeur_fait:
            return False, "Vous avez déjà activé cette opération. En attente de confirmation RH."
        
        activation.demandeur_fait = True
        activation.date_demandeur = datetime.now()
    
    db.commit()
    
    # Créer notification pour RH
    creer_notification_rh(
        id_operation,
        "Activation en attente",
        f"L'employé {operation.matricule} a activé son opération. Confirmation RH requise.",
        db
    )
    
    return True, "Activation enregistrée. En attente de confirmation du RH."


def activer_operation_rh(
    id_operation: int,
    matricule_rh: int,
    db: Session
) -> Tuple[bool, str]:
    """
    Le RH valide l'activation d'une opération.
    L'opération est réellement activée quand demandeur ET RH ont validé.
    
    Args:
        id_operation: ID de l'opération
        matricule_rh: Matricule du RH
        db: Session de base de données
    
    Returns:
        Tuple (succès, message)
    """
    # Vérifier que c'est bien un RH
    if not verifier_role_rh(matricule_rh, db):
        return False, "Seul le RH peut effectuer cette action"
    
    activation = db.query(Activation).filter(
        Activation.id_operation == id_operation,
        Activation.type_action == TypeActionEnum.ACTIVATION
    ).first()
    
    if not activation:
        return False, "Le demandeur n'a pas encore activé cette opération"
    
    if not activation.demandeur_fait:
        return False, "Le demandeur doit d'abord activer l'opération"
    
    if activation.rh_fait:
        return False, "Opération déjà activée par le RH"
    
    # Valider l'activation
    activation.rh_fait = True
    activation.date_rh = datetime.now()
    activation.statut_final = StatutFinalEnum.COMPLETE
    
    db.commit()
    
    # Déduire du solde si nécessaire (pour permissions non conventionnelles et congés)
    from .permissions import obtenir_type_permission
    from .business_logic import deduire_solde_conges
    
    operation = db.query(Operation).filter(Operation.id_operation == id_operation).first()
    type_info = obtenir_type_permission(id_operation, db)
    
    # Déduire du solde uniquement pour les permissions non conventionnelles et les congés
    if type_info['est_conventionnelle'] == False or type_info['type'] == 'conge':
        employe = db.query(Employe).filter(Employe.matricule == operation.matricule).first()
        if employe:
            deduire_solde_conges(employe, operation.duree, db)
    
    # Notifier le demandeur
    notification = Notification(
        matricule=operation.matricule,
        type_notification=TypeNotificationEnum.VALIDATION,
        titre="Opération activée",
        message="Votre opération a été activée par le RH. Bon séjour!",
        id_operation=id_operation
    )
    db.add(notification)
    db.commit()
    
    return True, "Opération activée avec succès"


def est_operation_active(id_operation: int, db: Session) -> bool:
    """
    Vérifie si une opération est actuellement active.
    
    Une opération est considérée comme active si:
    - Elle a une activation avec statut_final = COMPLETE
    - Le demandeur et le RH ont tous deux validé l'activation
    
    Args:
        id_operation: ID de l'opération
        db: Session de base de données
    
    Returns:
        True si l'opération est active, False sinon
    """
    activation = db.query(Activation).filter(
        Activation.id_operation == id_operation,
        Activation.type_action == TypeActionEnum.ACTIVATION,
        Activation.statut_final == StatutFinalEnum.COMPLETE
    ).first()
    
    if activation and activation.demandeur_fait and activation.rh_fait:
        return True
    
    return False


def cloturer_operation_demandeur(
    id_operation: int,
    matricule_demandeur: int,
    db: Session,
    retour_anticipe: bool = False,
    date_retour_anticipe: Optional[date] = None
) -> Tuple[bool, str]:
    """
    Le demandeur clôture son opération manuellement.
    La clôture n'est complète que lorsque le RH la valide aussi.
    
    Args:
        id_operation: ID de l'opération
        matricule_demandeur: Matricule du demandeur
        db: Session de base de données
        retour_anticipe: Si True, l'employé revient avant la date prévue
        date_retour_anticipe: Date effective du retour anticipé
    
    Returns:
        Tuple (succès, message)
    """
    operation = db.query(Operation).filter(Operation.id_operation == id_operation).first()
    
    if not operation:
        return False, "Opération introuvable"
    
    if operation.matricule != matricule_demandeur:
        return False, "Vous n'êtes pas autorisé à clôturer cette opération"
    
    # Vérifier que l'opération est activée
    activation_activee = db.query(Activation).filter(
        Activation.id_operation == id_operation,
        Activation.type_action == TypeActionEnum.ACTIVATION,
        Activation.statut_final == StatutFinalEnum.COMPLETE
    ).first()
    
    if not activation_activee:
        return False, "L'opération n'a pas été activée"
    
    # Vérifier les prérequis selon le type d'opération
    from .permissions import verifier_delai_preuves_permission
    from .missions import verifier_rapport_mission
    
    # Si c'est une permission conventionnelle, vérifier les preuves
    type_info = obtenir_type_permission(id_operation, db)
    if type_info.get('est_conventionnelle'):
        preuves_ok, message, _ = verifier_delai_preuves_permission(id_operation, db)
        if not preuves_ok:
            return False, f"Impossible de clôturer: {message}"
    
    # Si c'est une mission, vérifier le rapport
    mission = db.query(Mission).filter(Mission.id_mission == id_operation).first()
    if mission:
        rapport_ok, message = verifier_rapport_mission(id_operation, db)
        if not rapport_ok:
            return False, f"Impossible de clôturer: {message}"
        
        # Vérifier que les frais ont été payés (validation à 2 niveaux)
        if not mission.frais_payes:
            if not mission.frais_valides_missionnaire:
                return False, "Impossible de clôturer: Vous devez d'abord valider les frais de mission"
            elif not mission.frais_valides_rh:
                return False, "Impossible de clôturer: En attente de la validation RH du paiement des frais"
            else:
                return False, "Impossible de clôturer: Les frais de mission n'ont pas encore été payés"
    
    # Gérer le retour anticipé
    if retour_anticipe:
        if not date_retour_anticipe or date_retour_anticipe >= operation.date_retour:
            return False, "La date de retour anticipé doit être antérieure à la date de retour prévue"
        
        operation.retour_anticipe = True
        operation.date_retour_anticipe = date_retour_anticipe
        
        # Calculer les jours à rendre
        from .business_logic import calculer_jours_ouvrables, rajouter_solde_conges
        jours_non_utilises = calculer_jours_ouvrables(date_retour_anticipe, operation.date_retour)
        
        # Rendre les jours au solde (sauf pour permissions conventionnelles)
        if not type_info.get('est_conventionnelle'):
            employe = db.query(Employe).filter(Employe.matricule == operation.matricule).first()
            rajouter_solde_conges(employe, jours_non_utilises, db)
    
    # Vérifier si clôture existe déjà
    cloture = db.query(Activation).filter(
        Activation.id_operation == id_operation,
        Activation.type_action == TypeActionEnum.CLOTURE
    ).first()
    
    if not cloture:
        cloture = Activation(
            id_operation=id_operation,
            type_action=TypeActionEnum.CLOTURE,
            demandeur_fait=True,
            date_demandeur=datetime.now(),
            rh_fait=False,
            statut_final=StatutFinalEnum.EN_ATTENTE
        )
        db.add(cloture)
    else:
        if cloture.demandeur_fait:
            return False, "Vous avez déjà demandé la clôture. En attente de confirmation RH."
        
        cloture.demandeur_fait = True
        cloture.date_demandeur = datetime.now()
    
    db.commit()
    
    # Notifier le RH
    creer_notification_rh(
        id_operation,
        "Clôture en attente",
        f"L'employé {operation.matricule} a clôturé son opération. Confirmation RH requise.",
        db
    )
    
    return True, "Clôture enregistrée. En attente de confirmation du RH."


def cloturer_operation_rh(
    id_operation: int,
    matricule_rh: int,
    db: Session
) -> Tuple[bool, str]:
    """
    Le RH valide la clôture d'une opération.
    
    Args:
        id_operation: ID de l'opération
        matricule_rh: Matricule du RH
        db: Session de base de données
    
    Returns:
        Tuple (succès, message)
    """
    if not verifier_role_rh(matricule_rh, db):
        return False, "Seul le RH peut effectuer cette action"
    
    cloture = db.query(Activation).filter(
        Activation.id_operation == id_operation,
        Activation.type_action == TypeActionEnum.CLOTURE
    ).first()
    
    if not cloture:
        return False, "Le demandeur n'a pas encore clôturé cette opération"
    
    if not cloture.demandeur_fait:
        return False, "Le demandeur doit d'abord clôturer l'opération"
    
    if cloture.rh_fait:
        return False, "Opération déjà clôturée par le RH"
    
    # Pour les missions, vérifier que les frais ont été payés
    mission = db.query(Mission).filter(Mission.id_mission == id_operation).first()
    if mission and not mission.frais_payes:
        return False, "Impossible de clôturer: Les frais de mission doivent être payés avant la clôture"
    
    cloture.rh_fait = True
    cloture.date_rh = datetime.now()
    cloture.statut_final = StatutFinalEnum.COMPLETE
    
    db.commit()
    
    # Notifier le demandeur
    operation = db.query(Operation).filter(Operation.id_operation == id_operation).first()
    notification = Notification(
        matricule=operation.matricule,
        type_notification=TypeNotificationEnum.VALIDATION,
        titre="Opération clôturée",
        message="Votre opération a été clôturée par le RH.",
        id_operation=id_operation
    )
    db.add(notification)
    db.commit()
    
    return True, "Opération clôturée avec succès"


def verifier_delai_cloture(db: Session):
    """
    Vérifie les opérations qui devraient être clôturées et envoie des alertes.
    À exécuter quotidiennement (cron job).
    
    Args:
        db: Session de base de données
    """
    today = date.today()
    date_alerte = today - timedelta(days=DELAI_CLOTURE)
    
    # Trouver les opérations activées mais non clôturées dont la date de retour est dépassée
    operations = db.query(Operation).join(
        Activation,
        Activation.id_operation == Operation.id_operation
    ).filter(
        Activation.type_action == TypeActionEnum.ACTIVATION,
        Activation.statut_final == StatutFinalEnum.COMPLETE,
        Operation.date_retour < date_alerte,
        ~db.query(Activation).filter(
            Activation.id_operation == Operation.id_operation,
            Activation.type_action == TypeActionEnum.CLOTURE,
            Activation.statut_final == StatutFinalEnum.COMPLETE
        ).exists()
    ).all()
    
    for operation in operations:
        if not operation.alerte_non_cloture:
            # Première alerte
            operation.alerte_non_cloture = True
            operation.date_alerte_envoyee = datetime.now()
            
            # Notifier l'employé
            notification = Notification(
                matricule=operation.matricule,
                type_notification=TypeNotificationEnum.CLOTURE_REQUISE,
                titre="Clôture requise - Alerte J+1",
                message=f"Vous devez clôturer votre opération. Date de retour: {operation.date_retour}",
                id_operation=operation.id_operation
            )
            db.add(notification)
            
            # Notifier le RH
            creer_notification_rh(
                operation.id_operation,
                "Opération non clôturée",
                f"Employé {operation.matricule} n'a pas clôturé son opération (retour: {operation.date_retour})",
                db
            )
        
        # Après 3 jours d'alertes (48h + 3 jours), décrémenter le solde
        jours_depuis_alerte = (today - operation.date_alerte_envoyee.date()).days if operation.date_alerte_envoyee else 0
        
        if jours_depuis_alerte >= 3:
            from .business_logic import deduire_solde_conges
            from .permissions import obtenir_type_permission
            
            # Décrémenter uniquement pour permissions non-conv et congés
            type_info = obtenir_type_permission(operation.id_operation, db)
            if type_info['est_conventionnelle'] == False or type_info['type'] == 'conge':
                employe = db.query(Employe).filter(Employe.matricule == operation.matricule).first()
                if employe:
                    # Pénalité: 1 jour supplémentaire
                    deduire_solde_conges(employe, 1, db)
                    
                    notification = Notification(
                        matricule=employe.matricule,
                        type_notification=TypeNotificationEnum.AUTRE,
                        titre="Pénalité - Non clôture",
                        message="1 jour déduit de votre solde pour non-clôture dans les délais",
                        id_operation=operation.id_operation
                    )
                    db.add(notification)
    
    db.commit()


def obtenir_type_permission(id_operation: int, db: Session) -> Dict:
    """Helper pour obtenir le type de permission."""
    from .permissions import obtenir_type_permission as get_perm_type
    return get_perm_type(id_operation, db)


def verifier_role_rh(matricule: int, db: Session) -> bool:
    """
    Vérifie si un employé a le rôle RH.
    
    Args:
        matricule: Matricule de l'employé
        db: Session de base de données
    
    Returns:
        True si RH, False sinon
    """
    from ..models import Utilisateur, Role
    
    utilisateur = db.query(Utilisateur).filter(Utilisateur.matricule == matricule).first()
    
    if not utilisateur or not utilisateur.role_id:
        return False
    
    role = db.query(Role).filter(Role.id == utilisateur.role_id).first()
    
    return role and role.name.upper() == 'RH'


def creer_notification_rh(id_operation: int, titre: str, message: str, db: Session):
    """
    Crée une notification pour tous les RH.
    
    Args:
        id_operation: ID de l'opération concernée
        titre: Titre de la notification
        message: Message de la notification
        db: Session de base de données
    """
    from ..models import Utilisateur, Role
    
    # Trouver tous les RH
    rh_users = db.query(Utilisateur).join(Role).filter(Role.name == 'RH').all()
    
    for rh in rh_users:
        notification = Notification(
            matricule=rh.matricule,
            type_notification=TypeNotificationEnum.AUTRE,
            titre=titre,
            message=message,
            id_operation=id_operation
        )
        db.add(notification)
    
    db.commit()
