import sys
sys.stdout.reconfigure(encoding="utf-8")
import pymysql

conn = pymysql.connect(host="db", user="root", password="extranet", database="EMS_DB", charset="utf8mb4")
cur = conn.cursor()

lines = [
    "-- Migration 076 : Synchronisation référentiel DEV -> PROD",
    "-- Entités, Directions, Départements, Fonctions",
    "-- Idempotent : safe to run multiple times",
    "",
    "SET NAMES utf8mb4;",
    "",
]

# ENTITÉS
lines.append("-- ---------------------------------------------------------------")
lines.append("-- ENTITES")
lines.append("-- ---------------------------------------------------------------")
cur.execute("SELECT nom FROM ENTITE ORDER BY id_entite")
for (nom,) in cur.fetchall():
    n = nom.replace("'", "''")
    lines.append(
        f"INSERT INTO ENTITE (nom) SELECT '{n}' FROM DUAL "
        f"WHERE NOT EXISTS (SELECT 1 FROM ENTITE WHERE nom = '{n}');"
    )
lines.append("")

# DIRECTIONS
lines.append("-- ---------------------------------------------------------------")
lines.append("-- DIRECTIONS")
lines.append("-- ---------------------------------------------------------------")
cur.execute("""
    SELECT d.nom, e.nom AS entite_nom
    FROM DIRECTION d
    JOIN ENTITE e ON d.id_entite = e.id_entite
    ORDER BY e.id_entite, d.id_direction
""")
for (nom, entite_nom) in cur.fetchall():
    n = nom.replace("'", "''")
    en = entite_nom.replace("'", "''")
    lines.append(
        f"INSERT INTO DIRECTION (nom, id_entite) "
        f"SELECT '{n}', id_entite FROM ENTITE WHERE nom = '{en}' "
        f"AND NOT EXISTS ("
        f"SELECT 1 FROM DIRECTION d2 "
        f"JOIN ENTITE e2 ON d2.id_entite = e2.id_entite "
        f"WHERE d2.nom = '{n}' AND e2.nom = '{en}');"
    )
lines.append("")

# DÉPARTEMENTS
lines.append("-- ---------------------------------------------------------------")
lines.append("-- DEPARTEMENTS")
lines.append("-- ---------------------------------------------------------------")
cur.execute("""
    SELECT dep.nom, e.nom AS entite_nom, dir.nom AS dir_nom
    FROM DEPARTEMENT dep
    JOIN ENTITE e ON dep.id_entite = e.id_entite
    LEFT JOIN DIRECTION dir ON dep.id_direction = dir.id_direction
    ORDER BY e.id_entite, dep.id_direction, dep.dept_id
""")
for (nom, entite_nom, dir_nom) in cur.fetchall():
    n = nom.replace("'", "''")
    en = entite_nom.replace("'", "''")
    if dir_nom is None:
        lines.append(
            f"INSERT INTO DEPARTEMENT (nom, id_entite, id_direction) "
            f"SELECT '{n}', id_entite, NULL FROM ENTITE WHERE nom = '{en}' "
            f"AND NOT EXISTS ("
            f"SELECT 1 FROM DEPARTEMENT d2 "
            f"JOIN ENTITE e2 ON d2.id_entite = e2.id_entite "
            f"WHERE d2.nom = '{n}' AND e2.nom = '{en}' AND d2.id_direction IS NULL);"
        )
    else:
        dn = dir_nom.replace("'", "''")
        lines.append(
            f"INSERT INTO DEPARTEMENT (nom, id_entite, id_direction) "
            f"SELECT '{n}', e.id_entite, d.id_direction "
            f"FROM ENTITE e JOIN DIRECTION d ON d.id_entite = e.id_entite "
            f"WHERE e.nom = '{en}' AND d.nom = '{dn}' "
            f"AND NOT EXISTS ("
            f"SELECT 1 FROM DEPARTEMENT dep2 "
            f"JOIN DIRECTION dir2 ON dep2.id_direction = dir2.id_direction "
            f"WHERE dep2.nom = '{n}' AND dir2.nom = '{dn}');"
        )
lines.append("")

# FONCTIONS
lines.append("-- ---------------------------------------------------------------")
lines.append("-- FONCTIONS")
lines.append("-- ---------------------------------------------------------------")
lines.append("-- UNIQUE KEY sur (libelle, id_direction, dept_id) -> INSERT IGNORE ok")
cur.execute("""
    SELECT DISTINCT f.libelle, dep.nom AS dept_nom, e.nom AS entite_nom
    FROM FONCTION_REFERENCE f
    LEFT JOIN DEPARTEMENT dep ON f.dept_id = dep.dept_id
    LEFT JOIN ENTITE e ON dep.id_entite = e.id_entite
    ORDER BY dept_nom, f.libelle
""")
for (libelle, dept_nom, entite_nom) in cur.fetchall():
    lb = libelle.replace("'", "''")
    if dept_nom is None:
        # INSERT IGNORE ne prévient PAS les doublons quand dept_id IS NULL
        # (le UNIQUE KEY contient des NULLs → MySQL n'applique pas l'unicité)
        lines.append(
            f"INSERT INTO FONCTION_REFERENCE (libelle, dept_id) "
            f"SELECT '{lb}', NULL FROM DUAL WHERE NOT EXISTS "
            f"(SELECT 1 FROM FONCTION_REFERENCE WHERE libelle = '{lb}' AND dept_id IS NULL);"
        )
    else:
        dp = dept_nom.replace("'", "''")
        ep = entite_nom.replace("'", "''")
        lines.append(
            f"INSERT IGNORE INTO FONCTION_REFERENCE (libelle, dept_id) "
            f"SELECT '{lb}', dep.dept_id "
            f"FROM DEPARTEMENT dep JOIN ENTITE e ON dep.id_entite = e.id_entite "
            f"WHERE dep.nom = '{dp}' AND e.nom = '{ep}';"
        )

cur.close()
conn.close()

# Ajouts manuels post-génération (fonctions ajoutées via l'interface admin)
lines.append("")
lines.append("-- ---------------------------------------------------------------")
lines.append("-- FONCTIONS AJOUTÉES MANUELLEMENT")
lines.append("-- ---------------------------------------------------------------")
lines.append("INSERT INTO FONCTION_REFERENCE (libelle, dept_id) SELECT 'Directeur Exécutif, Head of Deal Origination', NULL FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM FONCTION_REFERENCE WHERE libelle = 'Directeur Exécutif, Head of Deal Origination' AND dept_id IS NULL);")

print("\n".join(lines))
