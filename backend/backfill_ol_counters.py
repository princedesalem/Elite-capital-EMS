"""
backfill_ol_counters.py
-----------------------
Applique _fix_ol_counters à tous les html_content existants
de la table Fiche_poste_template.
Idempotent : peut être relancé sans risque.

Usage (depuis le container ou en local) :
    python backfill_ol_counters.py
"""
import sys
import os

# Ajoute le répertoire /app au PYTHONPATH (idem que l'app FastAPI)
sys.path.insert(0, os.path.dirname(__file__))

from app.db import SessionLocal
from app.models import FichePosteTemplate
from app.routers.fiches_poste_router import _fix_ol_counters


def main():
    db = SessionLocal()
    try:
        fiches = db.query(FichePosteTemplate).filter(
            FichePosteTemplate.html_content.isnot(None),
            FichePosteTemplate.html_content.contains('<ol'),
        ).all()

        print(f"{len(fiches)} fiche(s) contenant <ol> trouvée(s).")
        updated = 0

        for f in fiches:
            fixed = _fix_ol_counters(f.html_content)
            if fixed != f.html_content:
                f.html_content = fixed
                updated += 1
                print(f"  [UPDATED] id={f.id_template} – {f.fonction}")
            else:
                print(f"  [OK]      id={f.id_template} – {f.fonction}")

        db.commit()
        print(f"\n{updated} fiche(s) mise(s) à jour, {len(fiches) - updated} déjà correcte(s).")

    finally:
        db.close()


if __name__ == '__main__':
    main()
