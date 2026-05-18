"""
Système de workflow de validation avec règles hiérarchiques
"""
from typing import List, Optional, Tuple
from sqlalchemy.orm import Session
from ..models import (
    Employe, Operation, Departement, Direction, Validation,
    Utilisateur, Role, Frais, Notification, TypeNotificationEnum
)
from datetime import datetime


def _normaliser_role(role_name: Optional[str]) -> str:
    role = (role_name or '').strip().upper()
    if role in {'ADMIN', 'ADMINISTRATEUR'}:
        return 'ADMIN'
    if role in {'EMPLOYE', 'EMPLOYE'}:
        return 'EMPLOYE'
    return role


def _doit_deduire_solde(operation: Operation, db: Session) -> bool:
    type_demande = str(operation.type_demande or '').strip().lower()

    if type_demande == 'conge' or type_demande == 'congé':
        return True

    if type_demande != 'permission':
        return False

    from .permissions import obtenir_type_permission

    type_info = obtenir_type_permission(operation.id_operation, db)
    return type_info.get('est_conventionnelle') is False


def determiner_sequence_validation(
    employe: Employe,
    db: Session,
    id_operation: Optional[int] = None
) -> List[str]:
    """Détermine la séquence de validation hiérarchique d'une demande."""
    sequence: List[str] = []
    role_demandeur = obtenir_role_validateur(employe.matricule, db)

    a_des_frais = False
    if id_operation is not None:
        a_des_frais = db.query(Frais).filter(Frais.id_operation == id_operation).first() is not None

    dernier_validateur = 'PCA'
    is_ecg = False
    if employe.id_entite:
        from ..models import Entite

        entite = db.query(Entite).filter(Entite.id_entite == employe.id_entite).first()
        if entite and entite.nom == 'ECG':
            is_ecg = True
            dernier_validateur = 'AG'

    # Court-circuit : Assistante Administrateur Général → seul le terminal valide
    if 'assistante administrateur' in (employe.fonction or '').lower():
        return [dernier_validateur]

    def _dept_rh_shortcut_active() -> bool:
        if not employe.dept_id:
            return False
        dept = db.query(Departement).filter(Departement.dept_id == employe.dept_id).first()
        if not dept or not dept.id_responsable:
            return False

        # Shortcut only for RH department employees.
        dept_name = str(dept.nom or '').strip().lower()
        if ('rh' not in dept_name) and ('ressource' not in dept_name) and ('resource' not in dept_name):
            return False

        role_resp = obtenir_role_validateur(dept.id_responsable, db)
        return role_resp == 'RH'

    rh_shortcut = _dept_rh_shortcut_active()

    def append_role(role_name: Optional[str]):
        role_normalise = (role_name or '').strip().upper()
        if not role_normalise:
            return
        if role_normalise in sequence:
            return
        sequence.append(role_normalise)

    if role_demandeur in {'AG', 'PCA'}:
        return []

    if role_demandeur == 'DG':
        append_role('RH')
        append_role(dernier_validateur)
    elif role_demandeur == 'RH':
        if is_ecg:
            # Règle métier : toute demande avec frais passe par DFC puis DG
            # (la DG valide après le DFC) avant le PCA/AG, quelle que soit
            # l'entité (y compris ECG).
            if a_des_frais:
                append_role('DFC')
                append_role('DG')
            append_role(dernier_validateur)
        else:
            if a_des_frais:
                append_role('DFC')
            append_role('DG')
            append_role(dernier_validateur)
    elif role_demandeur == 'DIRECTEUR':
        # Règle métier : quand un DIRECTEUR fait une demande, la DG doit figurer
        # dans le workflow quelle que soit l'entité (y compris ECG). Tous les DG
        # de l'application devront valider avant passage au PCA/AG.
        # Si la demande comporte des frais, le DFC valide avant la DG.
        append_role('RH')
        if a_des_frais:
            append_role('DFC')
        append_role('DG')
        append_role(dernier_validateur)
    elif role_demandeur == 'RESPONSABLE':
        # Règle métier : un RESPONSABLE qui fait une demande ne passe pas par un
        # DIRECTEUR. Il va RH → (DFC?) → DG → PCA/AG, DG obligatoire quelle
        # que soit l'entité (y compris ECG). Si frais, DFC valide avant la DG.
        append_role('RH')
        if a_des_frais:
            append_role('DFC')
        append_role('DG')
        append_role(dernier_validateur)
    else:
        departement = None
        if employe.dept_id:
            departement = db.query(Departement).filter(
                Departement.dept_id == employe.dept_id
            ).first()

        if departement and departement.id_direction:
            append_role('DIRECTEUR')
            append_role('RH')
        else:
            # Département sans direction rattachée (ou employé sans département)
            # → c'est le RESPONSABLE du département qui valide, pas un directeur.
            # On ignore volontairement employe.id_direction ici : la règle métier
            # impose que seul le rattachement département→direction définit si
            # un DIRECTEUR doit intervenir dans la séquence.
            if rh_shortcut:
                # One RH validation should satisfy both RESPONSABLE + RH for RH dept special case.
                append_role('RH')
            else:
                append_role('RESPONSABLE')
                append_role('RH')

        if is_ecg:
            # Règle métier : toute demande de frais d'un employé (quelle
            # que soit l'entité, ECG incluse) passe par DFC puis DG avant
            # le PCA/AG. Sans frais, le workflow ECG historique (sans DG
            # ni DFC) est conservé.
            if a_des_frais:
                append_role('DFC')
                append_role('DG')
            append_role(dernier_validateur)
        else:
            if a_des_frais:
                append_role('DFC')
            append_role('DG')
            append_role(dernier_validateur)

    # Règle fonction : les employés dont la fonction contient "responsable" ou
    # "directeur" (quelle que soit la casse) doivent toujours avoir la DG dans
    # leur chaîne de validation — couvre congés, permissions, missions et frais
    # de mission, même sans frais sur l'opération.
    # Exception ECG : les demandes de sortie (type_demande == 'Sortie') pour les
    # employés ECG ne passent pas par la DG, conformément au workflow ECG historique.
    _fonction = (employe.fonction or '').lower()
    if ('responsable' in _fonction or 'directeur' in _fonction) and 'DG' not in sequence:
        _exclure_dg = False
        if is_ecg and id_operation is not None:
            _op = db.query(Operation).filter(
                Operation.id_operation == id_operation
            ).first()
            if _op and str(_op.type_demande or '').strip().lower() == 'sortie':
                _exclure_dg = True
        if not _exclure_dg:
            if dernier_validateur in sequence:
                sequence.insert(sequence.index(dernier_validateur), 'DG')
            else:
                sequence.append('DG')

    role_demandeur_normalise = _normaliser_role(role_demandeur)
    return [role for role in sequence if _normaliser_role(role) != role_demandeur_normalise]


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
        # Chercher le directeur de la direction.
        # PRIORITÉ 1 : direction du département de l'employé (structure org. officielle).
        # Garantit qu'un employé du département "Projets" rattaché à la Direction
        # "Organisation et Projet" va au directeur de CETTE direction, et non au
        # directeur de l'Audit (même si employe.id_direction est incohérent/stale).
        direction_id = None

        if employe.dept_id:
            departement = db.query(Departement).filter(
                Departement.dept_id == employe.dept_id
            ).first()
            if departement and departement.id_direction:
                direction_id = departement.id_direction

        # PRIORITÉ 2 : id_direction direct de l'employé (fallback uniquement si pas
        # de département ou département sans direction rattachée).
        if not direction_id:
            direction_id = employe.id_direction

        if direction_id:
            direction = db.query(Direction).filter(
                Direction.id_direction == direction_id
            ).first()

            if direction and direction.id_directeur:
                return direction.id_directeur

        # PRIORITÉ 3 : si la direction n'a pas d'id_directeur configuré,
        # essayer le N+1 de l'employé s'il a lui-même le rôle DIRECTEUR.
        # Garantit qu'un employé rattaché hiérarchiquement à son directeur via
        # n1 va bien voir ses demandes routées vers ce directeur, même quand
        # DIRECTION.id_directeur n'a pas encore été renseigné.
        if employe.n1:
            n1_role = obtenir_role_validateur(employe.n1, db)
            if n1_role == 'DIRECTEUR':
                return employe.n1

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
    
    elif role == 'DFC':
        # Priorité 1 : trouver par fonction (source de vérité, pas par rôle assigné)
        # même entité d'abord
        if employe.id_entite:
            emp_dfc = db.query(Employe).join(
                Utilisateur, Utilisateur.matricule == Employe.matricule
            ).filter(
                Employe.fonction.ilike('%directeur financier%'),
                Employe.id_entite == employe.id_entite
            ).first()
            if emp_dfc:
                return emp_dfc.matricule
        # toutes entités
        emp_dfc = db.query(Employe).join(
            Utilisateur, Utilisateur.matricule == Employe.matricule
        ).filter(
            Employe.fonction.ilike('%directeur financier%')
        ).first()
        if emp_dfc:
            return emp_dfc.matricule
        # Fallback compatibilité descendante : chercher via role_id
        role_obj = db.query(Role).filter(Role.name == 'DFC').first()
        if role_obj:
            u = db.query(Utilisateur).filter(Utilisateur.role_id == role_obj.id).first()
            if u:
                return u.matricule
            emp_v = db.query(Employe).filter(Employe.id_role == role_obj.id).first()
            if emp_v:
                return emp_v.matricule

    elif role in ['RH', 'DG', 'PCA', 'AG']:
        # PCA et AG sont interchangeables : un seul rôle terminal existe généralement
        roles_candidats = [role]
        if role == 'AG':
            roles_candidats.append('PCA')
        elif role == 'PCA':
            roles_candidats.append('AG')

        for role_candidat in roles_candidats:
            role_obj = db.query(Role).filter(Role.name == role_candidat).first()
            if not role_obj:
                continue

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

            # Fallback via Employe.id_role
            if employe.id_entite:
                emp_v = db.query(Employe).filter(
                    Employe.id_role == role_obj.id,
                    Employe.id_entite == employe.id_entite
                ).first()
                if emp_v:
                    return emp_v.matricule
            emp_v = db.query(Employe).filter(Employe.id_role == role_obj.id).first()
            if emp_v:
                return emp_v.matricule
    
    return None


