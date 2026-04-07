"""
Système de gestion des permissions conventionnelles et non-conventionnelles
Selon la Convention Collective Nationale du Commerce
"""
from datetime import datetime, date, timedelta
from decimal import Decimal
from typing import Tuple, Dict, Optional
from sqlalchemy import extract, func
from sqlalchemy.orm import Session
from ..models import (
    Employe, Permission, PermConventionelle, PermNonConventionelle,
    PermMaternelle, PermDeces, PermMaladie, PermBapteme, PermMariage,
    PreuvePermission,
    Operation, Notification, TypeNotificationEnum
)


# Durées maximales selon l'ARTICLE 7 du Règlement Intérieur
# Convention Collective Nationale du Commerce
# Liste des permissions conventionnelles autorisées
DUREES_PERMISSIONS_CONVENTIONNELLES = {
    'mariage': {
        'salarie': 4,           # Mariage du travailleur: 4 jours
        'enfant': 2             # Mariage d'un enfant du travailleur: 2 jours
    },
    'paternite': {
        'epouse': 3             # Accouchement de l'épouse du travailleur: 3 jours
    },
    'bapteme': {
        'enfant': 1             # Baptême d'un enfant du travailleur: 1 jour
    },
    'deces': {
        'conjoint': 5,          # Décès du conjoint du travailleur: 5 jours
        'enfant': 3,            # Décès d'un enfant du travailleur: 3 jours
        'pere': 5,              # Décès du père du travailleur: 5 jours
        'mere': 5,              # Décès de la mère du travailleur: 5 jours
        'beau_pere': 3,         # Décès du père du conjoint légitime: 3 jours
        'belle_mere': 3,        # Décès de la mère du conjoint légitime: 3 jours
        'frere': 3,             # Décès du frère du travailleur: 3 jours
        'soeur': 3              # Décès de la sœur du travailleur: 3 jours
    },
    'maladie': {
        'certifiee': 3          # Permission maladie sur présentation d'un justificatif médical
    },
    'maternelle': {
        'simple': 112,          # Congé maternité: 16 semaines (Convention Collective)
        'pathologique': 126     # Congé maternité pathologique: 18 semaines
    }
}

# Limite maximale par année calendaire
LIMITE_PERMISSIONS_PAR_AN = 12  # 12 jours par année calendaire (Article 7)

DELAI_TELECHARGEMENT_PREUVES = 60  # 60 jours pour téléverser les preuves (Article 7)


def verifier_type_permission_conventionnelle(
    type_permission: str,
    sous_type: Optional[str] = None
) -> Tuple[bool, str, int]:
    """
    Vérifie si un type de permission est conventionnel et retourne la durée maximale.
    
    Args:
        type_permission: Type de permission ('deces', 'mariage', 'paternite', 'bapteme', 'maladie', 'maternelle')
        sous_type: Sous-type si applicable (ex: 'conjoint', 'enfant', 'pere' pour déces)
    
    Returns:
        Tuple (est_conventionnel, message, duree_max)
    """
    type_permission = str(type_permission or '').strip().lower()
    if type_permission == 'accouchement':
        type_permission = 'paternite'
    
    if type_permission in DUREES_PERMISSIONS_CONVENTIONNELLES:
        duree = DUREES_PERMISSIONS_CONVENTIONNELLES[type_permission]
        
        # Si la durée est un dictionnaire, on a besoin du sous-type
        if isinstance(duree, dict):
            if not sous_type or sous_type.lower() not in duree:
                return False, f"Sous-type requis pour {type_permission}", 0
            duree_max = duree[sous_type.lower()]
        else:
            duree_max = duree
        
        return True, f"Permission conventionnelle: {type_permission}", duree_max
    
    return False, "Permission non conventionnelle", 0


