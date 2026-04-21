"""
Router pour la gestion des permissions conventionnelles et non-conventionnelles
"""
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Request
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import date, timedelta, datetime
from ..db import get_db
from .. import models
from ..utils import permissions as perm_utils, workflow, notifications, activation_cloture, business_logic, access_control
from ..utils.audit import log_action
import os

router = APIRouter(prefix='/api/permissions', tags=['permissions'])


def _build_permission_title(type_permission: Optional[str], sous_type: Optional[str], est_conventionnelle: bool) -> str:
    if not est_conventionnelle:
        return 'Permission non-conventionnelle'

    parts = ['Permission conventionnelle']
    if type_permission:
        parts.append(str(type_permission).replace('_', ' ').title())
    if sous_type:
        parts.append(str(sous_type).replace('_', ' ').title())
    return ' - '.join(parts)


def _replace_permission_subtype_rows(id_operation: int, type_permission: str, db: Session) -> None:
    db.query(models.PermMaternelle).filter(models.PermMaternelle.id_perm_mat == id_operation).delete()
    db.query(models.PermDeces).filter(models.PermDeces.id_perm_dec == id_operation).delete()
    db.query(models.PermMaladie).filter(models.PermMaladie.id_perm_mal == id_operation).delete()
    db.query(models.PermBapteme).filter(models.PermBapteme.id_perm_bap == id_operation).delete()
    db.query(models.PermMariage).filter(models.PermMariage.id_perm_mar == id_operation).delete()

    if type_permission == 'maternelle':
        db.add(models.PermMaternelle(id_perm_mat=id_operation))
    elif type_permission == 'deces':
        db.add(models.PermDeces(id_perm_dec=id_operation))
    elif type_permission == 'maladie':
        db.add(models.PermMaladie(id_perm_mal=id_operation))
    elif type_permission == 'bapteme':
        db.add(models.PermBapteme(id_perm_bap=id_operation))
    elif type_permission in ['mariage', 'paternite', 'accouchement']:
        db.add(models.PermMariage(id_perm_mar=id_operation))


def _normalize_permission_type(type_permission: Optional[str]) -> str:
    value = str(type_permission or '').strip().lower()
    if value == 'accouchement':
        return 'paternite'
    return value


def _validate_permission_type_by_sex(type_permission: str, employe: models.Employe):
    sexe_raw = employe.sexe.value if hasattr(employe.sexe, 'value') else employe.sexe
    sexe = str(sexe_raw or '').strip().upper()
    if type_permission == 'maternelle' and sexe == 'M':
        raise HTTPException(status_code=400, detail='La permission maternité est réservée aux employées de sexe féminin.')
    if type_permission == 'paternite' and sexe == 'F':
        raise HTTPException(status_code=400, detail='La permission paternité est réservée aux employés de sexe masculin.')


@router.get('/types-conventionnels')
def obtenir_types_conventionnels():
    """
    Obtenir la liste des types de permissions conventionnelles disponibles.
    """
    return {
        "types": perm_utils.DUREES_PERMISSIONS_CONVENTIONNELLES,
        "delai_preuves_jours": perm_utils.DELAI_TELECHARGEMENT_PREUVES,
        "note": "Les permissions conventionnelles ne déduisent PAS du solde de congés (max 10 jours sauf exceptions médicales)"
    }


