"""Export des données système pour le seed de production."""
import sys, json
sys.path.insert(0, '/app')
from app.db import SessionLocal
import sqlalchemy as sa

db = SessionLocal()
seed = {}

tables = [
    'PAYS',
    'ENTITE',
    'LOCALISATION',
    'DIRECTION',
    'DEPARTEMENT',
    'DEPARTEMENT_IMPLANTATION',
    'FONCTION_REFERENCE',
    'Implantation',
    'roles',
    'MODULE_STORE_ITEM',
]

for table in tables:
    try:
        rows = db.execute(sa.text(f'SELECT * FROM `{table}`')).fetchall()
        seed[table] = [dict(r._mapping) for r in rows]
        print(f'{table}: {len(seed[table])} lignes')
    except Exception as e:
        print(f'{table}: ERREUR - {e}')

# Admin user (sans mot de passe)
try:
    rows = db.execute(sa.text(
        "SELECT matricule, nom, prenom, role, email FROM UTILISATEUR WHERE role='admin'"
    )).fetchall()
    seed['UTILISATEUR_admin'] = [dict(r._mapping) for r in rows]
    print(f'UTILISATEUR_admin: {len(seed["UTILISATEUR_admin"])} lignes')
except Exception as e:
    print(f'UTILISATEUR: ERREUR - {e}')

db.close()

with open('/tmp/seed_data.json', 'w', encoding='utf-8') as f:
    json.dump(seed, f, ensure_ascii=False, indent=2, default=str)

print('\nExporte dans /tmp/seed_data.json')
