"""
Migration 020 - Correction rétroactive des données
===================================================
1. Opérations "en attente" alors que la validation est terminée → statut = 'validé'
2. Opérations validées sans déduction de solde (congé / perm non-conv) → déduction
3. Opérations validées sans enregistrement Activation → créer Activation COMPLETE

Usage:
    python migrations/020_fix_data.py [--dry-run]
"""
import sys
import os
from datetime import datetime

# Ajouter le répertoire parent au path pour les imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db import SessionLocal
from app import models
from app.utils.workflow import obtenir_prochain_validateur
from app.utils.business_logic import deduire_solde_conges

DRY_RUN = '--dry-run' in sys.argv


def log(msg):
    print(f"[{'DRY-RUN' if DRY_RUN else 'APPLY'}] {msg}")


def fix_statuts(db):
    """Marquer comme 'validé' les opérations en attente dont la validation est terminée."""
    ops = db.query(models.Operation).filter(
        models.Operation.statut == 'en attente'
    ).all()

    fixed = 0
    for op in ops:
        prochain_role, _ = obtenir_prochain_validateur(op.id_operation, db)
        if prochain_role is None:
            log(f"  Op #{op.id_operation} ({op.type_demande}) statut en attente → validé")
            if not DRY_RUN:
                op.statut = 'validé'
            fixed += 1

    if not DRY_RUN and fixed:
        db.commit()
    log(f"fix_statuts: {fixed} opération(s) corrigée(s)")
    return fixed


def fix_soldes(db):
    """Déduire les soldes manquants pour congés et permissions non conventionnelles validées."""
    from app.utils.permissions import obtenir_type_permission

    ops = db.query(models.Operation).filter(
        models.Operation.statut == 'validé',
        models.Operation.solde_deduit == False,  # noqa: E712
    ).all()

    fixed = 0
    for op in ops:
        type_demande = str(op.type_demande or '').strip().lower()
        type_info = obtenir_type_permission(op.id_operation, db)
        doit_deduire = (
            type_info.get('est_conventionnelle') == False  # noqa: E712
            or type_info.get('type') == 'conge'
            or type_demande in {'conge', 'congé'}
        )
        duree = op.duree or op.duree_jours or 0
        if doit_deduire and duree > 0:
            employe = db.query(models.Employe).filter(
                models.Employe.matricule == op.matricule
            ).first()
            if employe:
                log(
                    f"  Op #{op.id_operation} ({op.type_demande}) "
                    f"matricule={op.matricule} duree={duree}j → déduction solde"
                )
                if not DRY_RUN:
                    deduire_solde_conges(employe, duree, db)
                    op.solde_deduit = True
                    db.add(op)
                fixed += 1

    if not DRY_RUN and fixed:
        db.commit()
    log(f"fix_soldes: {fixed} déduction(s) effectuée(s)")
    return fixed


def fix_activations(db):
    """Créer des enregistrements Activation COMPLETE pour les opérations validées sans activation."""
    ops = db.query(models.Operation).filter(
        models.Operation.statut == 'validé'
    ).all()

    fixed = 0
    now = datetime.now()
    for op in ops:
        existing = db.query(models.Activation).filter(
            models.Activation.id_operation == op.id_operation,
            models.Activation.type_action == models.TypeActionEnum.ACTIVATION
        ).first()
        if not existing:
            log(
                f"  Op #{op.id_operation} ({op.type_demande}) → création Activation COMPLETE"
            )
            if not DRY_RUN:
                activation = models.Activation(
                    id_operation=op.id_operation,
                    type_action=models.TypeActionEnum.ACTIVATION,
                    demandeur_fait=True,
                    date_demandeur=now,
                    rh_fait=True,
                    date_rh=now,
                    statut_final=models.StatutFinalEnum.COMPLETE,
                )
                db.add(activation)
            fixed += 1

    if not DRY_RUN and fixed:
        db.commit()
    log(f"fix_activations: {fixed} activation(s) créée(s)")
    return fixed


def main():
    log("=== Démarrage migration 020_fix_data ===")
    db = SessionLocal()
    try:
        log("--- Étape 1: Correction des statuts ---")
        fix_statuts(db)

        log("--- Étape 2: Déduction des soldes manquants ---")
        fix_soldes(db)

        log("--- Étape 3: Création des activations manquantes ---")
        fix_activations(db)

        log("=== Migration terminée ===")
    except Exception as e:
        db.rollback()
        log(f"ERREUR: {e}")
        raise
    finally:
        db.close()


if __name__ == '__main__':
    main()