def creer_permission_conventionnelle(
    id_operation: int,
    type_permission: str,
    duree: int,
    db: Session,
    sous_type: Optional[str] = None
) -> Tuple[bool, str]:
    """
    Crée une permission conventionnelle selon l'ARTICLE 7 du Règlement Intérieur.
    
    Règles (Article 7):
    - Limite de 12 jours par année calendaire
    - Dépôt de preuves dans les 60 jours suivant l'événement
    - Demandes: 48h après (décès/accouchement) ou 72h à l'avance (autres cas)
    
    Args:
        id_operation: ID de l'opération
        type_permission: Type de permission
        duree: Durée demandée
        db: Session de base de données
        sous_type: Sous-type si applicable
    
    Returns:
        Tuple (succès, message)
    """
    from .business_logic import verifier_solde_conges
    
    # Vérifier si c'est bien conventionnel
    est_conv, message, duree_max = verifier_type_permission_conventionnelle(type_permission, sous_type)
    
    if not est_conv:
        return False, "Ce type de permission n'est pas conventionnel"
    
    if duree > duree_max:
        return False, f"Durée maximale pour ce type: {duree_max} jours (Article 7, Règlement intérieur)"
    
    # Vérifier la limite annuelle de 12 jours (Article 7)
    # Note: La maternité ne compte pas dans cette limite (congé spécial longue durée)
    if type_permission != 'maternelle':
        employe = db.query(Employe).join(
            Operation,
            Operation.matricule == Employe.matricule
        ).filter(
            Operation.id_operation == id_operation
        ).first()
        
        if employe:
            # Compter les jours de permissions conventionnelles déjà pris cette année
            annee_actuelle = datetime.now().year
            jours_permissions_annee = db.query(
                func.sum(Operation.duree_jours)
            ).join(
                PermConventionelle,
                PermConventionelle.id_perm_c == Operation.id_operation
            ).filter(
                Operation.matricule == employe.matricule,
                extract('year', Operation.date_debut) == annee_actuelle,
                Operation.statut.in_(['VALIDE', 'ACTIVE', 'CLOTUREE'])
            ).scalar() or 0
            
            total_demande = jours_permissions_annee + duree
            
            if total_demande > LIMITE_PERMISSIONS_PAR_AN:
                jours_restants = max(0, LIMITE_PERMISSIONS_PAR_AN - jours_permissions_annee)
                return False, (
                    f"Limite annuelle atteinte. Article 7 - Limite: {LIMITE_PERMISSIONS_PAR_AN} jours par an. "
                    f"Actuellement: {int(jours_permissions_annee)} jours utilisés. "
                    f"Jours restants: {int(jours_restants)} (dépassement possible en déduction de congés)"
                )
    
    # Créer l'entrée Permission
    permission = db.query(Permission).filter(Permission.id_permission == id_operation).first()
    if not permission:
        permission = Permission(id_permission=id_operation)
        db.add(permission)
        db.flush()
    
    # Créer la permission conventionnelle
    date_limite = date.today() + timedelta(days=DELAI_TELECHARGEMENT_PREUVES)
    
    perm_conv = PermConventionelle(
        id_perm_c=id_operation,
        preuve=None,
        preuves_televersees=False,
        date_limite_preuves=date_limite
    )
    db.add(perm_conv)
    
    # Créer le sous-type spécifique
    if type_permission == 'maternelle':
        perm_mat = PermMaternelle(id_perm_mat=id_operation)
        db.add(perm_mat)
    elif type_permission == 'deces':
        perm_dec = PermDeces(id_perm_dec=id_operation)
        db.add(perm_dec)
    elif type_permission == 'maladie':
        perm_mal = PermMaladie(id_perm_mal=id_operation)
        db.add(perm_mal)
    elif type_permission == 'bapteme':
        perm_bap = PermBapteme(id_perm_bap=id_operation)
        db.add(perm_bap)
    elif type_permission in ['mariage', 'paternite', 'accouchement']:
        perm_mar = PermMariage(id_perm_mar=id_operation)
        db.add(perm_mar)
    
    db.commit()
    
    return True, (
        f"Permission conventionnelle créée ({duree} jours). "
        f"Preuves à fournir avant le {date_limite.strftime('%d/%m/%Y')} (Article 7, Règlement intérieur)"
    )



def creer_permission_non_conventionnelle(
    id_operation: int,
    duree: int,
    employe: Employe,
    db: Session
) -> Tuple[bool, str]:
    """
    Crée une permission non conventionnelle.
    
    Règles:
    - DEDUIT du solde de congés
    - Vérifie le solde disponible
    
    Args:
        id_operation: ID de l'opération
        duree: Durée demandée
        employe: Instance de l'employé
        db: Session de base de données
    
    Returns:
        Tuple (succès, message)
    """
    # Créer l'entrée Permission
    permission = db.query(Permission).filter(Permission.id_permission == id_operation).first()
    if not permission:
        permission = Permission(id_permission=id_operation)
        db.add(permission)
        db.flush()
    
    # Créer la permission non conventionnelle
    perm_non_conv = PermNonConventionelle(id_perm_nc=id_operation)
    db.add(perm_non_conv)
    
    db.commit()
    
    return True, f"Permission non conventionnelle créée. Sera déduite du solde lors de l'activation"


