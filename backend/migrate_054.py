"""Apply migration 054: convert matricule columns from INT to VARCHAR(32)."""
import pymysql

conn = pymysql.connect(host='db', user='extranet', password='extranet',
                       database='EMS_DB', autocommit=True)
cur = conn.cursor()

# Get all FK names referencing EMPLOYE.matricule
cur.execute("""SELECT TABLE_NAME, CONSTRAINT_NAME
FROM information_schema.KEY_COLUMN_USAGE
WHERE REFERENCED_TABLE_SCHEMA='EMS_DB'
  AND REFERENCED_TABLE_NAME='EMPLOYE'
  AND REFERENCED_COLUMN_NAME='matricule'""")
fks = cur.fetchall()
print(f'FKs to drop: {len(fks)}')

# 1) Drop all FKs pointing to EMPLOYE.matricule
for tbl, fk in fks:
    try:
        cur.execute(f"ALTER TABLE `{tbl}` DROP FOREIGN KEY `{fk}`")
        print(f"  dropped FK {tbl}.{fk}")
    except Exception as e:
        print(f"  skip drop {tbl}.{fk}: {e}")

# Drop self-referential n1 FK on EMPLOYE
try:
    cur.execute("ALTER TABLE EMPLOYE DROP FOREIGN KEY EMPLOYE_ibfk_3")
    print("  dropped n1 FK")
except Exception as e:
    print(f"  n1 FK drop: {e}")

# 2) Alter EMPLOYE PK + own columns
cur.execute("""ALTER TABLE EMPLOYE
    MODIFY COLUMN matricule VARCHAR(32) NOT NULL,
    MODIFY COLUMN backup_matricule VARCHAR(32) NULL,
    MODIFY COLUMN n1 VARCHAR(32) NULL""")
print("EMPLOYE done")

