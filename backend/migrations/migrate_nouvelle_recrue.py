"""
Migration: ajoute la colonne `nouvelle_recrue` à la table EMPLOYE.
Usage : docker exec extranet-backend-1 python migrations/migrate_nouvelle_recrue.py
"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db import engine
from sqlalchemy import text

def run():
    with engine.connect() as conn:
        # Vérifier si la colonne existe déjà
        result = conn.execute(text(
            "SELECT COUNT(*) FROM information_schema.COLUMNS "
            "WHERE TABLE_SCHEMA = DATABASE() "
            "AND TABLE_NAME = 'EMPLOYE' "
            "AND COLUMN_NAME = 'nouvelle_recrue'"
        ))
        exists = result.scalar() > 0
        if exists:
            print("✓ Colonne 'nouvelle_recrue' déjà présente — rien à faire.")
        else:
            conn.execute(text(
                "ALTER TABLE EMPLOYE ADD COLUMN nouvelle_recrue BOOLEAN DEFAULT FALSE"
            ))
            conn.commit()
            print("✓ Colonne 'nouvelle_recrue' ajoutée avec succès.")

if __name__ == '__main__':
    run()
