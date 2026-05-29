"""Backfill SESSION_UTILISATION rows from audit_logs LOGIN_SUCCESS entries.

A executer UNE FOIS sur prod pour reconstruire les sessions manquantes
des utilisateurs dont les logins ont ete tracees dans audit_logs mais
qui n'ont pas de ligne SESSION_UTILISATION (regression frontend ou.catch
silencieux).

Usage:
    docker exec -it extranet-backend-1 python /app/backfill_sessions_from_audit.py
"""
from datetime import timedelta
from sqlalchemy import and_

from app.db import SessionLocal
from app import models


def main():
    db = SessionLocal()
    try:
        # 1) Recuperer toutes les entrees LOGIN_SUCCESS
        logins = db.query(models.AuditLog).filter(
            models.AuditLog.action == 'LOGIN_SUCCESS'
        ).order_by(models.AuditLog.timestamp.asc()).all()
        print(f'AuditLog LOGIN_SUCCESS: {len(logins)} entries')

        # 2) Index des sessions existantes (matricule, minute-rounded timestamp)
        existing = db.query(models.SessionUtilisation).all()
        index = set()
        for s in existing:
            key = (str(s.matricule), s.date_connexion.replace(second=0, microsecond=0))
            index.add(key)
        print(f'SessionUtilisation existantes: {len(existing)}')

        created = 0
        skipped = 0
        for log in logins:
            matricule = log.actor or log.entity_id
            if not matricule:
                continue
            ts = log.timestamp
            if not ts:
                continue
            key = (str(matricule), ts.replace(second=0, microsecond=0))
            if key in index:
                skipped += 1
                continue
            # Verifier que l'employe existe (FK)
            emp = db.query(models.Employe).filter(
                models.Employe.matricule == str(matricule)
            ).first()
            if not emp:
                continue
            sess = models.SessionUtilisation(
                matricule=str(matricule),
                date_connexion=ts,
                ip_adresse=log.ip,
                user_agent='backfill-from-audit',
            )
            db.add(sess)
            index.add(key)
            created += 1

        db.commit()
        print(f'-> {created} sessions creees, {skipped} deja presentes')
    finally:
        db.close()


if __name__ == '__main__':
    main()
