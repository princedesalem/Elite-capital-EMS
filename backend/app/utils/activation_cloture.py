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
    
    # Allow the initiator OR any missionnaire assigned to a Mission-type operation
    is_authorized = (operation.matricule == matricule_demandeur)
    if not is_authorized and (operation.type_demande or '').lower() == 'mission':
        from ..models import MissionnairesMission
        is_authorized = db.query(MissionnairesMission).filter(
            MissionnairesMission.id_mission == id_operation,
            MissionnairesMission.matricule == matricule_demandeur
        ).first() is not None
    if not is_authorized:
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
            # Si RH ou PCA/AG et que la partie RH n'est pas encore faite, compléter maintenant
            est_ac = verifier_role_rh(matricule_demandeur, db) or verifier_role_pca_ag(matricule_demandeur, db)
            if est_ac and not activation.rh_fait:
                activation.rh_fait = True
                activation.date_rh = datetime.now()
                activation.statut_final = StatutFinalEnum.COMPLETE
                db.commit()
                return True, "Opération activée immédiatement."
            return False, "Vous avez déjà activé cette opération. En attente de confirmation RH."
        
        activation.demandeur_fait = True
        activation.date_demandeur = datetime.now()
    
    db.commit()
    
    # Si RH ou PCA/AG : compléter immédiatement les deux côtés (pas d'attente RH)
    est_auto_complete = verifier_role_rh(matricule_demandeur, db) or verifier_role_pca_ag(matricule_demandeur, db)
    if est_auto_complete:
        activation.rh_fait = True
        activation.date_rh = datetime.now()
        activation.statut_final = StatutFinalEnum.COMPLETE
        # Déduire le solde si pas encore fait (sécurité)
        if not operation.solde_deduit:
            from .permissions import obtenir_type_permission
            from .business_logic import deduire_solde_conges
            type_info = obtenir_type_permission(id_operation, db)
            type_demande = str(operation.type_demande or '').strip().lower()
            doit_deduire = (
                type_info['est_conventionnelle'] == False
                or type_info['type'] == 'conge'
                or type_demande in {'conge', 'congé'}
            )
            if doit_deduire and operation.duree:
                employe_obj = db.query(Employe).filter(Employe.matricule == operation.matricule).first()
                if employe_obj:
                    deduire_solde_conges(employe_obj, operation.duree, db)
                    operation.solde_deduit = True
                    db.add(operation)
        db.commit()
        return True, "Opération activée immédiatement."

    # Créer notification pour RH
    _emp_act = db.query(Employe).filter(Employe.matricule == operation.matricule).first()
    _nom_act = f"{_emp_act.prenom} {_emp_act.nom}" if _emp_act else f"Matricule {operation.matricule}"
    _type_act = (operation.type_demande or 'Opération').capitalize()
    _label_act = f"{_type_act} « {operation.titre} »" if operation.titre else _type_act
    creer_notification_rh(
        id_operation,
        "Activation en attente",
        f"{_nom_act} a activé {_label_act}. Confirmation RH requise.",
        db
    )
    
    return True, "Activation enregistrée. En attente de confirmation du RH."


