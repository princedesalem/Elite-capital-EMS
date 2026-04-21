from datetime import date, datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Body, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models
from ..db import get_db
from ..utils.audit import log_action


router = APIRouter(prefix='/api/tasks', tags=['tasks'])

ADMIN_ROLES = {'RH', 'DG', 'PCA', 'ADMIN'}
VALID_PRIORITIES = {'haute', 'moyenne', 'basse'}
VALID_STATUSES = {'a_faire', 'en_cours', 'termine', 'annule'}


def _normalize_role(role: Optional[str]) -> str:
    return str(role or '').upper()


def _is_admin(role: Optional[str]) -> bool:
    return _normalize_role(role) in ADMIN_ROLES


def _parse_due_date(raw_value: Any):
    if not raw_value:
        return None
    if isinstance(raw_value, date):
        return raw_value
    return date.fromisoformat(str(raw_value))


def _get_assignees(task_id: int, db: Session) -> List[int]:
    rows = db.query(models.TaskAssignee).filter(models.TaskAssignee.id_task == task_id).all()
    return [r.matricule_employe for r in rows]


def _get_assignees_details(task_id: int, db: Session) -> List[Dict]:
    rows = db.query(models.TaskAssignee).filter(models.TaskAssignee.id_task == task_id).all()
    result = []
    for r in rows:
        emp = db.query(models.Employe).filter(models.Employe.matricule == r.matricule_employe).first()
        result.append({
            'matricule': r.matricule_employe,
            'nom': f"{emp.prenom or ''} {emp.nom or ''}".strip() if emp else str(r.matricule_employe),
            'fonction': emp.fonction or '' if emp else '',
        })
    return result


def _set_assignees(task_id: int, assignees: List[int], db: Session):
    """Replace all assignees for a task."""
    db.query(models.TaskAssignee).filter(models.TaskAssignee.id_task == task_id).delete()
    seen = set()
    for mat in assignees:
        if mat and mat not in seen:
            seen.add(mat)
            db.add(models.TaskAssignee(id_task=task_id, matricule_employe=mat))


def _serialize_task(task: models.Task, db: Session) -> Dict[str, Any]:
    assignees = _get_assignees_details(task.id_task, db)
    # Legacy compat: assigne_a still works as first assignee
    return {
        'id': task.id_task,
        'titre': task.titre,
        'description': task.description or '',
        'priorite': task.priorite,
        'statut': task.statut,
        'date_echeance': task.date_echeance.isoformat() if task.date_echeance else '',
        'assigne_a': str(task.assigne_a) if task.assigne_a else '',
        'assignees': assignees,
        'created_by': task.cree_par,
        'created_at': task.date_creation.isoformat() if task.date_creation else None,
        'updated_at': task.date_modification.isoformat() if task.date_modification else None,
    }


def _parse_assignees(payload: Dict, role_actor: Optional[str], matricule_actor: int) -> List[int]:
    """Parse both legacy assigne_a and new assignees[] from payload."""
    assignees_raw = payload.get('assignees') or []
    if isinstance(assignees_raw, str):
        assignees_raw = [assignees_raw] if assignees_raw else []

    # Legacy single assignee
    assigne_a_raw = payload.get('assigne_a')
    if assigne_a_raw not in [None, '']:
        legacy = int(assigne_a_raw)
        if legacy not in assignees_raw:
            assignees_raw = [legacy] + list(assignees_raw)

    assignees = [int(m) for m in assignees_raw if m not in [None, '']]

    if not _is_admin(role_actor):
        for m in assignees:
            if m != matricule_actor:
                raise HTTPException(status_code=403, detail='Vous ne pouvez pas assigner une tâche à un autre employé')

    return assignees


@router.get('/{matricule}')
def lister_taches(matricule: int, role: str = '', db: Session = Depends(get_db)):
    query = db.query(models.Task)
    if not _is_admin(role):
        # Include tasks where this user is creator, legacy assignee, or in TASK_ASSIGNEE
        assigned_task_ids = [
            row.id_task for row in
            db.query(models.TaskAssignee).filter(models.TaskAssignee.matricule_employe == matricule).all()
        ]
        query = query.filter(
            (models.Task.cree_par == matricule) |
            (models.Task.assigne_a == matricule) |
            (models.Task.id_task.in_(assigned_task_ids))
        )
    tasks = query.order_by(models.Task.date_creation.desc()).all()
    return [_serialize_task(task, db) for task in tasks]


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

    assignees = _parse_assignees(payload, role_actor, matricule_actor)
    # Legacy compat: store first assignee in assigne_a
    assigne_a = assignees[0] if assignees else None

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
    db.flush()
    _set_assignees(task.id_task, assignees, db)
    db.commit()
    db.refresh(task)
    log_action(db, matricule_actor, 'CREATE_TASK', 'task', task.id_task, {'titre': titre, 'priorite': priorite, 'assignees': assignees})
    return _serialize_task(task, db)


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

    assignees = _parse_assignees(payload, role_actor, matricule_actor)
    assigne_a = assignees[0] if assignees else None

    task.titre = titre
    task.description = payload.get('description') or None
    task.priorite = priorite
    task.statut = statut
    task.date_echeance = _parse_due_date(payload.get('date_echeance'))
    task.assigne_a = assigne_a
    task.date_modification = datetime.utcnow()

    _set_assignees(task.id_task, assignees, db)
    db.commit()
    db.refresh(task)
    log_action(db, matricule_actor, 'UPDATE_TASK', 'task', task.id_task, {'titre': titre, 'statut': statut, 'assignees': assignees})
    return _serialize_task(task, db)


@router.patch('/{id_task}/statut')
def modifier_statut_tache(id_task: int, payload: Dict[str, Any] = Body(...), db: Session = Depends(get_db)):
    task = db.query(models.Task).filter(models.Task.id_task == id_task).first()
    if not task:
        raise HTTPException(status_code=404, detail='Tâche introuvable')

    matricule_actor = int(payload.get('matricule_actor') or 0)
    role_actor = payload.get('role_actor')
    assigned_mats = _get_assignees(task.id_task, db)
    if not _is_admin(role_actor) and task.cree_par != matricule_actor and task.assigne_a != matricule_actor and matricule_actor not in assigned_mats:
        raise HTTPException(status_code=403, detail='Vous ne pouvez pas modifier le statut de cette tâche')

    statut = str(payload.get('statut') or '')
    if statut not in VALID_STATUSES:
        raise HTTPException(status_code=400, detail='Statut invalide')

    task.statut = statut
    task.date_modification = datetime.utcnow()
    db.commit()
    db.refresh(task)
    log_action(db, matricule_actor, 'UPDATE_TASK_STATUS', 'task', task.id_task, {'statut': statut})
    return _serialize_task(task, db)


@router.delete('/{id_task}')
def supprimer_tache(id_task: int, matricule_actor: int, role_actor: str = '', db: Session = Depends(get_db)):
    task = db.query(models.Task).filter(models.Task.id_task == id_task).first()
    if not task:
        raise HTTPException(status_code=404, detail='Tâche introuvable')

    if not _is_admin(role_actor) and task.cree_par != matricule_actor:
        raise HTTPException(status_code=403, detail='Seul le créateur ou un administrateur peut supprimer cette tâche')

    titre_before = task.titre
    db.delete(task)
    db.commit()
    log_action(db, matricule_actor, 'DELETE_TASK', 'task', id_task, {'titre': titre_before})
    return {'message': 'Tâche supprimée avec succès', 'id': id_task}