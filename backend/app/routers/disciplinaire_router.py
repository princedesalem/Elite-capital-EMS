"""
Router — Gestion Disciplinaire.

CRUD des mesures disciplinaires : blame, avertissement, sanction, conseil_discipline.
Seuls RH, ADMIN, DIRECTEUR, DG, PCA peuvent créer/modifier/supprimer.
Lecture accessible à l'employé concerné (ses propres mesures).
"""
from datetime import date, datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from .. import models
from ..db import get_db
from ..utils.security import get_current_user

router = APIRouter(prefix='/api/disciplinaire', tags=['disciplinaire'])

_ROLES_RH = {'RH', 'ADMIN', 'DIRECTEUR', 'DG', 'PCA'}

_TYPES_VALIDES = {'blame', 'avertissement', 'sanction', 'conseil_discipline'}


class MesureCreate(BaseModel):
    matricule: str
    type_mesure: str
    motif: str
    gravite: int = 1        # 1-5
    date_mesure: date


class MesureUpdate(BaseModel):
    type_mesure: Optional[str] = None
    motif: Optional[str] = None
    gravite: Optional[int] = None
    date_mesure: Optional[date] = None


def _serialize(m: models.MesureDisciplinaire, db: Session) -> dict:
    emp = db.query(models.Employe).filter_by(matricule=m.matricule).first()
    cr = db.query(models.Employe).filter_by(matricule=m.cree_par).first()
    return {
        'id_mesure': m.id_mesure,
        'matricule': m.matricule,
        'nom_employe': f"{emp.prenom} {emp.nom}" if emp else m.matricule,
        'type_mesure': m.type_mesure,
        'motif': m.motif,
        'gravite': m.gravite,
        'date_mesure': m.date_mesure.isoformat() if m.date_mesure else None,
        'cree_par': m.cree_par,
        'nom_createur': f"{cr.prenom} {cr.nom}" if cr else m.cree_par,
        'created_at': m.created_at.isoformat() if m.created_at else None,
    }


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post('/', status_code=status.HTTP_201_CREATED)
def creer_mesure(
    body: MesureCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    role = (current_user.get('role') or '').upper()
    if role not in _ROLES_RH:
        raise HTTPException(status_code=403, detail="Rôle insuffisant.")
    if body.type_mesure not in _TYPES_VALIDES:
        raise HTTPException(status_code=422, detail=f"type_mesure invalide. Valeurs acceptées : {_TYPES_VALIDES}")
    if not (1 <= body.gravite <= 5):
        raise HTTPException(status_code=422, detail="gravite doit être entre 1 et 5.")

    emp = db.query(models.Employe).filter_by(matricule=body.matricule).first()
    if not emp:
        raise HTTPException(status_code=404, detail="Employé introuvable.")

    mesure = models.MesureDisciplinaire(
        matricule=body.matricule,
        type_mesure=body.type_mesure,
        motif=body.motif,
        gravite=body.gravite,
        date_mesure=body.date_mesure,
        cree_par=current_user['matricule'],
        created_at=datetime.utcnow(),
    )
    db.add(mesure)
    db.commit()
    db.refresh(mesure)
    return _serialize(mesure, db)


@router.get('/')
def lister_mesures(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Toutes les mesures — réservé aux rôles habilitants."""
    role = (current_user.get('role') or '').upper()
    if role not in _ROLES_RH:
        raise HTTPException(status_code=403, detail="Accès réservé.")
    mesures = db.query(models.MesureDisciplinaire).order_by(
        models.MesureDisciplinaire.date_mesure.desc()
    ).all()
    return [_serialize(m, db) for m in mesures]


@router.get('/employe/{matricule}')
def mesures_employe(
    matricule: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Timeline disciplinaire d'un employé."""
    role = (current_user.get('role') or '').upper()
    if current_user['matricule'] != matricule and role not in _ROLES_RH:
        raise HTTPException(status_code=403, detail="Accès refusé.")
    mesures = db.query(models.MesureDisciplinaire).filter_by(matricule=matricule).order_by(
        models.MesureDisciplinaire.date_mesure.desc()
    ).all()
    return [_serialize(m, db) for m in mesures]


@router.put('/{id_mesure}')
def modifier_mesure(
    id_mesure: int,
    body: MesureUpdate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    role = (current_user.get('role') or '').upper()
    if role not in _ROLES_RH:
        raise HTTPException(status_code=403, detail="Rôle insuffisant.")
    mesure = db.query(models.MesureDisciplinaire).filter_by(id_mesure=id_mesure).first()
    if not mesure:
        raise HTTPException(status_code=404, detail="Mesure introuvable.")
    if body.type_mesure is not None:
        if body.type_mesure not in _TYPES_VALIDES:
            raise HTTPException(status_code=422, detail=f"type_mesure invalide.")
        mesure.type_mesure = body.type_mesure
    if body.motif is not None:
        mesure.motif = body.motif
    if body.gravite is not None:
        if not (1 <= body.gravite <= 5):
            raise HTTPException(status_code=422, detail="gravite doit être entre 1 et 5.")
        mesure.gravite = body.gravite
    if body.date_mesure is not None:
        mesure.date_mesure = body.date_mesure
    db.commit()
    db.refresh(mesure)
    return _serialize(mesure, db)


@router.delete('/{id_mesure}', status_code=status.HTTP_204_NO_CONTENT)
def supprimer_mesure(
    id_mesure: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    role = (current_user.get('role') or '').upper()
    if role not in _ROLES_RH:
        raise HTTPException(status_code=403, detail="Rôle insuffisant.")
    mesure = db.query(models.MesureDisciplinaire).filter_by(id_mesure=id_mesure).first()
    if not mesure:
        raise HTTPException(status_code=404, detail="Mesure introuvable.")
    db.delete(mesure)
    db.commit()
