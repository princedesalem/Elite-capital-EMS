"""
Logique métier pour le système EMS
Gestion des congés, permissions, missions et évaluations
"""
from datetime import datetime, timedelta, date
from decimal import Decimal
from typing import Tuple, Dict, List
from sqlalchemy.orm import Session
from ..models import Employe, Operation, Notification, DemandeExplication, TypeNotificationEnum


def calculer_jours_ouvrables(date_debut: date, date_fin: date, exclure_vendredi_samedi: bool = True) -> int:
    """
    Calcule le nombre de jours ouvrables entre deux dates.
    Exclut les jours non ouvrables (samedi et dimanche) par défaut.
    
    Args:
        date_debut: Date de début
        date_fin: Date de fin (incluse)
        exclure_vendredi_samedi: Si True, exclut samedi (5) et dimanche (6)
    
    Returns:
        Nombre de jours ouvrables
    """
    if date_debut > date_fin:
        return 0
    
    jours = 0
    current_date = date_debut
    
    while current_date <= date_fin:
        # weekday(): Lundi=0 ... Samedi=5, Dimanche=6
        if exclure_vendredi_samedi:
            if current_date.weekday() not in [5, 6]:  # Exclure samedi et dimanche
                jours += 1
        else:
            jours += 1
        
        current_date += timedelta(days=1)
    
    return jours


def verifier_eligibilite_conges(employe: Employe) -> Tuple[bool, str]:
    """
    Vérifie si un employé est éligible pour prendre des congés.
    Règle: Doit avoir au moins 1 an d'ancienneté (depuis date_embauche)
    
    Args:
        employe: Instance de l'employé
    
    Returns:
        Tuple (eligibilité, message)
    """
    if not employe.date_embauche:
        return False, "Date d'embauche non renseignée"
    
    today = date.today()
    anciennete_jours = (today - employe.date_embauche).days
    anciennete_annees = anciennete_jours / 365.25
    
    if anciennete_annees < 1:
        jours_restants = int(365.25 - anciennete_jours)
        return False, f"Ancienneté insuffisante. Eligibilité dans {jours_restants} jours (après 1 an)"
    
    return True, "Eligibilité confirmée"


def verifier_solde_conges(employe: Employe, duree_demandee: int) -> Tuple[bool, str, Decimal]:
    """
    Vérifie si le solde de congés est suffisant pour la durée demandée.
    
    Args:
        employe: Instance de l'employé
        duree_demandee: Nombre de jours demandés
    
    Returns:
        Tuple (solde_suffisant, message, solde_actuel)
    """
    solde_actuel = Decimal(employe.solde_conges) if employe.solde_conges else Decimal(0)
    duree_decimal = Decimal(duree_demandee)
    
    if solde_actuel < duree_decimal:
        deficit = duree_decimal - solde_actuel
        return False, f"Solde insuffisant. Manque: {deficit} jour(s). Solde actuel: {solde_actuel} jour(s)", solde_actuel
    
    return True, f"Solde suffisant. Solde actuel: {solde_actuel} jour(s)", solde_actuel


def calculer_augmentation_solde_mensuel(employe: Employe, db: Session) -> Decimal:
    """
    Calcule et applique l'augmentation mensuelle du solde de congés.
    Règle: +2 jours par mois travaillé
    
    Args:
        employe: Instance de l'employé
        db: Session de base de données
    
    Returns:
        Nouveau solde après augmentation
    """
    JOURS_PAR_MOIS = Decimal('2.0')
    
    # Si aucune date de dernière mise à jour, utiliser la date d'embauche
    date_derniere_maj = employe.date_derniere_maj_solde or employe.date_embauche
    
    if not date_derniere_maj:
        return employe.solde_conges or Decimal(0)
    
    today = date.today()
    
    # Calculer le nombre de mois écoulés
    mois_ecoules = (today.year - date_derniere_maj.year) * 12 + (today.month - date_derniere_maj.month)
    
    if mois_ecoules > 0:
        augmentation = JOURS_PAR_MOIS * mois_ecoules
        nouveau_solde = (employe.solde_conges or Decimal(0)) + augmentation
        
        # Mettre à jour l'employé
        employe.solde_conges = nouveau_solde
        employe.date_derniere_maj_solde = today
        db.commit()
        
        return nouveau_solde
    
    return employe.solde_conges or Decimal(0)


