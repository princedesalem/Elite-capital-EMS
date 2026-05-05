"""
Router pour le système de workflow et validation hiérarchique
"""
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session
from typing import List, Optional, Dict
from datetime import datetime
from ..db import get_db
from .. import models
from ..utils import workflow as wf_utils
from ..utils.audit import log_action

router = APIRouter(prefix='/api/workflow', tags=['workflow'])


def _notifier_missionnaires_mission_validee(id_operation: int, operation: models.Operation, db: Session):
    """
    Quand une mission est définitivement validée, notifie chaque missionnaire avec un lien
    vers la page frais, et notifie leurs supérieurs hiérarchiques (chaîne n1).
    """
    from ..utils import notifications as notif_utils

    # Récupérer tous les missionnaires assignés
    missionnaires = db.query(models.MissionnairesMission).filter(
        models.MissionnairesMission.id_mission == id_operation
    ).all()

    matricules_missionnaires = [m.matricule for m in missionnaires]
    # Si pas de ligne MissionnairesMission (mission simple), utiliser l'initiateur
    if not matricules_missionnaires:
        matricules_missionnaires = [operation.matricule]

    deja_notifies = set()

    for mat in matricules_missionnaires:
        # Notifier le missionnaire avec lien vers frais
        notif_utils.creer_notification(
            matricule=mat,
            type_notification='INFO',
            titre="Mission validée – soumettez vos frais",
            message=(
                f"Votre mission #{id_operation} a été validée. "
                f"Rendez-vous dans Frais de Mission pour soumettre votre demande de frais (mission_id={id_operation})."
            ),
            id_operation=id_operation,
            db=db,
        )
        # Rappel d'activation : le missionnaire doit activer sa mission avant le départ
        notif_utils.creer_notification(
            matricule=mat,
            type_notification='ALERTE',
            titre="Action requise – Activez votre mission",
            message=(
                f"La mission #{id_operation} a été approuvée. "
                f"Pensez à l'activer avant votre départ depuis l'onglet « Reçu » dans la page Missions (type_demande=Mission)."
            ),
            id_operation=id_operation,
            db=db,
        )
        deja_notifies.add(mat)

        # Notifier la hiérarchie (remontée via n1, max 5 niveaux)
        employe = db.query(models.Employe).filter(models.Employe.matricule == mat).first()
        superieur_mat = employe.n1 if employe else None
        niveau = 0
        while superieur_mat and niveau < 5:
            if superieur_mat not in deja_notifies:
                notif_utils.creer_notification(
                    matricule=superieur_mat,
                    type_notification='INFO',
                    titre="Mission validée",
                    message=(
                        f"La mission de "
                        f"{employe.prenom} {employe.nom} a été validée."
                    ),
                    id_operation=id_operation,
                    db=db,
                )
                deja_notifies.add(superieur_mat)
            sup_emp = db.query(models.Employe).filter(models.Employe.matricule == superieur_mat).first()
            superieur_mat = sup_emp.n1 if sup_emp else None
            niveau += 1


