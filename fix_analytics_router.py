import re

f = r'c:\Users\cedri\OneDrive - ELITE CAPITAL Group S.A\Documents\EMS\extranet\backend\app\routers\analytics_router.py'
c = open(f, encoding='utf-8').read()

# --- Fix sheet 6: replace Employe.departement with Departement.nom via join ---

# Fix the query selection
c = c.replace(
    "models.Employe.departement,\n            func.count(models.Operation.id_operation).label('nb_abs'),",
    "models.Departement.nom.label('dept_nom'),\n            func.count(models.Operation.id_operation).label('nb_abs'),"
)

# Fix the first join (Operation → Employe) and add second join (Employe → Departement)
c = c.replace(
    ".join(models.Operation, models.Operation.matricule == models.Employe.matricule)\n        .filter(\n            models.Operation.type_demande.in_(",
    ".join(models.Employe, models.Operation.matricule == models.Employe.matricule)\n        .join(models.Departement, models.Departement.dept_id == models.Employe.dept_id)\n        .filter(\n            models.Operation.type_demande.in_(",
    1  # only replace first occurrence
)

# Fix group_by and the effectif_dept query
old_block = (
    ".group_by(models.Employe.departement)\n        .all()\n    )\n"
    "    effectif_dept = dict(\n"
    "        db.query(models.Employe.departement, func.count(models.Employe.matricule))\n"
    "        .filter(models.Employe.statut_employe == models.StatutEmployeEnum.ACTIF)\n"
    "        .group_by(models.Employe.departement)"
)
new_block = (
    ".group_by(models.Departement.nom)\n        .all()\n    )\n"
    "    effectif_dept = dict(\n"
    "        db.query(models.Departement.nom, func.count(models.Employe.matricule))\n"
    "        .join(models.Employe, models.Employe.dept_id == models.Departement.dept_id)\n"
    "        .filter(models.Employe.statut_employe == models.StatutEmployeEnum.ACTIF)\n"
    "        .group_by(models.Departement.nom)"
)
c = c.replace(old_block, new_block, 1)

# Fix the iteration loop
old_loop = (
    "    for dept, nb_abs in sorted(abs_dept_raw, key=lambda x: x[1], reverse=True):\n"
    "        eff = effectif_dept.get(dept, 0) or 1\n"
    "        taux = round(nb_abs / eff * 100, 1) if eff else 0\n"
    "        ws6.append([dept or 'N/A', effectif_dept.get(dept, 0), nb_abs, taux])"
)
new_loop = (
    "    for dept_nom, nb_abs in sorted(abs_dept_raw, key=lambda x: x[1], reverse=True):\n"
    "        eff = effectif_dept.get(dept_nom, 0) or 1\n"
    "        taux = round(nb_abs / eff * 100, 1) if eff else 0\n"
    "        ws6.append([dept_nom or 'N/A', effectif_dept.get(dept_nom, 0), nb_abs, taux])"
)
c = c.replace(old_loop, new_loop)

# --- Fix sheet 9: Distribution_org - departments section ---
# The block groups by Employe.departement
old_dept_sheet9 = (
    "    dept_rows = (\n"
    "        db.query(models.Employe.departement, func.count(models.Employe.matricule))\n"
    "        .filter(models.Employe.statut_employe == models.StatutEmployeEnum.ACTIF)\n"
    "        .group_by(models.Employe.departement)\n"
    "        .order_by(func.count(models.Employe.matricule).desc())\n"
    "        .all()\n"
    "    )\n"
    "    for dept, cnt in dept_rows:\n"
    "        ws9.append([dept or 'N/A', cnt])"
)
new_dept_sheet9 = (
    "    dept_rows = (\n"
    "        db.query(models.Departement.nom, func.count(models.Employe.matricule))\n"
    "        .join(models.Employe, models.Employe.dept_id == models.Departement.dept_id)\n"
    "        .filter(models.Employe.statut_employe == models.StatutEmployeEnum.ACTIF)\n"
    "        .group_by(models.Departement.nom)\n"
    "        .order_by(func.count(models.Employe.matricule).desc())\n"
    "        .all()\n"
    "    )\n"
    "    for dept, cnt in dept_rows:\n"
    "        ws9.append([dept or 'N/A', cnt])"
)
c = c.replace(old_dept_sheet9, new_dept_sheet9, 1)

# --- Fix export_dashboard: Profil sheet emp.departement ---
c = c.replace("        ('Département', emp.departement or ''),", "        ('Département', ''),  # resolved below via dept_obj")

# After "('Entité', ent_obj.nom if ent_obj else '')," add dept
old_profil = "        ('Entité', ent_obj.nom if ent_obj else ''),\n        ('Département', ''),  # resolved below via dept_obj"
new_profil = "        ('Entité', ent_obj.nom if ent_obj else ''),\n        ('Département', dept_obj.nom if dept_obj else ''),"
c = c.replace(old_profil, new_profil)

# Add dept_obj lookup
old_lookup = "    ent_obj = db.query(models.Entite).filter_by(id_entite=emp.id_entite).first()"
new_lookup = (
    "    ent_obj = db.query(models.Entite).filter_by(id_entite=emp.id_entite).first()\n"
    "    dept_obj = db.query(models.Departement).filter_by(dept_id=emp.dept_id).first()"
)
c = c.replace(old_lookup, new_lookup)

# --- Fix export_dashboard: Org_distribution sheet ---
old_org = (
    "    dept_rows = (\n"
    "        db.query(models.Employe.departement, func.count(models.Employe.matricule))\n"
    "        .filter(\n"
    "            models.Employe.id_direction == emp.id_direction,\n"
    "            models.Employe.statut_employe == models.StatutEmployeEnum.ACTIF,\n"
    "        )\n"
    "        .group_by(models.Employe.departement)\n"
    "        .all()\n"
    "    )\n"
    "    for dept, cnt in dept_rows:\n"
    "        ws4.append([dept or 'N/A', cnt])"
)
new_org = (
    "    dept_rows = (\n"
    "        db.query(models.Departement.nom, func.count(models.Employe.matricule))\n"
    "        .join(models.Employe, models.Employe.dept_id == models.Departement.dept_id)\n"
    "        .filter(\n"
    "            models.Employe.id_direction == emp.id_direction,\n"
    "            models.Employe.statut_employe == models.StatutEmployeEnum.ACTIF,\n"
    "        )\n"
    "        .group_by(models.Departement.nom)\n"
    "        .all()\n"
    "    )\n"
    "    for dept, cnt in dept_rows:\n"
    "        ws4.append([dept or 'N/A', cnt])"
)
c = c.replace(old_org, new_org)

open(f, 'w', encoding='utf-8').write(c)

# Report remaining issues
remaining = list(re.finditer(r'Employe\.departement', c))
print(f'Fixed! Remaining Employe.departement: {len(remaining)}')
for m in remaining:
    line = c[:m.start()].count('\n') + 1
    print(f'  line {line}: {c[m.start()-30:m.end()+30].strip()}')
