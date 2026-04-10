from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from .. import models
from ..db import get_db

router = APIRouter(prefix='/api/performance-reviews', tags=['performance-reviews'])


class Review360Create(BaseModel):
    reviewer_id: int
    reviewee_id: int
    scores: List[float] = []
    commentaire: Optional[str] = None
    points_forts: Optional[str] = None
    points_amelioration: Optional[str] = None


def _serialize(r: models.Review360) -> dict:
    return {
        'id': r.id,
        'reviewer_id': r.reviewer_id,
        'reviewee_id': r.reviewee_id,
        'scores': r.scores if isinstance(r.scores, list) else [],
        'commentaire': r.commentaire,
        'points_forts': r.points_forts,
        'points_amelioration': r.points_amelioration,
        'created_at': r.created_at.isoformat() if r.created_at else None,
    }


@router.get('')
def list_reviews(db: Session = Depends(get_db)):
    items = db.query(models.Review360).order_by(models.Review360.created_at.desc()).all()
    return [_serialize(i) for i in items]


@router.post('')
def create_review(body: Review360Create, db: Session = Depends(get_db)):
    r = models.Review360(
        reviewer_id=body.reviewer_id,
        reviewee_id=body.reviewee_id,
        scores=body.scores,
        commentaire=body.commentaire,
        points_forts=body.points_forts,
        points_amelioration=body.points_amelioration,
        created_at=datetime.utcnow(),
    )
    db.add(r)
    db.commit()
    db.refresh(r)
    return _serialize(r)


@router.delete('/{review_id}')
def delete_review(review_id: int, db: Session = Depends(get_db)):
    r = db.query(models.Review360).filter(models.Review360.id == review_id).first()
    if not r:
        raise HTTPException(status_code=404, detail='Évaluation introuvable')
    db.delete(r)
    db.commit()
    return {'ok': True}
