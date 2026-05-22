"""
seed_prod.py — Initialise les données système ELITE CAPITAL pour la production.

Usage (depuis le container backend):
    python3 /app/seed_prod.py

Idempotent : peut être relancé sans risque, ne duplique rien.
"""
import sys
sys.path.insert(0, '/app')

from app.db import SessionLocal
import sqlalchemy as sa

db = SessionLocal()

def upsert(table, pk_col, rows):
    """Insert les lignes manquantes uniquement (par clé primaire)."""
    inserted = 0
    for row in rows:
        pk_val = row[pk_col]
        exists = db.execute(
            sa.text(f'SELECT 1 FROM `{table}` WHERE `{pk_col}` = :v'),
            {'v': pk_val}
        ).fetchone()
        if not exists:
            cols = ', '.join(f'`{k}`' for k in row)
            placeholders = ', '.join(f':{k}' for k in row)
            db.execute(sa.text(f'INSERT INTO `{table}` ({cols}) VALUES ({placeholders})'), row)
            inserted += 1
    db.commit()
    print(f'  {table}: {inserted} insérées ({len(rows) - inserted} déjà présentes)')

print('\n=== SEED DONNÉES SYSTÈME ELITE CAPITAL ===\n')

# ── PAYS ──────────────────────────────────────────────────────────────────────
upsert('PAYS', 'id_pays', [
    {'id_pays': 1, 'nom_pays': 'Cameroun',                  'code_pays': 'CM'},
    {'id_pays': 2, 'nom_pays': 'Gabon',                     'code_pays': 'GA'},
    {'id_pays': 3, 'nom_pays': 'Congo',                     'code_pays': 'CG'},
    {'id_pays': 4, 'nom_pays': 'Tchad',                     'code_pays': 'TD'},
    {'id_pays': 6, 'nom_pays': 'Guinée équatoriale',        'code_pays': 'GQ'},
    {'id_pays': 8, 'nom_pays': 'République centrafricaine', 'code_pays': 'CF'},
])

# ── ENTITE ────────────────────────────────────────────────────────────────────
upsert('ENTITE', 'id_entite', [
    {'id_entite': 1, 'nom': 'ELCAM'},
    {'id_entite': 2, 'nom': 'EXCA'},
    {'id_entite': 3, 'nom': 'ECG'},
])

# ── LOCALISATION ──────────────────────────────────────────────────────────────
upsert('LOCALISATION', 'id_localisation', [
    {'id_localisation': 1, 'ville': 'Yaoundé',    'id_pays': 1},
    {'id_localisation': 2, 'ville': 'Douala',     'id_pays': 1},
    {'id_localisation': 3, 'ville': 'Libreville', 'id_pays': 2},
    {'id_localisation': 4, 'ville': 'Brazzaville','id_pays': 3},
])

# ── DIRECTION ─────────────────────────────────────────────────────────────────
upsert('DIRECTION', 'id_direction', [
    {'id_direction':  1, 'nom': 'Direction de la Distribution',           'id_entite': 1, 'id_localisation': 1, 'id_directeur': None},
    {'id_direction':  2, 'nom': 'Conformité et Controle Interne',         'id_entite': 2, 'id_localisation': 1, 'id_directeur': None},
    {'id_direction':  3, 'nom': 'Developpement et Investissement',        'id_entite': 2, 'id_localisation': 1, 'id_directeur': None},
    {'id_direction':  4, 'nom': 'Conseils et Financements Structurés',    'id_entite': 2, 'id_localisation': 1, 'id_directeur': None},
    {'id_direction':  5, 'nom': 'Audit Interne et Inspection Générale',   'id_entite': 3, 'id_localisation': 1, 'id_directeur': None},
    {'id_direction':  6, 'nom': 'Direction Financière et Comptable',      'id_entite': 3, 'id_localisation': 1, 'id_directeur': None},
    {'id_direction':  7, 'nom': 'Organisation et Projets',                'id_entite': 3, 'id_localisation': 1, 'id_directeur': None},
    {'id_direction': 22, 'nom': 'Conformité et Controle Interne',         'id_entite': 1, 'id_localisation': 1, 'id_directeur': None},
])

