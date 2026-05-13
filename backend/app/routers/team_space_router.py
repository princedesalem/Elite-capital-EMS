from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Set

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from .. import models
from ..db import get_db


router = APIRouter(prefix='/api/team-space', tags=['team-space'])

VALID_TYPES = {'shoutout', 'kudos', 'poll', 'annonce', 'message'}

POST_TYPE_LABELS = {
    'shoutout': 'Shout-out',
    'kudos': 'Kudos',
    'poll': 'Sondage',
    'annonce': 'Annonce',
    'message': 'Message',
}


def _resolve_audience_matricules(
    audience_type: str,
    audience_selected: List[str],
    destinataire: str,
    db: Session,
) -> Set[int]:
    """Return the set of active employee matricules that should receive the post notification."""
    audience_type = (audience_type or 'all').lower()
    selected = [str(s).strip() for s in (audience_selected or []) if str(s).strip()]

    base_query = db.query(models.Employe).filter(
        models.Employe.statut_employe == models.StatutEmployeEnum.ACTIF
    )
    targets: Set[int] = set()

    if audience_type == 'all' or not selected:
        for emp in base_query.all():
            if emp.matricule is not None:
                targets.add(str(emp.matricule).strip().upper())
    elif audience_type == 'entites':
        ids = [e.id_entite for e in db.query(models.Entite).filter(models.Entite.nom.in_(selected)).all()]
        if ids:
            for emp in base_query.filter(models.Employe.id_entite.in_(ids)).all():
                targets.add(str(emp.matricule).strip().upper())
    elif audience_type == 'directions':
        ids = [d.id_direction for d in db.query(models.Direction).filter(models.Direction.nom.in_(selected)).all()]
        if ids:
            for emp in base_query.filter(models.Employe.id_direction.in_(ids)).all():
                targets.add(str(emp.matricule).strip().upper())
    elif audience_type == 'departements':
        ids = [d.dept_id for d in db.query(models.Departement).filter(models.Departement.nom.in_(selected)).all()]
        if ids:
            for emp in base_query.filter(models.Employe.dept_id.in_(ids)).all():
                targets.add(str(emp.matricule).strip().upper())

    # Always include destinataire by name if resolvable (for shoutout / kudos)
    dest = (destinataire or '').strip()
    if dest:
        tokens = dest.split()
        match = None
        if len(tokens) >= 2:
            first, last = tokens[0], ' '.join(tokens[1:])
            match = (
                base_query.filter(
                    ((models.Employe.prenom == first) & (models.Employe.nom == last))
                    | ((models.Employe.nom == first) & (models.Employe.prenom == last))
                ).first()
            )
        if not match:
            match = base_query.filter(
                (models.Employe.nom == dest) | (models.Employe.prenom == dest)
            ).first()
        if match and match.matricule is not None:
            targets.add(str(match.matricule).strip().upper())

    return targets


def _notify_post_created(post: models.TeamSpacePost, db: Session) -> None:
    """Create in-app notifications for a newly created team-space post."""
    audience_type = post.audience_type or 'all'
    audience_selected = list(post.audience_selected or [])
    destinataire = post.destinataire or ''

    try:
        targets = _resolve_audience_matricules(audience_type, audience_selected, destinataire, db)
    except Exception:
        return

    if post.author_matricule:
        targets.discard(str(post.author_matricule).strip().upper())
    if not targets:
        return

    label = POST_TYPE_LABELS.get(post.post_type, 'Publication')
    author = post.author_name or 'Un collègue'
    if post.post_type == 'shoutout':
        titre = f'Nouveau shout-out de {author}'
        message = (post.message or '').strip()
        if destinataire:
            message = f'À {destinataire} : {message}' if message else f'Shout-out à {destinataire}'
    elif post.post_type == 'kudos':
        titre = f'Nouveau kudos de {author}'
        parts = []
        if post.valeur:
            parts.append(str(post.valeur))
        if destinataire:
            parts.append(f'pour {destinataire}')
        if post.raison:
            parts.append(f'— {post.raison}')
        message = ' '.join(parts) or 'Un collègue a reçu un kudos.'
    elif post.post_type == 'poll':
        titre = f'Nouveau sondage de {author}'
        message = (post.question or '').strip() or 'Un nouveau sondage est disponible.'
    elif post.post_type == 'annonce':
        titre = f'Annonce de {author}'
        annonce_titre = (post.valeur or '').strip()
        body = (post.message or '').strip()
        message = f'{annonce_titre} — {body}' if annonce_titre and body else annonce_titre or body or 'Nouvelle annonce dans l’Espace Équipe.'
    elif post.post_type == 'message':
        titre = f'Message de {author}'
        message = (post.message or '').strip() or 'Nouveau message dans l’Espace Équipe.'
    else:
        titre = f'Nouvelle publication ({label})'
        message = (post.message or post.question or '').strip() or 'Nouvelle publication dans l’Espace Équipe.'

    message = message[:500]
    notifications = [
        models.Notification(
            matricule=mat,
            type_notification=models.TypeNotificationEnum.AUTRE,
            titre=titre[:200],
            message=message,
            id_operation=None,
        )
        for mat in targets
    ]
    if notifications:
        db.add_all(notifications)
        db.commit()


