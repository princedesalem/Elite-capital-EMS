"""
Router pour la persistence des paramètres utilisateurs en base de données.
Remplace le stockage localStorage qui se perd au changement de navigateur/device.
"""
from typing import Any, Dict

from fastapi import APIRouter, Body, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from datetime import datetime

from .. import models
from ..db import get_db
from ..utils import security

router = APIRouter(prefix='/api/settings', tags=['settings'])


def _decode_token(request: Request) -> int | None:
    auth = request.headers.get('authorization', '')
    if auth.lower().startswith('bearer '):
        try:
            payload = security.jwt.decode(
                auth.split(None, 1)[1],
                security.SECRET_KEY,
                algorithms=[security.ALGORITHM],
            )
            return payload.get('matricule')
        except Exception:
            pass
    return None


@router.get('/{matricule}')
def get_settings(matricule: str, request: Request, db: Session = Depends(get_db)):
    """Récupère les paramètres sauvegardés en DB pour un utilisateur."""
    actor = _decode_token(request)
    if actor is None:
        raise HTTPException(status_code=401, detail='Non authentifié')
    if actor != matricule:
        raise HTTPException(status_code=403, detail='Accès refusé')

    row = db.query(models.UserSettings).filter(models.UserSettings.matricule == matricule).first()
    if not row:
        return {'matricule': matricule, 'settings': {}}
    return {'matricule': matricule, 'settings': row.settings or {}}


@router.put('/{matricule}')
def save_settings(
    matricule: str,
    request: Request,
    payload: Dict[str, Any] = Body(...),
    db: Session = Depends(get_db),
):
    """Sauvegarde (upsert) les paramètres d'un utilisateur en DB."""
    actor = _decode_token(request)
    if actor is None:
        raise HTTPException(status_code=401, detail='Non authentifié')
    if actor != matricule:
        raise HTTPException(status_code=403, detail='Accès refusé')

    settings_data = payload.get('settings', payload)  # accept {settings: {...}} or directly {...}

    row = db.query(models.UserSettings).filter(models.UserSettings.matricule == matricule).first()
    if row:
        row.settings = settings_data
        row.updated_at = datetime.utcnow()
    else:
        row = models.UserSettings(
            matricule=matricule,
            settings=settings_data,
            updated_at=datetime.utcnow(),
        )
        db.add(row)

    db.commit()
    db.refresh(row)
    return {'matricule': matricule, 'settings': row.settings}
