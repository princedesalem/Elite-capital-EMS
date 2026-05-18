from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..db import get_db
from .. import models

router = APIRouter(prefix='/roles', tags=['roles'])


@router.get('/')
def list_roles(db: Session = Depends(get_db)):
    # DFC n'est plus un rôle assignable manuellement : il est déduit
    # automatiquement de la fonction 'Directeur financier et Comptable'.
    return db.query(models.Role).filter(models.Role.name != 'DFC').all()


@router.post('/')
def create_role(name: str, description: str = '', db: Session = Depends(get_db)):
    if db.query(models.Role).filter(models.Role.name == name).first():
        raise HTTPException(status_code=400, detail='Role exists')
    r = models.Role(name=name, description=description)
    db.add(r)
    db.commit()
    db.refresh(r)
    return r
