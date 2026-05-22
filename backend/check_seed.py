import os, sys
sys.path.insert(0, '.')
from dotenv import load_dotenv; load_dotenv('.env')
import sqlalchemy as sa

engine = sa.create_engine(os.environ['DATABASE_URL'])
tables = [
    'pays', 'entite', 'localisation', 'direction', 'departement',
    'fonction_reference', 'formations', 'modules_formation', 'lecons',
    'employe', 'utilisateur', '_migrations_appliquees'
]
with engine.connect() as conn:
    for t in tables:
        try:
            c = conn.execute(sa.text(f"SELECT COUNT(*) FROM `{t}`")).scalar()
            print(f"  {t}: {c} lignes")
        except Exception as e:
            print(f"  {t}: ERREUR - {e}")
