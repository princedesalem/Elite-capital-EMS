"""
Système de workflow de validation avec règles hiérarchiques
"""
from typing import List, Optional, Tuple
from sqlalchemy.orm import Session
from ..models import (
    Employe, Operation, Departement, Direction, Validation,
    Utilisateur, Role, Frais
)
from datetime import datetime


def _normaliser_role(role_name: Optional[str]) -> str:
    role = (role_name or '').strip().upper()
    if role in {'ADMIN', 'ADMINISTRATEUR'}:
        return 'ADMIN'
    if role in {'EMPLOYE', 'EMPLOYE'}:
        return 'EMPLOYE'
    return role


def determiner_sequence_validation(
    employe: Employe,
    db: Session,
    id_operation: Optional[int] = None
) -> List[str]:
    """
    Détermine la séquence de validation pour un employé selon sa structure organisationnelle.
    
    Règles:
    1. Si le département a une direction:
       - Le RESPONSABLE est skippé
       - Séquence: DIRECTEUR → RH → [DFC si frais] → DG → PCA/AG
    
    2. Si le département n'a PAS de direction:
       - Séquence: RESPONSABLE → RH → [DFC si frais] → DG → PCA/AG
    
    3. Si l'entité est ECG:
       - Le dernier validateur est AG au lieu de PCA
    
    4. Si c'est le DG qui fait la demande:
       - Séquence: RH → [DFC si frais] → PCA/AG
    
    5. Si l'opération a des frais de mission:
       - DFC est ajouté APRÈS RH et AVANT DG
    
    Args:
        employe: Instance de l'employé
        db: Session de base de données
        id_operation: ID de l'opération (pour vérifier si frais existent)
    
    Returns:
        Liste ordonnée des rôles validateurs
    """
    sequence = []
    
    # Vérifier si c'est le DG
    est_dg = verifier_role_employe(employe.matricule, 'DG', db)
    
    if est_dg:
        # DG: RH → [DFC si frais] → PCA/AG
        sequence = ['RH']
    else:
        # Récupérer le département
        if employe.dept_id:
            departement = db.query(Departement).filter(
                Departement.dept_id == employe.dept_id
            ).first()

            if departement and departement.id_direction:
                # Département sous une direction: DIRECTEUR en premier
                sequence = ['DIRECTEUR', 'RH']
            else:
                # Département sans direction: RESPONSABLE en premier
                sequence = ['RESPONSABLE', 'RH']
        elif employe.id_direction:
            # Pas de département mais rattaché à une direction
            sequence = ['DIRECTEUR', 'RH']
        else:
            # Cas par défaut
            sequence = ['RESPONSABLE', 'RH']
    
    # Vérifier si l'opération a des frais de mission
    a_des_frais = False
    if id_operation:
        frais = db.query(Frais).filter(Frais.id_operation == id_operation).first()
        if frais:
            a_des_frais = True
    
    # Ajouter DFC AVANT DG si des frais existent
    if a_des_frais:
        sequence.append('DFC')
    
    # Ajouter DG
    sequence.append('DG')
    
    # Déterminer le dernier validateur selon l'entité
    if employe.id_entite:
        from ..models import Entite
        entite = db.query(Entite).filter(Entite.id_entite == employe.id_entite).first()
        
        if entite and entite.nom == 'ECG':
            sequence.append('AG')
        else:
            sequence.append('PCA')
    else:
        sequence.append('PCA')  # Par défaut
    
    return sequence


def obtenir_validateur_pour_role(
    employe: Employe,
    role: str,
    db: Session
) -> Optional[int]:
    """
    Trouve le matricule du validateur approprié pour un rôle donné.
    
    Args:
        employe: Instance de l'employé qui fait la demande
        role: Rôle du validateur recherché
        db: Session de base de données
    
    Returns:
        Matricule du validateur ou None
    """
    if role == 'RESPONSABLE':
        # Chercher le responsable du département
        if employe.dept_id:
            departement = db.query(Departement).filter(
                Departement.dept_id == employe.dept_id
            ).first()
            
            if departement and departement.id_responsable:
                return departement.id_responsable
            
            # Fallback: chercher le N+1
            if employe.n1:
                return employe.n1
    
    elif role == 'DIRECTEUR':
        # Chercher le directeur de la direction (priorité à la direction du département)
        direction_id = employe.id_direction

        if not direction_id and employe.dept_id:
            departement = db.query(Departement).filter(
                Departement.dept_id == employe.dept_id
            ).first()
            if departement and departement.id_direction:
                direction_id = departement.id_direction

        if direction_id:
            direction = db.query(Direction).filter(
                Direction.id_direction == direction_id
            ).first()

            if direction and direction.id_directeur:
                return direction.id_directeur

        # Fallback: un directeur de la même entité
        role_obj = db.query(Role).filter(Role.name == 'DIRECTEUR').first()
        if role_obj and employe.id_entite:
            utilisateur = db.query(Utilisateur).join(Employe).filter(
                Utilisateur.role_id == role_obj.id,
                Employe.id_entite == employe.id_entite
            ).first()
            if utilisateur:
                return utilisateur.matricule

        # Dernier fallback: n'importe quel directeur
        if role_obj:
            utilisateur = db.query(Utilisateur).filter(
                Utilisateur.role_id == role_obj.id
            ).first()
            if utilisateur:
                return utilisateur.matricule
    
    elif role in ['RH', 'DFC', 'DG', 'PCA', 'AG']:
        # Chercher un utilisateur avec ce rôle dans la même entité
        role_obj = db.query(Role).filter(Role.name == role).first()
        
        if role_obj:
            # Chercher dans la même entité en priorité
            if employe.id_entite:
                utilisateur = db.query(Utilisateur).join(Employe).filter(
                    Utilisateur.role_id == role_obj.id,
                    Employe.id_entite == employe.id_entite
                ).first()
                
                if utilisateur:
                    return utilisateur.matricule
            
            # Fallback: n'importe quel utilisateur avec ce rôle
            utilisateur = db.query(Utilisateur).filter(
                Utilisateur.role_id == role_obj.id
            ).first()
            
            if utilisateur:
                return utilisateur.matricule
    
    return None


