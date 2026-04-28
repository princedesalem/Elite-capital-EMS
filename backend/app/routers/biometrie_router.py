"""Webhook biom\u00e9trie : endpoint stable pour recevoir les pointages.

S\u00e9curit\u00e9 : header `X-Biometrie-Token` v\u00e9rifi\u00e9 contre la variable
d'environnement `BIOMETRIE_WEBHOOK_TOKEN`. Si la variable n'est pas
d\u00e9finie, l'endpoint refuse 503 (configuration manquante) pour \u00e9viter
toute ingestion non authentifi\u00e9e par d\u00e9faut.

Idempotence : unique sur (matricule, date_pointage, device_id). Une seconde
requ\u00eate identique met \u00e0 jour `heure_depart` au lieu de cr\u00e9er un doublon.

Format JSON attendu :
    {
      "matricule": "EMP001",
      "date": "2026-04-28",
      "heure_arrivee": "08:23:00",
      "heure_depart": "17:05:00",   // optionnel
      "device_id": "ZKTECO-001"     // optionnel
    }

Exemple curl :
    curl -X POST https://api.example.com/api/biometrie/pointage \\
         -H "Content-Type: application/json" \\
         -H "X-Biometrie-Token: $BIOMETRIE_WEBHOOK_TOKEN" \\
         -d '{"matricule":"EMP001","date":"2026-04-28","heure_arrivee":"08:23:00"}'
"""
import os
from datetime import date as date_type, time as time_type
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Header, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Pointage, Employe
from ..utils.retards import detecter_retard


router = APIRouter(prefix='/api/biometrie', tags=['biometrie'])


class PointageIn(BaseModel):
    matricule: str = Field(..., max_length=32)
    date: date_type
    heure_arrivee: Optional[time_type] = None
    heure_depart: Optional[time_type] = None
    device_id: Optional[str] = Field(None, max_length=64)
    source: str = Field('biometrie', max_length=32)


class PointageOut(BaseModel):
    id_pointage: int
    matricule: str
    date_pointage: date_type
    heure_arrivee: Optional[time_type]
    heure_depart: Optional[time_type]
    retard_minutes: Optional[int]
    notif_retard_envoyee: bool


def _verify_token(x_biometrie_token: Optional[str]) -> None:
    expected = os.getenv('BIOMETRIE_WEBHOOK_TOKEN', '').strip()
    if not expected:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Webhook biom\u00e9trie non configur\u00e9 (BIOMETRIE_WEBHOOK_TOKEN manquant).",
        )
    if not x_biometrie_token or x_biometrie_token != expected:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token webhook biom\u00e9trie invalide.",
        )


@router.post('/pointage', status_code=status.HTTP_201_CREATED, response_model=PointageOut)
def recevoir_pointage(
    payload: PointageIn,
    x_biometrie_token: Optional[str] = Header(None, alias='X-Biometrie-Token'),
    db: Session = Depends(get_db),
):
    _verify_token(x_biometrie_token)

    employe = db.query(Employe).filter(Employe.matricule == payload.matricule).first()
    if not employe:
        raise HTTPException(status_code=404, detail="Employ\u00e9 inconnu")

    # Idempotence : si un pointage existe d\u00e9j\u00e0 pour (matricule, date, device_id),
    # on l'enrichit (par ex. ajout heure_depart) au lieu de dupliquer.
    existing = db.query(Pointage).filter(
        Pointage.matricule == payload.matricule,
        Pointage.date_pointage == payload.date,
        Pointage.device_id == payload.device_id,
    ).first()

    if existing:
        if payload.heure_arrivee and not existing.heure_arrivee:
            existing.heure_arrivee = payload.heure_arrivee
        if payload.heure_depart:
            existing.heure_depart = payload.heure_depart
        pointage = existing
    else:
        pointage = Pointage(
            matricule=payload.matricule,
            date_pointage=payload.date,
            heure_arrivee=payload.heure_arrivee,
            heure_depart=payload.heure_depart,
            device_id=payload.device_id,
            source=payload.source,
        )
        db.add(pointage)

    db.flush()

    notif_envoyee = False
    if pointage.heure_arrivee:
        _, notif_envoyee = detecter_retard(pointage, db)
    else:
        db.commit()

    return PointageOut(
        id_pointage=pointage.id_pointage,
        matricule=pointage.matricule,
        date_pointage=pointage.date_pointage,
        heure_arrivee=pointage.heure_arrivee,
        heure_depart=pointage.heure_depart,
        retard_minutes=pointage.retard_minutes,
        notif_retard_envoyee=notif_envoyee,
    )