# ── DEPARTEMENT ───────────────────────────────────────────────────────────────
upsert('DEPARTEMENT', 'dept_id', [
    {'dept_id':  1, 'nom': 'Distribution Grandes Entreprises, Institutions et Fortunes', 'id_entite': 1, 'id_direction':  1, 'id_responsable': None},
    {'dept_id':  2, 'nom': 'Distribution particuliers et PME',                           'id_entite': 1, 'id_direction':  1, 'id_responsable': None},
    {'dept_id':  3, 'nom': 'Gestion et Analyse de portefeuille',                         'id_entite': 1, 'id_direction': None, 'id_responsable': None},
    {'dept_id':  4, 'nom': 'Middle et Back Office',                                      'id_entite': 1, 'id_direction': None, 'id_responsable': None},
    {'dept_id':  8, 'nom': 'Pool Grandes Entreprises & Fortunes',                        'id_entite': 2, 'id_direction':  3, 'id_responsable': None},
    {'dept_id':  9, 'nom': 'Pool Particuliers & PME',                                    'id_entite': 2, 'id_direction':  3, 'id_responsable': None},
    {'dept_id': 10, 'nom': 'Financement & Structuration',                                'id_entite': 2, 'id_direction':  4, 'id_responsable': None},
    {'dept_id': 11, 'nom': 'Middle & Back Office',                                       'id_entite': 2, 'id_direction': None, 'id_responsable': None},
    {'dept_id': 12, 'nom': 'Trésorerie(ALM)',                                            'id_entite': 2, 'id_direction': None, 'id_responsable': None},
    {'dept_id': 16, 'nom': 'Inspection Generale',                                        'id_entite': 3, 'id_direction':  5, 'id_responsable': None},
    {'dept_id': 17, 'nom': 'Audit interne',                                              'id_entite': 3, 'id_direction':  5, 'id_responsable': None},
    {'dept_id': 18, 'nom': 'Comptabilité',                                               'id_entite': 3, 'id_direction':  6, 'id_responsable': None},
    {'dept_id': 19, 'nom': 'Trésorerie et Financement',                                  'id_entite': 3, 'id_direction':  6, 'id_responsable': None},
    {'dept_id': 20, 'nom': 'Controle de gestion',                                        'id_entite': 3, 'id_direction':  6, 'id_responsable': None},
    {'dept_id': 21, 'nom': 'Ressources Humaines',                                        'id_entite': 3, 'id_direction': None, 'id_responsable': None},
    {'dept_id': 22, 'nom': 'Affaires Juridiques & Fiscalité',                            'id_entite': 3, 'id_direction': None, 'id_responsable': None},
    {'dept_id': 23, 'nom': 'Communication Marketing et Relations Publiques',             'id_entite': 3, 'id_direction': None, 'id_responsable': None},
    {'dept_id': 24, 'nom': "Gestion des Projets et Systèmes d'Informations",             'id_entite': 3, 'id_direction':  7, 'id_responsable': None},
    {'dept_id': 25, 'nom': 'Marketing Digital et Opérationnel',                          'id_entite': 3, 'id_direction': None, 'id_responsable': None},
    {'dept_id': 26, 'nom': 'Moyens Généraux',                                            'id_entite': 3, 'id_direction': None, 'id_responsable': None},
    {'dept_id': 33, 'nom': 'Développement Commercial',                                   'id_entite': 1, 'id_direction': None, 'id_responsable': None},
    {'dept_id': 34, 'nom': 'Développement Commercial',                                   'id_entite': 2, 'id_direction': None, 'id_responsable': None},
    {'dept_id': 35, 'nom': 'Dévelopement commercial ELCAM',                              'id_entite': 1, 'id_direction': None, 'id_responsable': None},
    {'dept_id': 36, 'nom': 'Dévelopement commercial EXCA',                               'id_entite': 2, 'id_direction': None, 'id_responsable': None},
])

# ── IMPLANTATION ──────────────────────────────────────────────────────────────
# Table de jointure ENTITE <-> LOCALISATION (clé composite, pas d'auto-id)
implantations = [
    {'id_localisation': 1, 'id_entite': 1},
    {'id_localisation': 2, 'id_entite': 1},
    {'id_localisation': 3, 'id_entite': 1},
    {'id_localisation': 4, 'id_entite': 1},
    {'id_localisation': 1, 'id_entite': 2},
    {'id_localisation': 2, 'id_entite': 2},
    {'id_localisation': 3, 'id_entite': 2},
    {'id_localisation': 4, 'id_entite': 2},
    {'id_localisation': 1, 'id_entite': 3},
]
inserted = 0
for row in implantations:
    exists = db.execute(sa.text(
        'SELECT 1 FROM Implantation WHERE id_localisation=:l AND id_entite=:e'
    ), {'l': row['id_localisation'], 'e': row['id_entite']}).fetchone()
    if not exists:
        db.execute(sa.text(
            'INSERT INTO Implantation (id_localisation, id_entite) VALUES (:l, :e)'
        ), {'l': row['id_localisation'], 'e': row['id_entite']})
        inserted += 1
