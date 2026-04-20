"""
Utilitaire d'audit structuré pour journaliser les actions métier.
"""
from sqlalchemy.orm import Session
from .. import models
from datetime import datetime
import json


def log_action(db: Session, matricule_acteur, action: str, ressource_type: str,
               ressource_id=None, details: dict = None, ip_address: str = None):
    """
    Enregistre une action dans le journal d'audit.
    """
    detail_str = json.dumps(details, ensure_ascii=False, default=str) if details else None
    entry = models.AuditLog(
        actor=str(matricule_acteur) if matricule_acteur else None,
        action=action,
        entity=ressource_type,
        entity_id=str(ressource_id) if ressource_id else None,
        detail=detail_str,
        ip=ip_address,
        timestamp=datetime.utcnow()
    )
    db.add(entry)
    try:
        db.commit()
    except Exception:
        db.rollback()