def televerser_preuves_permission(
    id_operation: int,
    chemin_preuve: str,
    db: Session,
    nom_fichier: Optional[str] = None
) -> Tuple[bool, str]:
    """
    Enregistre le téléversement d'une preuve pour une permission conventionnelle.
    Supporte plusieurs fichiers par permission (une ligne PreuvePermission par fichier).
    """
    import os as _os
    perm_conv = db.query(PermConventionelle).filter(
        PermConventionelle.id_perm_c == id_operation
    ).first()
    
    if not perm_conv:
        return False, "Permission conventionnelle introuvable"
    
    # Vérifier si dans le délai
    if perm_conv.date_limite_preuves and date.today() > perm_conv.date_limite_preuves:
        return False, f"Délai dépassé. Date limite était le {perm_conv.date_limite_preuves}"
    
    fichier_nom = nom_fichier or _os.path.basename(chemin_preuve)
    now = datetime.now()
    
    # Ajouter une ligne dans la table des preuves multiples
    nouvelle_preuve = PreuvePermission(
        id_perm_c=id_operation,
        chemin_fichier=chemin_preuve,
        nom_fichier=fichier_nom,
        date_upload=now,
    )
    db.add(nouvelle_preuve)
    
    # Mettre à jour les champs de synthèse sur PermConventionelle
    perm_conv.preuves_televersees = True
    perm_conv.date_telechargement_preuves = now
    
    db.commit()
    
    return True, "Preuve téléversée avec succès"


def verifier_delai_preuves_permission(
    id_operation: int,
    db: Session
) -> Tuple[bool, str, Optional[date]]:
    """
    Vérifie si les preuves ont été téléversées dans le délai.
    
    Args:
        id_operation: ID de l'opération
        db: Session de base de données
    
    Returns:
        Tuple (preuves_ok, message, date_limite)
    """
    perm_conv = db.query(PermConventionelle).filter(
        PermConventionelle.id_perm_c == id_operation
    ).first()
    
    if not perm_conv:
        return False, "Permission non conventionnelle ou introuvable", None
    
    if perm_conv.preuves_televersees:
        return True, "Preuves téléversées", perm_conv.date_limite_preuves
    
    if date.today() > perm_conv.date_limite_preuves:
        return False, f"Délai dépassé ({perm_conv.date_limite_preuves.strftime('%d/%m/%Y')}). Article 7 - 60 jours", perm_conv.date_limite_preuves
    
    jours_restants = (perm_conv.date_limite_preuves - date.today()).days
    return False, f"Preuves non téléversées. {jours_restants} jours restants (limite: {perm_conv.date_limite_preuves.strftime('%d/%m/%Y')})", perm_conv.date_limite_preuves


def verifier_delai_soumission_demande(
    type_permission: str,
    date_debut: date,
    date_demande: date = None,
    sous_type: Optional[str] = None
) -> Tuple[bool, str]:
    """
    Vérifie les délais de soumission des demandes selon le Décret n°75/29 du 10 Janvier 1975 (Article 3).
    
    Article 3 du Décret:
    - 48h APRÈS l'événement pour: décès, paternité
    - 72h À L'AVANCE pour: tous les autres cas
    
    Args:
        type_permission: Type de permission
        date_debut: Date du début de la permission
        date_demande: Date de la demande (par défaut: aujourd'hui)
        sous_type: Sous-type si applicable
    
    Returns:
        Tuple (respecte_delai, message)
    """
    if date_demande is None:
        date_demande = date.today()
    
    # Types qui nécessitent 48h APRÈS l'événement
    types_apres_48h = ['deces', 'paternite', 'accouchement']
    
    if type_permission.lower() in types_apres_48h:
        delai_min = timedelta(hours=0)  # Peut demander le jour même ou après
        delai_max = timedelta(hours=48)
        diff = date_demande - date_debut
        
        if diff < delai_min or diff > delai_max:
            return False, (
                f"Décret n°75/29 Article 3 - Pour {type_permission}: demande entre 0h et 48h après l'événement. "
                f"Événement: {date_debut.strftime('%d/%m/%Y')}, Demande: {date_demande.strftime('%d/%m/%Y')}"
            )
    else:
        # Tous les autres cas: 72h À L'AVANCE
        delai_min = timedelta(hours=72)
        diff = date_debut - date_demande
        
        if diff < delai_min:
            jours_manquants = (delai_min - diff).days + 1
            return False, (
                f"Décret n°75/29 Article 3 - Demande requise au minimum 72h à l'avance. "
                f"Demande: {date_demande.strftime('%d/%m/%Y')}, Début: {date_debut.strftime('%d/%m/%Y')}. "
                f"Au minimum {jours_manquants} jour(s) de plus requis."
            )
    
    return True, "Délai de soumission conforme"