db.commit()
print(f'  Implantation: {inserted} insérées ({len(implantations) - inserted} déjà présentes)')

# ── FONCTION_REFERENCE ────────────────────────────────────────────────────────
upsert('FONCTION_REFERENCE', 'id_fonction', [
    {'id_fonction':   1, 'libelle': 'Administrateur Général',                                                      'id_direction': None, 'dept_id': None},
    {'id_fonction':   2, 'libelle': 'Directeur Audit Interne et Inspection Générale',                              'id_direction': None, 'dept_id': None},
    {'id_fonction':   3, 'libelle': 'Inspecteur Générale(IG)',                                                     'id_direction': None, 'dept_id': None},
    {'id_fonction':   4, 'libelle': 'Auditeur',                                                                    'id_direction':    5, 'dept_id':   17},
    {'id_fonction':   5, 'libelle': 'Représentants Résidents et responsables de la creation et relation d\'affaires','id_direction': None, 'dept_id': None},
    {'id_fonction':   6, 'libelle': 'Directeur financier et Comptable(DFC)',                                       'id_direction': None, 'dept_id': None},
    {'id_fonction':   7, 'libelle': 'comptable et responsable contrôle et consolidation',                          'id_direction':    6, 'dept_id':   18},
    {'id_fonction':   8, 'libelle': 'responsable Trésorerie et financement',                                       'id_direction': None, 'dept_id': None},
    {'id_fonction':   9, 'libelle': 'contrôleur de gestion',                                                       'id_direction': None, 'dept_id': None},
    {'id_fonction':  10, 'libelle': 'comptable',                                                                   'id_direction':    6, 'dept_id':   18},
    {'id_fonction':  11, 'libelle': 'Responsable des Ressources Humaines',                                         'id_direction': None, 'dept_id':   21},
    {'id_fonction':  12, 'libelle': 'chargé des resources humaines',                                               'id_direction': None, 'dept_id':   21},
    {'id_fonction':  13, 'libelle': 'responsable communication et relation publiques',                             'id_direction':    7, 'dept_id':   23},
    {'id_fonction':  14, 'libelle': 'chargé community management accueil et courrier',                             'id_direction': None, 'dept_id': None},
    {'id_fonction':  15, 'libelle': 'infographiste et déploiement',                                                'id_direction':    7, 'dept_id':   23},
    {'id_fonction':  16, 'libelle': 'Responsable affaires juridiques & fiscalité',                                 'id_direction': None, 'dept_id':   22},
    {'id_fonction':  17, 'libelle': 'chargé de la fiscalité',                                                      'id_direction': None, 'dept_id':   22},
    {'id_fonction':  18, 'libelle': 'Directeur des Organisations et projets',                                      'id_direction': None, 'dept_id': None},
    {'id_fonction':  19, 'libelle': "Responsable des systèmes d'information",                                      'id_direction':    7, 'dept_id':   24},
    {'id_fonction':  20, 'libelle': 'chargé des organisations et projets',                                         'id_direction':    7, 'dept_id':   24},
    {'id_fonction':  21, 'libelle': 'chargé marketing digital opérationnel',                                       'id_direction':    7, 'dept_id': None},
    {'id_fonction':  22, 'libelle': 'chargé des moyens généraux',                                                  'id_direction': None, 'dept_id':   26},
    {'id_fonction':  23, 'libelle': 'Administrateur Directeur Général',                                            'id_direction': None, 'dept_id': None},
    {'id_fonction':  24, 'libelle': 'Directeur Général Adjoint',                                                   'id_direction': None, 'dept_id': None},
    {'id_fonction':  25, 'libelle': 'Responsable conformité et contrôle interne',                                  'id_direction': None, 'dept_id': None},
    {'id_fonction':  26, 'libelle': 'Directeur Développement et investissement',                                   'id_direction': None, 'dept_id': None},
    {'id_fonction':  27, 'libelle': 'Responsable développement Pool Grande Entreprise & Fortunes',                 'id_direction': None, 'dept_id': None},
    {'id_fonction':  28, 'libelle': 'Chargé développement Pool Grande Entreprise & Fortunes',                      'id_direction': None, 'dept_id': None},
    {'id_fonction':  29, 'libelle': 'Responsable développement Pool Particuliers & PME',                           'id_direction': None, 'dept_id': None},
    {'id_fonction':  30, 'libelle': 'Chargé développement Pool Particuliers & PMEs',                               'id_direction': None, 'dept_id': None},
    {'id_fonction':  31, 'libelle': 'Responsable Middle & Back Office',                                            'id_direction': None, 'dept_id': None},
    {'id_fonction':  32, 'libelle': 'Responsable Trésorerie(ALM)',                                                 'id_direction': None, 'dept_id': None},
    {'id_fonction':  33, 'libelle': 'Chargé de négociation',                                                       'id_direction': None, 'dept_id': None},
    {'id_fonction':  34, 'libelle': 'Directeur Conseil et Financement structurés',                                 'id_direction': None, 'dept_id': None},
    {'id_fonction':  35, 'libelle': 'Responsable Financement et structuration',                                    'id_direction': None, 'dept_id': None},
    {'id_fonction':  36, 'libelle': 'Analyste Financement et structuration',                                       'id_direction': None, 'dept_id': None},
    {'id_fonction':  37, 'libelle': 'Responsable du Développement',                                                'id_direction': None, 'dept_id': None},
    {'id_fonction':  38, 'libelle': 'Chargé du développement portefeuille Grandes entreprise et Fortune',          'id_direction': None, 'dept_id': None},
    {'id_fonction':  39, 'libelle': 'Chargé du développement portefeuille particulier et PME',                     'id_direction': None, 'dept_id': None},
    {'id_fonction':  40, 'libelle': 'Directeur Conformité et Contrôle interne',                                    'id_direction': None, 'dept_id': None},
    {'id_fonction':  41, 'libelle': 'Directeur Distribution',                                                      'id_direction': None, 'dept_id': None},
    {'id_fonction':  42, 'libelle': 'Responsable Distribution Grandes Entreprises Institutions et Fortunes',       'id_direction': None, 'dept_id': None},
    {'id_fonction':  43, 'libelle': 'Responsable Distribution Particuliers et PME',                                'id_direction': None, 'dept_id': None},
    {'id_fonction':  44, 'libelle': 'Responsable Gestion et Analyste de portefeuille',                             'id_direction': None, 'dept_id': None},
    {'id_fonction':  45, 'libelle': 'chargé de Gestions de portefeuille',                                          'id_direction': None, 'dept_id': None},
    {'id_fonction':  46, 'libelle': 'chargé Analyste de portefeuille',                                             'id_direction': None, 'dept_id': None},
    {'id_fonction':  47, 'libelle': 'chargé Back Office & operations',                                             'id_direction': None, 'dept_id': None},
    {'id_fonction':  82, 'libelle': 'Stagiaire professionnel',                                                     'id_direction': None, 'dept_id': None},
    {'id_fonction':  83, 'libelle': 'Stagiaire académique',                                                        'id_direction': None, 'dept_id': None},
    {'id_fonction':  84, 'libelle': 'PCA',                                                                         'id_direction': None, 'dept_id': None},
    {'id_fonction':  85, 'libelle': 'Directeur Général',                                                           'id_direction': None, 'dept_id': None},
    {'id_fonction':  86, 'libelle': 'Directeur',                                                                   'id_direction': None, 'dept_id': None},
    {'id_fonction':  87, 'libelle': 'Responsable Département',                                                     'id_direction': None, 'dept_id': None},
    {'id_fonction':  88, 'libelle': 'DFC',                                                                         'id_direction': None, 'dept_id': None},
    {'id_fonction':  89, 'libelle': 'Employé',                                                                     'id_direction': None, 'dept_id': None},
    {'id_fonction':  90, 'libelle': 'RH',                                                                          'id_direction': None, 'dept_id': None},
    {'id_fonction':  99, 'libelle': 'Responsable Comptable  Contrôle et Consolidation',                            'id_direction':    6, 'dept_id': None},
    {'id_fonction': 100, 'libelle': 'Chargé Cloud et sécurité',                                                    'id_direction':    7, 'dept_id':   24},
    {'id_fonction': 101, 'libelle': 'Chargé Communication',                                                        'id_direction':    7, 'dept_id':   23},
    {'id_fonction': 102, 'libelle': 'Responsable Des Resources Humaines',                                          'id_direction': None, 'dept_id':   21},
    {'id_fonction': 104, 'libelle': 'Chargé Transformation Digitale, Innovation & Solutions Applicatives',         'id_direction':    7, 'dept_id':   24},
    {'id_fonction': 105, 'libelle': 'Chargé Administration Systèmes, Réseaux & Support IT',                        'id_direction':    7, 'dept_id':   24},
    {'id_fonction': 106, 'libelle': 'Assistante Administrateur Général',                                           'id_direction': None, 'dept_id': None},
])