def activer_operation_auto_apres_validation(
    id_operation: int,
    matricule_demandeur: int,
    db: Session
) -> Tuple[bool, str]:
    """
    Déclenche automatiquement la partie demandeur de l'activation après la
    validation finale du workflow.  La validation finale vaut comme accord
    implicite de départ ; le RH doit encore confirmer pour compléter.
    """
    operation = db.query(Operation).filter(Operation.id_operation == id_operation).first()
    if not operation:
        return False, "Opération introuvable"

    # Ne pas re-créer si une activation existe déjà
    existing = db.query(Activation).filter(
        Activation.id_operation == id_operation,
        Activation.type_action == TypeActionEnum.ACTIVATION
    ).first()
    if existing:
        return True, "Activation déjà initiée"

    # Si le demandeur est lui-même RH, compléter les deux côtés immédiatement
    employe = db.query(Employe).filter(Employe.matricule == matricule_demandeur).first()
    nom_employe = f"{employe.prenom} {employe.nom}" if employe else f"Employé #{matricule_demandeur}"
    est_rh = verifier_role_rh(matricule_demandeur, db)
    now = datetime.now()

    activation = Activation(
        id_operation=id_operation,
        type_action=TypeActionEnum.ACTIVATION,
        demandeur_fait=True,
        date_demandeur=now,
        rh_fait=est_rh,
        date_rh=now if est_rh else None,
        statut_final=StatutFinalEnum.COMPLETE if est_rh else StatutFinalEnum.EN_ATTENTE
    )
    db.add(activation)
    db.commit()

    if not est_rh:
        # Notifier le RH qu'une confirmation d'activation est requise
        creer_notification_rh(
            id_operation,
            "Activation en attente de confirmation",
            (
                f"La {(operation.type_demande or 'demande').lower()} de {nom_employe} "
                f"a été approuvée par tous les validateurs. Votre confirmation d'activation est requise."
            ),
            db
        )

    return True, "Activation initiée automatiquement après validation finale"


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
    type_demande = str(operation.type_demande or '').strip().lower() if operation else ''
    doit_deduire_solde = (
        type_info['est_conventionnelle'] == False
        or type_info['type'] == 'conge'
        or type_demande in {'conge', 'congé'}
    )
    
    # Déduire du solde uniquement pour les permissions non conventionnelles et les congés
    if doit_deduire_solde and operation.duree and not operation.solde_deduit:
        employe = db.query(Employe).filter(Employe.matricule == operation.matricule).first()
        if employe:
            deduire_solde_conges(employe, operation.duree, db)
            operation.solde_deduit = True
            db.add(operation)
            db.commit()
    
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
    
    # Allow the initiator OR any missionnaire assigned to a Mission-type operation
    is_authorized = (operation.matricule == matricule_demandeur)
    if not is_authorized and (operation.type_demande or '').lower() == 'mission':
        from ..models import MissionnairesMission
        is_authorized = db.query(MissionnairesMission).filter(
            MissionnairesMission.id_mission == id_operation,
            MissionnairesMission.matricule == matricule_demandeur
        ).first() is not None
    if not is_authorized:
        return False, "Vous n'êtes pas autorisé à clôturer cette opération"
    
    # Vérifier que l'opération est activée
    activation_activee = db.query(Activation).filter(
        Activation.id_operation == id_operation,
        Activation.type_action == TypeActionEnum.ACTIVATION,
        Activation.demandeur_fait == True,
        Activation.rh_fait == True
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
        date_retour_prevue = operation.date_retour or operation.date_fin
        if not date_retour_anticipe or not date_retour_prevue or date_retour_anticipe >= date_retour_prevue:
            return False, "La date de retour anticipé doit être antérieure à la date de retour prévue"
        
        operation.retour_anticipe = True
        operation.date_retour_anticipe = date_retour_anticipe
        
        # Calculer les jours à rendre
        from .business_logic import calculer_jours_ouvrables, rajouter_solde_conges
        jours_non_utilises = calculer_jours_ouvrables(date_retour_anticipe, date_retour_prevue)
        
        # Rendre les jours au solde (sauf pour permissions conventionnelles)
        if not type_info.get('est_conventionnelle'):
            employe = db.query(Employe).filter(Employe.matricule == operation.matricule).first()
            rajouter_solde_conges(employe, jours_non_utilises, db)
    
    # Si le demandeur est lui-même RH ou PCA/AG, compléter les deux côtés immédiatement
    est_auto_complete = verifier_role_rh(matricule_demandeur, db) or verifier_role_pca_ag(matricule_demandeur, db)
    now = datetime.now()

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
            date_demandeur=now,
            rh_fait=est_auto_complete,
            date_rh=now if est_auto_complete else None,
            statut_final=StatutFinalEnum.COMPLETE if est_auto_complete else StatutFinalEnum.EN_ATTENTE
        )
        db.add(cloture)
    else:
        if cloture.demandeur_fait:
            return False, "Vous avez déjà demandé la clôture. En attente de confirmation RH."
        
        cloture.demandeur_fait = True
        cloture.date_demandeur = now
        if est_auto_complete:
            cloture.rh_fait = True
            cloture.date_rh = now
            cloture.statut_final = StatutFinalEnum.COMPLETE
    
    db.commit()
    
    if not est_auto_complete:
        # Notifier le RH
        _emp = db.query(Employe).filter(Employe.matricule == operation.matricule).first()
        _nom = f"{_emp.prenom} {_emp.nom}" if _emp else f"Matricule {operation.matricule}"
        _type_op = (operation.type_demande or 'Opération').capitalize()
        _label_op = f"{_type_op} « {operation.titre} »" if operation.titre else _type_op
        creer_notification_rh(
            id_operation,
            "Clôture en attente",
            f"{_nom} a clôturé {_label_op}. Confirmation RH requise.",
            db
        )
        return True, "Clôture enregistrée. En attente de confirmation du RH."
    
    return True, "Clôture complète (auto-confirmation RH)."


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
            _emp_alerte = db.query(Employe).filter(Employe.matricule == operation.matricule).first()
            _nom_alerte = f"{_emp_alerte.prenom} {_emp_alerte.nom}" if _emp_alerte else f"Matricule {operation.matricule}"
            _type_alerte = (operation.type_demande or 'Opération').capitalize()
            _label_alerte = f"{_type_alerte} « {operation.titre} »" if operation.titre else _type_alerte
            creer_notification_rh(
                operation.id_operation,
                "Opération non clôturée",
                f"{_nom_alerte} n'a pas clôturé {_label_alerte} (retour prévu : {operation.date_retour}).",
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


def verifier_role_pca_ag(matricule: int, db: Session) -> bool:
    """
    Vérifie si un employé a le rôle PCA ou AG.
    Ces rôles n'ont pas de validateurs — ils gèrent eux-mêmes leur cycle complet.
    """
    from ..models import Utilisateur, Role

    utilisateur = db.query(Utilisateur).filter(Utilisateur.matricule == matricule).first()
    if not utilisateur or not utilisateur.role_id:
        return False

    role = db.query(Role).filter(Role.id == utilisateur.role_id).first()
    return role and role.name.upper() in {'PCA', 'AG'}


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
