from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..db import get_db
from .. import models
from datetime import date, time, datetime
from typing import List, Dict, Any

router = APIRouter(prefix='/api/sorties', tags=['sorties'])


@router.get('/')
def list_sorties(matricule: int = None, db: Session = Depends(get_db)):
    q = db.query(models.Sortie)
    if matricule:
        q = q.filter(models.Sortie.matricule == matricule)
    rows = q.order_by(models.Sortie.date_creation.desc()).all()
    return [
        {
            'id_sortie':     r.id_sortie,
            'matricule':     r.matricule,
            'date_sortie':   r.date_sortie.isoformat() if r.date_sortie else None,
            'heure_sortie':  str(r.heure_sortie) if r.heure_sortie else None,
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
    if not date_str or not heure_str:
        raise HTTPException(status_code=422, detail='date_sortie et heure_sortie sont requis.')

    try:
        d = date.fromisoformat(str(date_str))
    except ValueError:
        raise HTTPException(status_code=422, detail='Format de date invalide (YYYY-MM-DD attendu).')

    try:
        parts = str(heure_str).split(':')
        h = time(int(parts[0]), int(parts[1]) if len(parts) > 1 else 0)
    except (ValueError, IndexError):
        raise HTTPException(status_code=422, detail="Format d'heure invalide (HH:MM attendu).")

    matricule = payload.get('matricule')
    if not matricule:
        raise HTTPException(status_code=422, detail='matricule est requis.')

    sortie = models.Sortie(
        matricule=int(matricule),
        date_sortie=d,
        heure_sortie=h,
        commentaire=payload.get('commentaire') or None,
        statut='en attente',
    )
    db.add(sortie)
    db.commit()
    db.refresh(sortie)

    return {
        'id_sortie':     sortie.id_sortie,
        'matricule':     sortie.matricule,
        'date_sortie':   sortie.date_sortie.isoformat(),
        'heure_sortie':  str(sortie.heure_sortie),
        'commentaire':   sortie.commentaire,
        'statut':        sortie.statut,
        'date_creation': sortie.date_creation.isoformat() if sortie.date_creation else None,
    }
