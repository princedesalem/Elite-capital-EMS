from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from .. import models
from ..db import get_db

router = APIRouter(prefix='/api/talent', tags=['talent'])


# ── Schemas ───────────────────────────────────────────────────────────────────

class MeetingCreate(BaseModel):
    titre: str
    manager_id: Optional[int] = None
    employee_id: Optional[int] = None
    date: Optional[str] = None
    agenda: Optional[str] = None
    notes: Optional[str] = None
    actions: Optional[str] = None
    statut: str = 'planifie'


class MeetingUpdate(MeetingCreate):
    pass


class GoalCreate(BaseModel):
    titre: str
    description: Optional[str] = None
    type: Optional[str] = None
    echeance: Optional[str] = None
    statut: str = 'a_faire'
    employee_id: Optional[int] = None


class GoalUpdate(GoalCreate):
    pass


# ── Serializers ───────────────────────────────────────────────────────────────

def _ser_meeting(m: models.TalentMeeting) -> dict:
    return {
        'id': m.id,
        'titre': m.titre,
        'manager_id': m.manager_id,
        'employee_id': m.employee_id,
        'date': m.date,
        'agenda': m.agenda,
        'notes': m.notes,
        'actions': m.actions,
        'statut': m.statut,
        'created_at': m.created_at.isoformat() if m.created_at else None,
        'updated_at': m.updated_at.isoformat() if m.updated_at else None,
    }


def _ser_goal(g: models.TalentGoal) -> dict:
    return {
        'id': g.id,
        'titre': g.titre,
        'description': g.description,
        'type': g.type,
        'echeance': g.echeance,
        'statut': g.statut,
        'employee_id': g.employee_id,
        'created_at': g.created_at.isoformat() if g.created_at else None,
        'updated_at': g.updated_at.isoformat() if g.updated_at else None,
    }


# ── Meetings routes ───────────────────────────────────────────────────────────

@router.get('/meetings')
def list_meetings(db: Session = Depends(get_db)):
    items = db.query(models.TalentMeeting).order_by(models.TalentMeeting.created_at.desc()).all()
    return [_ser_meeting(i) for i in items]


@router.post('/meetings')
def create_meeting(body: MeetingCreate, db: Session = Depends(get_db)):
    m = models.TalentMeeting(
        titre=body.titre,
        manager_id=body.manager_id,
        employee_id=body.employee_id,
        date=body.date,
        agenda=body.agenda,
        notes=body.notes,
        actions=body.actions,
        statut=body.statut,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db.add(m)
    db.commit()
    db.refresh(m)
    return _ser_meeting(m)


@router.put('/meetings/{meeting_id}')
def update_meeting(meeting_id: int, body: MeetingUpdate, db: Session = Depends(get_db)):
    m = db.query(models.TalentMeeting).filter(models.TalentMeeting.id == meeting_id).first()
    if not m:
        raise HTTPException(status_code=404, detail='Réunion introuvable')
    m.titre = body.titre
    m.manager_id = body.manager_id
    m.employee_id = body.employee_id
    m.date = body.date
    m.agenda = body.agenda
    m.notes = body.notes
    m.actions = body.actions
    m.statut = body.statut
    m.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(m)
    return _ser_meeting(m)


@router.delete('/meetings/{meeting_id}')
def delete_meeting(meeting_id: int, db: Session = Depends(get_db)):
    m = db.query(models.TalentMeeting).filter(models.TalentMeeting.id == meeting_id).first()
    if not m:
        raise HTTPException(status_code=404, detail='Réunion introuvable')
    db.delete(m)
    db.commit()
    return {'ok': True}


# ── Goals routes ──────────────────────────────────────────────────────────────

@router.get('/goals')
def list_goals(db: Session = Depends(get_db)):
    items = db.query(models.TalentGoal).order_by(models.TalentGoal.created_at.desc()).all()
    return [_ser_goal(i) for i in items]


@router.post('/goals')
def create_goal(body: GoalCreate, db: Session = Depends(get_db)):
    g = models.TalentGoal(
        titre=body.titre,
        description=body.description,
        type=body.type,
        echeance=body.echeance,
        statut=body.statut,
        employee_id=body.employee_id,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db.add(g)
    db.commit()
    db.refresh(g)
    return _ser_goal(g)


@router.put('/goals/{goal_id}')
def update_goal(goal_id: int, body: GoalUpdate, db: Session = Depends(get_db)):
    g = db.query(models.TalentGoal).filter(models.TalentGoal.id == goal_id).first()
    if not g:
        raise HTTPException(status_code=404, detail='Objectif introuvable')
    g.titre = body.titre
    g.description = body.description
    g.type = body.type
    g.echeance = body.echeance
    g.statut = body.statut
    g.employee_id = body.employee_id
    g.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(g)
    return _ser_goal(g)


@router.delete('/goals/{goal_id}')
def delete_goal(goal_id: int, db: Session = Depends(get_db)):
    g = db.query(models.TalentGoal).filter(models.TalentGoal.id == goal_id).first()
    if not g:
        raise HTTPException(status_code=404, detail='Objectif introuvable')
    db.delete(g)
    db.commit()
    return {'ok': True}
