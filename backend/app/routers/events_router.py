from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from .. import models
from ..db import get_db

router = APIRouter(prefix='/api/events', tags=['events'])


class EvenementCreate(BaseModel):
    titre: str
    type: str = 'Réunion'
    description: Optional[str] = None
    lieu: Optional[str] = None
    date_debut: str
    date_fin: Optional[str] = None
    organisateur: Optional[str] = None
    capacite: Optional[int] = None
    statut: str = 'brouillon'
    created_by: Optional[int] = None


class EvenementUpdate(EvenementCreate):
    pass


class StatutUpdate(BaseModel):
    statut: str


def _serialize(ev: models.Evenement) -> dict:
    return {
        'id': ev.id,
        'titre': ev.titre,
        'type': ev.type,
        'description': ev.description,
        'lieu': ev.lieu,
        'date_debut': ev.date_debut,
        'date_fin': ev.date_fin,
        'organisateur': ev.organisateur,
        'capacite': ev.capacite,
        'statut': ev.statut,
        'created_by': ev.created_by,
        'created_at': ev.created_at.isoformat() if ev.created_at else None,
        'updated_at': ev.updated_at.isoformat() if ev.updated_at else None,
    }


@router.get('')
def list_events(db: Session = Depends(get_db)):
    items = db.query(models.Evenement).order_by(models.Evenement.created_at.desc()).all()
    return [_serialize(i) for i in items]


@router.post('')
def create_event(body: EvenementCreate, db: Session = Depends(get_db)):
    ev = models.Evenement(
        titre=body.titre,
        type=body.type,
        description=body.description,
        lieu=body.lieu,
        date_debut=body.date_debut,
        date_fin=body.date_fin,
        organisateur=body.organisateur,
        capacite=body.capacite,
        statut=body.statut,
        created_by=body.created_by,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db.add(ev)
    db.commit()
    db.refresh(ev)
    return _serialize(ev)


@router.put('/{ev_id}')
def update_event(ev_id: int, body: EvenementUpdate, db: Session = Depends(get_db)):
    ev = db.query(models.Evenement).filter(models.Evenement.id == ev_id).first()
    if not ev:
        raise HTTPException(status_code=404, detail='Événement introuvable')
    ev.titre = body.titre
    ev.type = body.type
    ev.description = body.description
    ev.lieu = body.lieu
    ev.date_debut = body.date_debut
    ev.date_fin = body.date_fin
    ev.organisateur = body.organisateur
    ev.capacite = body.capacite
    ev.statut = body.statut
    ev.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(ev)
    return _serialize(ev)


@router.patch('/{ev_id}/statut')
def change_statut(ev_id: int, body: StatutUpdate, db: Session = Depends(get_db)):
    ev = db.query(models.Evenement).filter(models.Evenement.id == ev_id).first()
    if not ev:
        raise HTTPException(status_code=404, detail='Événement introuvable')
    ev.statut = body.statut
    ev.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(ev)
    return _serialize(ev)


@router.delete('/{ev_id}')
def delete_event(ev_id: int, db: Session = Depends(get_db)):
    ev = db.query(models.Evenement).filter(models.Evenement.id == ev_id).first()
    if not ev:
        raise HTTPException(status_code=404, detail='Événement introuvable')
    db.delete(ev)
    db.commit()
    return {'ok': True}
