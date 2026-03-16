"""
Système de gestion des fiches de poste et évaluations
"""
from datetime import datetime, date
from typing import Dict, List, Optional, Tuple
from decimal import Decimal
from sqlalchemy.orm import Session
from ..models import (
    Employe, FicheDePoste, Evaluation, PeriodeEvaluation,
    StatutEvaluationEnum, Notification, TypeNotificationEnum
)
import json


def creer_fiche_de_poste(
    matricule: int,
    objectifs: List[Dict],
    cree_par: int,
    db: Session
) -> Tuple[bool, str, Optional[int]]:
    """
    Crée une fiche de poste pour un employé (généralement par le RH).
    
    Les objectifs doivent être une liste de dictionnaires avec:
    - titre: titre de l'objectif
    - description: description détaillée
    - poids: poids dans l'évaluation (en %)
    - indicateurs: liste des indicateurs de mesure
    
    Args:
        matricule: Matricule de l'employé
        objectifs: Liste des objectifs à atteindre
        cree_par: Matricule de celui qui crée la fiche (RH)
        db: Session de base de données
    
    Returns:
        Tuple (succès, message, id_fiche)
    """
    employe = db.query(Employe).filter(Employe.matricule == matricule).first()
    
    if not employe:
        return False, "Employé introuvable", None
    
    # Vérifier la somme des poids
    poids_total = sum(obj.get('poids', 0) for obj in objectifs)
    if poids_total != 100:
        return False, f"La somme des poids doit être 100% (actuellement: {poids_total}%)", None
    
    fiche = FicheDePoste(
        matricule=matricule,
        objectifs=json.dumps(objectifs),
        cree_par=cree_par,
        date_creation=datetime.now()
    )
    
    db.add(fiche)
    db.commit()
    db.refresh(fiche)
    
    # Notifier l'employé
    notification = Notification(
        matricule=matricule,
        type_notification=TypeNotificationEnum.AUTRE,
        titre="Fiche de poste créée",
        message="Votre fiche de poste a été créée. Vous pouvez la consulter dans votre profil."
    )
    db.add(notification)
    db.commit()
    
    return True, "Fiche de poste créée avec succès", fiche.id_fiche


def creer_periode_evaluation(
    date_debut: date,
    date_fin: date,
    cree_par: int,
    db: Session
) -> Tuple[bool, str, Optional[int]]:
    """
    Crée une période d'évaluation (par le RH).
    
    Args:
        date_debut: Date de début de la période d'évaluation
        date_fin: Date de fin de la période d'évaluation
        cree_par: Matricule du RH qui crée la période
        db: Session de base de données
    
    Returns:
        Tuple (succès, message, id_periode)
    """
    if date_debut >= date_fin:
        return False, "La date de début doit être antérieure à la date de fin", None
    
    periode = PeriodeEvaluation(
        date_debut=date_debut,
        date_fin=date_fin,
        cree_par=cree_par
    )
    
    db.add(periode)
    db.commit()
    db.refresh(periode)
    
    # Créer les évaluations pour tous les employés avec une fiche de poste
    employes_avec_fiche = db.query(FicheDePoste).all()
    
    for fiche in employes_avec_fiche:
        evaluation = Evaluation(
            id_fiche=fiche.id_fiche,
            id_periode=periode.id_periode,
            matricule=fiche.matricule,
            statut=StatutEvaluationEnum.EN_ATTENTE_AUTO_EVAL
        )
        db.add(evaluation)
        
        # Notifier l'employé
        notification = Notification(
            matricule=fiche.matricule,
            type_notification=TypeNotificationEnum.EVALUATION,
            titre="Auto-évaluation requise",
            message=f"La période d'évaluation est ouverte du {date_debut} au {date_fin}. "
                   f"Veuillez effectuer votre auto-évaluation."
        )
        db.add(notification)
    
    db.commit()
    
    return True, f"Période d'évaluation créée. {len(employes_avec_fiche)} employés notifiés.", periode.id_periode


