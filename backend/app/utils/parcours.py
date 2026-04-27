"""Utilitaire pour enregistrer les événements de parcours employé.

Appelé depuis les routes RH à chaque changement significatif (rôle, département,
direction, entité, localisation) afin d'alimenter la page « Parcours ».
"""
from __future__ import annotations

from datetime import date, datetime
from typing import Optional

from sqlalchemy.orm import Session

from .. import models


_FIELD_LABELS = {
    'id_role': 'Rôle',
    'dept_id': 'Département',
    'id_direction': 'Direction',
    'id_entite': 'Entité',
    'id_localisation': 'Localisation',
    'fonction': 'Fonction',
}


def _role_label(db: Session, role_id) -> Optional[str]:
    if role_id is None:
        return None
    role = db.query(models.Role).filter(models.Role.id == role_id).first()
    return role.name if role else str(role_id)


def _dept_label(db: Session, dept_id) -> Optional[str]:
    if dept_id is None:
        return None
    d = db.query(models.Departement).filter(models.Departement.dept_id == dept_id).first()
    return d.nom if d and d.nom else str(dept_id)


def _direction_label(db: Session, id_direction) -> Optional[str]:
    if id_direction is None:
        return None
    d = db.query(models.Direction).filter(models.Direction.id_direction == id_direction).first()
    return d.nom if d and d.nom else str(id_direction)


def _entite_label(db: Session, id_entite) -> Optional[str]:
    if id_entite is None:
        return None
    e = db.query(models.Entite).filter(models.Entite.id_entite == id_entite).first()
    return e.nom if e and e.nom else str(id_entite)


def _localisation_label(db: Session, id_localisation) -> Optional[str]:
    if id_localisation is None:
        return None
    loc = db.query(models.Localisation).filter(
        models.Localisation.id_localisation == id_localisation
    ).first()
    return loc.ville if loc and loc.ville else str(id_localisation)


def _resolve(db: Session, champ: str, value):
    if value is None:
        return None
    if champ == 'id_role':
        return _role_label(db, value)
    if champ == 'dept_id':
        return _dept_label(db, value)
    if champ == 'id_direction':
        return _direction_label(db, value)
    if champ == 'id_entite':
        return _entite_label(db, value)
    if champ == 'id_localisation':
        return _localisation_label(db, value)
    return str(value)


def _type_for_field(champ: str) -> models.TypeParcoursEnum:
    if champ == 'id_role':
        return models.TypeParcoursEnum.PROMOTION
    if champ == 'id_localisation':
        return models.TypeParcoursEnum.MUTATION
    if champ in ('id_direction', 'id_entite', 'dept_id'):
        return models.TypeParcoursEnum.TRANSFERT
    return models.TypeParcoursEnum.AUTRE


def record_event(
    db: Session,
    matricule: str,
    type_action: models.TypeParcoursEnum,
    champ_modifie: Optional[str] = None,
    ancienne_valeur: Optional[str] = None,
    nouvelle_valeur: Optional[str] = None,
    libelle: Optional[str] = None,
    actor: Optional[str] = None,
    date_action: Optional[date] = None,
) -> models.ParcoursEmploye:
    """Crée une entrée de parcours et la persiste (commit inclus)."""
    entry = models.ParcoursEmploye(
        matricule=matricule,
        type_action=type_action,
        champ_modifie=champ_modifie,
        ancienne_valeur=ancienne_valeur,
        nouvelle_valeur=nouvelle_valeur,
        libelle=libelle,
        actor=str(actor) if actor is not None else None,
        date_action=date_action or date.today(),
        created_at=datetime.utcnow(),
    )
    db.add(entry)
    try:
        db.commit()
        db.refresh(entry)
    except Exception:
        db.rollback()
        raise
    return entry


def record_employee_diff(
    db: Session,
    matricule: str,
    before: dict,
    after: dict,
    actor: Optional[str] = None,
) -> list[models.ParcoursEmploye]:
    """Enregistre une ligne de parcours par champ changé (role/dept/direction/entite/loc)."""
    tracked = ['id_role', 'dept_id', 'id_direction', 'id_entite', 'id_localisation']
    entries: list[models.ParcoursEmploye] = []
    for champ in tracked:
        old = before.get(champ)
        new = after.get(champ)
        if old == new:
            continue
        type_action = _type_for_field(champ)
        old_label = _resolve(db, champ, old)
        new_label = _resolve(db, champ, new)
        field_label = _FIELD_LABELS.get(champ, champ)
        libelle = f"{field_label} : {old_label or '—'} → {new_label or '—'}"
        entry = record_event(
            db,
            matricule=matricule,
            type_action=type_action,
            champ_modifie=champ,
            ancienne_valeur=old_label,
            nouvelle_valeur=new_label,
            libelle=libelle,
            actor=actor,
        )
        entries.append(entry)
    return entries
