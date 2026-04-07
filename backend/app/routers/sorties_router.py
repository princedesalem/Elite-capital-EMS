"""
Router pour la gestion des demandes de sortie (absences courtes infra-journalières).

Fonctionnalités :
- Création, modification et suppression de demandes de sortie
- Calcul automatique de la durée effective (déduction pause déjeuner 12h-14h)
- Workflow de validation (RH / responsable hiérarchique)
- Activation et clôture des sorties validées
- Historique et filtrage par période
"""
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from ..db import get_db
from .. import models
from datetime import date, time, datetime
from typing import List, Dict, Any, Optional
from ..utils import workflow, notifications, activation_cloture, access_control
import math
import re

router = APIRouter(prefix='/api/sorties', tags=['sorties'])


def _extract_heure_retour(commentaire: Optional[str]) -> Optional[str]:
    if not commentaire:
        return None
    marker = 'Heure retour:'
    idx = commentaire.find(marker)
    if idx == -1:
        return None
    value = commentaire[idx + len(marker):].strip()
    if '|' in value:
        value = value.split('|', 1)[0].strip()
    return value or None


def _strip_heure_retour(commentaire: Optional[str]) -> str:
    if not commentaire:
        return ''
    cleaned = re.sub(r'\s*\|\s*Heure retour:\s*\d{1,2}:\d{2}(:\d{2})?\s*', ' ', str(commentaire), flags=re.IGNORECASE)
    cleaned = re.sub(r'\s*Heure retour:\s*\d{1,2}:\d{2}(:\d{2})?\s*', ' ', cleaned, flags=re.IGNORECASE)
    return cleaned.strip()


def _parse_time(value: Any) -> time:
    parts = str(value).split(':')
    return time(int(parts[0]), int(parts[1]) if len(parts) > 1 else 0)


def _duration_hours(heure_sortie_value: Any, heure_retour_value: Any) -> float:
    heure_sortie_obj = _parse_time(heure_sortie_value) if not isinstance(heure_sortie_value, time) else heure_sortie_value
    heure_retour_obj = _parse_time(heure_retour_value) if not isinstance(heure_retour_value, time) else heure_retour_value
    start_minutes = (heure_sortie_obj.hour * 60) + heure_sortie_obj.minute
    end_minutes = (heure_retour_obj.hour * 60) + heure_retour_obj.minute
    if end_minutes <= start_minutes:
        raise HTTPException(status_code=422, detail="L'heure de retour doit être supérieure à l'heure de départ.")
    return round((end_minutes - start_minutes) / 60, 2)


def _effective_duration_hours(heure_sortie_value: Any, heure_retour_value: Any) -> float:
    """Compute effective duration with lunch break deduction.

    Rule: subtract 1 hour max if interval overlaps lunch window [12:00, 14:00].
    """
    brute = _duration_hours(heure_sortie_value, heure_retour_value)
    heure_sortie_obj = _parse_time(heure_sortie_value) if not isinstance(heure_sortie_value, time) else heure_sortie_value
    heure_retour_obj = _parse_time(heure_retour_value) if not isinstance(heure_retour_value, time) else heure_retour_value

    start_minutes = (heure_sortie_obj.hour * 60) + heure_sortie_obj.minute
    end_minutes = (heure_retour_obj.hour * 60) + heure_retour_obj.minute
    lunch_start = 12 * 60
    lunch_end = 14 * 60

    overlap_start = max(start_minutes, lunch_start)
    overlap_end = min(end_minutes, lunch_end)
    overlap_minutes = max(0, overlap_end - overlap_start)

    deduction_hours = 1 if overlap_minutes > 0 else 0
    effective = max(0.0, brute - deduction_hours)
    return round(effective, 2)


def _build_commentaire(commentaire: Optional[str], heure_retour: Optional[str]) -> Optional[str]:
    parts = []
    if commentaire and str(commentaire).strip():
        parts.append(str(commentaire).strip())
    if heure_retour and str(heure_retour).strip():
        parts.append(f"Heure retour: {str(heure_retour).strip()}")
    return ' | '.join(parts) if parts else None


@router.get('/')
def list_sorties(matricule: int = None, db: Session = Depends(get_db)):
    q = db.query(models.Sortie)
    if matricule:
        q = q.filter(models.Sortie.matricule == matricule)
    rows = q.order_by(models.Sortie.date_creation.desc()).all()
    return [
        {
            'duree_heures': _effective_duration_hours(r.heure_sortie, _extract_heure_retour(r.commentaire)) if (r.heure_sortie and _extract_heure_retour(r.commentaire)) else None,
            'id_sortie':     r.id_sortie,
            'matricule':     r.matricule,
            'id_operation':  r.id_operation,
            'date_sortie':   r.date_sortie.isoformat() if r.date_sortie else None,
            'heure_sortie':  str(r.heure_sortie) if r.heure_sortie else None,
            'heure_retour':  _extract_heure_retour(r.commentaire),
            'commentaire':   r.commentaire,
            'statut':        r.statut,
            'date_creation': r.date_creation.isoformat() if r.date_creation else None,
        }
        for r in rows
    ]


