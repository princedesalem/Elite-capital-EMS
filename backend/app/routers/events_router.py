from datetime import datetime
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from .. import models
from ..db import get_db
from ..utils.security import get_current_user

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


# ── Inscriptions & Présence ────────────────────────────────────────────────────

class InscriptionBody(BaseModel):
    matricules: List[str]


class PresenceBody(BaseModel):
    statut: str   # present | absent


def _serialize_inscription(ins: models.InscriptionEvenement, db: Session) -> dict:
    emp = db.query(models.Employe).filter_by(matricule=ins.matricule).first()
    return {
        'id_inscription': ins.id_inscription,
        'id_evenement': ins.id_evenement,
        'matricule': ins.matricule,
        'nom': f"{emp.prenom} {emp.nom}" if emp else ins.matricule,
        'statut': ins.statut,
        'inscrit_le': ins.inscrit_le.isoformat() if ins.inscrit_le else None,
        'confirme_le': ins.confirme_le.isoformat() if ins.confirme_le else None,
        'confirme_par': ins.confirme_par,
    }


@router.post('/{ev_id}/inscriptions', status_code=201)
def inscrire_employes(
    ev_id: int,
    body: InscriptionBody,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Inscrire un ou plusieurs employés à un événement."""
    ev = db.query(models.Evenement).filter(models.Evenement.id == ev_id).first()
    if not ev:
        raise HTTPException(status_code=404, detail='Événement introuvable')
    created = []
    for mat in body.matricules:
        existing = db.query(models.InscriptionEvenement).filter_by(
            id_evenement=ev_id, matricule=mat
        ).first()
        if existing:
            continue
        ins = models.InscriptionEvenement(
            id_evenement=ev_id,
            matricule=mat,
            statut='inscrit',
            inscrit_le=datetime.utcnow(),
        )
        db.add(ins)
        created.append(mat)
    db.commit()
    return {'inscrits': created}


@router.get('/{ev_id}/inscriptions')
def liste_inscriptions(
    ev_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Liste des inscriptions à un événement."""
    ev = db.query(models.Evenement).filter(models.Evenement.id == ev_id).first()
    if not ev:
        raise HTTPException(status_code=404, detail='Événement introuvable')
    inscriptions = db.query(models.InscriptionEvenement).filter_by(id_evenement=ev_id).all()
    return [_serialize_inscription(i, db) for i in inscriptions]


@router.patch('/{ev_id}/inscriptions/{matricule}/presence')
def marquer_presence(
    ev_id: int,
    matricule: str,
    body: PresenceBody,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Marquer présent/absent. RH ou l'employé lui-même peuvent confirmer."""
    if body.statut not in ('present', 'absent'):
        raise HTTPException(status_code=422, detail="statut doit être 'present' ou 'absent'.")
    ins = db.query(models.InscriptionEvenement).filter_by(
        id_evenement=ev_id, matricule=matricule
    ).first()
    if not ins:
        raise HTTPException(status_code=404, detail='Inscription introuvable.')
    ins.statut = body.statut
    ins.confirme_le = datetime.utcnow()
    ins.confirme_par = current_user['matricule']
    db.commit()
    db.refresh(ins)
    return _serialize_inscription(ins, db)


@router.delete('/{ev_id}/inscriptions/{matricule}', status_code=204)
def annuler_inscription(
    ev_id: int,
    matricule: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Annuler une inscription (RH ou l'employé lui-même)."""
    ins = db.query(models.InscriptionEvenement).filter_by(
        id_evenement=ev_id, matricule=matricule
    ).first()
    if not ins:
        raise HTTPException(status_code=404, detail='Inscription introuvable.')
    role = (current_user.get('role') or '').upper()
    if current_user['matricule'] != matricule and role not in {'RH', 'ADMIN', 'DIRECTEUR', 'DG', 'PCA'}:
        raise HTTPException(status_code=403, detail='Accès refusé.')
    db.delete(ins)
    db.commit()

