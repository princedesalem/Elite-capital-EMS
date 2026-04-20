from datetime import datetime, timedelta
from typing import Any, Dict, List

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from .. import models
from ..db import get_db


router = APIRouter(prefix='/api/team-space', tags=['team-space'])

VALID_TYPES = {'shoutout', 'kudos', 'poll'}


def _serialize(post: models.TeamSpacePost) -> Dict[str, Any]:
    return {
        'id': post.id_post,
        'type': post.post_type,
        'from': post.author_name or 'Utilisateur',
        'from_matricule': post.author_matricule,
        'date': post.date_creation.strftime('%d/%m/%Y') if post.date_creation else None,
        'destinataire': post.destinataire or '',
        'message': post.message or '',
        'valeur': post.valeur or '',
        'raison': post.raison or '',
        'question': post.question or '',
        'options': post.poll_options or [],
        'votedBy': post.voted_by or [],
        'likes': int(post.likes or 0),
        'audience': {
            'type': post.audience_type or 'all',
            'selected': post.audience_selected or [],
        },
        'created_at': post.date_creation.isoformat() if post.date_creation else None,
    }


@router.get('/posts')
def list_posts(
    type: str = Query(default='all'),
    search: str = Query(default=''),
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(get_db),
):
    query = db.query(models.TeamSpacePost)

    normalized_type = str(type or 'all').strip().lower()
    if normalized_type in VALID_TYPES:
        query = query.filter(models.TeamSpacePost.post_type == normalized_type)

    q = str(search or '').strip().lower()
    if q:
        like_value = f'%{q}%'
        query = query.filter(
            (models.TeamSpacePost.author_name.ilike(like_value)) |
            (models.TeamSpacePost.destinataire.ilike(like_value)) |
            (models.TeamSpacePost.message.ilike(like_value)) |
            (models.TeamSpacePost.question.ilike(like_value))
        )

    posts = query.order_by(models.TeamSpacePost.date_creation.desc()).limit(limit).all()
    return [_serialize(post) for post in posts]


@router.post('/posts')
def create_post(payload: Dict[str, Any] = Body(...), db: Session = Depends(get_db)):
    post_type = str(payload.get('type') or '').strip().lower()
    if post_type not in VALID_TYPES:
        raise HTTPException(status_code=400, detail='Type de publication invalide')

    author_name = str(payload.get('from') or '').strip() or 'Utilisateur'
    audience = payload.get('audience') or {}
    audience_type = str(audience.get('type') or 'all').strip().lower() or 'all'
    audience_selected = audience.get('selected') if isinstance(audience.get('selected'), list) else []

    post = models.TeamSpacePost(
        post_type=post_type,
        author_matricule=int(payload.get('from_matricule') or 0) or None,
        author_name=author_name,
        destinataire=(str(payload.get('destinataire') or '').strip() or None),
        message=(str(payload.get('message') or '').strip() or None),
        valeur=(str(payload.get('valeur') or '').strip() or None),
        raison=(str(payload.get('raison') or '').strip() or None),
        question=(str(payload.get('question') or '').strip() or None),
        poll_options=payload.get('options') if isinstance(payload.get('options'), list) else None,
        voted_by=payload.get('votedBy') if isinstance(payload.get('votedBy'), list) else [],
        likes=int(payload.get('likes') or 0),
        audience_type=audience_type,
        audience_selected=audience_selected,
        date_creation=datetime.utcnow(),
    )

    if post_type == 'shoutout':
        if not post.destinataire or not post.message:
            raise HTTPException(status_code=400, detail='Destinataire et message obligatoires')
    elif post_type == 'kudos':
        if not post.destinataire:
            raise HTTPException(status_code=400, detail='Destinataire obligatoire')
    elif post_type == 'poll':
        if not post.question:
            raise HTTPException(status_code=400, detail='Question obligatoire')
        options = post.poll_options or []
        cleaned_options: List[Dict[str, Any]] = []
        for option in options:
            texte = str((option or {}).get('texte') or '').strip()
            if not texte:
                continue
            cleaned_options.append({'texte': texte, 'votes': int((option or {}).get('votes') or 0)})
        if len(cleaned_options) < 2:
            raise HTTPException(status_code=400, detail='Le sondage doit contenir au moins 2 options')
        post.poll_options = cleaned_options
        post.voted_by = []

    db.add(post)
    db.commit()
    db.refresh(post)
    return _serialize(post)