def _serialize_operation_with_demandeur(operation: models.Operation, db: Session) -> Dict:
    demandeur = db.query(models.Employe).filter(
        models.Employe.matricule == operation.matricule
    ).first()
    prochain_role, _ = wf_utils.obtenir_prochain_validateur(operation.id_operation, db)

    # Activation record
    act = db.query(models.Activation).filter(
        models.Activation.id_operation == operation.id_operation,
        models.Activation.type_action == models.TypeActionEnum.ACTIVATION
    ).first()

    # Clôture record
    clo = db.query(models.Activation).filter(
        models.Activation.id_operation == operation.id_operation,
        models.Activation.type_action == models.TypeActionEnum.CLOTURE
    ).first()

    # Last validation record (for status tooltip)
    last_val = db.query(models.Validation).filter(
        models.Validation.id_operation == operation.id_operation
    ).order_by(models.Validation.timestamp_action.desc()).first()
    dernier_validateur_nom = None
    if last_val:
        v_emp = db.query(models.Employe).filter(
            models.Employe.matricule == last_val.matricule_validateur
        ).first()
        dernier_validateur_nom = (
            f"{v_emp.prenom} {v_emp.nom}" if v_emp else f"#{last_val.matricule_validateur}"
        )

    # Permission fields (for preuves visibility in validator views)
    perm_conv = db.query(models.PermConventionelle).filter(
        models.PermConventionelle.id_perm_c == operation.id_operation
    ).first() if (operation.type_demande or '').lower() == 'permission' else None
    preuves_count = 0
    if perm_conv:
        preuves_count = db.query(models.PreuvePermission).filter(
            models.PreuvePermission.id_perm_c == operation.id_operation
        ).count()

    result = {
        'id_operation': operation.id_operation,
        'type_demande': operation.type_demande,
        'titre': operation.titre,
        'statut': operation.statut,
        'date_debut': str(operation.date_debut) if operation.date_debut else None,
        'date_fin': str(operation.date_fin) if operation.date_fin else None,
        'date_depart': str(operation.date_depart) if operation.date_depart else None,
        'date_retour': str(operation.date_retour) if operation.date_retour else None,
        'duree_jours': operation.duree_jours,
        'motif': operation.motif,
        'date_demande': str(operation.date_demande) if operation.date_demande else None,
        'est_modifie': bool(operation.est_modifie),
        'date_modification': str(operation.date_modification) if operation.date_modification else None,
        'prochain_validateur_role': prochain_role,
        'validation_terminee': prochain_role is None,
        'demandeur': {
            'matricule': demandeur.matricule,
            'nom': f"{demandeur.prenom} {demandeur.nom}",
            'nom_complet': f"{demandeur.prenom} {demandeur.nom}",
            'fonction': demandeur.fonction,
            'departement_id': demandeur.dept_id,
        } if demandeur else None,
        # Activation data
        'activation_demandeur_fait': bool(act.demandeur_fait) if act else False,
        'activation_date_demandeur': str(act.date_demandeur) if act and act.date_demandeur else None,
        'activation_rh_fait': bool(act.rh_fait) if act else False,
        'activation_date_rh': str(act.date_rh) if act and act.date_rh else None,
        'activation_complete': bool(act and act.statut_final == models.StatutFinalEnum.COMPLETE),
        # Clôture data
        'cloture_demandeur_fait': bool(clo.demandeur_fait) if clo else False,
        'cloture_date_demandeur': str(clo.date_demandeur) if clo and clo.date_demandeur else None,
        'cloture_rh_fait': bool(clo.rh_fait) if clo else False,
        'cloture_date_rh': str(clo.date_rh) if clo and clo.date_rh else None,
        'cloture_complete': bool(clo and clo.statut_final == models.StatutFinalEnum.COMPLETE),
        # Last validation data (for status tooltip)
        'derniere_validation_date': str(last_val.timestamp_action) if last_val and last_val.timestamp_action else None,
        'dernier_validateur_nom': dernier_validateur_nom,
        # Permission preuves info (so validators can view proofs)
        'est_conventionnelle': bool(perm_conv) if perm_conv is not None else None,
        'preuves_televersees': preuves_count > 0 if perm_conv else None,
    }

    # Enrichissement spécifique aux missions
    if (operation.type_demande or '').lower() == 'mission':
        _mission = db.query(models.Mission).filter(
            models.Mission.id_mission == operation.id_operation
        ).first()
        _mm_rows = db.query(models.MissionnairesMission).filter(
            models.MissionnairesMission.id_mission == operation.id_operation
        ).all()
        _noms = []
        for _mm in _mm_rows:
            _emp = db.query(models.Employe).filter(
                models.Employe.matricule == _mm.matricule
            ).first()
            if _emp:
                _noms.append(f"{_emp.prenom} {_emp.nom}")
        result.update({
            'pays': _mission.pays if _mission else None,
            'ville': _mission.ville if _mission else None,
            'missionnaires_noms': _noms,
            'frais_payes': bool(_mission.frais_payes) if _mission else False,
            'frais_valides_missionnaire': bool(_mission.frais_valides_missionnaire) if _mission else False,
            'frais_valides_rh': bool(_mission.frais_valides_rh) if _mission else False,
            'date_paiement_frais': _mission.date_paiement_frais.isoformat() if _mission and _mission.date_paiement_frais else None,
        })

    return result


@router.get('/mes-demandes/{matricule}')
def obtenir_mes_demandes(matricule: str, db: Session = Depends(get_db)):
    """
    Obtenir toutes les demandes (opérations) créées par un employé.
    """
    operations = db.query(models.Operation).filter(
        models.Operation.matricule == matricule
    ).order_by(models.Operation.date_demande.desc()).all()
    
    return [_serialize_operation_with_demandeur(op, db) for op in operations]


@router.get('/a-valider/{matricule}')
def obtenir_demandes_a_valider(matricule: str, db: Session = Depends(get_db)):
    """
    Obtenir toutes les opérations en attente de validation par cet employé.
    """
    role_validateur = wf_utils.obtenir_role_validateur(matricule, db)
    operations = db.query(models.Operation).order_by(models.Operation.date_demande.desc()).all()

    _TERMINAUX = {'PCA', 'AG'}
    operations_a_valider = []
    for operation in operations:
        prochain_role, prochain_matricule = wf_utils.obtenir_prochain_validateur(operation.id_operation, db)
        role_ok = (prochain_role == role_validateur) or (
            role_validateur in _TERMINAUX and prochain_role in _TERMINAUX
        )
        if role_ok and prochain_matricule == matricule:
            data = _serialize_operation_with_demandeur(operation, db)
            data['role_validateur'] = role_validateur
            operations_a_valider.append(data)

    return operations_a_valider


