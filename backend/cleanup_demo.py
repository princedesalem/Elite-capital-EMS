"""Nettoyage des employés/utilisateurs de démo — garde uniquement le compte admin 9999."""
import os, sys
sys.path.insert(0, '.')
from dotenv import load_dotenv; load_dotenv('.env')
import sqlalchemy as sa
from sqlalchemy.orm import Session

engine = sa.create_engine(os.environ['DATABASE_URL'])
db = Session(engine)

try:
    # Désactiver FK checks pour pouvoir supprimer
    db.execute(sa.text("SET FOREIGN_KEY_CHECKS=0"))

    non_user = db.execute(sa.text("SELECT COUNT(*) FROM UTILISATEUR WHERE matricule != '9999'")).scalar()
    db.execute(sa.text("DELETE FROM UTILISATEUR WHERE matricule != '9999'"))
    print(f"  UTILISATEUR: {non_user} supprimé(s), admin 9999 conservé")

    non_emp = db.execute(sa.text("SELECT COUNT(*) FROM EMPLOYE WHERE matricule != '9999'")).scalar()
    db.execute(sa.text("DELETE FROM EMPLOYE WHERE matricule != '9999'"))
    print(f"  EMPLOYE: {non_emp} supprimé(s), admin 9999 conservé")

    db.execute(sa.text("SET FOREIGN_KEY_CHECKS=1"))
    db.commit()
    print("\n✓ Nettoyage terminé.")
except Exception as e:
    db.execute(sa.text("SET FOREIGN_KEY_CHECKS=1"))
    db.rollback()
    print(f"ERREUR: {e}")
finally:
    db.close()
