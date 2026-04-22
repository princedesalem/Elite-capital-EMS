"""
Script one-shot pour réaligner les notifications des opérations en attente
avec les validateurs corrects, après le correctif du bug de routage direction.

Exemple concret : Samuel Ngoula avait ses demandes chez Serge Tchoua (directeur
d'une autre direction) à cause d'un champ `id_direction` incohérent sur
l'employé. Ce script parcourt toutes les opérations `en attente`, recalcule le
bon validateur via la logique corrigée, et :
  - marque comme lues les anciennes notifications mal routées ;
  - crée une nouvelle notification pour le bon validateur (si absente).

Usage :
    docker compose exec backend python fix_pending_validators.py

Idempotent : peut être relancé sans effet si tout est déjà cohérent.
"""
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parent
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.db import SessionLocal
from app.utils.workflow import rerouter_notifications_validation_en_attente


def main():
    db = SessionLocal()
    try:
        print("=" * 70)
        print("Réalignement des notifications validation pending")
        print("=" * 70)
        stats = rerouter_notifications_validation_en_attente(db)
        print()
        print(f"  Opérations examinées                   : {stats['operations_examinees']}")
        print(f"  Opérations corrigées                   : {stats['operations_corrigees']}")
        print(f"  Notifications réassignées (archivées)  : {stats['notifications_reassignees']}")
        print(f"  Notifications créées (bon validateur)  : {stats['notifications_creees_pour_nouveau_validateur']}")
        print()
        if stats['operations_corrigees'] == 0:
            print("  => Aucune correction nécessaire. Routage déjà cohérent.")
        else:
            print("  => Migration appliquée avec succès.")
    finally:
        db.close()


if __name__ == '__main__':
    main()