def obtenir_tous_matricules_dg(db: Session) -> List[str]:
    """
    Retourne la liste ordonnée (par matricule) des matricules ayant le rôle DG,
    toutes entités confondues. Règle métier : lorsque plusieurs DG existent, ils
    doivent tous valider avant passage au PCA/AG.

    On regarde à la fois Utilisateur.role_id et Employe.id_role pour être robuste
    aux variations de seed.
    """
    role_dg = db.query(Role).filter(Role.name == 'DG').first()
    if not role_dg:
        return []

    matricules: set = set()

    # Via Utilisateur.role_id
    users = db.query(Utilisateur).filter(Utilisateur.role_id == role_dg.id).all()
    for u in users:
        if u.matricule is not None:
            matricules.add(u.matricule)

    # Via Employe.id_role (fallback robuste)
    emps = db.query(Employe).filter(Employe.id_role == role_dg.id).all()
    for e in emps:
        if e.matricule is not None:
            matricules.add(e.matricule)

    return sorted(matricules)


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

    # Opération déjà terminée → plus de validateur attendu
    if (operation.statut or '').lower() in ('refusé', 'validé', 'annulé', 'refuse', 'valide', 'annule'):
        return None, None
    
    employe = db.query(Employe).filter(Employe.matricule == operation.matricule).first()
    
    if not employe:
        return None, None
    
    # Obtenir la séquence complète (avec vérification des frais)
    sequence = determiner_sequence_validation(employe, db, id_operation)
    
    # Obtenir les validations déjà effectuées (par rôle et matricule)
    validations = db.query(Validation).filter(
        Validation.id_operation == id_operation,
        Validation.statut_validation == 'validé'
    ).all()
    
    roles_valides = set()
    matricules_valides_par_role: dict = {}
    for val in validations:
        if val.role_validateur:
            roles_valides.add(val.role_validateur)
            matricules_valides_par_role.setdefault(val.role_validateur, set()).add(
                val.matricule_validateur
            )
    
    # Trouver le premier rôle non validé
    for role in sequence:
        if role == 'DG':
            # Multi-DG : tous les DG doivent valider. Le rôle n'est "terminé"
            # que lorsque chaque DG a enregistré une validation.
            matricules_dg = obtenir_tous_matricules_dg(db)
            if not matricules_dg:
                # Aucun DG configuré → on ignore silencieusement l'étape.
                continue
            deja_valides = matricules_valides_par_role.get('DG', set())
            restants = [m for m in matricules_dg if m not in deja_valides]
            if restants:
                return 'DG', restants[0]
            # Tous les DG ont validé → passer à l'étape suivante.
            continue

        if role not in roles_valides:
            matricule = obtenir_validateur_pour_role(employe, role, db)
            return role, matricule
    
    return None, None  # Tous les validateurs ont validé