def _serialize(
    post: models.TeamSpacePost,
    comments_count: int = 0,
    liked_by: Optional[List[str]] = None,
) -> Dict[str, Any]:
    return {
        'id': post.id_post,
        'type': post.post_type,
        'from': post.author_name or 'Utilisateur',
        'from_matricule': post.author_matricule,
        'date': post.date_creation.strftime('%d/%m/%Y') if post.date_creation else None,
        'destinataire': post.destinataire or '',
        'message': post.message or '',
        'titre': post.valeur if post.post_type == 'annonce' else '',
        'valeur': post.valeur or '',
        'raison': post.raison or '',
        'question': post.question or '',
        'options': post.poll_options or [],
        'votedBy': post.voted_by or [],
        'likes': int(post.likes or 0),
        'comments_count': comments_count,
        'liked_by': liked_by if liked_by is not None else [],
        'audience': {
            'type': post.audience_type or 'all',
            'selected': post.audience_selected or [],
        },
        'created_at': post.date_creation.isoformat() if post.date_creation else None,
    }


def _serialize_comment(
    c: models.TeamSpaceComment,
    replies: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    return {
        'id': c.id,
        'post_id': c.post_id,
        'parent_id': c.parent_id,
        'auteur_matricule': c.auteur_matricule,
        'auteur_nom': c.auteur_nom,
        'contenu': c.contenu,
        'date': c.created_at.strftime('%d/%m/%Y %H:%M') if c.created_at else None,
        'created_at': c.created_at.isoformat() if c.created_at else None,
        'replies': replies if replies is not None else [],
    }


def _notify_like(post: models.TeamSpacePost, liker_matricule: str, db: Session) -> None:
    """Ajoute une notif à l’auteur du post quand quelqu’un like (sans commit)."""
    if not post.author_matricule:
        return
    author_mat = str(post.author_matricule).strip().upper()
    liker_mat = str(liker_matricule).strip().upper()
    if author_mat == liker_mat:
        return  # pas de notif auto-like
    liker = db.query(models.Employe).filter(
        models.Employe.matricule == liker_matricule
    ).first()
    liker_name = f'{liker.prenom or ""} {liker.nom or ""}'.strip() if liker else f'Matricule {liker_matricule}'
    notif = models.Notification(
        matricule=author_mat,
        type_notification=models.TypeNotificationEnum.AUTRE,
        titre=f'{liker_name} a aimé votre publication',
        message=(post.message or post.question or post.valeur or 'Votre publication dans l’Espace Équipe.')[:300],
        id_operation=None,
    )
    db.add(notif)


def _notify_comment(post: models.TeamSpacePost, commenter_nom: str, contenu: str, db: Session) -> None:
    """Notifie l’auteur du post quand quelqu’un commente."""
    if not post.author_matricule:
        return
    db.add(models.Notification(
        matricule=str(post.author_matricule).strip().upper(),
        type_notification=models.TypeNotificationEnum.AUTRE,
        titre=f'{commenter_nom} a commenté votre publication',
        message=contenu[:300],
        id_operation=None,
    ))
    db.commit()


def _notify_reply(parent: models.TeamSpaceComment, replier_nom: str, contenu: str, db: Session) -> None:
    """Notifie l’auteur du commentaire quand quelqu’un répond."""
    if not parent.auteur_matricule:
        return
    db.add(models.Notification(
        matricule=str(parent.auteur_matricule).strip().upper(),
        type_notification=models.TypeNotificationEnum.AUTRE,
        titre=f'{replier_nom} a répondu à votre commentaire',
        message=contenu[:300],
        id_operation=None,
    ))
    db.commit()


@router.get('/posts')
def list_posts(
    type: str = Query(default='all'),
    search: str = Query(default=''),
    limit: int = Query(default=100, ge=1, le=500),
    viewer_matricule: str = Query(default=''),
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

    # Batch fetch: comment counts + liked_by lists
    post_ids = [p.id_post for p in posts]
    comment_counts: Dict[int, int] = {}
    liked_by_map: Dict[int, List[str]] = {}
    if post_ids:
        counts = (
            db.query(models.TeamSpaceComment.post_id, func.count(models.TeamSpaceComment.id))
            .filter(models.TeamSpaceComment.post_id.in_(post_ids))
            .group_by(models.TeamSpaceComment.post_id)
            .all()
        )
        comment_counts = {pid: cnt for pid, cnt in counts}
        for like in db.query(models.TeamSpacePostLike).filter(
            models.TeamSpacePostLike.post_id.in_(post_ids)
        ).all():
            liked_by_map.setdefault(like.post_id, []).append(like.matricule)

    return [
        _serialize(
            post,
            comments_count=comment_counts.get(post.id_post, 0),
            liked_by=liked_by_map.get(post.id_post, []),
        )
        for post in posts
    ]


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
        # For annonce: store titre in valeur field (reused); for others: use valeur directly
        valeur=(str(payload.get('titre') or payload.get('valeur') or '').strip() or None),
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
    elif post_type == 'message':
        if not post.message:
            raise HTTPException(status_code=400, detail='Message obligatoire')
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
    _notify_post_created(post, db)
    return _serialize(post, comments_count=0, liked_by=[])


@router.post('/posts/{id_post}/like')
@router.patch('/posts/{id_post}/like')
def toggle_like(id_post: int, payload: Dict[str, Any] = Body(default={}), db: Session = Depends(get_db)):
    """Toggle like: 1 like par personne, illimité en nombre de clics mais compte 1 fois."""
    post = db.query(models.TeamSpacePost).filter(models.TeamSpacePost.id_post == id_post).first()
    if not post:
        raise HTTPException(status_code=404, detail='Publication introuvable')

    matricule = str(payload.get('matricule') or '').strip()
    if not matricule:
        matricule = 'ANONYMOUS'

    existing = db.query(models.TeamSpacePostLike).filter(
        models.TeamSpacePostLike.post_id == id_post,
        models.TeamSpacePostLike.matricule == matricule,
    ).first()

    if existing:
        db.delete(existing)
        post.likes = max(0, int(post.likes or 0) - 1)
    else:
        db.add(models.TeamSpacePostLike(post_id=id_post, matricule=matricule))
        post.likes = int(post.likes or 0) + 1
        _notify_like(post, matricule, db)  # notif sans commit

    db.commit()
    db.refresh(post)

    liked_by = [
        r.matricule for r in
        db.query(models.TeamSpacePostLike)
        .filter(models.TeamSpacePostLike.post_id == id_post)
        .all()
    ]
    comments_count = db.query(func.count(models.TeamSpaceComment.id)).filter(
        models.TeamSpaceComment.post_id == id_post
    ).scalar() or 0
    return _serialize(post, comments_count=comments_count, liked_by=liked_by)


@router.get('/posts/{id_post}/comments')
def list_comments(id_post: int, db: Session = Depends(get_db)):
    top_comments = (
        db.query(models.TeamSpaceComment)
        .filter(
            models.TeamSpaceComment.post_id == id_post,
            models.TeamSpaceComment.parent_id.is_(None),
        )
        .order_by(models.TeamSpaceComment.created_at.asc())
        .all()
    )
    result = []
    for c in top_comments:
        replies = (
            db.query(models.TeamSpaceComment)
            .filter(models.TeamSpaceComment.parent_id == c.id)
            .order_by(models.TeamSpaceComment.created_at.asc())
            .all()
        )
        result.append(_serialize_comment(c, [_serialize_comment(r) for r in replies]))
    return result


@router.post('/posts/{id_post}/comments')
def add_comment(id_post: int, payload: Dict[str, Any] = Body(...), db: Session = Depends(get_db)):
    post = db.query(models.TeamSpacePost).filter(models.TeamSpacePost.id_post == id_post).first()
    if not post:
        raise HTTPException(status_code=404, detail='Publication introuvable')

    auteur_nom = str(payload.get('auteur_nom') or '').strip()
    contenu = str(payload.get('contenu') or '').strip()
    if not auteur_nom or not contenu:
        raise HTTPException(status_code=400, detail='Auteur et contenu requis')

    comment = models.TeamSpaceComment(
        post_id=id_post,
        parent_id=None,
        auteur_matricule=str(payload.get('auteur_matricule') or '').strip() or None,
        auteur_nom=auteur_nom,
        contenu=contenu,
    )
    db.add(comment)
    db.commit()
    db.refresh(comment)
    _notify_comment(post, auteur_nom, contenu, db)
    return _serialize_comment(comment)


@router.post('/comments/{id_comment}/reply')
def reply_comment(id_comment: int, payload: Dict[str, Any] = Body(...), db: Session = Depends(get_db)):
    parent = db.query(models.TeamSpaceComment).filter(models.TeamSpaceComment.id == id_comment).first()
    if not parent:
        raise HTTPException(status_code=404, detail='Commentaire introuvable')

    auteur_nom = str(payload.get('auteur_nom') or '').strip()
    contenu = str(payload.get('contenu') or '').strip()
    if not auteur_nom or not contenu:
        raise HTTPException(status_code=400, detail='Auteur et contenu requis')

    reply = models.TeamSpaceComment(
        post_id=parent.post_id,
        parent_id=id_comment,
        auteur_matricule=str(payload.get('auteur_matricule') or '').strip() or None,
        auteur_nom=auteur_nom,
        contenu=contenu,
    )
    db.add(reply)
    db.commit()
    db.refresh(reply)
    _notify_reply(parent, auteur_nom, contenu, db)
    return _serialize_comment(reply)


@router.patch('/comments/{id_comment}')
def update_comment(id_comment: int, payload: Dict[str, Any] = Body(...), db: Session = Depends(get_db)):
    comment = db.query(models.TeamSpaceComment).filter(models.TeamSpaceComment.id == id_comment).first()
    if not comment:
        raise HTTPException(status_code=404, detail='Commentaire introuvable')
    contenu = str(payload.get('contenu') or '').strip()
    if not contenu:
        raise HTTPException(status_code=400, detail='Contenu requis')
    comment.contenu = contenu
    db.commit()
    db.refresh(comment)
    return _serialize_comment(comment)


@router.delete('/comments/{id_comment}')
def delete_comment(id_comment: int, db: Session = Depends(get_db)):
    comment = db.query(models.TeamSpaceComment).filter(models.TeamSpaceComment.id == id_comment).first()
    if not comment:
        raise HTTPException(status_code=404, detail='Commentaire introuvable')
    post_id = comment.post_id
    db.delete(comment)
    db.commit()
    # Retourner le nouveau compteur
    count = db.query(func.count(models.TeamSpaceComment.id)).filter(
        models.TeamSpaceComment.post_id == post_id
    ).scalar() or 0
    return {'ok': True, 'post_id': post_id, 'comments_count': count}


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
        return _serialize(post, liked_by=[])

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
    return _serialize(post, liked_by=[])


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
    return _serialize(post, liked_by=[])


@router.delete('/posts/{id_post}')
def delete_post(id_post: int, db: Session = Depends(get_db)):
    post = db.query(models.TeamSpacePost).filter(models.TeamSpacePost.id_post == id_post).first()
    if not post:
        raise HTTPException(status_code=404, detail='Publication introuvable')
    db.delete(post)
    db.commit()
    return {'ok': True}
