"""
Auto-migrator : applique automatiquement les fichiers SQL du dossier migrations/
qui n'ont pas encore été exécutés sur la base de données courante.

Fonctionne avec MySQL ET SQLite (environnement de test).

Appelé au démarrage du backend dans lifespan().
"""
import logging
import os
import re
from pathlib import Path
from sqlalchemy import text

logger = logging.getLogger(__name__)

MIGRATIONS_DIR = Path(__file__).resolve().parents[2] / 'migrations'

# Requêtes adaptées selon le dialecte
_CREATE_TABLE_MYSQL = """
CREATE TABLE IF NOT EXISTS `_migrations_appliquees` (
    `nom` VARCHAR(255) NOT NULL PRIMARY KEY,
    `appliquee_le` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
"""

_CREATE_TABLE_SQLITE = """
CREATE TABLE IF NOT EXISTS "_migrations_appliquees" (
    "nom" TEXT NOT NULL PRIMARY KEY,
    "appliquee_le" TEXT DEFAULT (datetime('now'))
);
"""


def _is_sqlite(engine) -> bool:
    return engine.dialect.name == 'sqlite'


def _ensure_table(conn, is_sqlite: bool) -> None:
    sql = _CREATE_TABLE_SQLITE if is_sqlite else _CREATE_TABLE_MYSQL
    conn.execute(text(sql))


def _get_appliquees(conn) -> set:
    rows = conn.execute(text('SELECT nom FROM "_migrations_appliquees"'
                             if False else 'SELECT nom FROM `_migrations_appliquees`')).fetchall()
    return {r[0] for r in rows}


def _get_appliquees_safe(conn, is_sqlite: bool) -> set:
    table = '"_migrations_appliquees"' if is_sqlite else '`_migrations_appliquees`'
    rows = conn.execute(text(f'SELECT nom FROM {table}')).fetchall()
    return {r[0] for r in rows}


def _mark_done(conn, nom: str, is_sqlite: bool) -> None:
    table = '"_migrations_appliquees"' if is_sqlite else '`_migrations_appliquees`'
    col = '"nom"' if is_sqlite else '`nom`'
    conn.execute(text(f'INSERT INTO {table} ({col}) VALUES (:nom)'), {'nom': nom})


def _split_statements(sql: str):
    """Découpe un fichier SQL en statements individuels (séparés par ;)."""
    # Supprimer les commentaires -- et /* */
    sql = re.sub(r'--[^\n]*', '', sql)
    sql = re.sub(r'/\*.*?\*/', '', sql, flags=re.DOTALL)
    stmts = [s.strip() for s in sql.split(';')]
    return [s for s in stmts if s]


def run_migrations(engine) -> None:
    """
    Vérifie et applique toutes les migrations SQL manquantes dans l'ordre.
    Les fichiers .py dans migrations/ sont ignorés (gérés manuellement).
    """
    if not MIGRATIONS_DIR.exists():
        logger.warning(f"Dossier migrations introuvable : {MIGRATIONS_DIR}")
        return

    is_sqlite = _is_sqlite(engine)

    # Trier les fichiers par numéro de préfixe (NNN_nom.sql)
    sql_files = sorted(
        [f for f in MIGRATIONS_DIR.glob('*.sql')],
        key=lambda p: p.name
    )

    if not sql_files:
        return

    try:
        with engine.begin() as conn:
            _ensure_table(conn, is_sqlite)
            appliquees = _get_appliquees_safe(conn, is_sqlite)

        for sql_file in sql_files:
            nom = sql_file.name
            if nom in appliquees:
                continue

            logger.info(f"[auto_migrate] Application de {nom}...")
            sql_content = sql_file.read_text(encoding='utf-8')
            statements = _split_statements(sql_content)

            try:
                with engine.begin() as conn:
                    for stmt in statements:
                        try:
                            conn.execute(text(stmt))
                        except Exception as e:
                            err_msg = str(e).lower()
                            # Ignorer les erreurs "colonne déjà existante" ou "table déjà existante"
                            if any(k in err_msg for k in [
                                'duplicate column', 'already exists',
                                '1060',   # MySQL: Duplicate column name
                                '1050',   # MySQL: Table already exists
                                'duplicate key', 'unique constraint',
                            ]):
                                logger.info(f"[auto_migrate] {nom}: ignoré (déjà appliqué partiellement) — {e}")
                            else:
                                raise

                    _mark_done(conn, nom, is_sqlite)
                logger.info(f"[auto_migrate] {nom} appliqué avec succès.")

            except Exception as e:
                logger.error(f"[auto_migrate] Échec de {nom}: {e}")
                # On continue quand même pour les migrations suivantes

    except Exception as e:
        logger.error(f"[auto_migrate] Erreur générale : {e}")