# ── MIGRATIONS DÉJÀ APPLIQUÉES (évite de re-tenter sur un déploiement neuf) ──
# init_db.py crée le schéma complet ; on marque toutes les migrations comme
# déjà appliquées pour que auto_migrate.py ne les rejoue pas.
upsert('_migrations_appliquees', 'nom', [
    {'nom': '001_add_mission_segments.sql'},
    {'nom': '002_add_missionnaires_mission.sql'},
    {'nom': '003_add_transport_to_segments.sql'},
    {'nom': '004_add_heure_retour.sql'},
    {'nom': '005_add_relances_commentaires.sql'},
    {'nom': '006_add_paiement_frais_mission.sql'},
    {'nom': '007_add_localisation_to_org.sql'},
    {'nom': '008_org_structure_audit_report.sql'},
    {'nom': '009_fix_org_localisation_legacy.sql'},
    {'nom': '010_add_missing_operation_fields.sql'},
    {'nom': '011_add_fonction_reference.sql'},
    {'nom': '012_add_id_operation_to_sortie.sql'},
    {'nom': '012_remove_departement_localisation.sql'},
    {'nom': '013_add_localisation_to_departement.sql'},
    {'nom': '013_add_operation_to_sortie.sql'},
    {'nom': '014_add_tasks.sql'},
    {'nom': '015_add_team_space_posts.sql'},
    {'nom': '016_add_module_store_item.sql'},
    {'nom': '017_add_employee_localisation_and_emergency_contact.sql'},
    {'nom': '018_enforce_single_day_sorties.sql'},
    {'nom': '019_add_solde_deduit_to_operations.sql'},
    {'nom': '021_drop_departement_localisation.sql'},
    {'nom': '022_fix_activations_and_soldes.sql'},
    {'nom': '023_fix_rh_solde.sql'},
    {'nom': '024_fix_stuck_activations.sql'},
    {'nom': '025_add_employee_family_fields.sql'},
    {'nom': '026_add_push_subscriptions.sql'},
    {'nom': '027_add_mission_comment.sql'},
    {'nom': '028_add_preuve_permission_table.sql'},
    {'nom': '029_add_n1_fonction.sql'},
    {'nom': '030_add_demande_envoyee.sql'},
    {'nom': '030_add_evaluation_tables.sql'},
    {'nom': '031_add_fonction_liaisons.sql'},
    {'nom': '033_add_localisation_to_departement.sql'},
    {'nom': '034_drop_departement_localisation.sql'},
    {'nom': '035_add_departement_implantation.sql'},
    {'nom': '036_add_frais_missionnaire.sql'},
    {'nom': '037_add_task_assignees.sql'},
    {'nom': '038_add_commentaire_rh_remplacant.sql'},
    {'nom': '038_add_user_settings.sql'},
    {'nom': '039_add_parcours_employe.sql'},
    {'nom': '040_add_commentaire_remplacant.sql'},
    {'nom': '051_add_id_segment_to_frais_missionnaire.sql'},
    {'nom': '052_fix_direction_directeur_and_reroute_notifs.sql'},
    {'nom': '055_add_salaire_employe.sql'},
    {'nom': '056_add_notif_relance_and_email_pref.sql'},
    {'nom': '057_add_pointage.sql'},
    {'nom': '058_operation_vue.sql'},
    {'nom': '059_add_fiche_poste_template.sql'},
    {'nom': '060_add_html_content_fiche_poste.sql'},
    {'nom': '061_add_fiche_poste_to_employe.sql'},
    {'nom': '062_add_contrat_fields.sql'},
    {'nom': '062_evaluation_workflow.sql'},
    {'nom': '063_academy_tables.sql'},
    {'nom': '063_add_validator_signatures.sql'},
    {'nom': '064_add_derniere_connexion.sql'},
    {'nom': '065_seed_academy_formations.sql'},
    {'nom': '066_seed_business_modules.sql'},
    {'nom': '067_add_alerte_contrat_notification_type.sql'},
])

