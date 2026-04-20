"""
Router pour les fonctions d'administration (audit logs, etc.)
"""
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime
from ..db import get_db
from .. import models
from ..utils import access_control

router = APIRouter(prefix='/api/admin', tags=['admin'])


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
