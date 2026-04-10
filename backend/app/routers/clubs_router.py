from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from .. import models
from ..db import get_db

router = APIRouter(prefix='/api/clubs', tags=['clubs'])


# ── Schemas ───────────────────────────────────────────────────────────────────

class ClubCreate(BaseModel):
    nom: str
    description: Optional[str] = None
    type: str = 'Sports'
    emoji: Optional[str] = None


class ClubUpdate(ClubCreate):
    pass


class ActivityCreate(BaseModel):
    club_id: int
    titre: str
    date: Optional[str] = None
    description: Optional[str] = None
    created_by: Optional[int] = None


class ReviewCreate(BaseModel):
    club_id: int
    rating: int
    commentaire: Optional[str] = None
    user_id: Optional[int] = None


class MembershipCreate(BaseModel):
    club_id: int
    user_id: int


# ── Serializers ───────────────────────────────────────────────────────────────

def _ser_club(c: models.Club) -> dict:
    return {
        'id': c.id,
        'nom': c.nom,
        'description': c.description,
        'type': c.type,
        'emoji': c.emoji,
        'created_by': c.created_by,
        'created_at': c.created_at.isoformat() if c.created_at else None,
        'updated_at': c.updated_at.isoformat() if c.updated_at else None,
    }


def _ser_membership(m: models.ClubMembership) -> dict:
    return {
        'id': m.id,
        'club_id': m.club_id,
        'user_id': m.user_id,
        'joined_at': m.joined_at.isoformat() if m.joined_at else None,
    }


def _ser_activity(a: models.ClubActivity) -> dict:
    return {
        'id': a.id,
        'club_id': a.club_id,
        'titre': a.titre,
        'date': a.date,
        'description': a.description,
        'created_by': a.created_by,
        'created_at': a.created_at.isoformat() if a.created_at else None,
    }


def _ser_review(r: models.ClubReviewItem) -> dict:
    return {
        'id': r.id,
        'club_id': r.club_id,
        'user_id': r.user_id,
        'rating': r.rating,
        'commentaire': r.commentaire,
        'created_at': r.created_at.isoformat() if r.created_at else None,
    }


# ── Clubs routes ──────────────────────────────────────────────────────────────

@router.get('')
def list_clubs(db: Session = Depends(get_db)):
    items = db.query(models.Club).order_by(models.Club.created_at.desc()).all()
    return [_ser_club(i) for i in items]


@router.post('')
def create_club(body: ClubCreate, db: Session = Depends(get_db)):
    c = models.Club(
        nom=body.nom,
        description=body.description,
        type=body.type,
        emoji=body.emoji,
        created_by=None,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db.add(c)
    db.commit()
    db.refresh(c)
    return _ser_club(c)


@router.put('/{club_id}')
def update_club(club_id: int, body: ClubUpdate, db: Session = Depends(get_db)):
    c = db.query(models.Club).filter(models.Club.id == club_id).first()
    if not c:
        raise HTTPException(status_code=404, detail='Club introuvable')
    c.nom = body.nom
    c.description = body.description
    c.type = body.type
    c.emoji = body.emoji
    c.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(c)
    return _ser_club(c)


@router.delete('/{club_id}')
def delete_club(club_id: int, db: Session = Depends(get_db)):
    club = db.query(models.Club).filter(models.Club.id == club_id).first()
    if not club:
        raise HTTPException(status_code=404, detail='Club introuvable')
    # cascade delete related data
    db.query(models.ClubMembership).filter(models.ClubMembership.club_id == club_id).delete()
    db.query(models.ClubActivity).filter(models.ClubActivity.club_id == club_id).delete()
    db.query(models.ClubReviewItem).filter(models.ClubReviewItem.club_id == club_id).delete()
    db.delete(club)
    db.commit()
    return {'ok': True}


# ── Memberships routes ────────────────────────────────────────────────────────

@router.get('/memberships')
def list_memberships(db: Session = Depends(get_db)):
    items = db.query(models.ClubMembership).all()
    return [_ser_membership(i) for i in items]


@router.post('/memberships')
def join_club(body: MembershipCreate, db: Session = Depends(get_db)):
    existing = (
        db.query(models.ClubMembership)
        .filter(
            models.ClubMembership.club_id == body.club_id,
            models.ClubMembership.user_id == body.user_id,
        )
        .first()
    )
    if existing:
        return _ser_membership(existing)
    m = models.ClubMembership(
        club_id=body.club_id,
        user_id=body.user_id,
        joined_at=datetime.utcnow(),
    )
    db.add(m)
    db.commit()
    db.refresh(m)
    return _ser_membership(m)


@router.delete('/memberships/{membership_id}')
def leave_club(membership_id: int, db: Session = Depends(get_db)):
    m = db.query(models.ClubMembership).filter(models.ClubMembership.id == membership_id).first()
    if not m:
        raise HTTPException(status_code=404, detail='Membre introuvable')
    db.delete(m)
    db.commit()
    return {'ok': True}


# ── Activities routes ─────────────────────────────────────────────────────────

@router.get('/activities')
def list_activities(db: Session = Depends(get_db)):
    items = db.query(models.ClubActivity).order_by(models.ClubActivity.created_at.desc()).all()
    return [_ser_activity(i) for i in items]


@router.post('/activities')
def create_activity(body: ActivityCreate, db: Session = Depends(get_db)):
    a = models.ClubActivity(
        club_id=body.club_id,
        titre=body.titre,
        date=body.date,
        description=body.description,
        created_by=body.created_by,
        created_at=datetime.utcnow(),
    )
    db.add(a)
    db.commit()
    db.refresh(a)
    return _ser_activity(a)


# ── Reviews routes ────────────────────────────────────────────────────────────

@router.get('/reviews')
def list_reviews(db: Session = Depends(get_db)):
    items = db.query(models.ClubReviewItem).order_by(models.ClubReviewItem.created_at.desc()).all()
    return [_ser_review(i) for i in items]


@router.post('/reviews')
def create_review(body: ReviewCreate, db: Session = Depends(get_db)):
    if body.user_id:
        existing = (
            db.query(models.ClubReviewItem)
            .filter(
                models.ClubReviewItem.club_id == body.club_id,
                models.ClubReviewItem.user_id == body.user_id,
            )
            .first()
        )
        if existing:
            raise HTTPException(status_code=409, detail='Vous avez déjà évalué ce club.')
    r = models.ClubReviewItem(
        club_id=body.club_id,
        user_id=body.user_id or 0,
        rating=body.rating,
        commentaire=body.commentaire,
        created_at=datetime.utcnow(),
    )
    db.add(r)
    db.commit()
    db.refresh(r)
    return _ser_review(r)