# ── ELITE ACADEMY ─────────────────────────────────────────────────────────────
_F = [
    # (id, titre, description, categorie, niveau, duree_h, est_onboarding)
    (1,  'Bienvenue chez Elite Capital Group',                 "Decouvrez la vision, les valeurs et l'organisation du groupe. Un parcours essentiel pour toute nouvelle recrue.",               'Onboarding',            'Débutant',      1.5, 1),
    (2,  "Prise en main de l'extranet EMS",                   'Navigation, raccourcis, profil utilisateur, notifications : maitrisez les bases de la plateforme.',                             'Onboarding',            'Débutant',      1.0, 1),
    (3,  'Gestion des conges et absences',                     'Demander, valider, suivre vos conges et absences. Comprendre les soldes et les regles RH.',                                    'Ressources Humaines',   'Débutant',      2.0, 0),
    (4,  'Permissions et sorties',                             'Procedures pour les permissions courtes, les sorties exceptionnelles et les preuves justificatives.',                           'Ressources Humaines',   'Débutant',      1.0, 0),
    (5,  'Pointage et presence',                               "Pointage quotidien, regles d'assiduite et suivi du temps de travail dans EMS.",                                                'Ressources Humaines',   'Débutant',      0.5, 0),
    (6,  'Gestion des missions',                               'Creer, planifier et suivre une mission : segments, transports, missionnaires multiples et destinations.',                       'Operations',            'Intermédiaire', 3.0, 0),
    (7,  'Notes de frais et remboursements',                   'Saisir, justifier et faire valider vos frais professionnels. Bonnes pratiques anti-rejet.',                                    'Finance',               'Débutant',      1.5, 0),
    (8,  'Operations terrain',                                 'Suivi operationnel, vue operation, sorties et coordination des equipes sur le terrain.',                                       'Operations',            'Intermédiaire', 2.5, 0),
    (9,  'Evaluations et entretiens annuels',                  'Le cycle complet des evaluations : auto-evaluation, entretien, validation N+1 et plan de developpement.',                     'Performance',           'Intermédiaire', 2.5, 0),
    (10, 'Performance reviews et objectifs',                   'Fixer des objectifs SMART, suivre les KPIs et conduire un entretien de performance constructif.',                              'Performance',           'Avancé',        3.0, 0),
    (11, 'Procedures disciplinaires',                          'Cadre legal et procedures internes : avertissement, mise a pied, sanctions et recours.',                                       'Ressources Humaines',   'Avancé',        2.5, 0),
    (12, 'Score comportemental',                               "Comprendre le score comportemental, ses criteres et son impact sur le parcours de l'employe.",                                 'Ressources Humaines',   'Intermédiaire', 1.5, 0),
    (13, "Demandes d'explication",                             "Rediger, repondre et traiter une demande d'explication selon les standards du groupe.",                                         'Ressources Humaines',   'Intermédiaire', 1.0, 0),
    (14, 'Fiche de poste : redaction et mise a jour',          'Construire une fiche de poste complete : missions, responsabilites, competences et liaisons hierarchiques.',                   'Organisation',          'Intermédiaire', 2.0, 0),
    (15, 'Organisation et organigramme',                       "Lire et maintenir l'organigramme du groupe : directions, departements, fonctions et liaisons.",                                'Organisation',          'Débutant',      1.5, 0),
    (16, 'Workflow et gestion des taches',                     'Creer, assigner et suivre les taches via le module Workflow. Statuts, filtres et bonnes pratiques.',                           'Productivite',          'Débutant',      1.5, 0),
    (17, 'Talent management',                                  'Identifier les talents, construire les plans de succession et piloter le developpement des hauts potentiels.',                 'Strategie RH',          'Avancé',        3.0, 0),
    (18, 'Workforce planning',                                 'Planification des effectifs, anticipation des besoins et optimisation de la masse salariale.',                                 'Strategie RH',          'Avancé',        3.0, 0),
    (19, 'Gestion des remplacants',                            'Designer, accompagner et suivre les remplacants temporaires ou definitifs.',                                                   'Ressources Humaines',   'Intermédiaire', 1.5, 0),
    (20, 'Analytics et tableaux de bord',                      'Exploiter les dashboards EMS : indicateurs cles, exports et lecture des tendances.',                                           'Data & Analytics',      'Intermédiaire', 2.0, 0),
    (21, 'Assistant IA et productivite',                       "Tirer parti de l'assistant IA integre a EMS pour gagner en efficacite au quotidien.",                                          'Productivite',          'Débutant',      1.0, 0),
    (22, 'Securite, confidentialite et bonnes pratiques',      'Charte informatique, gestion des acces, protection des donnees et reflexes anti-phishing.',                                    'Conformite',            'Débutant',      1.5, 0),
    (23, 'Administration et parametrage EMS',                  'Pour les administrateurs : gestion des utilisateurs, roles, modules et parametres systeme.',                                   'Administration',        'Avancé',        3.5, 0),
    (24, 'Documentation et base de connaissances',             'Trouver et contribuer a la documentation interne : standards, procedures et guides metier.',                                   'Productivite',          'Débutant',      0.5, 0),
    (25, 'Achats : fondamentaux',                              "Cycle achats, sourcing, demande d'achat, bon de commande et reception. Bonnes pratiques de base.",                             'Achats',                'Débutant',      2.0, 0),
    (26, 'Achats : negociation et performance',                'Strategies de negociation fournisseurs, suivi des KPIs achats et optimisation des couts.',                                     'Achats',                'Avancé',        3.0, 0),
    (27, 'Commercial : techniques de vente',                   'Prospection, qualification, decouverte des besoins, argumentation et closing.',                                                'Commercial',            'Débutant',      2.5, 0),
    (28, 'Commercial : pilotage du pipeline',                  'Forecast, taux de transformation, management des opportunites et reporting commercial.',                                       'Commercial',            'Avancé',        2.5, 0),
    (29, 'Marketing : strategie et positionnement',            'Etude de marche, segmentation, ciblage, positionnement et mix marketing 4P.',                                                  'Marketing',             'Débutant',      2.0, 0),
    (30, 'Marketing digital et content',                       'SEO, SEA, social media, email marketing et content strategy.',                                                                 'Marketing',             'Intermédiaire', 3.0, 0),
    (31, 'Communication interne et externe',                   'Plan de communication, relations presse, communication de crise et messages cles.',                                            'Communication',         'Débutant',      1.5, 0),
    (32, 'Communication : prise de parole et media training',  'Maitriser sa posture, structurer son message, repondre aux medias et au public.',                                              'Communication',         'Avancé',        2.0, 0),
    (33, 'SI : architecture et urbanisation',                  'Cartographie applicative, urbanisation, integration, API et flux de donnees.',                                                 "Système d'Information", 'Intermédiaire', 2.5, 0),
    (34, 'SI : cybersecurite et gouvernance des donnees',      'ISO 27001, RGPD, gestion des incidents, sauvegardes et plan de continuite.',                                                   "Système d'Information", 'Avancé',        3.0, 0),
    (35, 'Flotte : gestion operationnelle',                    'Suivi des vehicules, carburant, entretien, sinistres et conformite reglementaire.',                                            'Flotte',                'Débutant',      1.5, 0),
    (36, 'Flotte : optimisation TCO et eco-conduite',          "TCO, telematique, eco-conduite et reduction de l'empreinte carbone du parc.",                                                  'Flotte',                'Avancé',        2.0, 0),
    (37, 'Audit interne : fondamentaux',                       'Cadre de reference IIA, methodologie, conduite de mission et redaction du rapport.',                                           'Audit',                 'Intermédiaire', 2.5, 0),
    (38, 'Audit : controle interne et gestion des risques',    "Cartographie des risques, dispositif de controle interne et plan d'action correctif.",                                         'Audit',                 'Avancé',        3.0, 0),
    (39, 'Gestion de projet : les essentiels',                 'Cadrage, planification, suivi, gestion des risques et cloture de projet.',                                                     'Projets',               'Débutant',      2.0, 0),
    (40, 'Methodes agiles : Scrum et Kanban',                  'Roles, ceremonies, artefacts Scrum et tableau Kanban applique au quotidien.',                                                  'Projets',               'Intermédiaire', 2.5, 0),
    (41, 'CRM : fondamentaux et parcours client',              "Capter, qualifier et fideliser : cycle de vie client et exploitation d'un CRM.",                                               'CRM',                   'Débutant',      1.5, 0),
    (42, 'CRM : segmentation, scoring et automation',          "Segmentation comportementale, scoring, workflows d'automation et personnalisation.",                                           'CRM',                   'Avancé',        2.5, 0),
]