@router.get('/sequence/{matricule}')
def obtenir_sequence_validation(
    matricule: str,
    id_operation: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """
    Obtenir la séquence de validation pour un employé.
    
    La séquence s'adapte selon:
    - Structure organisationnelle (dept avec/sans direction)
    - Présence de frais (ajoute DFC avant DG)
    - Rôle du demandeur (DG → RH direct)
    - Entité (ECG → AG au lieu de PCA)
    """
    employe = db.query(models.Employe).filter(models.Employe.matricule == matricule).first()
    if not employe:
        raise HTTPException(status_code=404, detail="Employé introuvable")
    
    sequence = wf_utils.determiner_sequence_validation(employe, db, id_operation)
    
    # Obtenir les matricules des validateurs
    validateurs = []
    for role in sequence:
        matricule_validateur = wf_utils.obtenir_validateur_pour_role(employe, role, db)
        
        if matricule_validateur:
            validateur = db.query(models.Employe).filter(
                models.Employe.matricule == matricule_validateur
            ).first()
            
            validateurs.append({
                "role": role,
                "matricule": matricule_validateur,
                "nom_complet": f"{validateur.prenom} {validateur.nom}" if validateur else "Inconnu"
            })
        else:
            validateurs.append({
                "role": role,
                "matricule": None,
                "nom_complet": "Non défini"
            })
    
    return {
        "sequence": sequence,
        "validateurs": validateurs
    }


@router.get('/prochain-validateur/{id_operation}')
def obtenir_prochain_validateur(id_operation: int, db: Session = Depends(get_db)):
    """
    Obtenir le prochain validateur dans la séquence pour une opération.
    """
    prochain_role, prochain_matricule = wf_utils.obtenir_prochain_validateur(id_operation, db)
    
    if not prochain_role:
        return {
            "message": "Tous les validateurs ont validé",
            "prochain_role": None,
            "prochain_validateur": None
        }
    
    validateur = None
    if prochain_matricule:
        validateur = db.query(models.Employe).filter(
            models.Employe.matricule == prochain_matricule
        ).first()
    
    return {
        "prochain_role": prochain_role,
        "prochain_matricule": prochain_matricule,
        "prochain_validateur": {
            "matricule": validateur.matricule,
            "nom_complet": f"{validateur.prenom} {validateur.nom}",
            "fonction": validateur.fonction,
            "email": validateur.email
        } if validateur else None
    }


@router.post('/valider/{id_operation}')
def valider_operation(
    id_operation: int,
    matricule_validateur: str,
    statut: str,  # 'validé' ou 'refusé'
    request: Request = None,
    commentaire: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    Valider ou refuser une opération selon le workflow hiérarchique.
    """
    if statut not in ['validé', 'refusé']:
        raise HTTPException(status_code=400, detail="Statut doit être 'validé' ou 'refusé'")
    
    # Vérifier que le motif de refus est obligatoire lors d'un refus
    if statut == 'refusé' and (not commentaire or not commentaire.strip()):
        raise HTTPException(status_code=400, detail="Le motif de refus est obligatoire")
    
    success, message = wf_utils.valider_operation(
        id_operation, matricule_validateur, statut, commentaire, db
    )
    
    if not success:
        raise HTTPException(status_code=400, detail=message)

    log_action(db, matricule_validateur, 'OPERATION_VALIDATED' if statut == 'validé' else 'OPERATION_REFUSED',
              'operation', id_operation, {'statut': statut, 'commentaire': commentaire}, ip_address=request.client.host if request and request.client else None)

    # Si c'est une mission définitivement validée → notifier missionnaires et hiérarchie
    if statut == 'validé':
        op = db.query(models.Operation).filter(models.Operation.id_operation == id_operation).first()
        if op and (op.statut or '').lower() == 'validé' and (op.type_demande or '').lower() == 'mission':
            _notifier_missionnaires_mission_validee(id_operation, op, db)
    
    # Obtenir le prochain validateur si validé
    prochain_role, prochain_matricule = wf_utils.obtenir_prochain_validateur(id_operation, db)
    
    return {
        "message": message,
        "statut": statut,
        "prochain_role": prochain_role,
        "termine": prochain_role is None
    }


@router.get('/historique-validations/{id_operation}')
def obtenir_historique_validations(id_operation: int, db: Session = Depends(get_db)):
    """
    Obtenir l'historique de toutes les validations pour une opération.
    """
    validations = db.query(models.Validation).filter(
        models.Validation.id_operation == id_operation
    ).order_by(models.Validation.timestamp_action).all()
    
    result = []
    for val in validations:
        validateur = db.query(models.Employe).filter(
            models.Employe.matricule == val.matricule_validateur
        ).first()
        
        result.append({
            "id_validation": val.id_validation,
            "role_validateur": val.role_validateur,
            "matricule_validateur": val.matricule_validateur,
            "nom_validateur": f"{validateur.prenom} {validateur.nom}" if validateur else "Inconnu",
            "statut_validation": val.statut_validation,
            "commentaire": val.commentaire,
            "date_validation": val.timestamp_action
        })
    
    return result


@router.get('/mes-demandes-detail/{matricule}')
def obtenir_mes_demandes_detail(matricule: str, db: Session = Depends(get_db)):
    """
    Obtenir toutes les demandes créées par un employé avec leur statut de validation.
    """
    operations = db.query(models.Operation).filter(
        models.Operation.matricule == matricule
    ).order_by(models.Operation.date_demande.desc()).all()
    
    result = []
    for op in operations:
        # Obtenir le prochain validateur
        prochain_role, prochain_matricule = wf_utils.obtenir_prochain_validateur(op.id_operation, db)
        
        # Obtenir les validations déjà faites
        validations_count = db.query(models.Validation).filter(
            models.Validation.id_operation == op.id_operation,
            models.Validation.statut_validation == 'validé'
        ).count()
        
        result.append({
            "id_operation": op.id_operation,
            "type_demande": op.type_demande,
            "date_debut": op.date_debut,
            "date_fin": op.date_fin,
            "duree_jours": op.duree_jours,
            "statut": op.statut,
            "date_demande": op.date_demande,
            "validations_completees": validations_count,
            "prochain_validateur_role": prochain_role,
            "validation_terminee": prochain_role is None
        })
    
    return result


@router.get('/a-valider-detail/{matricule_validateur}')
def obtenir_operations_a_valider(matricule_validateur: str, db: Session = Depends(get_db)):
    """
    Obtenir toutes les opérations en attente de validation par un validateur.
    """
    # Obtenir le rôle du validateur
    role_validateur = wf_utils.obtenir_role_validateur(matricule_validateur, db)
    
    # Obtenir toutes les opérations (pas de filtre statut - n'existe pas sur Operation)
    # Le statut est déterminé par les validations workflow
    operations_attente = db.query(models.Operation).all()

    operations_a_valider = []
    
    for op in operations_attente:
        # Vérifier si c'est le tour de ce validateur
        prochain_role, prochain_matricule = wf_utils.obtenir_prochain_validateur(op.id_operation, db)
        
        if not (prochain_role == role_validateur and prochain_matricule == matricule_validateur):
            continue

        if prochain_role:
            employe = db.query(models.Employe).filter(
                models.Employe.matricule == op.matricule
            ).first()
            
            operations_a_valider.append({
                "id_operation": op.id_operation,
                "type_demande": op.type_demande,
                "date_debut": op.date_debut,
                "date_fin": op.date_fin,
                "duree_jours": op.duree_jours,
                "motif": op.motif,
                "demandeur": {
                    "matricule": employe.matricule,
                    "nom_complet": f"{employe.prenom} {employe.nom}",
                    "fonction": employe.fonction,
                    "departement_id": employe.dept_id
                } if employe else None,
                "date_demande": op.date_demande
            })
    
    return operations_a_valider


@router.get('/operations-visibles/{matricule}')
def obtenir_operations_visibles(matricule: str, db: Session = Depends(get_db)):
    """
    Obtenir toutes les opérations visibles par un employé selon son rôle.
    
    Visibilité:
    - EMPLOYE: Ses propres opérations
    - RESPONSABLE: Département
    - DIRECTEUR: Direction
    - DG: Entité
    - RH/PCA/AG: Toutes les opérations
    """
    operations = wf_utils.obtenir_operations_visibles(matricule, db)
    
    result = []
    for op in operations:
        employe = db.query(models.Employe).filter(
            models.Employe.matricule == op.matricule
        ).first()
        
        prochain_role, _ = wf_utils.obtenir_prochain_validateur(op.id_operation, db)
        
        result.append({
            "id_operation": op.id_operation,
            "type_demande": op.type_demande,
            "date_debut": op.date_debut,
            "date_fin": op.date_fin,
            "statut": op.statut,
            "demandeur": {
                "matricule": employe.matricule,
                "nom_complet": f"{employe.prenom} {employe.nom}",
                "fonction": employe.fonction
            } if employe else None,
            "prochain_validateur_role": prochain_role
        })
    
    return result


@router.get('/peut-creer-pour-autrui/{matricule}')
def peut_creer_pour_autrui(matricule: str, db: Session = Depends(get_db)):
    """
    Vérifier si un employé peut créer des demandes pour autrui.
    
    Règle: Supérieurs hiérarchiques (RESPONSABLE, DIRECTEUR, DG) et RH peuvent 
    créer des missions pour leurs subordonnés.
    """
    peut_creer = wf_utils.peut_creer_demande_pour_autrui(matricule, db)
    
    role = wf_utils.obtenir_role_validateur(matricule, db)
    
    return {
        "peut_creer_pour_autrui": peut_creer,
        "role": role,
        "message": "Peut créer des demandes pour ses subordonnés" if peut_creer else "Ne peut créer que ses propres demandes"
    }


@router.get('/stats-validations/{matricule_validateur}')
def obtenir_stats_validations(matricule_validateur: str, db: Session = Depends(get_db)):
    """
    Obtenir des statistiques sur les validations d'un validateur.
    """
    validations = db.query(models.Validation).filter(
        models.Validation.matricule_validateur == matricule_validateur
    ).all()
    
    total = len(validations)
    valides = len([v for v in validations if v.statut_validation == 'validé'])
    refuses = len([v for v in validations if v.statut_validation == 'refusé'])
    
    return {
        "total_validations": total,
        "valides": valides,
        "refuses": refuses,
        "taux_validation": round((valides / total * 100) if total > 0 else 0, 2)
    }


@router.get('/mes-validations/{matricule_validateur}')
def obtenir_mes_validations(matricule_validateur: str, db: Session = Depends(get_db)):
    """
    Obtenir toutes les demandes validées par ce validateur.
    """
    validations = db.query(models.Validation).filter(
        models.Validation.matricule_validateur == matricule_validateur,
        models.Validation.statut_validation == 'validé'
    ).order_by(models.Validation.timestamp_action.desc()).all()
    
    operations_validees = []
    for validation in validations:
        operation = db.query(models.Operation).filter(
            models.Operation.id_operation == validation.id_operation
        ).first()
        
        if operation:
            data = _serialize_operation_with_demandeur(operation, db)
            data.update({
                'id_validation': validation.id_validation,
                'date_validation': str(validation.timestamp_action) if validation.timestamp_action else None,
                'commentaire_validation': validation.commentaire,
                'role_validateur': validation.role_validateur
            })
            operations_validees.append(data)
    
    return operations_validees


@router.get('/mes-refus/{matricule_validateur}')
def obtenir_mes_refus(matricule_validateur: str, db: Session = Depends(get_db)):
    """
    Obtenir toutes les demandes refusées par ce validateur.
    """
    validations = db.query(models.Validation).filter(
        models.Validation.matricule_validateur == matricule_validateur,
        models.Validation.statut_validation == 'refusé'
    ).order_by(models.Validation.timestamp_action.desc()).all()
    
    operations_refusees = []
    for validation in validations:
        operation = db.query(models.Operation).filter(
            models.Operation.id_operation == validation.id_operation
        ).first()
        
        if operation:
            data = _serialize_operation_with_demandeur(operation, db)
            data.update({
                'id_validation': validation.id_validation,
                'date_refus': str(validation.timestamp_action) if validation.timestamp_action else None,
                'motif_refus': validation.commentaire,
                'role_validateur': validation.role_validateur
            })
            operations_refusees.append(data)
    
    return operations_refusees


@router.get('/boite/{matricule}')
def obtenir_boite_workflow(matricule: str, db: Session = Depends(get_db)):
    """
    Retourne la boite workflow complete d'un utilisateur:
    - envoye: demandes creees par l'utilisateur
    - recu: demandes actuellement en attente de sa validation
    - valide: demandes qu'il a validees
    - refuse: demandes qu'il a refusees
    - recu_pca_ag: (RH seulement) toutes les demandes validées des PCA/AG, pour information
    """
    envoye = obtenir_mes_demandes(matricule, db)
    recu = obtenir_demandes_a_valider(matricule, db)
    valide = obtenir_mes_validations(matricule, db)
    refuse = obtenir_mes_refus(matricule, db)

    recu_pca_ag = []
    role_utilisateur = wf_utils.obtenir_role_validateur(matricule, db)
    if role_utilisateur == 'RH':
        # Trouver tous les employés PCA/AG
        pca_ag_roles = db.query(models.Role).filter(
            models.Role.name.in_(['PCA', 'AG'])
        ).all()
        pca_ag_role_ids = [r.id for r in pca_ag_roles]

        if pca_ag_role_ids:
            pca_ag_users = db.query(models.Utilisateur).filter(
                models.Utilisateur.role_id.in_(pca_ag_role_ids)
            ).all()
            pca_ag_matricules = [u.matricule for u in pca_ag_users]

            if pca_ag_matricules:
                ops_pca_ag = db.query(models.Operation).filter(
                    models.Operation.matricule.in_(pca_ag_matricules),
                    models.Operation.statut == 'validé'
                ).order_by(models.Operation.date_demande.desc()).all()

                recu_pca_ag = [_serialize_operation_with_demandeur(op, db) for op in ops_pca_ag]

    return {
        'envoye': envoye,
        'recu': recu,
        'valide': valide,
        'refuse': refuse,
        'recu_pca_ag': recu_pca_ag,
    }


@router.get('/progression/{id_operation}')
def obtenir_progression_validation(id_operation: int, db: Session = Depends(get_db)):
    """
    Obtenir la progression complète de validation d'une opération pour affichage Teams.
    
    Retourne:
    - sequence: Liste des rôles à valider dans l'ordre
    - etapes: Liste détaillée avec statut de chaque étape
    - progression: Pourcentage de completion
    - statut_final: État actuel de la demande
    """
    operation = db.query(models.Operation).filter(
        models.Operation.id_operation == id_operation
    ).first()
    
    if not operation:
        raise HTTPException(status_code=404, detail="Operation introuvable")
    
    employe = db.query(models.Employe).filter(
        models.Employe.matricule == operation.matricule
    ).first()
    
    # Obtenir la séquence de validation
    sequence = wf_utils.determiner_sequence_validation(employe, db, id_operation)
    
    # Inverser la séquence pour afficher AG en haut
    sequence = list(reversed(sequence))

    # Cas spécial : séquence vide (PCA/AG) et opération validée → 100%
    if not sequence and (operation.statut or '').lower() in ('validé', 'valide'):
        role_dem = wf_utils.obtenir_role_validateur(operation.matricule, db)
        # date_vue du demandeur lui-même pour ce cas PCA/AG auto-validé
        _vue_self = db.query(models.OperationVue).filter(
            models.OperationVue.id_operation == id_operation,
            models.OperationVue.matricule_observateur == str(operation.matricule).upper(),
        ).first()
        return {
            'id_operation': id_operation,
            'type_demande': operation.type_demande,
            'est_modifie': bool(operation.est_modifie),
            'date_modification': operation.date_modification.isoformat() if operation.date_modification else None,
            'demandeur': {
                'matricule': employe.matricule,
                'nom_complet': f'{employe.prenom} {employe.nom}',
                'fonction': employe.fonction
            } if employe else None,
            'date_demande': operation.date_demande.isoformat() if operation.date_demande else None,
            'sequence': [role_dem],
            'etapes': [{
                'numero': 1, 'role': role_dem, 'statut': 'validé',
                'validateur': f'{employe.prenom} {employe.nom}' if employe else 'Inconnu',
                'matricule_validateur': operation.matricule,
                'date': operation.date_demande.isoformat() if operation.date_demande else None,
                'commentaire': None, 'icone': '✅',
                'date_recu': operation.date_demande.isoformat() if operation.date_demande else None,
                'date_vue': _vue_self.date_vue.isoformat() if _vue_self else None,
            }],
            'progression': 100, 'statut_final': 'APPROUVÉE',
            'total_etapes': 1, 'etapes_validees': 1, 'etapes_refusees': 0
        }

    # Obtenir les validations réalisées
    validations = db.query(models.Validation).filter(
        models.Validation.id_operation == id_operation
    ).order_by(models.Validation.timestamp_action).all()
    
    _TERMINAUX_PROG = {'PCA', 'AG'}
    # Pour les rôles non-DG on garde un mapping 1→1 (la dernière gagne, cas normal).
    validations_dict = {v.role_validateur: v for v in validations if v.role_validateur != 'DG'}
    # Pour DG on conserve un mapping matricule → validation (multi-DG parallèle).
    validations_dg_par_matricule = {
        v.matricule_validateur: v
        for v in validations
        if v.role_validateur == 'DG' and v.matricule_validateur is not None
    }

    # Liste des DG de l'application (ordonnée). Utilisée uniquement si la séquence
    # contient le rôle DG ; sinon on n'affiche rien de plus.
    matricules_dg = wf_utils.obtenir_tous_matricules_dg(db) if 'DG' in sequence else []

    # Construire les étapes
    etapes = []
    numero_courant = 0
    for role in sequence:
        if role == 'DG' and matricules_dg:
            # Étape DG : on émet une sous-étape par DG (affichage côte à côte).
            for matricule_dg in matricules_dg:
                numero_courant += 1
                validation = validations_dg_par_matricule.get(matricule_dg)
                dg_employe = db.query(models.Employe).filter(
                    models.Employe.matricule == matricule_dg
                ).first()
                nom_dg = (
                    f"{dg_employe.prenom} {dg_employe.nom}"
                    if dg_employe else f"DG {matricule_dg}"
                )
                if validation:
                    etapes.append({
                        "numero": numero_courant,
                        "role": "DG",
                        "statut": validation.statut_validation,
                        "validateur": nom_dg,
                        "matricule_validateur": validation.matricule_validateur,
                        "matricule_validateur_attendu": matricule_dg,
                        "date": validation.timestamp_action.isoformat() if validation.timestamp_action else None,
                        "commentaire": validation.commentaire,
                        "icone": "✅" if validation.statut_validation == "validé" else "❌",
                        "parallele": len(matricules_dg) > 1,
                        "groupe": "DG",
                    })
                else:
                    etapes.append({
                        "numero": numero_courant,
                        "role": "DG",
                        "statut": "en attente",
                        "validateur": nom_dg,
                        "matricule_validateur": None,
                        "matricule_validateur_attendu": matricule_dg,
                        "date": None,
                        "commentaire": None,
                        "icone": "⏳",
                        "parallele": len(matricules_dg) > 1,
                        "groupe": "DG",
                    })
            continue

        numero_courant += 1
        validation = validations_dict.get(role)
        # Backward-compat: si le rôle terminal a été stocké avec l'alias opposé
        # (données créées avant la correction du stockage entity-aware)
        if validation is None and role in _TERMINAUX_PROG:
            _alt = 'AG' if role == 'PCA' else 'PCA'
            validation = validations_dict.get(_alt)
        
        if validation:
            statut = validation.statut_validation  # 'validé' ou 'refusé'
            validateur = db.query(models.Employe).filter(
                models.Employe.matricule == validation.matricule_validateur
            ).first()
            
            etapes.append({
                "numero": numero_courant,
                "role": role,
                "statut": statut,
                "validateur": f"{validateur.prenom} {validateur.nom}" if validateur else "Inconnu",
                "matricule_validateur": validation.matricule_validateur,
                "date": validation.timestamp_action.isoformat() if validation.timestamp_action else None,
                "commentaire": validation.commentaire,
                "icone": "✅" if statut == "validé" else "❌",
                "parallele": False,
                "groupe": None,
            })
        else:
            # Étape non encore effectuée.
            # On cherche le matricule du validateur ATTENDU pour pouvoir lire
            # sa date_vue dans OPERATION_VUE même avant qu'il ait validé.
            mat_attendu = wf_utils.obtenir_validateur_pour_role(employe, role, db)
            emp_attendu = db.query(models.Employe).filter(
                models.Employe.matricule == mat_attendu
            ).first() if mat_attendu else None
            etapes.append({
                "numero": numero_courant,
                "role": role,
                "statut": "en attente",
                "validateur": f"{emp_attendu.prenom} {emp_attendu.nom}" if emp_attendu else None,
                "matricule_validateur": None,
                "matricule_validateur_attendu": mat_attendu,
                "date": None,
                "commentaire": None,
                "icone": "⏳",
                "parallele": False,
                "groupe": None,
            })
    
    # Calculer la progression
    validees = len([e for e in etapes if e['statut'] == 'validé'])
    refusees = len([e for e in etapes if e['statut'] == 'refusé'])
    progression = round((validees / len(etapes) * 100) if etapes else 0, 0) if refusees == 0 else 0

    # ── Enrichir chaque étape avec date_recu et date_vue ──────────────────────
    # La liste etapes est en ordre inversé (AG en tête, RESPONSABLE en dernier).
    # date_recu[i] = date_demande pour la dernière étape (premier validateur dans
    # la chaîne originale), sinon timestamp_action de l'étape suivante (i+1).
    # date_vue = date de consultation depuis OPERATION_VUE.
    vues_map: dict = {}
    all_vues = db.query(models.OperationVue).filter(
        models.OperationVue.id_operation == id_operation
    ).all()
    for v in all_vues:
        if v.matricule_observateur:
            vues_map[str(v.matricule_observateur).upper()] = v.date_vue

    for i, etape in enumerate(etapes):
        # date_recu : quand le validateur a reçu la demande
        if i == len(etapes) - 1:
            # Dernier dans la liste inversée = premier validateur de la chaîne
            etape['date_recu'] = operation.date_demande.isoformat() if operation.date_demande else None
        else:
            # Reçu quand l'étape suivante (dans l'ordre inversé = l'étape précédente
            # dans la chaîne originale) a été validée
            etape['date_recu'] = etapes[i + 1].get('date')

        # date_vue : quand ce validateur a ouvert l'opération
        mat_key = str(
            etape.get('matricule_validateur') or etape.get('matricule_validateur_attendu') or ''
        ).upper()
        dv = vues_map.get(mat_key)
        etape['date_vue'] = dv.isoformat() if dv else None
    # ─────────────────────────────────────────────────────────────────────────
    
    # Déterminer le statut final
    if refusees > 0:
        statut_final = "REFUSÉE"
    elif validees == len(etapes):
        statut_final = "APPROUVÉE"
    else:
        statut_final = f"EN COURS ({validees}/{len(etapes)})"
    
    return {
        "id_operation": id_operation,
        "type_demande": operation.type_demande,
        "est_modifie": bool(operation.est_modifie),
        "date_modification": operation.date_modification.isoformat() if operation.date_modification else None,
        "demandeur": {
            "matricule": employe.matricule,
            "nom_complet": f"{employe.prenom} {employe.nom}",
            "fonction": employe.fonction
        } if employe else None,
        "date_demande": operation.date_demande.isoformat() if operation.date_demande else None,
        "sequence": sequence,
        "etapes": etapes,
        "progression": int(progression),
        "statut_final": statut_final,
        "total_etapes": len(etapes),
        "etapes_validees": validees,
        "etapes_refusees": refusees
    }


# ---------------------------------------------------------------------------
#  Suivi des consultations d'op�rations (qui a vu une demande, et quand).
#  Migration 058 � table OPERATION_VUE.  On enregistre uniquement la PREMI�RE
#  consultation par utilisateur (UNIQUE KEY id_operation � matricule).
# ---------------------------------------------------------------------------

@router.post('/marquer-vu/{id_operation}')
def marquer_operation_vue(
    id_operation: int,
    matricule_observateur: str,
    db: Session = Depends(get_db),
):
    """Enregistre, si absent, la première consultation d'une opération par un utilisateur.

    Idempotent : si une trace existe déjà pour ce couple, on ne fait rien et
    on renvoie la trace existante.  Tout le monde est enregistré, y compris
    le demandeur lui-même (traçabilité complète).
    """
    op = db.query(models.Operation).filter(
        models.Operation.id_operation == id_operation
    ).first()
    if not op:
        raise HTTPException(status_code=404, detail="Opération introuvable")

    matricule = (matricule_observateur or '').strip().upper()
    if not matricule:
        raise HTTPException(status_code=400, detail="matricule_observateur requis")

    existing = db.query(models.OperationVue).filter(
        models.OperationVue.id_operation == id_operation,
        models.OperationVue.matricule_observateur == matricule,
    ).first()
    if existing:
        return {
            "ok": True,
            "already": True,
            "date_vue": existing.date_vue.isoformat() if existing.date_vue else None,
        }

    emp = db.query(models.Employe).filter(models.Employe.matricule == matricule).first()
    nom = f"{emp.prenom or ''} {emp.nom or ''}".strip() if emp else None
    role = emp.fonction if emp else None

    vue = models.OperationVue(
        id_operation=id_operation,
        matricule_observateur=matricule,
        nom_observateur=nom or None,
        role_observateur=role,
        date_vue=datetime.utcnow(),
    )
    db.add(vue)
    try:
        db.commit()
        db.refresh(vue)
    except Exception:
        # Course inter-requ�tes : la contrainte UNIQUE prot�ge, on relit la trace.
        db.rollback()
        vue = db.query(models.OperationVue).filter(
            models.OperationVue.id_operation == id_operation,
            models.OperationVue.matricule_observateur == matricule,
        ).first()
    return {
        "ok": True,
        "already": False,
        "date_vue": vue.date_vue.isoformat() if vue and vue.date_vue else None,
    }


@router.get('/mes-vues/{matricule}')
def lister_mes_vues(matricule: str, db: Session = Depends(get_db)):
    """Retourne la liste des id_operation que cet utilisateur a déjà consultés.
    Utilisé par le frontend pour initialiser l'état 'vu' persistant au chargement.
    """
    mat = (matricule or '').strip().upper()
    rows = db.query(models.OperationVue.id_operation).filter(
        models.OperationVue.matricule_observateur == mat
    ).all()
    return [r.id_operation for r in rows]


@router.get('/vues/{id_operation}')
def lister_vues_operation(id_operation: int, db: Session = Depends(get_db)):
    """Renvoie la liste des utilisateurs ayant ouvert l'op�ration, par ordre chronologique."""
    op = db.query(models.Operation).filter(
        models.Operation.id_operation == id_operation
    ).first()
    if not op:
        raise HTTPException(status_code=404, detail="Op�ration introuvable")

    rows = db.query(models.OperationVue).filter(
        models.OperationVue.id_operation == id_operation
    ).order_by(models.OperationVue.date_vue.asc()).all()
    return [
        {
            "matricule_observateur": r.matricule_observateur,
            "nom_observateur": r.nom_observateur,
            "role_observateur": r.role_observateur,
            "date_vue": r.date_vue.isoformat() if r.date_vue else None,
        }
        for r in rows
    ]