# 3) Alter all FK-referencing columns
alters = [
    ("UTILISATEUR", "matricule", "VARCHAR(32) NULL"),
    ("DIRECTION",   "id_directeur",  "VARCHAR(32) NULL"),
    ("DEPARTEMENT", "id_responsable", "VARCHAR(32) NULL"),
    ("OPERATIONS",  "matricule",  "VARCHAR(32) NOT NULL"),
    ("OPERATIONS",  "remplacant", "VARCHAR(32) NULL"),
    ("OPERATIONS",  "cree_par",   "VARCHAR(32) NULL"),
    ("Conges",      "matricule",  "VARCHAR(32) NULL"),
    ("Permission",  "matricule",  "VARCHAR(32) NOT NULL"),
    ("Permission",  "cree_par",   "VARCHAR(32) NOT NULL"),
    ("SORTIE",      "matricule",  "VARCHAR(32) NULL"),
    ("SORTIE",      "cree_par",   "VARCHAR(32) NOT NULL"),
    ("Mission",     "matricule",  "VARCHAR(32) NOT NULL"),
    ("Frais",       "matricule",  "VARCHAR(32) NULL"),
    ("Frais",       "remplacant", "VARCHAR(32) NULL"),
    ("Frais",       "cree_par",   "VARCHAR(32) NULL"),
    ("MissionnairesMission", "matricule", "VARCHAR(32) NULL"),
    ("CommentaireMission",   "matricule", "VARCHAR(32) NULL"),
    ("FraisMissionnaire",    "matricule", "VARCHAR(32) NOT NULL"),
    ("Validation",  "matricule_validateur", "VARCHAR(32) NULL"),
    ("Notification", "matricule", "VARCHAR(32) NULL"),
    ("Activation",  "matricule",  "VARCHAR(32) NOT NULL"),
    ("Alerte_conges_annuelle", "matricule", "VARCHAR(32) NULL"),
    ("Congedier",   "matricule",  "VARCHAR(32) NULL"),
    ("Creation",    "matricule",  "VARCHAR(32) NULL"),
    ("Demande_explication", "matricule", "VARCHAR(32) NULL"),
    ("Embauche",    "matricule",  "VARCHAR(32) NULL"),
    ("Evaluation",  "matricule",  "VARCHAR(32) NULL"),
    ("Fiche_de_poste", "matricule", "VARCHAR(32) NULL"),
    ("Fiche_de_poste", "cree_par",  "VARCHAR(32) NULL"),
    ("PARCOURS_EMPLOYE", "matricule", "VARCHAR(32) NOT NULL"),
    ("PUSH_SUBSCRIPTION", "matricule", "VARCHAR(32) NOT NULL"),
    ("SESSION_UTILISATION", "matricule", "VARCHAR(32) NULL"),
    ("TASK", "assigne_a", "VARCHAR(32) NULL"),
    ("TASK", "cree_par",  "VARCHAR(32) NOT NULL"),
    ("TASK_ASSIGNEE", "matricule_employe", "VARCHAR(32) NOT NULL"),
    ("TEAM_SPACE_POST", "author_matricule", "VARCHAR(32) NULL"),
    ("USER_SETTINGS", "matricule", "VARCHAR(32) NOT NULL"),
    ("Remplacant_propose", "matricule_remplacant", "VARCHAR(32) NOT NULL"),
    ("MODULE_STORE_ITEM", "created_by", "VARCHAR(32) NULL"),
    ("Periode_evaluation", "cree_par", "VARCHAR(32) NULL"),
    ("club_activities", "created_by", "VARCHAR(32) NULL"),
    ("club_memberships", "user_id", "VARCHAR(32) NULL"),
    ("club_review_items", "user_id", "VARCHAR(32) NULL"),
    ("clubs", "created_by", "VARCHAR(32) NULL"),
    ("evenements", "created_by", "VARCHAR(32) NULL"),
    ("reviews_360", "reviewer_id", "VARCHAR(32) NOT NULL"),
    ("reviews_360", "reviewee_id", "VARCHAR(32) NOT NULL"),
    ("talent_goals", "employee_id", "VARCHAR(32) NULL"),
    ("talent_meetings", "manager_id", "VARCHAR(32) NULL"),
    ("talent_meetings", "employee_id", "VARCHAR(32) NULL"),
    ("workforce_positions", "created_by", "VARCHAR(32) NULL"),
]

for tbl, col, typedef in alters:
    try:
        cur.execute(f"ALTER TABLE `{tbl}` MODIFY COLUMN `{col}` {typedef}")
        print(f"  OK {tbl}.{col}")
    except Exception as e:
        print(f"  ERR {tbl}.{col}: {e}")

# 4) Recreate FKs (fetch column info from information_schema before we lost it — 
#    we still have them in fks list)
for tbl, fk in fks:
    try:
        cur.execute("""SELECT COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
            FROM information_schema.KEY_COLUMN_USAGE
            WHERE TABLE_SCHEMA='EMS_DB' AND TABLE_NAME=%s AND CONSTRAINT_NAME=%s""",
            (tbl, fk))
        row = cur.fetchone()
        if row:
            col, ref_tbl, ref_col = row
            cur.execute(
                f"ALTER TABLE `{tbl}` ADD CONSTRAINT `{fk}` "
                f"FOREIGN KEY (`{col}`) REFERENCES `{ref_tbl}`(`{ref_col}`)"
            )
    except Exception as e:
        print(f"  FK recreate {tbl}.{fk}: {e}")

# Recreate self-ref n1
try:
    cur.execute("ALTER TABLE EMPLOYE ADD CONSTRAINT EMPLOYE_ibfk_3 "
                "FOREIGN KEY (n1) REFERENCES EMPLOYE(matricule)")
    print("  n1 FK recreated")
except Exception as e:
    print(f"  n1 FK recreate: {e}")

# Verify
cur.execute("DESCRIBE EMPLOYE")
for r in cur.fetchall():
    if r[0] == 'matricule':
        print(f"\nRESULT — EMPLOYE.matricule: {r}")

conn.close()
print("\nMigration 054 complete.")