upsert('formations', 'id', [
    {'id': fid, 'titre': titre, 'description': desc, 'categorie': cat,
     'niveau': niv, 'image_url': None, 'duree_estimee_h': duree,
     'est_onboarding': onb, 'est_publie': 1, 'cree_par': '9999'}
    for fid, titre, desc, cat, niv, duree, onb in _F
])

# ── MODULES FORMATION (2 par formation : Introduction ordre=0, Validation ordre=99) ──
# IDs intro : fid <= 24 → id=fid ; fid > 24 → id=fid+7
# IDs validation : fid+62 pour toutes les formations
def _mid(fid): return fid if fid <= 24 else fid + 7

_modules = []
for fid, *_ in _F:
    _modules.append({'id': _mid(fid), 'formation_id': fid,
                     'titre': 'Introduction', 'description': 'Premiere prise de contact avec le sujet.', 'ordre': 0})
    _modules.append({'id': fid + 62,  'formation_id': fid,
                     'titre': 'Validation',    'description': 'Quiz de validation des acquis.', 'ordre': 99})
upsert('modules_formation', 'id', _modules)

# ── LECONS (1 par module) ──────────────────────────────────────────────────────
_FOOT1 = ("Le contenu detaille de cette formation sera enrichi "
          "prochainement par l'equipe Elite Academy.")
