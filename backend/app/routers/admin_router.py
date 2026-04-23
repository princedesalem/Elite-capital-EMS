"""
Router pour les fonctions d'administration (audit logs, etc.)
"""
import os
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime
from ..db import get_db
from .. import models
from ..utils import access_control

router = APIRouter(prefix='/api/admin', tags=['admin'])


@router.get('/ci-status')
def get_ci_status(request: Request):
    """
    Proxy vers l'API GitHub Actions : renvoie le statut du dernier run du workflow ci.yml.
    Nécessite les variables d'environnement : GITHUB_OWNER, GITHUB_REPO, GITHUB_PAT.
    ADMIN uniquement.
    """
    actor_matricule, actor_role = access_control.get_actor_from_request(request)
    if str(actor_role or '').upper() != 'ADMIN':
        raise HTTPException(status_code=403, detail='Réservé aux administrateurs')

    owner = os.getenv('GITHUB_OWNER', '').strip()
    repo = os.getenv('GITHUB_REPO', '').strip()
    pat = os.getenv('GITHUB_PAT', '').strip()

    if not (owner and repo and pat):
        return {
            'configured': False,
            'message': "Configurer GITHUB_OWNER, GITHUB_REPO, GITHUB_PAT dans l'environnement backend",
        }

    import httpx
    url = f'https://api.github.com/repos/{owner}/{repo}/actions/workflows/ci.yml/runs'
    headers = {
        'Authorization': f'Bearer {pat}',
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
    }
    try:
        with httpx.Client(timeout=10.0) as client:
            resp = client.get(url, headers=headers, params={'per_page': 1})
            resp.raise_for_status()
            data = resp.json()
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=502, detail=f'GitHub API error: {e.response.status_code}')
    except httpx.RequestError as e:
        raise HTTPException(status_code=502, detail=f'GitHub API unreachable: {str(e)[:100]}')

    runs = data.get('workflow_runs', [])
    if not runs:
        return {
            'configured': True,
            'has_run': False,
            'actions_url': f'https://github.com/{owner}/{repo}/actions',
        }

    run = runs[0]
    return {
        'configured': True,
        'has_run': True,
        'status': run.get('status'),
        'conclusion': run.get('conclusion'),
        'name': run.get('name'),
        'head_branch': run.get('head_branch'),
        'actor': (run.get('actor') or {}).get('login'),
        'created_at': run.get('created_at'),
        'updated_at': run.get('updated_at'),
        'html_url': run.get('html_url'),
        'actions_url': f'https://github.com/{owner}/{repo}/actions',
    }


@router.get('/audit-logs')
def get_audit_logs(
    request: Request,
    action: Optional[str] = None,
    matricule: Optional[str] = None,
    ressource_type: Optional[str] = None,
    depuis: Optional[str] = None,
    jusqu: Optional[str] = None,
    limit: int = Query(default=50, le=200),
    offset: int = Query(default=0, ge=0),
    sort_col: Optional[str] = Query(default='timestamp'),
    sort_dir: Optional[str] = Query(default='desc'),
    db: Session = Depends(get_db)
):
    """
    Consulter le journal d'audit. Restreint aux RH/ADMIN/PCA/AG.
    """
    actor_matricule, actor_role = access_control.get_actor_from_request(request)
    if not access_control.can_access_globally(str(actor_role or '').upper()):
        raise HTTPException(status_code=403, detail="Accès réservé aux administrateurs")

    query = db.query(models.AuditLog)

    if action:
        query = query.filter(models.AuditLog.action.ilike(f'%{action}%'))
    if matricule:
        query = query.filter(models.AuditLog.actor == matricule)
    if ressource_type:
        query = query.filter(models.AuditLog.entity.ilike(f'%{ressource_type}%'))
    if depuis:
        try:
            date_depuis = datetime.fromisoformat(depuis)
            query = query.filter(models.AuditLog.timestamp >= date_depuis)
        except ValueError:
            pass
    if jusqu:
        try:
            date_jusqu = datetime.fromisoformat(jusqu)
            query = query.filter(models.AuditLog.timestamp <= date_jusqu)
        except ValueError:
            pass

    total = query.count()
    _SORTABLE_COLS = {'timestamp', 'actor', 'action', 'entity', 'entity_id', 'ip'}
    _col_name = sort_col if sort_col in _SORTABLE_COLS else 'timestamp'
    _col_attr = getattr(models.AuditLog, _col_name)
    _order = _col_attr.asc() if sort_dir == 'asc' else _col_attr.desc()
    items = query.order_by(_order).offset(offset).limit(limit).all()

    return {
        "total": total,
        "limit": limit,
        "offset": offset,
        "items": [
            {
                "id": item.id,
                "actor": item.actor,
                "action": item.action,
                "entity": item.entity,
                "entity_id": item.entity_id,
                "detail": item.detail,
                "ip": item.ip,
                "timestamp": item.timestamp.isoformat() if item.timestamp else None,
            }
            for item in items
        ]
    }


@router.delete('/audit-logs/cleanup')
def cleanup_audit_logs(
    request: Request,
    older_than_days: int = Query(default=365, ge=30, description='Supprimer les journaux plus vieux que X jours'),
    db: Session = Depends(get_db)
):
    """
    Supprimer les entrées du journal d'audit plus vieilles que `older_than_days` jours.
    ADMIN uniquement.
    """
    from datetime import timedelta
    actor_matricule, actor_role = access_control.get_actor_from_request(request)
    if str(actor_role or '').upper() != 'ADMIN':
        raise HTTPException(status_code=403, detail='Réservé aux administrateurs')

    cutoff = datetime.utcnow() - timedelta(days=older_than_days)
    deleted_count = (
        db.query(models.AuditLog)
        .filter(models.AuditLog.timestamp < cutoff)
        .delete(synchronize_session=False)
    )
    db.commit()
    return {
        'detail': f'{deleted_count} entrée(s) supprimée(s)',
        'deleted_count': deleted_count,
        'cutoff_date': cutoff.isoformat(),
    }


@router.post('/workflow/rerouter-notifications')
def rerouter_workflow_notifications(
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Ré-aligne les notifications VALIDATION pending avec le bon validateur calculé
    par la logique courante. À utiliser ponctuellement après un changement de
    structure organisationnelle ou un correctif de routing.

    Exemple : Samuel Ngoula avait ses demandes chez Serge Tchoua (autre direction).
    Après ce ré-alignement, les notifications pointent vers le bon directeur.

    ADMIN uniquement.
    """
    actor_matricule, actor_role = access_control.get_actor_from_request(request)
    if str(actor_role or '').upper() != 'ADMIN':
        raise HTTPException(status_code=403, detail='Réservé aux administrateurs')

    from ..utils.workflow import rerouter_notifications_validation_en_attente

    stats = rerouter_notifications_validation_en_attente(db)
    return {
        'detail': 'Ré-alignement exécuté',
        **stats,
    }

