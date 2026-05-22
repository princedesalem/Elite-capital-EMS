import sqlite3

con = sqlite3.connect("C:/EMS/backend/ems.db")
cur = con.cursor()

cur.execute("SELECT name FROM sqlite_master WHERE type='table'")
tables = [r[0] for r in cur.fetchall()]
print("Tables:", tables)

try:
    cur.execute("SELECT matricule, email, mot_de_passe_hash, role_id FROM UTILISATEUR LIMIT 20")
    rows = cur.fetchall()
    print("Utilisateurs (%d):" % len(rows))
    for r in rows:
        print("  matricule=%s  email=%s  hash=%s  role=%s" % (r[0], r[1], (r[2] or "")[:20], r[3]))
except Exception as e:
    print("UTILISATEUR error:", e)

try:
    cur.execute("SELECT matricule, nom, prenom, email FROM EMPLOYE LIMIT 20")
    rows = cur.fetchall()
    print("Employes (%d):" % len(rows))
    for r in rows:
        print("  %s  %s %s  %s" % r)
except Exception as e:
    print("EMPLOYE error:", e)

con.close()