_FOOT2 = ("Cette formation vous permet de monter en competence sur le sujet. "
          "Suivez les modules et validez le quiz pour obtenir votre certificat.")

_lecons = []
for fid, titre, desc, *_ in _F:
    footer = _FOOT1 if fid <= 24 else _FOOT2
    mid, vid = _mid(fid), fid + 62
    contenu = f'<h2>{titre}</h2><p>{desc}</p><p>{footer}</p>'
    _lecons.append({'id': mid, 'module_id': mid, 'titre': "Vue d'ensemble",
                    'type': 'texte', 'contenu': contenu, 'ordre': 0, 'duree_min': 15})
    _lecons.append({'id': vid, 'module_id': vid, 'titre': 'Quiz final',
                    'type': 'quiz',  'contenu': None,    'ordre': 0, 'duree_min': 10})
upsert('lecons', 'id', _lecons)

# -- NETTOYAGE : un seul employe (9999) et un seul utilisateur (9999) ----------
print('\n-- Nettoyage employes/utilisateurs de test --')

_tables_employe = [
    'Notification', 'SESSION_UTILISATION', 'score_comportemental',
    'Conges', 'Permission', 'PREUVE_PERMISSION', 'SORTIE', 'Frais',
    'MissionnairesMission', 'CommentaireMission', 'OPERATION_VUE',
    'Validation', 'Activation', 'Evaluation', 'reviews_360',
    'TASK', 'TASK_ASSIGNEE', 'TEAM_SPACE_POST', 'team_space_comment',
    'team_space_post_like', 'inscriptions_formation', 'progression_lecons',
    'certificats_formation', 'PARCOURS_EMPLOYE', 'Remplacant_propose',
    'demande_explication', 'lettres_rh', 'document_interne',
    'workforce_positions', 'USER_SETTINGS',
]
for t in _tables_employe:
    try:
        db.execute(sa.text(f"DELETE FROM `{t}` WHERE matricule != '9999'"))
        db.commit()
    except Exception:
        db.rollback()

