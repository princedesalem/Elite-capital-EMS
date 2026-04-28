"""Restore employee 9005 data wiped by accidental partial PUT tests."""
from app.db import SessionLocal
from app import models
from sqlalchemy import text
import datetime

db = SessionLocal()

# Look up dept_id for 'Ressources Humaines'
dept = db.execute(text("SELECT dept_id, nom FROM DEPARTEMENT WHERE nom LIKE '%Ressources%Humaines%' LIMIT 1")).fetchone()
if dept:
    dept_id = dept[0]
    print(f"Found dept: {dept[1]} (id={dept_id})")
else:
    dept_id = None
    print("WARNING: departement 'Ressources Humaines' not found")

# Look up id_role for 'RH'
role = db.execute(text("SELECT id FROM roles WHERE name = 'RH' LIMIT 1")).fetchone()
role_id = role[0] if role else None
print(f"Found role RH: id={role_id}")

# Look up id_entite for 'ECG'
entite = db.execute(text("SELECT id_entite FROM ENTITE WHERE nom = 'ECG' OR nom LIKE '%ECG%' LIMIT 1")).fetchone()
entite_id = entite[0] if entite else None
print(f"Found entite ECG: id={entite_id}")

# Restore employee data
e = db.query(models.Employe).filter(models.Employe.matricule == '9005').first()
if not e:
    print("ERROR: employee 9005 not found")
    db.close()
    exit(1)

# Data confirmed from GET /employees/9005 response before the wipe
e.email          = 'hapsatou.idrissou@elite-capitalgroup.com'
e.telephone      = '+237 655 00 88 77'
e.contact_urgence = '+237 689 00 45 66'
e.sexe           = 'F'
e.fonction       = 'Responsable Des Resources Humaines'
e.dept_id        = dept_id
e.id_role        = role_id
e.id_entite      = entite_id
e.date_naissance = datetime.date(2000, 6, 22)
e.statut_matrimonial = 'Celibataire'
e.nombre_enfants = 0
e.solde_conges   = 17
e.statut_employe = models.StatutEmployeEnum.ACTIF

db.commit()
db.refresh(e)

print("\n=== Restauration terminée ===")
print(f"  email:        {e.email}")
print(f"  telephone:    {e.telephone}")
print(f"  sexe:         {e.sexe}")
print(f"  fonction:     {e.fonction}")
print(f"  dept_id:      {e.dept_id}")
print(f"  id_role:      {e.id_role}")
print(f"  id_entite:    {e.id_entite}")
print(f"  date_naiss.:  {e.date_naissance}")
print(f"  solde_conges: {e.solde_conges}")
print(f"  statut:       {e.statut_employe}")

db.close()
