"""
Système de gestion des remplaçants automatiques
"""
from typing import List, Dict, Optional
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from ..models import Employe, RemplacantPropose, Departement, Direction, StatutEmployeEnum


def trouver_remplacants_automatiques(
    employe: Employe,
    db: Session,
    limite: int = 5
) -> List[Dict]:
    """
    Trouve et propose automatiquement des remplaçants pour un employé.
    
    Ordre de priorité:
    1. Subordonnés directs du même département
    2. Collègues du même département
    3. Employés de la même direction
    4. Employés de la même entité
    
    Critères d'exclusion:
    - L'employé lui-même
    - Employés congédiés ou suspendus
    - Employés actuellement absents
    
    Args:
        employe: L'employé qui part en opération
        db: Session de base de données
        limite: Nombre maximum de remplaçants à proposer
    
    Returns:
        Liste de dictionnaires contenant les informations des remplaçants proposés
    """
    remplacants = []
    ordre = 1
    
    # Base query: employés actifs, non absents et différents de l'employé
    base_query = db.query(Employe).filter(
        and_(
            Employe.matricule != employe.matricule,
            Employe.statut_employe == StatutEmployeEnum.ACTIF,
            or_(Employe.absent == False, Employe.absent.is_(None))
        )
    )
    
    # 1. Subordonnés directs (ceux dont le n1 est l'employé actuel)
    if len(remplacants) < limite:
        subordonnes = base_query.filter(
            Employe.n1 == employe.matricule
        ).all()
        
        for sub in subordonnes[:limite - len(remplacants)]:
            remplacants.append({
                'matricule': sub.matricule,
                'nom': sub.nom,
                'prenom': sub.prenom,
                'fonction': sub.fonction,
                'ordre_proposition': ordre,
                'raison': 'Subordonné direct'
            })
            ordre += 1
    
    # 2. Collègues du même département (excluant les subordonnés déjà ajoutés)
    if len(remplacants) < limite and employe.dept_id:
        matricules_existants = [r['matricule'] for r in remplacants]
        collegues_dept = base_query.filter(
            and_(
                Employe.dept_id == employe.dept_id,
                ~Employe.matricule.in_(matricules_existants) if matricules_existants else True
            )
        ).all()
        
        for collegue in collegues_dept[:limite - len(remplacants)]:
            remplacants.append({
                'matricule': collegue.matricule,
                'nom': collegue.nom,
                'prenom': collegue.prenom,
                'fonction': collegue.fonction,
                'ordre_proposition': ordre,
                'raison': 'Même département'
            })
            ordre += 1
    
    # 3. Employés de la même direction
    if len(remplacants) < limite and employe.id_direction:
        matricules_existants = [r['matricule'] for r in remplacants]
        collegues_direction = base_query.filter(
            and_(
                Employe.id_direction == employe.id_direction,
                ~Employe.matricule.in_(matricules_existants) if matricules_existants else True
            )
        ).all()
        
        for collegue in collegues_direction[:limite - len(remplacants)]:
            remplacants.append({
                'matricule': collegue.matricule,
                'nom': collegue.nom,
                'prenom': collegue.prenom,
                'fonction': collegue.fonction,
                'ordre_proposition': ordre,
                'raison': 'Même direction'
            })
            ordre += 1
    
    # 4. Employés de la même entité
    if len(remplacants) < limite and employe.id_entite:
        matricules_existants = [r['matricule'] for r in remplacants]
        collegues_entite = base_query.filter(
            and_(
                Employe.id_entite == employe.id_entite,
                ~Employe.matricule.in_(matricules_existants) if matricules_existants else True
            )
        ).all()
        
        for collegue in collegues_entite[:limite - len(remplacants)]:
            remplacants.append({
                'matricule': collegue.matricule,
                'nom': collegue.nom,
                'prenom': collegue.prenom,
                'fonction': collegue.fonction,
                'ordre_proposition': ordre,
                'raison': 'Même entité'
            })
            ordre += 1
    
    return remplacants


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
    objets_crees = []
    
    for remplacant in remplacants:
        remplacant_propose = RemplacantPropose(
            id_operation=id_operation,
            matricule_remplacant=remplacant['matricule'],
            ordre_proposition=remplacant['ordre_proposition'],
            est_accepte=False
        )
        db.add(remplacant_propose)
        objets_crees.append(remplacant_propose)
    
    db.commit()
    return objets_crees


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
            return True
    
    return False


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
    
    if employe.statut_employe != StatutEmployeEnum.ACTIF:
        return False, f"Employé {employe.statut_employe.value}"
    
    if employe.absent:
        return False, "Employé actuellement absent"
    
    # Vérifier les chevauchements avec d'autres opérations
    date_debut_dt = datetime.strptime(date_debut, '%Y-%m-%d').date()
    date_fin_dt = datetime.strptime(date_fin, '%Y-%m-%d').date()
    
    operations = db.query(Operation).filter(
        Operation.matricule == matricule
    ).all()
    
    for op in operations:
        if not (date_fin_dt < op.date_depart or date_debut_dt > op.date_retour):
            return False, f"Déjà en opération du {op.date_depart} au {op.date_retour}"
    
    return True, None
