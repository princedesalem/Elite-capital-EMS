from datetime import datetime
from typing import Any, Dict

from fastapi import APIRouter, Body, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models
from ..db import get_db


router = APIRouter(prefix='/api/module-store', tags=['module-store'])


def _serialize(item: models.ModuleStoreItem) -> Dict[str, Any]:
    payload = item.payload if isinstance(item.payload, dict) else {}
    return {
        'id': item.id_item,
        **payload,
        '_created_by': item.created_by,
        '_created_at': item.created_at.isoformat() if item.created_at else None,
        '_updated_at': item.updated_at.isoformat() if item.updated_at else None,
    }


@router.get('/{module_name}')
def list_items(module_name: str, db: Session = Depends(get_db)):
    items = (
        db.query(models.ModuleStoreItem)
        .filter(models.ModuleStoreItem.module_name == module_name)
        .order_by(models.ModuleStoreItem.created_at.desc())
        .all()
    )
    return [_serialize(item) for item in items]


@router.post('/{module_name}')
def create_item(module_name: str, payload: Dict[str, Any] = Body(...), db: Session = Depends(get_db)):
    body = payload if isinstance(payload, dict) else {}
    actor = body.pop('_actor_matricule', None)

    item = models.ModuleStoreItem(
        module_name=module_name,
        payload=body,
        created_by=int(actor) if actor not in [None, ''] else None,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return _serialize(item)


@router.put('/{module_name}/{id_item}')
def update_item(module_name: str, id_item: int, payload: Dict[str, Any] = Body(...), db: Session = Depends(get_db)):
    item = (
        db.query(models.ModuleStoreItem)
        .filter(models.ModuleStoreItem.module_name == module_name, models.ModuleStoreItem.id_item == id_item)
        .first()
    )
    if not item:
        raise HTTPException(status_code=404, detail='Enregistrement introuvable')

    body = payload if isinstance(payload, dict) else {}
    body.pop('_actor_matricule', None)
    item.payload = body
    item.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(item)
    return _serialize(item)


@router.delete('/{module_name}/{id_item}')
def delete_item(module_name: str, id_item: int, db: Session = Depends(get_db)):
    item = (
        db.query(models.ModuleStoreItem)
        .filter(models.ModuleStoreItem.module_name == module_name, models.ModuleStoreItem.id_item == id_item)
        .first()
    )
    if not item:
        raise HTTPException(status_code=404, detail='Enregistrement introuvable')

    db.delete(item)
    db.commit()
    return {'message': 'Supprimé', 'id': id_item}
