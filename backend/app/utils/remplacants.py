"""
Système de gestion des remplaçants automatiques
"""
from typing import List, Dict, Optional
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from ..models import Employe, RemplacantPropose, Departement, Direction, StatutEmployeEnum


def _matricules_deja_remplacants(db: Session, date_debut, date_fin) -> set:
    """
    Retourne les matricules des personnes déjà acceptées comme remplaçante
    sur une période qui chevauche [date_debut, date_fin].
    """
    from ..models import Operation
    if not date_debut or not date_fin:
        return set()
    rows = db.query(RemplacantPropose.matricule_remplacant).join(
        Operation, RemplacantPropose.id_operation == Operation.id_operation
    ).filter(
        RemplacantPropose.est_accepte == True,
        Operation.date_debut != None,
        Operation.date_fin != None,
        Operation.date_debut <= str(date_fin),
        Operation.date_fin >= str(date_debut)
    ).all()
    return {r[0] for r in rows}


def trouver_remplacants_automatiques(
    employe: Employe,
    db: Session,
    limite: int = None,
    operation=None
) -> List[Dict]:
    """
    Trouve et propose automatiquement des remplaçants pour un employé.
    
    Seuls les subordonnés directs (n1 == employe.matricule) sont proposés.
    Tous les subordonnés sont retournés sans plafond arbitraire.
    
    Critères d'exclusion:
    - L'employé lui-même
    - Employés congédiés ou suspendus
    - Employés actuellement absents
    - Remplaçants déjà acceptés sur une période chevauchante
    
    Args:
        employe: L'employé qui part en opération
        db: Session de base de données
        limite: Ignoré (conservé pour compatibilité)
        operation: Opération en cours (pour vérifier les chevauchements)
    
    Returns:
        Liste de dictionnaires contenant les informations des remplaçants proposés
    """
    # Exclure les personnes déjà acceptées comme remplaçant sur la même période
    occupes = _matricules_deja_remplacants(
        db,
        operation.date_debut if operation else None,
        operation.date_fin if operation else None
    )

    filters = [
        Employe.matricule != employe.matricule,
        Employe.statut_employe == StatutEmployeEnum.ACTIF,
        or_(Employe.absent == False, Employe.absent.is_(None)),
        Employe.n1 == employe.matricule
    ]
    if occupes:
        filters.append(~Employe.matricule.in_(occupes))

    subordonnes = db.query(Employe).filter(and_(*filters)).all()

    return [
        {
            'matricule': sub.matricule,
            'nom': sub.nom,
            'prenom': sub.prenom,
            'fonction': sub.fonction,
            'ordre_proposition': i + 1,
            'raison': 'Subordonné direct'
        }
        for i, sub in enumerate(subordonnes)
    ]


def enregistrer_remplacants_proposes(
    id_operation: int,
    remplacants: List[Dict],
    db: Session
) -> List[RemplacantPropose]:
    """
    Enregistre les remplaçants proposés dans la base de données.
    
    Args:
        id_operation: ID de l'opération
        remplacants: Liste des remplaçants proposés
        db: Session de base de données
    
    Returns:
        Liste des objets RemplacantPropose créés
    """
    # Supprimer les propositions existantes pour éviter les doublons sur double-clic
    db.query(RemplacantPropose).filter(
        RemplacantPropose.id_operation == id_operation,
        RemplacantPropose.est_accepte == False
    ).delete(synchronize_session=False)

    objets_crees = []
    
    for i, remplacant in enumerate(remplacants):
        remplacant_propose = RemplacantPropose(
            id_operation=id_operation,
            matricule_remplacant=remplacant['matricule'],
            ordre_proposition=remplacant.get('ordre_proposition', i + 1),
            est_accepte=False
        )
        db.add(remplacant_propose)
        objets_crees.append(remplacant_propose)
    
    try:
        db.commit()
        return True, f"{len(objets_crees)} remplaçant(s) enregistré(s)"
    except Exception as e:
        db.rollback()
        return False, str(e)