def rerouter_notifications_validation_en_attente(db: Session) -> dict:
    """
    Ré-aligne les notifications VALIDATION pending avec le validateur calculé
    par la logique courante (post-correction du bug de routing direction).

    Pour chaque opération en statut 'en attente' :
    - Calcule le bon prochain validateur (role, matricule).
    - Trouve les notifications VALIDATION non lues liées à cette opération.
    - Si `notif.matricule != bon_matricule` : marque l'ancienne comme lue + archivée
      et crée une nouvelle notification pour le bon validateur (si pas déjà présente).

    Idempotent : si toutes les notifications pointent déjà vers le bon validateur,
    aucune modification n'est faite.

    Returns:
        Compteurs : {'operations_examinees', 'operations_corrigees', 'notifications_reassignees',
                     'notifications_creees_pour_nouveau_validateur'}
    """
    stats = {
        'operations_examinees': 0,
        'operations_corrigees': 0,
        'notifications_reassignees': 0,
        'notifications_creees_pour_nouveau_validateur': 0,
    }

    operations_pending = db.query(Operation).filter(
        Operation.statut.in_(['en attente', 'En attente', 'EN ATTENTE'])
    ).all()

    for op in operations_pending:
        stats['operations_examinees'] += 1

        role_correct, matricule_correct = obtenir_prochain_validateur(op.id_operation, db)
        if not matricule_correct:
            continue

        # Notifications VALIDATION non lues liées à cette opération
        notifs_pending = db.query(Notification).filter(
            Notification.id_operation == op.id_operation,
            Notification.type_notification == TypeNotificationEnum.VALIDATION,
            Notification.lue == False,  # noqa: E712
        ).all()

        # Vérifier s'il existe déjà une notification pour le bon validateur
        deja_ok = any(n.matricule == matricule_correct for n in notifs_pending)

        # Réassigner les notifications mal routées
        notifs_mal_routees = [n for n in notifs_pending if n.matricule != matricule_correct]

        if not notifs_mal_routees:
            continue

        stats['operations_corrigees'] += 1

        for notif in notifs_mal_routees:
            # Archiver l'ancienne : marquée comme lue pour qu'elle disparaisse de la boîte
            notif.lue = True
            db.add(notif)
            stats['notifications_reassignees'] += 1

        if not deja_ok:
            # Créer une nouvelle notification pour le bon validateur
            demandeur = db.query(Employe).filter(Employe.matricule == op.matricule).first()
            demandeur_label = (
                f"{demandeur.prenom} {demandeur.nom}"
                if demandeur else "un demandeur"
            )
            type_demande = op.type_demande if op.type_demande else 'opération'
            nouvelle_notif = Notification(
                matricule=matricule_correct,
                type_notification=TypeNotificationEnum.VALIDATION,
                titre="Demande à valider (reroutée)",
                message=(
                    f"Une {str(type_demande).lower()} de {demandeur_label} "
                    f"est en attente de votre validation."
                ),
                id_operation=op.id_operation,
            )
            db.add(nouvelle_notif)
            stats['notifications_creees_pour_nouveau_validateur'] += 1

    db.commit()
    return stats