def soumettre_auto_evaluation(
    id_evaluation: int,
    matricule: int,
    reponses: List[Dict],
    db: Session
) -> Tuple[bool, str]:
    """
    Soumet l'auto-évaluation d'un employé.
    
    Les réponses doivent correspondre aux objectifs de la fiche de poste.
    Format: [{'objectif_id': 0, 'note': 18, 'commentaire': '...'}]
    
    Args:
        id_evaluation: ID de l'évaluation
        matricule: Matricule de l'employé
        reponses: Liste des réponses d'auto-évaluation
        db: Session de base de données
    
    Returns:
        Tuple (succès, message)
    """
    evaluation = db.query(Evaluation).filter(Evaluation.id_eval == id_evaluation).first()
    
    if not evaluation:
        return False, "Évaluation introuvable"
    
    if evaluation.matricule != matricule:
        return False, "Vous n'êtes pas autorisé à modifier cette évaluation"
    
    if evaluation.statut != StatutEvaluationEnum.EN_ATTENTE_AUTO_EVAL:
        return False, "Auto-évaluation déjà effectuée"
    
    # Vérifier que toutes les notes sont entre 0 et 20
    for reponse in reponses:
        note = reponse.get('note', 0)
        if not (0 <= note <= 20):
            return False, f"Les notes doivent être entre 0 et 20 (note: {note} invalide)"
    
    evaluation.auto_evaluation = json.dumps(reponses)
    evaluation.statut = StatutEvaluationEnum.EN_COURS
    db.commit()
    
    # Notifier le N+1 pour évaluation
    employe = db.query(Employe).filter(Employe.matricule == matricule).first()
    if employe and employe.n1:
        notification = Notification(
            matricule=employe.n1,
            type_notification=TypeNotificationEnum.EVALUATION,
            titre=f"Évaluation en attente: {employe.nom} {employe.prenom}",
            message=f"L'employé {employe.matricule} a effectué son auto-évaluation. "
                   f"Votre évaluation est attendue."
        )
        db.add(notification)
        db.commit()
    
    return True, "Auto-évaluation soumise avec succès"


def soumettre_evaluation_hierarchique(
    id_evaluation: int,
    evaluateur_matricule: int,
    evaluateur_role: str,
    notes: List[Dict],
    commentaire_general: Optional[str],
    db: Session
) -> Tuple[bool, str]:
    """
    Soumet l'évaluation d'un supérieur hiérarchique.
    
    Args:
        id_evaluation: ID de l'évaluation
        evaluateur_matricule: Matricule de l'évaluateur
        evaluateur_role: Rôle de l'évaluateur (RESPONSABLE, DIRECTEUR, RH, DG)
        notes: Liste des notes par objectif
        commentaire_general: Commentaire général sur l'évaluation
        db: Session de base de données
    
    Returns:
        Tuple (succès, message)
    """
    evaluation = db.query(Evaluation).filter(Evaluation.id_eval == id_evaluation).first()
    
    if not evaluation:
        return False, "Évaluation introuvable"
    
    if evaluation.statut == StatutEvaluationEnum.EN_ATTENTE_AUTO_EVAL:
        return False, "L'employé doit d'abord effectuer son auto-évaluation"
    
    # Charger les évaluations existantes
    evaluations_existantes = json.loads(evaluation.evaluations) if evaluation.evaluations else {}
    
    # Ajouter la nouvelle évaluation
    evaluations_existantes[evaluateur_role.lower()] = {
        'matricule': evaluateur_matricule,
        'notes': notes,
        'commentaire': commentaire_general,
        'date': datetime.now().isoformat()
    }
    
    evaluation.evaluations = json.dumps(evaluations_existantes)
    
    # Déterminer si c'est la dernière évaluation attendue
    # Ordre: RESPONSABLE → DIRECTEUR → RH → DG
    roles_requis = ['responsable', 'directeur', 'rh', 'dg']
    evaluations_completees = set(evaluations_existantes.keys())
    
    if evaluations_completees.issuperset(roles_requis):
        # Toutes les évaluations sont faites, calculer la note finale
        note_finale = calculer_note_finale(evaluation, db)
        evaluation.note_finale = note_finale
        evaluation.statut = StatutEvaluationEnum.TERMINE
        evaluation.date_finalisation = datetime.now()
        
        # Notifier l'employé
        notification = Notification(
            matricule=evaluation.matricule,
            type_notification=TypeNotificationEnum.EVALUATION,
            titre="Évaluation finalisée",
            message=f"Votre évaluation est terminée. Note finale: {note_finale}/100"
        )
        db.add(notification)
    else:
        # Déterminer le prochain évaluateur
        prochain_role = None
        for role in roles_requis:
            if role not in evaluations_completees:
                prochain_role = role
                break
        
        if prochain_role:
            # Notifier le prochain évaluateur
            # (logique à adapter selon la structure hiérarchique)
            pass
    
    db.commit()
    
    return True, "Évaluation soumise avec succès"


