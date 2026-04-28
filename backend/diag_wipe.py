from app.db import SessionLocal
from app import models
from sqlalchemy import text

db = SessionLocal()
e = db.query(models.Employe).filter_by(matricule='9005').first()
print('=== 9005 ===')
for col in ['matricule', 'photo', 'id_direction', 'dept_id', 'id_entite', 'id_role']:
    print(f'  {col}: {getattr(e, col, None)}')

# Inspect direction table
print()
print('=== Directions ===')
for d in db.query(models.Direction).all():
    print(f'  id={d.id_direction} nom={d.nom} entite={d.id_entite}')

# Employees grouped by direction
print()
print('=== Employees per direction ===')
rows = db.execute(text("SELECT id_direction, COUNT(*) c FROM employes GROUP BY id_direction")).fetchall()
for r in rows:
    print(r)

# Recent EMPLOYEE_UPDATED
print()
print('=== Recent EMPLOYEE_UPDATED ===')
rows = db.execute(text("SELECT entity_id, actor, ip, timestamp FROM audit_logs WHERE action='EMPLOYEE_UPDATED' ORDER BY timestamp DESC LIMIT 40")).fetchall()
for r in rows:
    print(r)

# Employees in elcam conformite (search by libelle)
print()
print('=== Search direction conformite/elcam ===')
rows = db.execute(text("SELECT matricule, nom, prenom, id_direction, id_entite FROM employes WHERE id_direction IS NULL ORDER BY matricule LIMIT 50")).fetchall()
print(f'Employees with NULL id_direction: {len(rows)}')
for r in rows[:20]:
    print(r)

db.close()
