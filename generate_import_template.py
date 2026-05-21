# -*- coding: utf-8 -*-
"""Génère TEMPLATE_IMPORT_EMPLOYES_EMS.xlsx avec la même structure que l'export."""

import io
import os
import sys

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "backend"))

from app.utils.employee_excel import (  # noqa: E402
    DB_DEPARTEMENTS,
    DB_DIRECTIONS,
    DB_ENTITES,
    DB_FONCTIONS,
    DB_PAYS,
    DB_ROLES,
    DB_VILLES,
    EXAMPLES,
    FONT,
    make_employee_workbook,
)


out_path = (
    r"c:\Users\cedri\OneDrive - ELITE CAPITAL Group S.A"
    r"\Documents\EMS\extranet\TEMPLATE_IMPORT_EMPLOYES_EMS.xlsx"
)

wb = make_employee_workbook(mode="template")
try:
    wb.save(out_path)
    print(f"Saved  → {out_path}")
except PermissionError:
    out_path = out_path.replace(".xlsx", "_v2.xlsx")
    wb.save(out_path)
    print(f"Fichier occupé — enregistré sous : {out_path}")

print(f"  Entités      : {len(DB_ENTITES)} valeurs")
print(f"  Directions   : {len(DB_DIRECTIONS)} valeurs")
print(f"  Départements : {len(DB_DEPARTEMENTS)} valeurs")
print(f"  Fonctions    : {len(DB_FONCTIONS)} valeurs")
print(f"  Rôles        : {len(DB_ROLES)} valeurs")
print(f"  Villes       : {len(DB_VILLES)} valeurs")
print(f"  Pays         : {len(DB_PAYS)} valeurs")
print(f"  Police       : {FONT}")
print(f"  Lignes       : 300 lignes pré-équipées  ·  {len(EXAMPLES)} lignes d'exemple grisées")
