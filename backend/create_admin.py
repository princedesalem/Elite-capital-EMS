"""
Script minimal : crée le compte admin (matricule 9999) directement dans SQLite.
Usage : python create_admin.py
"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))

from app.db import SessionLocal, Base, engine
from app import models
from app.utils.security import hash_password

# Charger les variables d'environnement depuis .env si python-dotenv est dispo
try:
    from dotenv import load_dotenv
    load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))
except ImportError:
    pass

ADMIN_PW = os.getenv('INIT_ADMIN_PW', 'ChangeMe123!@#')

Base.metadata.create_all(bind=engine)
db = SessionLocal()

try:
    # 1. Role ADMIN
    role = db.query(models.Role).filter(models.Role.name == 'ADMIN').first()
    if not role:
        role = models.Role(name='ADMIN', description='Administrateur système')
        db.add(role)
        db.commit()
        db.refresh(role)
    print(f'Role ADMIN id={role.id}')

    # 2. Entité minimale (pour la FK de l'employe)
    ent = db.query(models.Entite).first()
    if not ent:
        ent = models.Entite(nom='ECG')
        db.add(ent)
        db.commit()
        db.refresh(ent)
    print(f'Entite id={ent.id_entite}')

    # 3. Direction minimale
    direction = db.query(models.Direction).filter(
        models.Direction.id_entite == ent.id_entite
    ).first()
    if not direction:
        direction = models.Direction(nom='Direction Générale', id_entite=ent.id_entite)
        db.add(direction)
        db.commit()
        db.refresh(direction)
    print(f'Direction id={direction.id_direction}')

    # 4. Département minimal
    dept = db.query(models.Departement).filter(
        models.Departement.id_entite == ent.id_entite
    ).first()
    if not dept:
        dept = models.Departement(nom='Administration', id_entite=ent.id_entite)
        db.add(dept)
        db.commit()
        db.refresh(dept)
    print(f'Departement id={dept.dept_id}')

    # 5. Employé admin (matricule 9999)
    emp = db.query(models.Employe).filter(models.Employe.matricule == 9999).first()
    if not emp:
        from datetime import date
        emp = models.Employe(
            matricule=9999,
            nom='Admin',
            prenom='Systeme',
            email='admin@elc.com',
            date_embauche=date(2021, 1, 1),
            fonction='Administrateur',
            statut_employe='ACTIF',
            solde_conges=30,
            id_role=role.id,
            id_entite=ent.id_entite,
            id_direction=direction.id_direction,
            dept_id=dept.dept_id,
        )
        db.add(emp)
        db.commit()
        print('Employe 9999 cree')
    else:
        print('Employe 9999 existe deja')

    # 6. Utilisateur admin (matricule 9999)
    user = db.query(models.Utilisateur).filter(models.Utilisateur.matricule == 9999).first()
    if not user:
        safe_pwd = ADMIN_PW[:72] if len(ADMIN_PW.encode('utf-8')) > 72 else ADMIN_PW
        user = models.Utilisateur(
            matricule=9999,
            mot_de_passe_hash=hash_password(safe_pwd),
            role_id=role.id,
            email='admin@elc.com',
            mot_de_passe_temporaire=False,
            mfa_enabled=False,
        )
        db.add(user)
        db.commit()
        print(f'Utilisateur admin cree : matricule=9999, email=admin@elc.com, mot_de_passe={ADMIN_PW}')
    else:
        # Mettre à jour le mot de passe si l'user existe déjà
        safe_pwd = ADMIN_PW[:72] if len(ADMIN_PW.encode('utf-8')) > 72 else ADMIN_PW
        user.mot_de_passe_hash = hash_password(safe_pwd)
        user.role_id = role.id
        db.commit()
        print(f'Utilisateur admin mis a jour : matricule=9999, mot_de_passe={ADMIN_PW}')

    print('OK - Connexion : matricule=9999 / mot de passe=' + ADMIN_PW)

except Exception as e:
    db.rollback()
    print(f'ERREUR: {e}')
    import traceback; traceback.print_exc()
    sys.exit(1)
finally:
    db.close()
