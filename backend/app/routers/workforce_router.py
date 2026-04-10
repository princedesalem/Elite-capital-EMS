from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from .. import models
from ..db import get_db

router = APIRouter(prefix='/api/workforce', tags=['workforce'])


class PositionCreate(BaseModel):
    titre: str
    direction: Optional[str] = None
    entite: Optional[str] = None
    trimestre: str = 'T1'
    annee: Optional[str] = None
    budget: Optional[float] = None
    priorite: str = 'moyenne'
    statut: str = 'planifie'
    notes: Optional[str] = None
    created_by: Optional[int] = None


class PositionUpdate(PositionCreate):
    pass


def _serialize(p: models.WorkforcePosition) -> dict:
    return {
        'id': p.id,
        'titre': p.titre,
        'direction': p.direction,
        'entite': p.entite,
        'trimestre': p.trimestre,
        'annee': p.annee,
        'budget': float(p.budget) if p.budget is not None else None,
        'priorite': p.priorite,
        'statut': p.statut,
        'notes': p.notes,
        'created_by': p.created_by,
        'created_at': p.created_at.isoformat() if p.created_at else None,
        'updated_at': p.updated_at.isoformat() if p.updated_at else None,
    }


@router.get('/positions')
def list_positions(db: Session = Depends(get_db)):
    items = db.query(models.WorkforcePosition).order_by(models.WorkforcePosition.created_at.desc()).all()
    return [_serialize(i) for i in items]


@router.post('/positions')
def create_position(body: PositionCreate, db: Session = Depends(get_db)):
    p = models.WorkforcePosition(
        titre=body.titre,
        direction=body.direction,
        entite=body.entite,
        trimestre=body.trimestre,
        annee=body.annee,
        budget=body.budget,
        priorite=body.priorite,
        statut=body.statut,
        notes=body.notes,
        created_by=body.created_by,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db.add(p)
    db.commit()
    db.refresh(p)
    return _serialize(p)


@router.put('/positions/{pos_id}')
def update_position(pos_id: int, body: PositionUpdate, db: Session = Depends(get_db)):
    p = db.query(models.WorkforcePosition).filter(models.WorkforcePosition.id == pos_id).first()
    if not p:
        raise HTTPException(status_code=404, detail='Poste introuvable')
    p.titre = body.titre
    p.direction = body.direction
    p.entite = body.entite
    p.trimestre = body.trimestre
    p.annee = body.annee
    p.budget = body.budget
    p.priorite = body.priorite
    p.statut = body.statut
    p.notes = body.notes
    p.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(p)
    return _serialize(p)


@router.delete('/positions/{pos_id}')
def delete_position(pos_id: int, db: Session = Depends(get_db)):
    p = db.query(models.WorkforcePosition).filter(models.WorkforcePosition.id == pos_id).first()
    if not p:
        raise HTTPException(status_code=404, detail='Poste introuvable')
    db.delete(p)
    db.commit()
    return {'ok': True}