@router.patch('/posts/{id_post}/like')
def like_post(id_post: int, db: Session = Depends(get_db)):
    post = db.query(models.TeamSpacePost).filter(models.TeamSpacePost.id_post == id_post).first()
    if not post:
        raise HTTPException(status_code=404, detail='Publication introuvable')

    post.likes = int(post.likes or 0) + 1
    db.commit()
    db.refresh(post)
    return _serialize(post)


@router.patch('/posts/{id_post}/vote')
def vote_poll(id_post: int, payload: Dict[str, Any] = Body(...), db: Session = Depends(get_db)):
    post = db.query(models.TeamSpacePost).filter(models.TeamSpacePost.id_post == id_post).first()
    if not post:
        raise HTTPException(status_code=404, detail='Publication introuvable')
    if post.post_type != 'poll':
        raise HTTPException(status_code=400, detail='Vote uniquement autorisé sur un sondage')

    voter = str(payload.get('voter_matricule') or '').strip()
    if not voter:
        raise HTTPException(status_code=400, detail='Votant invalide')

    option_index = int(payload.get('option_index') if payload.get('option_index') is not None else -1)
    options = post.poll_options or []
    if option_index < 0 or option_index >= len(options):
        raise HTTPException(status_code=400, detail='Option invalide')

    voted_by = post.voted_by or []
    if voter in voted_by:
        return _serialize(post)

    next_options = []
    for idx, option in enumerate(options):
        votes = int((option or {}).get('votes') or 0)
        if idx == option_index:
            votes += 1
        next_options.append({'texte': str((option or {}).get('texte') or ''), 'votes': votes})

    post.poll_options = next_options
    post.voted_by = [*voted_by, voter]
    db.commit()
    db.refresh(post)
    return _serialize(post)


@router.patch('/posts/{id_post}')
def update_post(id_post: int, payload: Dict[str, Any] = Body(...), db: Session = Depends(get_db)):
    post = db.query(models.TeamSpacePost).filter(models.TeamSpacePost.id_post == id_post).first()
    if not post:
        raise HTTPException(status_code=404, detail='Publication introuvable')
    if post.date_creation and (datetime.utcnow() - post.date_creation) > timedelta(hours=1):
        raise HTTPException(status_code=403, detail='La modification est impossible après 1 heure')

    if post.post_type == 'shoutout':
        if 'message' in payload and str(payload['message']).strip():
            post.message = str(payload['message']).strip()
        if 'destinataire' in payload and str(payload['destinataire']).strip():
            post.destinataire = str(payload['destinataire']).strip()
    elif post.post_type == 'kudos':
        if 'destinataire' in payload and str(payload['destinataire']).strip():
            post.destinataire = str(payload['destinataire']).strip()
        if 'raison' in payload:
            post.raison = str(payload['raison']).strip() or None
        if 'valeur' in payload and str(payload['valeur']).strip():
            post.valeur = str(payload['valeur']).strip()
    elif post.post_type == 'poll':
        if 'question' in payload and str(payload['question']).strip():
            post.question = str(payload['question']).strip()

    db.commit()
    db.refresh(post)
    return _serialize(post)


@router.delete('/posts/{id_post}')
def delete_post(id_post: int, db: Session = Depends(get_db)):
    post = db.query(models.TeamSpacePost).filter(models.TeamSpacePost.id_post == id_post).first()
    if not post:
        raise HTTPException(status_code=404, detail='Publication introuvable')
    db.delete(post)
    db.commit()
    return {'ok': True}