def renouveler_solde_annuel(employe: Employe, db: Session) -> Tuple[Decimal, str]:
    """
    Renouvelle le solde de congés annuel selon la date d'embauche.
    Règle: Le solde se renouvelle chaque année à la date anniversaire d'embauche.
    Solde annuel standard: 24 jours (2 jours × 12 mois)
    
    Args:
        employe: Instance de l'employé
        db: Session de base de données
    
    Returns:
        Tuple (nouveau_solde, message)
    """
    SOLDE_ANNUEL = Decimal('24.0')
    
    if not employe.date_embauche:
        return employe.solde_conges or Decimal(0), "Date d'embauche non renseignée"
    
    today = date.today()
    date_anniversaire = employe.date_embauche.replace(year=today.year)
    
    # Si la date anniversaire est passée cette année et que le solde n'a pas été renouvelé
    if today >= date_anniversaire:
        # Vérifier si le renouvellement a déjà été fait cette année
        date_derniere_maj = employe.date_derniere_maj_solde or employe.date_embauche
        
        if date_derniere_maj.year < today.year or \
           (date_derniere_maj.year == today.year and date_derniere_maj < date_anniversaire):
            
            # Réinitialiser le solde
            ancien_solde = employe.solde_conges or Decimal(0)
            employe.solde_conges = SOLDE_ANNUEL
            employe.date_derniere_maj_solde = today
            db.commit()
            
            return SOLDE_ANNUEL, f"Solde renouvelé de {ancien_solde} à {SOLDE_ANNUEL} jours"
    
    return employe.solde_conges or Decimal(0), "Pas de renouvellement nécessaire"


def deduire_solde_conges(employe: Employe, duree: int, db: Session) -> Decimal:
    """
    Déduit un nombre de jours du solde de congés de l'employé.
    
    Args:
        employe: Instance de l'employé
        duree: Nombre de jours à déduire
        db: Session de base de données
    
    Returns:
        Nouveau solde après déduction
    """
    solde_actuel = employe.solde_conges or Decimal(0)
    nouveau_solde = solde_actuel - Decimal(duree)
    
    employe.solde_conges = nouveau_solde
    db.commit()
    
    # Si le solde devient négatif, créer une demande d'explication
    if nouveau_solde < 0:
        creer_demande_explication_solde_negatif(employe, nouveau_solde, db)
    
    return nouveau_solde


def rajouter_solde_conges(employe: Employe, duree: int, db: Session) -> Decimal:
    """
    Rajoute des jours au solde de congés (ex: en cas de retour anticipé).
    
    Args:
        employe: Instance de l'employé
        duree: Nombre de jours à rajouter
        db: Session de base de données
    
    Returns:
        Nouveau solde après ajout
    """
    solde_actuel = employe.solde_conges or Decimal(0)
    nouveau_solde = solde_actuel + Decimal(duree)
    
    employe.solde_conges = nouveau_solde
    db.commit()
    
    return nouveau_solde


def creer_demande_explication_solde_negatif(employe: Employe, solde_negatif: Decimal, db: Session):
    """
    Crée une demande d'explication lorsque le solde de l'employé devient négatif.
    Envoie également une notification par email.
    
    Args:
        employe: Instance de l'employé
        solde_negatif: Valeur du solde négatif
        db: Session de base de données
    """
    from ..models import DemandeExplication, StatutExplicationEnum
    
    motif = f"Solde de congés négatif: {solde_negatif} jour(s). " \
            f"Veuillez fournir une explication pour cette situation."
    
    demande = DemandeExplication(
        matricule=employe.matricule,
        motif=motif,
        statut=StatutExplicationEnum.EN_ATTENTE
    )
    
    db.add(demande)
    db.commit()
    
    # Créer une notification
    notification = Notification(
        matricule=employe.matricule,
        type_notification=TypeNotificationEnum.DEMANDE_EXPLICATION,
        titre="Demande d'explication - Solde négatif",
        message=motif
    )
    db.add(notification)
    db.commit()
    
    # TODO: Envoyer email
    # envoyer_email_demande_explication(employe.email, motif)


