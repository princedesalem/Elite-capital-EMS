from datetime import date, datetime
from typing import Any, Dict

from fastapi import APIRouter, Body, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models
from ..db import get_db


router = APIRouter(prefix='/api/tasks', tags=['tasks'])

ADMIN_ROLES = {'RH', 'DG', 'PCA', 'ADMIN'}
VALID_PRIORITIES = {'haute', 'moyenne', 'basse'}
VALID_STATUSES = {'a_faire', 'en_cours', 'termine', 'annule'}


def _normalize_role(role: str | None) -> str:
    return str(role or '').upper()


def _is_admin(role: str | None) -> bool:
    return _normalize_role(role) in ADMIN_ROLES


def _parse_due_date(raw_value: Any):
    if not raw_value:
        return None
    if isinstance(raw_value, date):
        return raw_value
    return date.fromisoformat(str(raw_value))


def _serialize_task(task: models.Task) -> Dict[str, Any]:
    return {
        'id': task.id_task,
        'titre': task.titre,
        'description': task.description or '',
        'priorite': task.priorite,
        'statut': task.statut,
        'date_echeance': task.date_echeance.isoformat() if task.date_echeance else '',
        'assigne_a': str(task.assigne_a) if task.assigne_a else '',
        'created_by': task.cree_par,
        'created_at': task.date_creation.isoformat() if task.date_creation else None,
        'updated_at': task.date_modification.isoformat() if task.date_modification else None,
    }


@router.get('/{matricule}')
def lister_taches(matricule: int, role: str = '', db: Session = Depends(get_db)):
    query = db.query(models.Task)
    if not _is_admin(role):
        query = query.filter(
            (models.Task.cree_par == matricule) |
            (models.Task.assigne_a == matricule)
        )
    tasks = query.order_by(models.Task.date_creation.desc()).all()
    return [_serialize_task(task) for task in tasks]


@router.post('/')
def creer_tache(payload: Dict[str, Any] = Body(...), db: Session = Depends(get_db)):
    matricule_actor = int(payload.get('matricule_actor') or 0)
    role_actor = payload.get('role_actor')
    titre = str(payload.get('titre') or '').strip()
    if not titre:
        raise HTTPException(status_code=400, detail='Le titre est obligatoire')

    priorite = str(payload.get('priorite') or 'moyenne')
    statut = str(payload.get('statut') or 'a_faire')
    if priorite not in VALID_PRIORITIES:
        raise HTTPException(status_code=400, detail='Priorité invalide')
    if statut not in VALID_STATUSES:
        raise HTTPException(status_code=400, detail='Statut invalide')

    assigne_a_raw = payload.get('assigne_a')
    assigne_a = int(assigne_a_raw) if assigne_a_raw not in [None, ''] else None
    if assigne_a and not _is_admin(role_actor) and assigne_a != matricule_actor:
        raise HTTPException(status_code=403, detail='Vous ne pouvez pas assigner une tâche à un autre employé')

    task = models.Task(
        titre=titre,
        description=payload.get('description') or None,
        priorite=priorite,
        statut=statut,
        date_echeance=_parse_due_date(payload.get('date_echeance')),
        assigne_a=assigne_a,
        cree_par=matricule_actor,
        date_creation=datetime.utcnow(),
        date_modification=datetime.utcnow(),
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return _serialize_task(task)


@router.put('/{id_task}')
def modifier_tache(id_task: int, payload: Dict[str, Any] = Body(...), db: Session = Depends(get_db)):
    task = db.query(models.Task).filter(models.Task.id_task == id_task).first()
    if not task:
        raise HTTPException(status_code=404, detail='Tâche introuvable')

    matricule_actor = int(payload.get('matricule_actor') or 0)
    role_actor = payload.get('role_actor')
    if not _is_admin(role_actor) and task.cree_par != matricule_actor:
        raise HTTPException(status_code=403, detail='Seul le créateur ou un administrateur peut modifier cette tâche')

    titre = str(payload.get('titre') or '').strip()
    if not titre:
        raise HTTPException(status_code=400, detail='Le titre est obligatoire')

    priorite = str(payload.get('priorite') or task.priorite)
    statut = str(payload.get('statut') or task.statut)
    if priorite not in VALID_PRIORITIES:
        raise HTTPException(status_code=400, detail='Priorité invalide')
    if statut not in VALID_STATUSES:
        raise HTTPException(status_code=400, detail='Statut invalide')

    assigne_a_raw = payload.get('assigne_a')
    assigne_a = int(assigne_a_raw) if assigne_a_raw not in [None, ''] else None
    if assigne_a and not _is_admin(role_actor) and assigne_a != matricule_actor:
        raise HTTPException(status_code=403, detail='Vous ne pouvez pas assigner une tâche à un autre employé')

    task.titre = titre
    task.description = payload.get('description') or None
    task.priorite = priorite
    task.statut = statut
    task.date_echeance = _parse_due_date(payload.get('date_echeance'))
    task.assigne_a = assigne_a
    task.date_modification = datetime.utcnow()

    db.commit()
    db.refresh(task)
    return _serialize_task(task)


@router.patch('/{id_task}/statut')
def modifier_statut_tache(id_task: int, payload: Dict[str, Any] = Body(...), db: Session = Depends(get_db)):
    task = db.query(models.Task).filter(models.Task.id_task == id_task).first()
    if not task:
        raise HTTPException(status_code=404, detail='Tâche introuvable')

    matricule_actor = int(payload.get('matricule_actor') or 0)
    role_actor = payload.get('role_actor')
    if not _is_admin(role_actor) and task.cree_par != matricule_actor and task.assigne_a != matricule_actor:
        raise HTTPException(status_code=403, detail='Vous ne pouvez pas modifier le statut de cette tâche')

    statut = str(payload.get('statut') or '')
    if statut not in VALID_STATUSES:
        raise HTTPException(status_code=400, detail='Statut invalide')

    task.statut = statut
    task.date_modification = datetime.utcnow()
    db.commit()
    db.refresh(task)
    return _serialize_task(task)


@router.delete('/{id_task}')
def supprimer_tache(id_task: int, matricule_actor: int, role_actor: str = '', db: Session = Depends(get_db)):
    task = db.query(models.Task).filter(models.Task.id_task == id_task).first()
    if not task:
        raise HTTPException(status_code=404, detail='Tâche introuvable')

    if not _is_admin(role_actor) and task.cree_par != matricule_actor:
        raise HTTPException(status_code=403, detail='Seul le créateur ou un administrateur peut supprimer cette tâche')

    db.delete(task)
    db.commit()
    return {'message': 'Tâche supprimée avec succès', 'id': id_task}