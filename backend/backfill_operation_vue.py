"""
Backfill OPERATION_VUE pour les opérations existantes.

Pour chaque ligne dans la table Validation, si aucune entrée OPERATION_VUE
n'existe pour le même (id_operation, matricule_validateur), on en crée une
avec date_vue = timestamp_action de la validation.

Logique : un validateur qui a validé/refusé a forcément ouvert l'opération.
Ce script est idempotent — il peut être relancé sans risque.

Utilisation :
    docker compose exec backend python backfill_operation_vue.py
"""

import sys
from sqlalchemy import func
from app.db import SessionLocal
from app import models


def run():
    db = SessionLocal()
    try:
        validations = db.query(models.Validation).all()
        created = 0
        skipped = 0

        for v in validations:
            if not v.matricule_validateur or not v.id_operation:
                skipped += 1
                continue

            matricule = str(v.matricule_validateur).strip().upper()

            # Vérification insensible à la casse pour éviter les doublons
            existing = db.query(models.OperationVue).filter(
                models.OperationVue.id_operation == v.id_operation,
                func.upper(models.OperationVue.matricule_observateur) == matricule,
            ).first()

            if existing:
                skipped += 1
                continue

            # Chercher les infos de l'employé pour nom/rôle
            emp = db.query(models.Employe).filter(
                models.Employe.matricule == matricule
            ).first()
            nom = f"{emp.prenom or ''} {emp.nom or ''}".strip() if emp else None
            # role_validateur dans Validation est la source la plus fiable
            role = v.role_validateur

            vue = models.OperationVue(
                id_operation=v.id_operation,
                matricule_observateur=matricule,
                nom_observateur=nom or None,
                role_observateur=role,
                date_vue=v.timestamp_action,
            )
            db.add(vue)
            try:
                db.flush()
                created += 1
            except Exception:
                db.rollback()
                skipped += 1

        db.commit()
        print(f"Backfill terminé : {created} entrées créées, {skipped} ignorées (déjà existantes ou données manquantes).")
    except Exception as e:
        db.rollback()
        print(f"Erreur : {e}", file=sys.stderr)
        sys.exit(1)
    finally:
        db.close()


if __name__ == '__main__':
    run()
