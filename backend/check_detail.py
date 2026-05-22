import os, sys
sys.path.insert(0, '.')
from dotenv import load_dotenv; load_dotenv('.env')
import sqlalchemy as sa

engine = sa.create_engine(os.environ['DATABASE_URL'])
with engine.connect() as conn:
    print("=== PAYS (6) ===")
    for r in conn.execute(sa.text("SELECT id_pays, nom_pays FROM pays")).fetchall():
        print(f"  [{r[0]}] {r[1]}")

    print("\n=== ENTITES (3) ===")
    for r in conn.execute(sa.text("SELECT id_entite, nom FROM entite")).fetchall():
        print(f"  [{r[0]}] {r[1]}")

    print("\n=== LOCALISATIONS (4) ===")
    for r in conn.execute(sa.text("SELECT id_localisation, ville FROM localisation")).fetchall():
        print(f"  [{r[0]}] {r[1]}")

    print("\n=== DIRECTIONS (8) ===")
    for r in conn.execute(sa.text("SELECT id_direction, nom, id_entite FROM direction ORDER BY id_direction")).fetchall():
        print(f"  [{r[0]}] {r[1]} | entite={r[2]}")

    print("\n=== DEPARTEMENTS (30) ===")
    for r in conn.execute(sa.text("SELECT dept_id, nom, id_direction FROM departement ORDER BY id_direction, dept_id")).fetchall():
        print(f"  [{r[0]}] {r[1]} | dir={r[2]}")