def obtenir_type_permission(id_operation: int, db: Session) -> Dict:
    """
    Détermine le type et sous-type d'une permission.
    
    Args:
        id_operation: ID de l'opération
        db: Session de base de données
    
    Returns:
        Dictionnaire avec type, sous_type, est_conventionnelle
    """
    # Vérifier si c'est une permission
    permission = db.query(Permission).filter(Permission.id_permission == id_operation).first()
    
    if not permission:
        return {'type': None, 'sous_type': None, 'est_conventionnelle': False}
    
    # Vérifier si conventionnelle
    perm_conv = db.query(PermConventionelle).filter(
        PermConventionelle.id_perm_c == id_operation
    ).first()
    
    if perm_conv:
        # Déterminer le sous-type
        if db.query(PermMaternelle).filter(PermMaternelle.id_perm_mat == id_operation).first():
            return {'type': 'permission', 'sous_type': 'maternelle', 'est_conventionnelle': True}
        elif db.query(PermDeces).filter(PermDeces.id_perm_dec == id_operation).first():
            return {'type': 'permission', 'sous_type': 'deces', 'est_conventionnelle': True}
        elif db.query(PermMaladie).filter(PermMaladie.id_perm_mal == id_operation).first():
            return {'type': 'permission', 'sous_type': 'maladie', 'est_conventionnelle': True}
        elif db.query(PermBapteme).filter(PermBapteme.id_perm_bap == id_operation).first():
            return {'type': 'permission', 'sous_type': 'bapteme', 'est_conventionnelle': True}
        elif db.query(PermMariage).filter(PermMariage.id_perm_mar == id_operation).first():
            return {'type': 'permission', 'sous_type': 'mariage', 'est_conventionnelle': True}
        else:
            return {'type': 'permission', 'sous_type': 'conventionnelle', 'est_conventionnelle': True}
    
    # Vérifier si non conventionnelle
    perm_non_conv = db.query(PermNonConventionelle).filter(
        PermNonConventionelle.id_perm_nc == id_operation
    ).first()
    
    if perm_non_conv:
        return {'type': 'permission', 'sous_type': 'non_conventionnelle', 'est_conventionnelle': False}
    
    return {'type': 'permission', 'sous_type': None, 'est_conventionnelle': None}


def envoyer_rappel_preuves_permission(id_operation: int, db: Session):
    """
    Envoie un rappel pour téléverser les preuves d'une permission.
    
    Args:
        id_operation: ID de l'opération
        db: Session de base de données
    """
    operation = db.query(Operation).filter(Operation.id_operation == id_operation).first()
    perm_conv = db.query(PermConventionelle).filter(
        PermConventionelle.id_perm_c == id_operation
    ).first()
    
    if not operation or not perm_conv or perm_conv.preuves_televersees:
        return
    
    jours_restants = (perm_conv.date_limite_preuves - date.today()).days
    
    if jours_restants <= 10:  # Rappel si moins de 10 jours restants
        notification = Notification(
            matricule=operation.matricule,
            type_notification=TypeNotificationEnum.AUTRE,
            titre=f"Rappel: Preuves permission à téléverser",
            message=f"Il vous reste {jours_restants} jours pour téléverser les preuves justificatives "
                   f"de votre permission. Date limite: {perm_conv.date_limite_preuves}"
        )
        db.add(notification)
        db.commit()
        
        # TODO: Envoyer email