def obtenir_prochain_validateur(
    id_operation: int,
    db: Session
) -> Tuple[Optional[str], Optional[int]]:
    """
    Détermine le prochain validateur dans la séquence.
    
    Args:
        id_operation: ID de l'opération
        db: Session de base de données
    
    Returns:
        Tuple (role_prochain_validateur, matricule_prochain_validateur)
    """
    operation = db.query(Operation).filter(Operation.id_operation == id_operation).first()
    
    if not operation:
        return None, None
    
    employe = db.query(Employe).filter(Employe.matricule == operation.matricule).first()
    
    if not employe:
        return None, None
    
    # Obtenir la séquence complète (avec vérification des frais)
    sequence = determiner_sequence_validation(employe, db, id_operation)
    
    # Obtenir les validations déjà effectuées
    validations = db.query(Validation).filter(
        Validation.id_operation == id_operation,
        Validation.statut_validation == 'validé'
    ).all()
    
    roles_valides = set()
    for val in validations:
        # Utiliser le rôle stocké dans la validation
        if val.role_validateur:
            roles_valides.add(val.role_validateur)
    
    # Trouver le premier rôle non validé
    for role in sequence:
        if role not in roles_valides:
            matricule = obtenir_validateur_pour_role(employe, role, db)
            return role, matricule
    
    return None, None  # Tous les validateurs ont validé


def valider_operation(
    id_operation: int,
    matricule_validateur: int,
    statut: str,
    commentaire: Optional[str],
    db: Session
) -> Tuple[bool, str]:
    """
    Enregistre la validation d'une opération par un validateur.
    
    Args:
        id_operation: ID de l'opération
        matricule_validateur: Matricule du validateur
        statut: 'validé' ou 'refusé'
        commentaire: Commentaire du validateur
        db: Session de base de données
    
    Returns:
        Tuple (succès, message)
    """
    operation = db.query(Operation).filter(Operation.id_operation == id_operation).first()
    
    if not operation:
        return False, "Opération introuvable"
    
    employe = db.query(Employe).filter(Employe.matricule == operation.matricule).first()
    if not employe:
        return False, "Employé introuvable"
    
    # Obtenir le rôle du validateur
    role_validateur = obtenir_role_validateur(matricule_validateur, db)
    
    # Vérifier que le validateur a le droit de valider à cette étape
    prochain_role, prochain_matricule = obtenir_prochain_validateur(id_operation, db)

    if prochain_role and prochain_role != role_validateur:
        return False, f"Ce n'est pas votre tour de valider. En attente de: {prochain_role}"

    role_validation_effectif = role_validateur
    
    # Créer la validation
    validation = Validation(
        id_operation=id_operation,
        matricule_validateur=matricule_validateur,
        role_validateur=role_validation_effectif,
        statut_validation=statut,
        commentaire=commentaire,
        timestamp_action=datetime.now()
    )
    db.add(validation)
    db.commit()
    
    # Notifier
    from .notifications import notifier_validation_operation
    notifier_validation_operation(
        id_operation,
        statut,
        role_validation_effectif,
        commentaire,
        db
    )
    
    # Si refusé, arrêter le workflow
    if statut == 'refusé':
        return True, "Opération refusée"
    
    # Si validé, vérifier s'il y a un prochain validateur
    prochain_role_apres, prochain_matricule_apres = obtenir_prochain_validateur(id_operation, db)
    
    if not prochain_role_apres:
        # C'était le dernier validateur
        # Notifier le demandeur que la validation est complète
        operation = db.query(Operation).filter(Operation.id_operation == id_operation).first()
        if operation:
            notification_finale = Notification(
                matricule=operation.matricule,
                type_notification=TypeNotificationEnum.VALIDATION,
                titre="Validation complète",
                message=f"Votre demande #{id_operation} a été validée par tous les validateurs et est maintenant approuvée.",
                id_operation=id_operation
            )
            db.add(notification_finale)
            db.commit()
        return True, "Opération validée par tous les validateurs"
    
    # Notifier le prochain validateur
    if prochain_matricule_apres:
        operation = db.query(Operation).filter(Operation.id_operation == id_operation).first()
        demandeur = db.query(Employe).filter(Employe.matricule == operation.matricule).first() if operation else None
        
        notification_prochain = Notification(
            matricule=prochain_matricule_apres,
            type_notification=TypeNotificationEnum.VALIDATION,
            titre="Nouvelle demande à valider",
            message=f"Une demande #{id_operation} ({operation.type_demande if operation else 'opération'}) " +
                   f"de {demandeur.prenom} {demandeur.nom} " if demandeur else "" +
                   f"est en attente de votre validation en tant que {prochain_role_apres}.",
            id_operation=id_operation
        )
        db.add(notification_prochain)
        db.commit()
    
    return True, f"Validation enregistrée. En attente de {prochain_role_apres}"