def obtenir_sequence_operation(id_operation: int, db: Session) -> List[str]:
    operation = db.query(Operation).filter(Operation.id_operation == id_operation).first()
    if not operation:
        return []

    employe = db.query(Employe).filter(Employe.matricule == operation.matricule).first()
    if not employe:
        return []

    return determiner_sequence_validation(employe, db, id_operation)


def obtenir_role_validateur_final(id_operation: int, db: Session) -> Optional[str]:
    sequence = obtenir_sequence_operation(id_operation, db)
    if not sequence:
        return None
    return sequence[-1]


def operation_est_validee_par_validateur_final(id_operation: int, db: Session) -> bool:
    role_final = obtenir_role_validateur_final(id_operation, db)
    if not role_final:
        return False

    _TERMINAUX = {'PCA', 'AG'}
    if role_final in _TERMINAUX:
        # PCA et AG sont interchangeables pour la validation terminale
        validation_finale = db.query(Validation).filter(
            Validation.id_operation == id_operation,
            Validation.role_validateur.in_(_TERMINAUX),
            Validation.statut_validation == 'validé'
        ).first()
    else:
        validation_finale = db.query(Validation).filter(
            Validation.id_operation == id_operation,
            Validation.role_validateur == role_final,
            Validation.statut_validation == 'validé'
        ).first()
    return validation_finale is not None