@router.post('/conventionnelle', status_code=status.HTTP_201_CREATED)
def creer_permission_conventionnelle(
    matricule: int,
    type_permission: str,
    sous_type: Optional[str] = None,
    matricule_createur: Optional[int] = None,
    duree: int = None,
    date_debut: date = None,
    date_fin: date = None,
    motif: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    Créer une demande de permission conventionnelle.
    
    Types disponibles: maternelle, deces, maladie, bapteme, mariage
    """
    employe = db.query(models.Employe).filter(models.Employe.matricule == matricule).first()
    if not employe:
        raise HTTPException(status_code=404, detail="Employé introuvable")

    createur = matricule_createur if matricule_createur is not None else matricule
    if createur != matricule:
        est_rh = workflow.verifier_role_employe(createur, 'RH', db)
        est_admin = workflow.verifier_role_employe(createur, 'ADMIN', db)
        if not (est_rh or est_admin):
            raise HTTPException(
                status_code=403,
                detail="Seuls RH et ADMIN peuvent initier une permission pour autrui"
            )
    
    # Vérifier que le type est valide
    type_permission_norm = _normalize_permission_type(type_permission)
    _validate_permission_type_by_sex(type_permission_norm, employe)

    est_valide, message_validation, duree_calculee = perm_utils.verifier_type_permission_conventionnelle(
        type_permission_norm, sous_type
    )
    
    if not est_valide:
        raise HTTPException(status_code=400, detail=message_validation)
    
    # Utiliser la durée calculée si non fournie
    if not date_debut or not date_fin:
        raise HTTPException(status_code=400, detail='Date de début et date de fin sont obligatoires')

    duree_ouvrable = business_logic.calculer_jours_ouvrables(date_debut, date_fin)
    if duree_ouvrable <= 0:
        raise HTTPException(status_code=400, detail='La durée de la permission doit être positive')

    if duree_ouvrable > duree_calculee:
        raise HTTPException(
            status_code=400,
            detail=f"Durée maximale pour ce type: {duree_calculee} jours ouvrables"
        )

    # Le backend reste la source de vérité pour la durée.
    duree = duree_ouvrable
    
    # Créer l'opération
    operation = models.Operation(
        matricule=matricule,
        titre=_build_permission_title(type_permission, sous_type, True),
        type_demande='Permission',
        statut='en attente',
        date_debut=date_debut,
        date_fin=date_fin,
        duree_jours=duree,
        motif=motif,
        commentaire=motif,
        cree_par=createur
    )
    db.add(operation)
    db.flush()
    
    # Créer l'enregistrement de permission conventionnelle
    success, message = perm_utils.creer_permission_conventionnelle(
        operation.id_operation,
        type_permission_norm,
        duree or 0,
        db,
        sous_type=sous_type
    )
    
    if not success:
        db.rollback()
        raise HTTPException(status_code=400, detail=message)
    
    db.commit()
    log_action(db, createur, 'CREATE_PERMISSION', 'operation', operation.id_operation,
               {'type_permission': type_permission_norm, 'sous_type': sous_type,
                'duree_jours': duree, 'matricule_cible': matricule,
                'date_debut': str(date_debut), 'date_fin': str(date_fin), 'motif': motif})

    # Auto-valider immédiatement si PCA/AG (séquence vide)
    workflow.auto_valider_si_sequence_vide(operation.id_operation, matricule, db)

    # Notifier le premier validateur
    prochain_role, prochain_matricule = workflow.obtenir_prochain_validateur(operation.id_operation, db)
    if prochain_matricule:
        notifications.creer_notification(
            matricule=prochain_matricule,
            type_notification='VALIDATION',
            titre=f"Permission conventionnelle ({type_permission_norm})",
            message=f"{employe.prenom} {employe.nom} demande une permission conventionnelle",
            id_operation=operation.id_operation,
            db=db
        )
    
    return {
        "id_operation": operation.id_operation,
        "type_permission": type_permission_norm,
        "sous_type": sous_type,
        "duree_demandee": duree,
        "date_limite_preuves": (date.today() + timedelta(days=60)).isoformat(),
        "message": "Permission conventionnelle créée. N'oubliez pas de téléverser les preuves dans les 60 jours."
    }


@router.post('/non-conventionnelle', status_code=status.HTTP_201_CREATED)
def creer_permission_non_conventionnelle(
    matricule: int,
    date_debut: date,
    date_fin: date,
    duree: Optional[int] = None,
    matricule_createur: Optional[int] = None,
    motif: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    Créer une demande de permission non-conventionnelle (déduit du solde de congés).
    """
    employe = db.query(models.Employe).filter(models.Employe.matricule == matricule).first()
    if not employe:
        raise HTTPException(status_code=404, detail="Employé introuvable")

    createur = matricule_createur if matricule_createur is not None else matricule
    if createur != matricule:
        est_rh = workflow.verifier_role_employe(createur, 'RH', db)
        est_admin = workflow.verifier_role_employe(createur, 'ADMIN', db)
        if not (est_rh or est_admin):
            raise HTTPException(
                status_code=403,
                detail="Seuls RH et ADMIN peuvent initier une permission pour autrui"
            )
    
    duree_calculee = business_logic.calculer_jours_ouvrables(date_debut, date_fin)
    if duree_calculee <= 0:
        raise HTTPException(status_code=400, detail='La durée de la permission doit être positive')

    chevauchement, message_chevauchement = business_logic.verifier_chevauchement_operations(
        employe, date_debut, date_fin, db
    )
    if chevauchement:
        raise HTTPException(status_code=400, detail=message_chevauchement)

    # Créer l'opération
    operation = models.Operation(
        matricule=matricule,
        titre=_build_permission_title('non_conventionnelle', None, False),
        type_demande='Permission',
        statut='en attente',
        date_debut=date_debut,
        date_fin=date_fin,
        date_depart=date_debut,
        date_retour=date_fin,
        duree_jours=duree_calculee,
        duree=duree_calculee,
        motif=motif,
        commentaire=motif,
        cree_par=createur
    )
    db.add(operation)
    db.flush()
    
    # Créer l'enregistrement de permission non-conventionnelle
    success, message = perm_utils.creer_permission_non_conventionnelle(
        operation.id_operation,
        duree_calculee,
        employe,
        db
    )
    
    if not success:
        db.rollback()
        raise HTTPException(status_code=400, detail=message)
    
    db.commit()
    log_action(db, createur, 'CREATE_PERMISSION_NON_CONV', 'operation', operation.id_operation,
               {'duree_jours': duree_calculee, 'matricule_cible': matricule,
                'date_debut': str(date_debut), 'date_fin': str(date_fin), 'motif': motif})

    # Auto-valider immédiatement si PCA/AG (séquence vide)
    workflow.auto_valider_si_sequence_vide(operation.id_operation, matricule, db)

    # Notifier
    prochain_role, prochain_matricule = workflow.obtenir_prochain_validateur(operation.id_operation, db)
    if prochain_matricule:
        notifications.creer_notification(
            matricule=prochain_matricule,
            type_notification='VALIDATION',
            titre=f"Permission non-conventionnelle",
            message=f"{employe.prenom} {employe.nom} demande {duree_calculee} jours de permission",
            id_operation=operation.id_operation,
            db=db
        )
    
    return {
        "id_operation": operation.id_operation,
        "duree_jours": duree_calculee,
        "solde_avant": float(employe.solde_conges),
        "message": "Permission non-conventionnelle créée. Le solde sera déduit après validation complète."
    }


@router.post('/{id_operation}/televerser-preuves')
async def televerser_preuves(
    id_operation: int,
    fichier: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """
    Téléverser les preuves pour une permission conventionnelle.
    """
    operation = db.query(models.Operation).filter(
        models.Operation.id_operation == id_operation
    ).first()
    
    if not operation:
        raise HTTPException(status_code=404, detail="Opération introuvable")
    
    # Créer le dossier uploads s'il n'existe pas
    upload_dir = "uploads/preuves_permissions"
    os.makedirs(upload_dir, exist_ok=True)
    
    # Sauvegarder le fichier
    file_path = os.path.join(upload_dir, f"{id_operation}_{fichier.filename}")
    
    with open(file_path, "wb") as f:
        content = await fichier.read()
        f.write(content)
    
    # Enregistrer dans la BDD
    success, message = perm_utils.televerser_preuves_permission(
        id_operation, file_path, db, nom_fichier=fichier.filename
    )
    
    if not success:
        raise HTTPException(status_code=400, detail=message)

    # Notifier tous les validateurs de la séquence
    employe_op = db.query(models.Employe).filter(models.Employe.matricule == operation.matricule).first()
    if employe_op:
        sequence = workflow.determiner_sequence_validation(employe_op, db, id_operation)
        notifies = set()
        for role in sequence:
            mat_v = workflow.obtenir_validateur_pour_role(employe_op, role, db)
            if mat_v and mat_v not in notifies:
                notifies.add(mat_v)
                notifications.creer_notification(
                    matricule=mat_v,
                    type_notification='INFO',
                    titre='Preuve de permission téléversée',
                    message=f'Une preuve a été téléversée pour la permission de {employe_op.prenom} {employe_op.nom}. Vous pouvez la consulter en lecture seule.',
                    id_operation=id_operation,
                    db=db
                )

    return {
        "message": "Preuves téléversées avec succès",
        "chemin_fichier": file_path
    }


@router.get('/{id_operation}/verifier-preuves')
def verifier_preuves(id_operation: int, db: Session = Depends(get_db)):
    """
    Vérifier si les preuves d'une permission conventionnelle ont été fournies dans les délais.
    """
    en_regle, message, jours_restants = perm_utils.verifier_delai_preuves_permission(
        id_operation, db
    )
    
    return {
        "en_regle": en_regle,
        "message": message,
        "jours_restants": jours_restants
    }


@router.get('/{id_operation}/preuves')
def lister_preuves(id_operation: int, db: Session = Depends(get_db)):
    """Liste toutes les preuves téléversées pour une permission conventionnelle."""
    preuves = db.query(models.PreuvePermission).filter(
        models.PreuvePermission.id_perm_c == id_operation
    ).order_by(models.PreuvePermission.date_upload).all()
    return [
        {
            "id_preuve": p.id_preuve,
            "nom_fichier": p.nom_fichier,
            "url": f"/{p.chemin_fichier.replace(chr(92), '/')}",
            "date_upload": p.date_upload.isoformat() if p.date_upload else None,
        }
        for p in preuves
    ]


@router.delete('/{id_operation}/preuves/{id_preuve}')
def supprimer_preuve(id_operation: int, id_preuve: int, db: Session = Depends(get_db)):
    """Supprime une preuve spécifique."""
    preuve = db.query(models.PreuvePermission).filter(
        models.PreuvePermission.id_preuve == id_preuve,
        models.PreuvePermission.id_perm_c == id_operation
    ).first()
    if not preuve:
        raise HTTPException(status_code=404, detail="Preuve introuvable")
    if os.path.exists(preuve.chemin_fichier):
        os.remove(preuve.chemin_fichier)
    db.delete(preuve)
    db.flush()
    nb_restantes = db.query(models.PreuvePermission).filter(
        models.PreuvePermission.id_perm_c == id_operation
    ).count()
    perm_conv = db.query(models.PermConventionelle).filter(
        models.PermConventionelle.id_perm_c == id_operation
    ).first()
    if perm_conv:
        perm_conv.preuves_televersees = nb_restantes > 0
    db.commit()
    return {"message": "Preuve supprimée", "nb_restantes": nb_restantes}


@router.get('/mes-permissions/{matricule}')
def obtenir_mes_permissions(
    matricule: int,
    annee: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """
    Obtenir toutes les permissions d'un employé via jointure sur Permission table.
    """
    query = db.query(models.Operation).join(
        models.Permission,
        models.Operation.id_operation == models.Permission.id_permission
    ).filter(
        models.Operation.matricule == matricule
    )
    
    if annee:
        query = query.filter(
            db.func.year(models.Operation.date_debut) == annee
        )
    
    operations = query.order_by(models.Operation.date_debut.desc()).all()
    
    result = []
    for op in operations:
        type_info = perm_utils.obtenir_type_permission(op.id_operation, db)
        # Vérifier si conventionnelle
        perm_conv = db.query(models.PermConventionelle).filter(
            models.PermConventionelle.id_perm_c == op.id_operation
        ).first()
        
        item = {
            "id_operation": op.id_operation,
            "date_debut": op.date_debut,
            "date_fin": op.date_fin,
            "duree_jours": op.duree_jours,
            "statut": op.statut,
            "type": "Conventionnelle" if perm_conv else "Non-conventionnelle",
            "motif": op.motif,
            "titre": op.titre,
            "type_permission": type_info.get('sous_type') if type_info.get('est_conventionnelle') else 'non_conventionnelle',
            "sous_type": None,
            "est_conventionnelle": bool(type_info.get('est_conventionnelle'))
        }
        
        if perm_conv:
            item["preuves_televersees"] = perm_conv.preuves_televersees
            item["date_limite_preuves"] = perm_conv.date_limite_preuves
            item["date_telechargement_preuves"] = perm_conv.date_telechargement_preuves.isoformat() if perm_conv.date_telechargement_preuves else None
            item["preuves"] = [
                {
                    "id_preuve": p.id_preuve,
                    "nom_fichier": p.nom_fichier,
                    "url": f"/{p.chemin_fichier.replace(chr(92), '/')}",
                    "date_upload": p.date_upload.isoformat() if p.date_upload else None,
                }
                for p in perm_conv.preuves
            ]

        # Statut d'activation – nécessaire pour le filtre côté frontend
        activation = db.query(models.Activation).filter(
            models.Activation.id_operation == op.id_operation,
            models.Activation.type_action == models.TypeActionEnum.ACTIVATION
        ).first()
        cloture = db.query(models.Activation).filter(
            models.Activation.id_operation == op.id_operation,
            models.Activation.type_action == models.TypeActionEnum.CLOTURE
        ).first()
        item["activation_complete"] = bool(activation and activation.statut_final == models.StatutFinalEnum.COMPLETE)
        item["statut_activation"] = "ACTIVE" if item["activation_complete"] else "EN_ATTENTE"
        item["cloture_complete"] = bool(cloture and cloture.statut_final == models.StatutFinalEnum.COMPLETE)
        item["statut_cloture"] = cloture.statut_final.value if (cloture and cloture.statut_final) else None

        if item["type_permission"] in {'maternelle', 'bapteme', 'maladie'}:
            item["sous_type"] = item["type_permission"]
        
        result.append(item)
    
    return result


@router.put('/{id_operation}/modifier')
def modifier_permission(
    id_operation: int,
    date_debut: date,
    date_fin: date,
    motif: Optional[str] = None,
    type_permission: Optional[str] = None,
    sous_type: Optional[str] = None,
    request: Request = None,
    db: Session = Depends(get_db)
):
    operation = db.query(models.Operation).filter(
        models.Operation.id_operation == id_operation,
        models.Operation.type_demande == 'Permission'
    ).first()

    if not operation:
        raise HTTPException(status_code=404, detail='Demande de permission introuvable')

    if request is not None:
        actor_matricule, actor_role = access_control.get_actor_from_request(request)
        if operation.matricule != actor_matricule and not access_control.can_access_globally(str(actor_role or '').upper()):
            raise HTTPException(status_code=403, detail="Vous n'êtes pas autorisé à modifier cette demande")

    if operation.statut and str(operation.statut).lower() != 'en attente':
        raise HTTPException(status_code=400, detail='Seules les demandes en attente peuvent être modifiées')

    if workflow.operation_a_deja_ete_validee(id_operation, db):
        raise HTTPException(status_code=400, detail='Impossible de modifier une opération après la première validation')

    employe = db.query(models.Employe).filter(models.Employe.matricule == operation.matricule).first()
    if not employe:
        raise HTTPException(status_code=404, detail='Employé introuvable')

    duree = business_logic.calculer_jours_ouvrables(date_debut, date_fin)
    if duree <= 0:
        raise HTTPException(status_code=400, detail='La durée de la permission doit être positive')

    chevauchement, message_chevauchement = business_logic.verifier_chevauchement_operations(
        employe, date_debut, date_fin, db, operation_id=id_operation
    )
    if chevauchement:
        autres_ops = db.query(models.Operation).filter(
            models.Operation.matricule == operation.matricule,
            models.Operation.id_operation != id_operation,
            models.Operation.type_demande.in_(['Congé', 'Permission', 'Mission'])
        ).all()
        conflit = any(
            op.date_debut and op.date_fin and not (date_fin < op.date_debut or date_debut > op.date_fin)
            for op in autres_ops
        )
        if conflit:
            raise HTTPException(status_code=400, detail=message_chevauchement)

    type_info = perm_utils.obtenir_type_permission(id_operation, db)
    est_conventionnelle = bool(type_info.get('est_conventionnelle'))

    if est_conventionnelle:
        type_permission_final = (type_permission or type_info.get('sous_type') or '').lower()
        sous_type_final = (sous_type or None)
        est_valide, message_validation, duree_max = perm_utils.verifier_type_permission_conventionnelle(
            type_permission_final,
            sous_type_final
        )
        if not est_valide:
            raise HTTPException(status_code=400, detail=message_validation)
        if duree > duree_max:
            raise HTTPException(status_code=400, detail=f'Durée maximale pour ce type: {duree_max} jours')

        _replace_permission_subtype_rows(id_operation, type_permission_final, db)
        operation.titre = _build_permission_title(type_permission_final, sous_type_final, True)
    else:
        solde_ok, message_solde, _ = business_logic.verifier_solde_conges(employe, duree)
        if not solde_ok:
            raise HTTPException(status_code=400, detail=message_solde)
        operation.titre = _build_permission_title('non_conventionnelle', None, False)

    operation.date_debut = date_debut
    operation.date_fin = date_fin
    operation.duree_jours = duree
    operation.duree = duree
    operation.date_depart = date_debut
    operation.date_retour = date_fin
    operation.motif = motif
    operation.commentaire = motif
    operation.est_modifie = True
    operation.date_modification = datetime.utcnow()

    db.commit()
    db.refresh(operation)
    log_action(db, operation.matricule, 'UPDATE_PERMISSION', 'operation', id_operation,
               {'date_debut': str(date_debut), 'date_fin': str(date_fin), 'duree_jours': duree, 'motif': motif})

    return {
        'message': 'Demande de permission modifiée avec succès',
        'id_operation': operation.id_operation,
        'date_debut': operation.date_debut,
        'date_fin': operation.date_fin,
        'duree_jours': operation.duree_jours,
        'motif': operation.motif,
        'type_permission': type_permission or type_info.get('sous_type'),
        'sous_type': sous_type,
        'est_conventionnelle': est_conventionnelle,
    }


@router.post('/activation/{id_operation}/rh')
def activer_permission_rh(
    id_operation: int,
    matricule_rh: int,
    db: Session = Depends(get_db)
):
    success, message = activation_cloture.activer_operation_rh(
        id_operation, matricule_rh, db
    )
    if not success:
        raise HTTPException(status_code=400, detail=message)
    return {'message': message}


@router.post('/activation/{id_operation}/demandeur')
def activer_permission_demandeur(
    id_operation: int,
    matricule_demandeur: int,
    db: Session = Depends(get_db)
):
    success, message = activation_cloture.activer_operation_demandeur(
        id_operation, matricule_demandeur, db
    )
    if not success:
        raise HTTPException(status_code=400, detail=message)
    return {'message': message}


@router.post('/cloture/{id_operation}/demandeur')
def cloturer_permission_demandeur(
    id_operation: int,
    matricule_demandeur: int,
    retour_anticipe: bool = False,
    date_retour_anticipe: Optional[date] = None,
    db: Session = Depends(get_db)
):
    success, message = activation_cloture.cloturer_operation_demandeur(
        id_operation, matricule_demandeur, db, retour_anticipe, date_retour_anticipe
    )
    if not success:
        raise HTTPException(status_code=400, detail=message)
    return {'message': message}


@router.post('/cloture/{id_operation}/rh')
def cloturer_permission_rh(
    id_operation: int,
    matricule_rh: int,
    db: Session = Depends(get_db)
):
    success, message = activation_cloture.cloturer_operation_rh(
        id_operation, matricule_rh, db
    )
    if not success:
        raise HTTPException(status_code=400, detail=message)
    return {'message': message}
