"""Seed idempotent pour les tests E2E Playwright.

Crée (s'ils n'existent pas) :
  - entité "E2E Entite", direction, département
  - 6 rôles standards
  - 3 utilisateurs E2E (employé 90001, responsable 90002, RH 90003)
    avec mot de passe `Test1234!@#`

Utilisation :
    docker compose exec -T backend python e2e_seed.py
"""
from datetime import date

from app.db import SessionLocal
from app import models
from app.utils.security import hash_password


E2E_PASSWORD = 'Test1234!@#'
E2E_ENTITE_NAME = 'E2E Entite'

USERS = [
    # (matricule, nom, prenom, role_name, sexe)
    (90001, 'E2E', 'Employe',     'EMPLOYE',     'M'),
    (90002, 'E2E', 'Responsable', 'RESPONSABLE', 'M'),
    (90003, 'E2E', 'RH',          'RH',          'F'),
]


def _get_or_create(db, model, filters, defaults=None):
    q = db.query(model).filter_by(**filters).first()
    if q:
        return q, False
    obj = model(**filters, **(defaults or {}))
    db.add(obj); db.flush()
    return obj, True


def seed():
    db = SessionLocal()
    created = 0
    try:
        entite, _ = _get_or_create(db, models.Entite, {'nom': E2E_ENTITE_NAME})

        loc_id = None
        try:
            loc, _ = _get_or_create(
                db, models.Localisation,
                {'pays': 'Cameroun', 'ville': 'Douala'},
            )
            loc_id = loc.id_localisation
        except Exception:
            loc_id = None

        direction, _ = _get_or_create(
            db, models.Direction,
            {'nom': 'E2E Direction', 'id_entite': entite.id_entite},
            defaults={'id_localisation': loc_id},
        )
        departement, _ = _get_or_create(
            db, models.Departement,
            {'nom': 'E2E Departement',
             'id_entite': entite.id_entite,
             'id_direction': direction.id_direction},
        )

        roles = {}
        for name in ('EMPLOYE', 'RESPONSABLE', 'DIRECTEUR', 'DG', 'RH', 'ADMIN'):
            role, _ = _get_or_create(
                db, models.Role, {'name': name},
                defaults={'description': f'Role {name}'},
            )
            roles[name] = role

        pwd_hash = hash_password(E2E_PASSWORD)

        for (mat, nom, prenom, role_name, sexe) in USERS:
            emp = db.query(models.Employe).filter(models.Employe.matricule == mat).first()
            if not emp:
                emp = models.Employe(
                    matricule=mat,
                    nom=nom,
                    prenom=prenom,
                    email=f'{mat}@e2e.local',
                    date_embauche=date(2020, 1, 1),
                    dept_id=departement.dept_id,
                    id_direction=direction.id_direction,
                    id_entite=entite.id_entite,
                    id_role=roles[role_name].id,
                    fonction=role_name,
                    sexe=sexe,
                    solde_conges=18,
                )
                db.add(emp); db.flush()
                created += 1

            user = db.query(models.Utilisateur).filter(
                models.Utilisateur.matricule == mat
            ).first()
            if not user:
                user = models.Utilisateur(
                    matricule=mat,
                    email=f'{mat}@e2e.local',
                    role_id=roles[role_name].id,
                    mot_de_passe_hash=pwd_hash,
                    mot_de_passe_temporaire=False,
                    mfa_enabled=False,
                    mfa_active=False,
                )
                db.add(user); db.flush()
            else:
                user.mot_de_passe_hash = pwd_hash
                user.mot_de_passe_temporaire = False
                user.mfa_enabled = False
                user.mfa_active = False

        db.commit()
        print(f"[e2e_seed] OK — {len(USERS)} utilisateurs dispos (créés: {created}) password={E2E_PASSWORD}")
    except Exception as e:
        db.rollback()
        print(f"[e2e_seed] ERREUR : {e}")
        raise
    finally:
        db.close()


if __name__ == '__main__':
    seed()