def operation_a_deja_ete_validee(id_operation: int, db: Session) -> bool:
    validation_existante = db.query(Validation).filter(
        Validation.id_operation == id_operation,
        Validation.statut_validation == 'validé'
    ).first()
    return validation_existante is not None


def valider_operation(
    id_operation: int,
    matricule_validateur: str,
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

    _TERMINAUX = {'PCA', 'AG'}
    role_ok = (prochain_role == role_validateur) or (
        role_validateur in _TERMINAUX and prochain_role in _TERMINAUX
    )
    if prochain_role and not role_ok:
        return False, f"Ce n'est pas votre tour de valider. En attente de: {prochain_role}"

    # Multi-DG : un DG qui a déjà validé ne peut pas revalider. On ne bloque pas
    # l'ordre entre DG (n'importe lequel des DG restants peut valider), mais on
    # refuse une seconde validation par le même matricule.
    if role_validateur == 'DG' and prochain_role == 'DG':
        deja_valide = db.query(Validation).filter(
            Validation.id_operation == id_operation,
            Validation.role_validateur == 'DG',
            Validation.matricule_validateur == matricule_validateur,
            Validation.statut_validation == 'validé',
        ).first()
        if deja_valide:
            return False, "Vous avez déjà validé cette demande"

    # Pour les rôles terminaux interchangeables, stocker le rôle attendu par la séquence
    # (ex: stocker 'AG' quand PCA valide pour un employé ECG, et 'PCA' pour ELCAM/EXCA)
    # Indispensable pour que la progression retrouve la validation par clé exacte
    if prochain_role in _TERMINAUX and role_validateur in _TERMINAUX:
        role_validation_effectif = prochain_role
    else:
        role_validation_effectif = role_validateur

    validateur_emp = db.query(Employe).filter(
        Employe.matricule == matricule_validateur
    ).first()
    
    # Créer la validation
    validation = Validation(
        id_operation=id_operation,
        matricule_validateur=matricule_validateur,
        role_validateur=role_validation_effectif,
        statut_validation=statut,
        commentaire=commentaire,
        signature_url=(validateur_emp.signature_url if validateur_emp else None),
        timestamp_action=datetime.now()
    )
    db.add(validation)
    db.commit()

    # Multi-DG : marquer comme lue la notif VALIDATION du DG qui vient de valider,
    # pour qu'elle disparaisse de SA boîte sans toucher celles des autres DG.
    if role_validation_effectif == 'DG':
        notifs_dg_self = db.query(Notification).filter(
            Notification.id_operation == id_operation,
            Notification.matricule == matricule_validateur,
            Notification.type_notification == TypeNotificationEnum.VALIDATION,
            Notification.lue == False,  # noqa: E712
        ).all()
        for _n in notifs_dg_self:
            _n.lue = True
            db.add(_n)
        if notifs_dg_self:
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
        operation.statut = 'refusé'
        db.add(operation)
        # Multi-DG : un refus par un DG annule l'étape pour TOUS les DG ; on
        # archive leurs notifications VALIDATION en attente pour que l'op
        # disparaisse de leur boîte.
        if role_validation_effectif == 'DG':
            notifs_dg_pending = db.query(Notification).filter(
                Notification.id_operation == id_operation,
                Notification.type_notification == TypeNotificationEnum.VALIDATION,
                Notification.lue == False,  # noqa: E712
            ).all()
            for _n in notifs_dg_pending:
                _n.lue = True
                db.add(_n)
        db.commit()
        return True, "Opération refusée"
    
    # Si validé, vérifier s'il y a un prochain validateur
    prochain_role_apres, prochain_matricule_apres = obtenir_prochain_validateur(id_operation, db)
    
    if not prochain_role_apres:
        # C'était le dernier validateur — statut passe à 'validé'
        operation.statut = 'validé'
        db.add(operation)
        db.commit()

        if operation.duree and not operation.solde_deduit and _doit_deduire_solde(operation, db):
            from .business_logic import deduire_solde_conges

            deduire_solde_conges(employe, operation.duree, db)
            operation.solde_deduit = True
            db.add(operation)
            db.commit()

        # Notifier le demandeur que sa demande est approuvée
        operation = db.query(Operation).filter(Operation.id_operation == id_operation).first()
        if operation:
            notification_finale = Notification(
                matricule=operation.matricule,
                type_notification=TypeNotificationEnum.VALIDATION,
                titre="Demande approuvée",
                message=(
                    f"Votre {(operation.type_demande or 'demande').lower()} a été validée par tous les validateurs "
                    f"et est maintenant approuvée. Vous pouvez maintenant l'activer."
                ),
                id_operation=id_operation
            )
            db.add(notification_finale)
            db.commit()

        return True, "Opération validée par tous les validateurs"

    # Tant que le dernier validateur n'a pas validé, l'opération reste en attente.
    operation.statut = 'en attente'
    db.add(operation)
    db.commit()
    
    # Notifier le prochain validateur
    if prochain_matricule_apres:
        operation = db.query(Operation).filter(Operation.id_operation == id_operation).first()
        demandeur = db.query(Employe).filter(Employe.matricule == operation.matricule).first() if operation else None
        
        demandeur_label = f"{demandeur.prenom} {demandeur.nom}" if demandeur else "un demandeur"
        type_demande = operation.type_demande if operation and operation.type_demande else 'opération'

        # B5 — si DG, notifier tous les DG simultanément, mais on évite :
        #   - de re-notifier un DG qui a déjà validé (sa notif a été marquée
        #     lue ci-dessus) ;
        #   - de doublonner une notif VALIDATION non lue déjà présente.
        cibles_notif: list[int] = []
        if (prochain_role_apres or '').upper() == 'DG':
            tous_dg = list(obtenir_tous_matricules_dg(db))
            # DGs ayant déjà validé cette opération
            deja_valides = {
                v.matricule_validateur for v in db.query(Validation).filter(
                    Validation.id_operation == id_operation,
                    Validation.role_validateur == 'DG',
                    Validation.statut_validation == 'validé',
                ).all()
            }
            # DGs qui ont déjà une notif VALIDATION non lue pour cette op
            deja_notifies = {
                n.matricule for n in db.query(Notification).filter(
                    Notification.id_operation == id_operation,
                    Notification.type_notification == TypeNotificationEnum.VALIDATION,
                    Notification.lue == False,  # noqa: E712
                ).all()
            }
            cibles_notif = [m for m in tous_dg if m not in deja_valides and m not in deja_notifies]
        if not cibles_notif and (prochain_role_apres or '').upper() != 'DG':
            cibles_notif = [prochain_matricule_apres]

        for _mat_cible in cibles_notif:
            notification_prochain = Notification(
                matricule=_mat_cible,
                type_notification=TypeNotificationEnum.VALIDATION,
                titre="Nouvelle demande à valider",
                message=(
                    f"Une {type_demande.lower()} de {demandeur_label} "
                    f"est en attente de votre validation."
                ),
                id_operation=id_operation
            )
            db.add(notification_prochain)
        db.commit()

        # Email au prochain validateur
        prochain_emp = db.query(Employe).filter(Employe.matricule == prochain_matricule_apres).first()
        if prochain_emp and prochain_emp.email:
            import os
            from .email import send_email
            app_url = os.getenv('APP_URL', 'http://localhost:5173')
            send_email(
                prochain_emp.email,
                f"[EMS] Nouvelle demande à valider – {type_demande} de {demandeur_label}",
                (
                    f"Bonjour {prochain_emp.prenom} {prochain_emp.nom},\n\n"
                    f"Une demande de {type_demande} de {demandeur_label} "
                    f"est en attente de votre validation.\n\n"
                    f"Connectez-vous à EMS pour la traiter : {app_url}\n\n"
                    f"Cordialement,\nÉquipe EMS"
                )
            )
    
    return True, f"Validation enregistrée. En attente de {prochain_role_apres}"


def verifier_role_employe(matricule: str, role_name: str, db: Session) -> bool:
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


def obtenir_role_validateur(matricule: str, db: Session) -> str:
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
    
    # Fallback: chercher via Employe.id_role
    employe_obj = db.query(Employe).filter(Employe.matricule == matricule).first()
    if employe_obj and employe_obj.id_role:
        role = db.query(Role).filter(Role.id == employe_obj.id_role).first()
        if role:
            return _normaliser_role(role.name)

    # Déduction DFC par fonction : pas besoin d'assignation manuelle du rôle
    if employe_obj and employe_obj.fonction:
        if 'directeur financier' in employe_obj.fonction.lower():
            return 'DFC'
    
    return 'EMPLOYE'


def auto_valider_si_sequence_vide(
    id_operation: int,
    matricule_demandeur: str,
    db: Session
) -> bool:
    """
    Si la séquence de validation est vide (PCA/AG), valide et active immédiatement l'opération.
    Retourne True si l'auto-validation a été effectuée.
    """
    operation = db.query(Operation).filter(Operation.id_operation == id_operation).first()
    if not operation:
        return False

    employe = db.query(Employe).filter(Employe.matricule == operation.matricule).first()
    if not employe:
        return False

    sequence = determiner_sequence_validation(employe, db, id_operation)
    if sequence:
        return False  # Des validateurs sont requis — pas d'auto-validation

    # Séquence vide → PCA/AG : auto-valider
    operation.statut = 'validé'
    db.add(operation)

    # Déduire le solde si applicable (congés et permissions non-conventionnelles)
    if operation.duree and not operation.solde_deduit and _doit_deduire_solde(operation, db):
        from .business_logic import deduire_solde_conges
        deduire_solde_conges(employe, operation.duree, db)
        operation.solde_deduit = True
        db.add(operation)

    db.commit()

    # Notification au demandeur
    notif = Notification(
        matricule=operation.matricule,
        type_notification=TypeNotificationEnum.VALIDATION,
        titre="Demande approuvée automatiquement",
        message=(
            f"Votre {(operation.type_demande or 'demande').lower()} a été approuvée automatiquement. "
            f"Vous pouvez procéder à l'activation."
        ),
        id_operation=id_operation
    )
    db.add(notif)
    db.commit()

    return True


def peut_creer_demande_pour_autrui(matricule: str, db: Session) -> bool:
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


def obtenir_operations_visibles(matricule: str, db: Session) -> List[Operation]:
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