@router.post('/')
def create_sortie(payload: Dict[str, Any], db: Session = Depends(get_db)):
    date_str  = payload.get('date_sortie')
    heure_str = payload.get('heure_sortie')
    heure_retour = payload.get('heure_retour')
    if not date_str or not heure_str or not heure_retour:
        raise HTTPException(status_code=422, detail='date_sortie, heure_sortie et heure_retour sont requis.')

    try:
        d = date.fromisoformat(str(date_str))
    except ValueError:
        raise HTTPException(status_code=422, detail='Format de date invalide (YYYY-MM-DD attendu).')

    try:
        h = _parse_time(heure_str)
        duree_heures = _effective_duration_hours(h, heure_retour)
    except (ValueError, IndexError, TypeError):
        raise HTTPException(status_code=422, detail="Format d'heure invalide (HH:MM attendu).")

    if duree_heures > 4:
        raise HTTPException(status_code=422, detail='Une demande de sortie ne peut pas dépasser 4 heures effectives.')

    matricule = payload.get('matricule')
    if not matricule:
        raise HTTPException(status_code=422, detail='matricule est requis.')

    employe = db.query(models.Employe).filter(models.Employe.matricule == int(matricule)).first()
    if not employe:
        raise HTTPException(status_code=404, detail='Employé introuvable.')

    operation = models.Operation(
        matricule=int(matricule),
        titre='Demande de sortie',
        commentaire=_build_commentaire(payload.get('commentaire'), heure_retour),
        type_demande='Sortie',
        statut='en attente',
        date_debut=d,
        date_fin=d,
        date_depart=d,
        date_retour=d,
        date_demande=datetime.now(),
        duree_jours=1,
        duree=max(1, math.ceil(duree_heures)),
        motif=payload.get('commentaire') or 'Sortie'
    )
    db.add(operation)
    db.commit()
    db.refresh(operation)

    sortie = models.Sortie(
        matricule=int(matricule),
        id_operation=operation.id_operation,
        date_sortie=d,
        heure_sortie=h,
        commentaire=_build_commentaire(payload.get('commentaire'), heure_retour),
        statut='en attente',
    )
    db.add(sortie)
    db.commit()
    db.refresh(sortie)

    prochain_role, prochain_matricule = workflow.obtenir_prochain_validateur(operation.id_operation, db)
    if prochain_matricule:
        notifications.creer_notification(
            matricule=prochain_matricule,
            type_notification='VALIDATION',
            titre='Nouvelle demande de sortie',
            message=f"{employe.prenom} {employe.nom} a soumis une demande de sortie.",
            id_operation=operation.id_operation,
            db=db
        )

    return {
        'duree_heures': duree_heures,
        'id_sortie':     sortie.id_sortie,
        'matricule':     sortie.matricule,
        'id_operation':  sortie.id_operation,
        'date_sortie':   sortie.date_sortie.isoformat(),
        'heure_sortie':  str(sortie.heure_sortie),
        'heure_retour': _extract_heure_retour(sortie.commentaire),
        'commentaire':   sortie.commentaire,
        'statut':        sortie.statut,
        'date_creation': sortie.date_creation.isoformat() if sortie.date_creation else None,
        'prochain_validateur': prochain_role,
    }


@router.put('/{id_operation}/annuler')
def annuler_sortie(id_operation: int, request: Request, db: Session = Depends(get_db)):
    actor_matricule, actor_role = access_control.get_actor_from_request(request)
    operation = db.query(models.Operation).filter(models.Operation.id_operation == id_operation).first()
    if not operation:
        raise HTTPException(status_code=404, detail='Opération introuvable.')

    if operation.matricule != actor_matricule and not access_control.can_access_globally(str(actor_role or '').upper()):
        raise HTTPException(status_code=403, detail="Vous n'êtes pas autorisé à annuler cette sortie.")

    if operation.type_demande != 'Sortie':
        raise HTTPException(status_code=400, detail='Cette opération n\'est pas une sortie.')

    if operation.statut and str(operation.statut).lower() != 'en attente':
        raise HTTPException(status_code=400, detail='Seules les sorties en attente peuvent être annulées.')

    sortie = db.query(models.Sortie).filter(models.Sortie.id_operation == id_operation).first()

    if workflow.operation_est_validee_par_validateur_final(id_operation, db):
        raise HTTPException(status_code=400, detail='Impossible d\'annuler une sortie déjà validée par le validateur final.')

    notifications.ajouter_notifications_annulation_operation(operation, actor_matricule, db)

    db.query(models.Validation).filter(models.Validation.id_operation == id_operation).delete()
    db.query(models.Creation).filter(models.Creation.id_operation == id_operation).delete()
    db.query(models.Notification).filter(models.Notification.id_operation == id_operation).delete()
    db.query(models.Activation).filter(models.Activation.id_operation == id_operation).delete()
    db.query(models.RemplacantPropose).filter(models.RemplacantPropose.id_operation == id_operation).delete()
    db.query(models.DemandeExplication).filter(models.DemandeExplication.id_operation == id_operation).delete()

    if sortie:
        db.delete(sortie)
    # Also clean up any orphan Sortie records linked by id_sortie matching this operation
    db.query(models.Sortie).filter(models.Sortie.id_sortie == id_operation, models.Sortie.id_operation.is_(None)).delete()
    db.delete(operation)
    db.commit()

    return {'message': f'Sortie #{id_operation} annulée avec succès', 'id_operation': id_operation}