def accepter_remplacant(
    id_operation: int,
    matricule_remplacant: int,
    db: Session
) -> bool:
    """
    Accepte un remplaçant proposé et met à jour l'opération.
    
    Args:
        id_operation: ID de l'opération
        matricule_remplacant: Matricule du remplaçant accepté
        db: Session de base de données
    
    Returns:
        True si succès, False sinon
    """
    from ..models import Operation

    # Vérifier qu'il n'y a pas de conflit de période
    current_op = db.query(Operation).filter(
        Operation.id_operation == id_operation
    ).first()
    if current_op and current_op.date_debut and current_op.date_fin:
        occupes = _matricules_deja_remplacants(
            db, current_op.date_debut, current_op.date_fin
        )
        if matricule_remplacant in occupes:
            return False, (
                "Ce remplaçant est déjà affecté à un autre remplacement "
                "sur la même période"
            )

    # Marquer le remplaçant comme accepté
    remplacant_propose = db.query(RemplacantPropose).filter(
        and_(
            RemplacantPropose.id_operation == id_operation,
            RemplacantPropose.matricule_remplacant == matricule_remplacant
        )
    ).first()

    if remplacant_propose:
        remplacant_propose.est_accepte = True
        
        # Mettre à jour l'opération avec le remplaçant
        operation = db.query(Operation).filter(
            Operation.id_operation == id_operation
        ).first()
        
        if operation:
            operation.remplacant = matricule_remplacant
            db.commit()
            return True, "Remplaçant accepté"
    
    return False, "Remplaçant introuvable"


def obtenir_remplacants_proposes(
    id_operation: int,
    db: Session
) -> List[Dict]:
    """
    Récupère la liste des remplaçants proposés pour une opération.
    
    Args:
        id_operation: ID de l'opération
        db: Session de base de données
    
    Returns:
        Liste des remplaçants avec leurs informations complètes
    """
    remplacants_proposes = db.query(RemplacantPropose).filter(
        RemplacantPropose.id_operation == id_operation
    ).order_by(RemplacantPropose.ordre_proposition).all()
    
    resultats = []
    for rp in remplacants_proposes:
        employe = db.query(Employe).filter(
            Employe.matricule == rp.matricule_remplacant
        ).first()
        
        if employe:
            resultats.append({
                'id_remplacant_propose': rp.id_remplacant_propose,
                'matricule': employe.matricule,
                'nom': employe.nom,
                'prenom': employe.prenom,
                'fonction': employe.fonction,
                'departement': employe.dept_id,
                'ordre_proposition': rp.ordre_proposition,
                'est_accepte': rp.est_accepte
            })
    
    return resultats


def verifier_disponibilite_remplacant(
    matricule: int,
    date_debut: str,
    date_fin: str,
    db: Session
) -> tuple[bool, Optional[str]]:
    """
    Vérifie si un remplaçant est disponible pour une période donnée.
    
    Args:
        matricule: Matricule du remplaçant potentiel
        date_debut: Date de début de l'opération
        date_fin: Date de fin de l'opération
        db: Session de base de données
    
    Returns:
        Tuple (disponible, raison_indisponibilite)
    """
    from ..models import Operation
    from datetime import datetime
    
    employe = db.query(Employe).filter(Employe.matricule == matricule).first()
    
    if not employe:
        return False, "Employé introuvable"
    
    if employe.statut_employe is not None and employe.statut_employe != StatutEmployeEnum.ACTIF:
        return False, f"Employé {employe.statut_employe.value}"
    
    if employe.absent:
        return False, "Employé actuellement absent"
    
    # Vérifier les chevauchements avec d'autres opérations
    from datetime import date as _DateType
    date_debut_dt = date_debut if isinstance(date_debut, _DateType) else datetime.strptime(str(date_debut), '%Y-%m-%d').date()
    date_fin_dt = date_fin if isinstance(date_fin, _DateType) else datetime.strptime(str(date_fin), '%Y-%m-%d').date()
    
    operations = db.query(Operation).filter(
        Operation.matricule == matricule
    ).all()
    
    for op in operations:
        debut_op = op.date_depart or op.date_debut
        fin_op = op.date_retour or op.date_fin
        if debut_op and fin_op:
            if not (date_fin_dt < debut_op or date_debut_dt > fin_op):
                return False, f"Déjà en opération du {debut_op} au {fin_op}"
    
    return True, None