def calculer_note_finale(evaluation: Evaluation, db: Session) -> Decimal:
    """
    Calcule la note finale d'une évaluation avec pondération.
    
    Pondération:
    - Auto-évaluation: 10%
    - Responsable: 25%
    - Directeur: 25%
    - RH: 20%
    - DG: 20%
    
    Args:
        evaluation: Instance de l'évaluation
        db: Session de base de données
    
    Returns:
        Note finale sur 100
    """
    ponderations = {
        'auto_evaluation': Decimal('0.10'),
        'responsable': Decimal('0.25'),
        'directeur': Decimal('0.25'),
        'rh': Decimal('0.20'),
        'dg': Decimal('0.20')
    }
    
    note_totale = Decimal('0')
    poids_utilise = Decimal('0')
    
    # Récupérer la fiche de poste pour les poids des objectifs
    fiche = db.query(FicheDePoste).filter(FicheDePoste.id_fiche == evaluation.id_fiche).first()
    objectifs = json.loads(fiche.objectifs) if fiche else []
    
    # Auto-évaluation
    if evaluation.auto_evaluation:
        auto_eval = json.loads(evaluation.auto_evaluation)
        note_auto = calculer_note_moyenne(auto_eval, objectifs)
        note_totale += note_auto * ponderations['auto_evaluation']
        poids_utilise += ponderations['auto_evaluation']
    
    # Évaluations hiérarchiques
    if evaluation.evaluations:
        evals_hier = json.loads(evaluation.evaluations)
        
        for role, ponderation in ponderations.items():
            if role != 'auto_evaluation' and role in evals_hier:
                notes = evals_hier[role].get('notes', [])
                note_moyenne = calculer_note_moyenne(notes, objectifs)
                note_totale += note_moyenne * ponderation
                poids_utilise += ponderation
    
    # Normaliser sur 100
    if poids_utilise > 0:
        return (note_totale / poids_utilise) * Decimal('5')  # Conversion 20 → 100
    
    return Decimal('0')


def calculer_note_moyenne(notes: List[Dict], objectifs: List[Dict]) -> Decimal:
    """
    Calcule la note moyenne pondérée selon les objectifs.
    
    Args:
        notes: Liste des notes données
        objectifs: Liste des objectifs avec leurs poids
    
    Returns:
        Note moyenne pondérée sur 20
    """
    note_totale = Decimal('0')
    
    for i, note_item in enumerate(notes):
        note = Decimal(str(note_item.get('note', 0)))
        poids = Decimal(str(objectifs[i].get('poids', 0))) / Decimal('100')
        note_totale += note * poids
    
    return note_totale


def obtenir_evaluation_complete(id_evaluation: int, db: Session) -> Optional[Dict]:
    """
    Récupère une évaluation complète avec toutes les informations.
    
    Args:
        id_evaluation: ID de l'évaluation
        db: Session de base de données
    
    Returns:
        Dictionnaire avec tous les détails de l'évaluation
    """
    evaluation = db.query(Evaluation).filter(Evaluation.id_eval == id_evaluation).first()
    
    if not evaluation:
        return None
    
    fiche = db.query(FicheDePoste).filter(FicheDePoste.id_fiche == evaluation.id_fiche).first()
    periode = db.query(PeriodeEvaluation).filter(
        PeriodeEvaluation.id_periode == evaluation.id_periode
    ).first()
    employe = db.query(Employe).filter(Employe.matricule == evaluation.matricule).first()
    
    return {
        'id_eval': evaluation.id_eval,
        'employe': {
            'matricule': employe.matricule,
            'nom': employe.nom,
            'prenom': employe.prenom,
            'fonction': employe.fonction
        } if employe else None,
        'periode': {
            'date_debut': periode.date_debut.isoformat() if periode else None,
            'date_fin': periode.date_fin.isoformat() if periode else None
        } if periode else None,
        'objectifs': json.loads(fiche.objectifs) if fiche and fiche.objectifs else [],
        'auto_evaluation': json.loads(evaluation.auto_evaluation) if evaluation.auto_evaluation else None,
        'evaluations': json.loads(evaluation.evaluations) if evaluation.evaluations else {},
        'note_finale': float(evaluation.note_finale) if evaluation.note_finale else None,
        'statut': evaluation.statut.value if evaluation.statut else None,
        'date_creation': evaluation.date_creation.isoformat() if evaluation.date_creation else None,
        'date_finalisation': evaluation.date_finalisation.isoformat() if evaluation.date_finalisation else None
    }


def obtenir_fiches_de_poste_employe(matricule: int, db: Session) -> List[Dict]:
    """
    Récupère toutes les fiches de poste d'un employé.
    
    Args:
        matricule: Matricule de l'employé
        db: Session de base de données
    
    Returns:
        Liste des fiches de poste
    """
    fiches = db.query(FicheDePoste).filter(FicheDePoste.matricule == matricule).all()
    
    return [
        {
            'id_fiche': fiche.id_fiche,
            'objectifs': json.loads(fiche.objectifs) if fiche.objectifs else [],
            'date_creation': fiche.date_creation.isoformat() if fiche.date_creation else None
        }
        for fiche in fiches
    ]