@router.put('/{id_operation}/modifier')
def modifier_sortie(id_operation: int, payload: Dict[str, Any], request: Request, db: Session = Depends(get_db)):
    operation = db.query(models.Operation).filter(models.Operation.id_operation == id_operation).first()
    if not operation:
        raise HTTPException(status_code=404, detail='Opération introuvable.')

    actor_matricule, actor_role = access_control.get_actor_from_request(request)
    if operation.matricule != actor_matricule and not access_control.can_access_globally(str(actor_role or '').upper()):
        raise HTTPException(status_code=403, detail="Vous n'êtes pas autorisé à modifier cette sortie.")

    if operation.type_demande != 'Sortie':
        raise HTTPException(status_code=400, detail='Cette opération n\'est pas une sortie.')

    if operation.statut and str(operation.statut).lower() != 'en attente':
        raise HTTPException(status_code=400, detail='Seules les sorties en attente peuvent être modifiées.')

    sortie = db.query(models.Sortie).filter(models.Sortie.id_operation == id_operation).first()
    if not sortie:
        raise HTTPException(status_code=404, detail='Sortie introuvable.')

    if workflow.operation_a_deja_ete_validee(id_operation, db):
        raise HTTPException(status_code=400, detail='Impossible de modifier une sortie après la première validation.')

    date_str = payload.get('date_sortie')
    heure_str = payload.get('heure_sortie')
    heure_retour_payload = payload.get('heure_retour')
    commentaire_payload = payload.get('commentaire')

    try:
        if date_str:
            d = date.fromisoformat(str(date_str))
            sortie.date_sortie = d
            operation.date_debut = d
            operation.date_fin = d
            operation.date_depart = d
            operation.date_retour = d

        if operation.date_debut:
            operation.date_fin = operation.date_debut
            operation.date_retour = operation.date_debut
        operation.duree_jours = 1

        if heure_str:
            h = _parse_time(heure_str)
            sortie.heure_sortie = h

        heure_retour_value = heure_retour_payload if heure_retour_payload is not None else _extract_heure_retour(sortie.commentaire)
        if not heure_retour_value:
            raise HTTPException(status_code=422, detail='heure_retour est requise.')

        duree_heures = _effective_duration_hours(sortie.heure_sortie, heure_retour_value)
        if duree_heures > 4:
            raise HTTPException(status_code=422, detail='Une demande de sortie ne peut pas dépasser 4 heures effectives.')
        operation.duree = max(1, math.ceil(duree_heures))

        base_comment = commentaire_payload if commentaire_payload is not None else _strip_heure_retour(sortie.commentaire)
        final_comment = _build_commentaire(base_comment, heure_retour_value)
        sortie.commentaire = final_comment
        operation.commentaire = final_comment
        if commentaire_payload is not None:
            operation.motif = str(commentaire_payload)

        operation.est_modifie = True
        operation.date_modification = datetime.utcnow()

        db.commit()
        db.refresh(sortie)

        return {
            'duree_heures': duree_heures,
            'message': f'Sortie #{id_operation} modifiée avec succès',
            'id_operation': id_operation,
            'date_sortie': sortie.date_sortie.isoformat() if sortie.date_sortie else None,
            'heure_sortie': str(sortie.heure_sortie) if sortie.heure_sortie else None,
            'heure_retour': _extract_heure_retour(sortie.commentaire),
            'commentaire': sortie.commentaire,
        }
    except ValueError:
        db.rollback()
        raise HTTPException(status_code=422, detail='Format date/heure invalide.')
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f'Erreur lors de la modification: {str(e)}')


@router.post('/activation/{id_operation}/demandeur')
def activer_sortie_demandeur(
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


@router.post('/activation/{id_operation}/rh')
def activer_sortie_rh(
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


@router.post('/cloture/{id_operation}/demandeur')
def cloturer_sortie_demandeur(
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
def cloturer_sortie_rh(
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