def verifier_role_employe(matricule: int, role_name: str, db: Session) -> bool:
    """
    Vérifie si un employé a un rôle spécifique.
    
    Args:
        matricule: Matricule de l'employé
        role_name: Nom du rôle
        db: Session de base de données
    
    Returns:
        True si l'employé a le rôle, False sinon
    """
    utilisateur = db.query(Utilisateur).filter(Utilisateur.matricule == matricule).first()
    
    if not utilisateur or not utilisateur.role_id:
        return False
    
    role = db.query(Role).filter(Role.id == utilisateur.role_id).first()

    if not role:
        return False

    role_employe = _normaliser_role(role.name)
    role_recherche = _normaliser_role(role_name)
    return role_employe == role_recherche


def obtenir_role_validateur(matricule: int, db: Session) -> str:
    """
    Obtient le rôle d'un validateur.
    
    Args:
        matricule: Matricule du validateur
        db: Session de base de données
    
    Returns:
        Nom du rôle ou 'EMPLOYE' par défaut
    """
    utilisateur = db.query(Utilisateur).filter(Utilisateur.matricule == matricule).first()
    
    if utilisateur and utilisateur.role_id:
        role = db.query(Role).filter(Role.id == utilisateur.role_id).first()
        if role:
            return _normaliser_role(role.name)
    
    return 'EMPLOYE'


def peut_creer_demande_pour_autrui(matricule: int, db: Session) -> bool:
    """
    Vérifie si un employé peut créer des demandes pour d'autres employés.
    
    Règles:
    - RH peut créer pour n'importe qui
    - Un supérieur peut créer des missions pour ses subordonnés
    
    Args:
        matricule: Matricule de l'employé
        db: Session de base de données
    
    Returns:
        True si autorisé, False sinon
    """
    # Vérifier si RH
    if verifier_role_employe(matricule, 'RH', db):
        return True
    
    # Vérifier si a des subordonnés
    subordonnes = db.query(Employe).filter(Employe.n1 == matricule).count()
    
    return subordonnes > 0


def obtenir_operations_visibles(matricule: int, db: Session) -> List[Operation]:
    """
    Obtient les opérations visibles pour un employé selon son rôle.
    
    Règles:
    - EMPLOYE: Ses propres opérations
    - RESPONSABLE: Opérations de son département
    - DIRECTEUR: Opérations de sa direction
    - DG: Opérations de son entité
    - RH/PCA/ADMIN/AG: Toutes les opérations
    
    Args:
        matricule: Matricule de l'employé
        db: Session de base de données
    
    Returns:
        Liste des opérations visibles
    """
    employe = db.query(Employe).filter(Employe.matricule == matricule).first()
    
    if not employe:
        return []
    
    # Vérifier le rôle
    if verifier_role_employe(matricule, 'RH', db) or \
            verifier_role_employe(matricule, 'PCA', db) or \
            verifier_role_employe(matricule, 'ADMIN', db) or \
            verifier_role_employe(matricule, 'AG', db):
        # Voir toutes les opérations
        return db.query(Operation).all()
    
    elif verifier_role_employe(matricule, 'DG', db):
        # Voir les opérations de son entité
        return db.query(Operation).join(Employe).filter(
            Employe.id_entite == employe.id_entite
        ).all()
    
    elif verifier_role_employe(matricule, 'DIRECTEUR', db):
        # Voir les opérations de sa direction
        return db.query(Operation).join(Employe).filter(
            Employe.id_direction == employe.id_direction
        ).all()
    
    elif verifier_role_employe(matricule, 'RESPONSABLE', db):
        # Voir les opérations de son département
        return db.query(Operation).join(Employe).filter(
            Employe.dept_id == employe.dept_id
        ).all()
    
    else:
        # Voir seulement ses propres opérations
        return db.query(Operation).filter(Operation.matricule == matricule).all()