def calculer_periode_operation(date_debut: date, date_fin: date) -> Dict:
    """
    Calcule différentes métriques pour une période d'opération.
    
    Args:
        date_debut: Date de début
        date_fin: Date de fin
    
    Returns:
        Dictionnaire avec les informations de période
    """
    jours_calendaires = (date_fin - date_debut).days + 1
    jours_ouvrables = calculer_jours_ouvrables(date_debut, date_fin)
    
    return {
        'date_debut': date_debut,
        'date_fin': date_fin,
        'jours_calendaires': jours_calendaires,
        'jours_ouvrables': jours_ouvrables,
        'duree': jours_ouvrables
    }


def verifier_chevauchement_operations(employe: Employe, date_debut: date, date_fin: date, 
                                      db: Session, operation_id: int = None) -> Tuple[bool, str]:
    """
    Vérifie si les dates d'une opération chevauchent avec d'autres opérations existantes.
    
    Args:
        employe: Instance de l'employé
        date_debut: Date de début de la nouvelle opération
        date_fin: Date de fin de la nouvelle opération
        db: Session de base de données
        operation_id: ID de l'opération (pour exclure lors d'une modification)
    
    Returns:
        Tuple (chevauchement_trouve, message)
    """
    operations = db.query(Operation).filter(
        Operation.matricule == employe.matricule,
        ~Operation.statut.in_(['refusé', 'rejeté', 'annulé'])
    )
    
    if operation_id:
        operations = operations.filter(Operation.id_operation != operation_id)
    
    for op in operations:
        op_date_debut = op.date_debut or op.date_depart
        op_date_fin = op.date_fin or op.date_retour

        if not op_date_debut or not op_date_fin:
            continue

        # Vérifier si les dates se chevauchent
        if not (date_fin < op_date_debut or date_debut > op_date_fin):
            type_operation = op.type_demande or op.titre or "opération"
            type_lower = type_operation.lower()
            _articles = {
                'congé': 'un', 'conge': 'un',
                'frais de mission': 'des', 'frais': 'des',
            }
            article = _articles.get(type_lower, 'une')
            return True, (
                f"Impossible : {article} {type_lower} est déjà en cours sur cette période "
                f"(opération #{op.id_operation} du {op_date_debut.strftime('%d/%m/%Y')} "
                f"au {op_date_fin.strftime('%d/%m/%Y')}). "
                "Veuillez choisir d'autres dates ou annuler l'opération existante."
            )
    
    return False, "Aucun chevauchement détecté"


def calculer_note_finale_evaluation(evaluations: Dict) -> Decimal:
    """
    Calcule la note finale d'une évaluation avec pondération.
    
    Pondération:
    - Auto-évaluation: 10%
    - Responsable (N+1): 25%
    - Directeur: 25%
    - RH: 20%
    - DG: 20%
    
    Args:
        evaluations: Dictionnaire JSON contenant toutes les évaluations
    
    Returns:
        Note finale pondérée
    """
    ponderations = {
        'auto_evaluation': Decimal('0.10'),
        'responsable': Decimal('0.25'),
        'directeur': Decimal('0.25'),
        'rh': Decimal('0.20'),
        'dg': Decimal('0.20')
    }
    
    note_totale = Decimal('0')
    poids_total = Decimal('0')
    
    for role, ponderation in ponderations.items():
        if role in evaluations and evaluations[role].get('note'):
            note = Decimal(str(evaluations[role]['note']))
            note_totale += note * ponderation
            poids_total += ponderation
    
    if poids_total > 0:
        return note_totale / poids_total * Decimal('100') / Decimal('20')  # Normaliser sur 100
    
    return Decimal('0')