try:
    db.execute(sa.text("DELETE FROM `MissionSegment` WHERE id_mission IN (SELECT id_mission FROM Mission WHERE demandeur != '9999')"))
    db.execute(sa.text("DELETE FROM `Mission` WHERE demandeur != '9999'"))
    db.commit()
except Exception:
    db.rollback()

try:
    db.execute(sa.text("DELETE FROM `OPERATIONS` WHERE matricule != '9999'"))
    db.commit()
except Exception:
    db.rollback()

try:
    db.execute(sa.text("DELETE FROM `audit_logs` WHERE user_id NOT IN (SELECT id_user FROM UTILISATEUR WHERE matricule='9999')"))
    db.commit()
except Exception:
    db.rollback()

non_admin = db.execute(sa.text("SELECT COUNT(*) FROM UTILISATEUR WHERE matricule != '9999'")).scalar()
db.execute(sa.text("DELETE FROM UTILISATEUR WHERE matricule != '9999'"))
db.commit()
print(f'  UTILISATEUR: {non_admin} supprime(s), admin 9999 conserve')

non_employe = db.execute(sa.text("SELECT COUNT(*) FROM EMPLOYE WHERE matricule != '9999'")).scalar()
db.execute(sa.text("DELETE FROM EMPLOYE WHERE matricule != '9999'"))
db.commit()
print(f'  EMPLOYE: {non_employe} supprime(s), admin 9999 conserve')

db.close()

print('\n✓ Seed système terminé.')
print('\nEtape suivante : exécuter init_db.py pour créer les rôles et le compte admin.')
