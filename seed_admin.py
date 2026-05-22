import sqlite3
import hashlib
import os
import sys

DB_PATH = "C:/EMS/backend/ems.db"
ADMIN_PW = "ChangeMe123!@#"

# bcrypt hash via passlib si dispo, sinon on l'installe
try:
    from passlib.context import CryptContext
    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
    hashed = pwd_context.hash(ADMIN_PW)
    print("Hash bcrypt OK")
except Exception as e:
    print("passlib erreur:", e)
    sys.exit(1)

con = sqlite3.connect(DB_PATH)
cur = con.cursor()

# Role ADMIN
cur.execute("SELECT id FROM roles WHERE name='ADMIN'")
row = cur.fetchone()
if not row:
    cur.execute("INSERT INTO roles (name, description) VALUES ('ADMIN', 'Administrateur système')")
    con.commit()
    cur.execute("SELECT id FROM roles WHERE name='ADMIN'")
    row = cur.fetchone()
role_id = row[0]
print(f"Role ADMIN id={role_id}")

# Entite
cur.execute("SELECT id_entite FROM ENTITE LIMIT 1")
row = cur.fetchone()
if not row:
    cur.execute("INSERT INTO ENTITE (nom) VALUES ('ECG')")
    con.commit()
    cur.execute("SELECT id_entite FROM ENTITE LIMIT 1")
    row = cur.fetchone()
id_entite = row[0]
print(f"Entite id={id_entite}")

# Direction
cur.execute("SELECT id_direction FROM DIRECTION WHERE id_entite=? LIMIT 1", (id_entite,))
row = cur.fetchone()
if not row:
    cur.execute("INSERT INTO DIRECTION (nom, id_entite) VALUES ('Direction Générale', ?)", (id_entite,))
    con.commit()
    cur.execute("SELECT id_direction FROM DIRECTION WHERE id_entite=? LIMIT 1", (id_entite,))
    row = cur.fetchone()
id_direction = row[0]
print(f"Direction id={id_direction}")

# Département
cur.execute("SELECT dept_id FROM DEPARTEMENT WHERE id_entite=? LIMIT 1", (id_entite,))
row = cur.fetchone()
if not row:
    cur.execute("INSERT INTO DEPARTEMENT (nom, id_entite) VALUES ('Administration', ?)", (id_entite,))
    con.commit()
    cur.execute("SELECT dept_id FROM DEPARTEMENT WHERE id_entite=? LIMIT 1", (id_entite,))
    row = cur.fetchone()
dept_id = row[0]
print(f"Departement id={dept_id}")

# Employé 9999
cur.execute("SELECT matricule FROM EMPLOYE WHERE matricule=9999")
if not cur.fetchone():
    cur.execute("""
        INSERT INTO EMPLOYE (matricule, nom, prenom, email, date_embauche, fonction,
            statut_employe, solde_conges, id_role, id_entite, id_direction, dept_id)
        VALUES (9999, 'Admin', 'Systeme', 'admin@elc.com', '2021-01-01', 'Administrateur',
            'ACTIF', 30, ?, ?, ?, ?)
    """, (role_id, id_entite, id_direction, dept_id))
    con.commit()
    print("Employe 9999 cree")
else:
    print("Employe 9999 existe deja")

# Utilisateur 9999
cur.execute("SELECT matricule FROM UTILISATEUR WHERE matricule=9999")
if not cur.fetchone():
    cur.execute("""
        INSERT INTO UTILISATEUR (matricule, mot_de_passe_hash, role_id, email,
            mot_de_passe_temporaire, mfa_enabled)
        VALUES (9999, ?, ?, 'admin@elc.com', 0, 0)
    """, (hashed, role_id))
    con.commit()
    print("Utilisateur admin CREE")
else:
    cur.execute("UPDATE UTILISATEUR SET mot_de_passe_hash=?, role_id=? WHERE matricule=9999",
                (hashed, role_id))
    con.commit()
    print("Utilisateur admin MIS A JOUR (mot de passe reset)")

# Vérification
cur.execute("SELECT matricule, email, mot_de_passe_hash FROM UTILISATEUR WHERE matricule=9999")
r = cur.fetchone()
print(f"\nResultat: matricule={r[0]} email={r[1]} hash={r[2][:30]}...")
print(f"\nConnexion: matricule=9999  mot_de_passe={ADMIN_PW}")
con.close()
