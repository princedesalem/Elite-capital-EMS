-- Migration 075: seed fonctions et departements (idempotent)
-- Generated from dev database. Safe to run multiple times.

-- ============================================================
-- DEPARTEMENTS: INSERT IGNORE par (nom, entite)
-- ============================================================
INSERT IGNORE INTO DEPARTEMENT (nom, id_entite, id_direction)
SELECT 'Distribution Grandes Entreprises, Institutions et Fortunes',
       (SELECT id_entite FROM ENTITE WHERE nom='ELCAM' LIMIT 1),
       (SELECT id_direction FROM DIRECTION WHERE nom='Direction de la Distribution' LIMIT 1)
FROM DUAL WHERE NOT EXISTS (
    SELECT 1 FROM DEPARTEMENT dp2
    JOIN ENTITE e2 ON e2.id_entite=dp2.id_entite
    WHERE dp2.nom='Distribution Grandes Entreprises, Institutions et Fortunes' AND e2.nom='ELCAM'
);
INSERT IGNORE INTO DEPARTEMENT (nom, id_entite, id_direction)
SELECT 'Distribution particuliers et PME',
       (SELECT id_entite FROM ENTITE WHERE nom='ELCAM' LIMIT 1),
       (SELECT id_direction FROM DIRECTION WHERE nom='Direction de la Distribution' LIMIT 1)
FROM DUAL WHERE NOT EXISTS (
    SELECT 1 FROM DEPARTEMENT dp2
    JOIN ENTITE e2 ON e2.id_entite=dp2.id_entite
    WHERE dp2.nom='Distribution particuliers et PME' AND e2.nom='ELCAM'
);
INSERT IGNORE INTO DEPARTEMENT (nom, id_entite, id_direction)
SELECT 'Gestion et Analyse de portefeuille',
       (SELECT id_entite FROM ENTITE WHERE nom='ELCAM' LIMIT 1),
       NULL
FROM DUAL WHERE NOT EXISTS (
    SELECT 1 FROM DEPARTEMENT dp2
    JOIN ENTITE e2 ON e2.id_entite=dp2.id_entite
    WHERE dp2.nom='Gestion et Analyse de portefeuille' AND e2.nom='ELCAM'
);
INSERT IGNORE INTO DEPARTEMENT (nom, id_entite, id_direction)
SELECT 'Middle et Back Office',
       (SELECT id_entite FROM ENTITE WHERE nom='ELCAM' LIMIT 1),
       NULL
FROM DUAL WHERE NOT EXISTS (
    SELECT 1 FROM DEPARTEMENT dp2
    JOIN ENTITE e2 ON e2.id_entite=dp2.id_entite
    WHERE dp2.nom='Middle et Back Office' AND e2.nom='ELCAM'
);
INSERT IGNORE INTO DEPARTEMENT (nom, id_entite, id_direction)
SELECT 'Pool Grandes Entreprises & Fortunes',
       (SELECT id_entite FROM ENTITE WHERE nom='EXCA' LIMIT 1),
       (SELECT id_direction FROM DIRECTION WHERE nom='Developpement et Investissement' LIMIT 1)
FROM DUAL WHERE NOT EXISTS (
    SELECT 1 FROM DEPARTEMENT dp2
    JOIN ENTITE e2 ON e2.id_entite=dp2.id_entite
    WHERE dp2.nom='Pool Grandes Entreprises & Fortunes' AND e2.nom='EXCA'
);
INSERT IGNORE INTO DEPARTEMENT (nom, id_entite, id_direction)
SELECT 'Pool Particuliers & PME',
       (SELECT id_entite FROM ENTITE WHERE nom='EXCA' LIMIT 1),
       (SELECT id_direction FROM DIRECTION WHERE nom='Developpement et Investissement' LIMIT 1)
FROM DUAL WHERE NOT EXISTS (
    SELECT 1 FROM DEPARTEMENT dp2
    JOIN ENTITE e2 ON e2.id_entite=dp2.id_entite
    WHERE dp2.nom='Pool Particuliers & PME' AND e2.nom='EXCA'
);
INSERT IGNORE INTO DEPARTEMENT (nom, id_entite, id_direction)
SELECT 'Financement & Structuration',
       (SELECT id_entite FROM ENTITE WHERE nom='EXCA' LIMIT 1),
       (SELECT id_direction FROM DIRECTION WHERE nom='Conseils et Financements Structurés' LIMIT 1)
FROM DUAL WHERE NOT EXISTS (
    SELECT 1 FROM DEPARTEMENT dp2
    JOIN ENTITE e2 ON e2.id_entite=dp2.id_entite
    WHERE dp2.nom='Financement & Structuration' AND e2.nom='EXCA'
);
INSERT IGNORE INTO DEPARTEMENT (nom, id_entite, id_direction)
SELECT 'Middle & Back Office',
       (SELECT id_entite FROM ENTITE WHERE nom='EXCA' LIMIT 1),
       NULL
FROM DUAL WHERE NOT EXISTS (
    SELECT 1 FROM DEPARTEMENT dp2
    JOIN ENTITE e2 ON e2.id_entite=dp2.id_entite
    WHERE dp2.nom='Middle & Back Office' AND e2.nom='EXCA'
);
INSERT IGNORE INTO DEPARTEMENT (nom, id_entite, id_direction)
SELECT 'Trésorerie(ALM)',
       (SELECT id_entite FROM ENTITE WHERE nom='EXCA' LIMIT 1),
       NULL
FROM DUAL WHERE NOT EXISTS (
    SELECT 1 FROM DEPARTEMENT dp2
    JOIN ENTITE e2 ON e2.id_entite=dp2.id_entite
    WHERE dp2.nom='Trésorerie(ALM)' AND e2.nom='EXCA'
);
INSERT IGNORE INTO DEPARTEMENT (nom, id_entite, id_direction)
SELECT 'Inspection Generale',
       (SELECT id_entite FROM ENTITE WHERE nom='ECG' LIMIT 1),
       (SELECT id_direction FROM DIRECTION WHERE nom='Audit Interne et Inspection Générale' LIMIT 1)
FROM DUAL WHERE NOT EXISTS (
    SELECT 1 FROM DEPARTEMENT dp2
    JOIN ENTITE e2 ON e2.id_entite=dp2.id_entite
    WHERE dp2.nom='Inspection Generale' AND e2.nom='ECG'
);
INSERT IGNORE INTO DEPARTEMENT (nom, id_entite, id_direction)
SELECT 'Audit interne',
       (SELECT id_entite FROM ENTITE WHERE nom='ECG' LIMIT 1),
       (SELECT id_direction FROM DIRECTION WHERE nom='Audit Interne et Inspection Générale' LIMIT 1)
FROM DUAL WHERE NOT EXISTS (
    SELECT 1 FROM DEPARTEMENT dp2
    JOIN ENTITE e2 ON e2.id_entite=dp2.id_entite
    WHERE dp2.nom='Audit interne' AND e2.nom='ECG'
);
INSERT IGNORE INTO DEPARTEMENT (nom, id_entite, id_direction)
SELECT 'Comptabilité',
       (SELECT id_entite FROM ENTITE WHERE nom='ECG' LIMIT 1),
       (SELECT id_direction FROM DIRECTION WHERE nom='Direction Financière et Comptable' LIMIT 1)
FROM DUAL WHERE NOT EXISTS (
    SELECT 1 FROM DEPARTEMENT dp2
    JOIN ENTITE e2 ON e2.id_entite=dp2.id_entite
    WHERE dp2.nom='Comptabilité' AND e2.nom='ECG'
);
INSERT IGNORE INTO DEPARTEMENT (nom, id_entite, id_direction)
SELECT 'Trésorerie et Financement',
       (SELECT id_entite FROM ENTITE WHERE nom='ECG' LIMIT 1),
       (SELECT id_direction FROM DIRECTION WHERE nom='Direction Financière et Comptable' LIMIT 1)
FROM DUAL WHERE NOT EXISTS (
    SELECT 1 FROM DEPARTEMENT dp2
    JOIN ENTITE e2 ON e2.id_entite=dp2.id_entite
    WHERE dp2.nom='Trésorerie et Financement' AND e2.nom='ECG'
);
INSERT IGNORE INTO DEPARTEMENT (nom, id_entite, id_direction)
SELECT 'Controle de gestion',
       (SELECT id_entite FROM ENTITE WHERE nom='ECG' LIMIT 1),
       (SELECT id_direction FROM DIRECTION WHERE nom='Direction Financière et Comptable' LIMIT 1)
FROM DUAL WHERE NOT EXISTS (
    SELECT 1 FROM DEPARTEMENT dp2
    JOIN ENTITE e2 ON e2.id_entite=dp2.id_entite
    WHERE dp2.nom='Controle de gestion' AND e2.nom='ECG'
);
INSERT IGNORE INTO DEPARTEMENT (nom, id_entite, id_direction)
SELECT 'Ressources Humaines',
       (SELECT id_entite FROM ENTITE WHERE nom='ECG' LIMIT 1),
       NULL
FROM DUAL WHERE NOT EXISTS (
    SELECT 1 FROM DEPARTEMENT dp2
    JOIN ENTITE e2 ON e2.id_entite=dp2.id_entite
    WHERE dp2.nom='Ressources Humaines' AND e2.nom='ECG'
);
INSERT IGNORE INTO DEPARTEMENT (nom, id_entite, id_direction)
SELECT 'Affaires Juridiques & Fiscalité',
       (SELECT id_entite FROM ENTITE WHERE nom='ECG' LIMIT 1),
       NULL
FROM DUAL WHERE NOT EXISTS (
    SELECT 1 FROM DEPARTEMENT dp2
    JOIN ENTITE e2 ON e2.id_entite=dp2.id_entite
    WHERE dp2.nom='Affaires Juridiques & Fiscalité' AND e2.nom='ECG'
);
INSERT IGNORE INTO DEPARTEMENT (nom, id_entite, id_direction)
SELECT 'Communication Marketing et Relations Publiques',
       (SELECT id_entite FROM ENTITE WHERE nom='ECG' LIMIT 1),
       NULL
FROM DUAL WHERE NOT EXISTS (
    SELECT 1 FROM DEPARTEMENT dp2
    JOIN ENTITE e2 ON e2.id_entite=dp2.id_entite
    WHERE dp2.nom='Communication Marketing et Relations Publiques' AND e2.nom='ECG'
);
INSERT IGNORE INTO DEPARTEMENT (nom, id_entite, id_direction)
SELECT 'Gestion des Projets et Systèmes d''Informations',
       (SELECT id_entite FROM ENTITE WHERE nom='ECG' LIMIT 1),
       (SELECT id_direction FROM DIRECTION WHERE nom='Organisation et Projets' LIMIT 1)
FROM DUAL WHERE NOT EXISTS (
    SELECT 1 FROM DEPARTEMENT dp2
    JOIN ENTITE e2 ON e2.id_entite=dp2.id_entite
    WHERE dp2.nom='Gestion des Projets et Systèmes d''Informations' AND e2.nom='ECG'
);
INSERT IGNORE INTO DEPARTEMENT (nom, id_entite, id_direction)
SELECT 'Marketing Digital et Opérationnel',
       (SELECT id_entite FROM ENTITE WHERE nom='ECG' LIMIT 1),
       NULL
FROM DUAL WHERE NOT EXISTS (
    SELECT 1 FROM DEPARTEMENT dp2
    JOIN ENTITE e2 ON e2.id_entite=dp2.id_entite
    WHERE dp2.nom='Marketing Digital et Opérationnel' AND e2.nom='ECG'
);
INSERT IGNORE INTO DEPARTEMENT (nom, id_entite, id_direction)
SELECT 'Moyens Généraux',
       (SELECT id_entite FROM ENTITE WHERE nom='ECG' LIMIT 1),
       NULL
FROM DUAL WHERE NOT EXISTS (
    SELECT 1 FROM DEPARTEMENT dp2
    JOIN ENTITE e2 ON e2.id_entite=dp2.id_entite
    WHERE dp2.nom='Moyens Généraux' AND e2.nom='ECG'
);
INSERT IGNORE INTO DEPARTEMENT (nom, id_entite, id_direction)
SELECT 'Développement Commercial',
       (SELECT id_entite FROM ENTITE WHERE nom='ELCAM' LIMIT 1),
       NULL
FROM DUAL WHERE NOT EXISTS (
    SELECT 1 FROM DEPARTEMENT dp2
    JOIN ENTITE e2 ON e2.id_entite=dp2.id_entite
    WHERE dp2.nom='Développement Commercial' AND e2.nom='ELCAM'
);
INSERT IGNORE INTO DEPARTEMENT (nom, id_entite, id_direction)
SELECT 'Développement Commercial',
       (SELECT id_entite FROM ENTITE WHERE nom='EXCA' LIMIT 1),
       NULL
FROM DUAL WHERE NOT EXISTS (
    SELECT 1 FROM DEPARTEMENT dp2
    JOIN ENTITE e2 ON e2.id_entite=dp2.id_entite
    WHERE dp2.nom='Développement Commercial' AND e2.nom='EXCA'
);
INSERT IGNORE INTO DEPARTEMENT (nom, id_entite, id_direction)
SELECT 'Dévelopement commercial ELCAM',
       (SELECT id_entite FROM ENTITE WHERE nom='ELCAM' LIMIT 1),
       NULL
FROM DUAL WHERE NOT EXISTS (
    SELECT 1 FROM DEPARTEMENT dp2
    JOIN ENTITE e2 ON e2.id_entite=dp2.id_entite
    WHERE dp2.nom='Dévelopement commercial ELCAM' AND e2.nom='ELCAM'
);
INSERT IGNORE INTO DEPARTEMENT (nom, id_entite, id_direction)
SELECT 'Dévelopement commercial EXCA',
       (SELECT id_entite FROM ENTITE WHERE nom='EXCA' LIMIT 1),
       NULL
FROM DUAL WHERE NOT EXISTS (
    SELECT 1 FROM DEPARTEMENT dp2
    JOIN ENTITE e2 ON e2.id_entite=dp2.id_entite
    WHERE dp2.nom='Dévelopement commercial EXCA' AND e2.nom='EXCA'
);
INSERT IGNORE INTO DEPARTEMENT (nom, id_entite, id_direction)
SELECT 'Contrôle Interne',
       (SELECT id_entite FROM ENTITE WHERE nom='EXCA' LIMIT 1),
       (SELECT id_direction FROM DIRECTION WHERE nom='Conformité et Controle Interne' LIMIT 1)
FROM DUAL WHERE NOT EXISTS (
    SELECT 1 FROM DEPARTEMENT dp2
    JOIN ENTITE e2 ON e2.id_entite=dp2.id_entite
    WHERE dp2.nom='Contrôle Interne' AND e2.nom='EXCA'
);
INSERT IGNORE INTO DEPARTEMENT (nom, id_entite, id_direction)
SELECT 'Contrôle Interne',
       (SELECT id_entite FROM ENTITE WHERE nom='ELCAM' LIMIT 1),
       (SELECT id_direction FROM DIRECTION WHERE nom='Conformité et Controle Interne' LIMIT 1)
FROM DUAL WHERE NOT EXISTS (
    SELECT 1 FROM DEPARTEMENT dp2
    JOIN ENTITE e2 ON e2.id_entite=dp2.id_entite
    WHERE dp2.nom='Contrôle Interne' AND e2.nom='ELCAM'
);

-- ============================================================
-- FONCTIONS: INSERT IGNORE par (libelle, direction, departement)
-- ============================================================
INSERT IGNORE INTO FONCTION_REFERENCE (libelle, id_direction, dept_id)
SELECT 'Administrateur Général', NULL, NULL
FROM DUAL WHERE NOT EXISTS (
    SELECT 1 FROM FONCTION_REFERENCE f2
    WHERE f2.libelle='Administrateur Général' AND f2.id_direction IS NULL AND f2.dept_id IS NULL
);
INSERT IGNORE INTO FONCTION_REFERENCE (libelle, id_direction, dept_id)
SELECT 'Directeur Audit Interne et Inspection Générale', (SELECT id_direction FROM DIRECTION WHERE nom='Audit Interne et Inspection Générale' LIMIT 1), NULL
FROM DUAL WHERE NOT EXISTS (
    SELECT 1 FROM FONCTION_REFERENCE f2
    WHERE f2.libelle='Directeur Audit Interne et Inspection Générale' AND f2.id_direction=(SELECT id_direction FROM DIRECTION WHERE nom='Audit Interne et Inspection Générale' LIMIT 1) AND f2.dept_id IS NULL
);
INSERT IGNORE INTO FONCTION_REFERENCE (libelle, id_direction, dept_id)
SELECT 'Inspecteur Général(IG)', (SELECT id_direction FROM DIRECTION WHERE nom='Audit Interne et Inspection Générale' LIMIT 1), (SELECT dp2.dept_id FROM DEPARTEMENT dp2 JOIN ENTITE e2 ON e2.id_entite=dp2.id_entite WHERE dp2.nom='Inspection Generale' AND e2.nom='ECG' LIMIT 1)
FROM DUAL WHERE NOT EXISTS (
    SELECT 1 FROM FONCTION_REFERENCE f2
    WHERE f2.libelle='Inspecteur Général(IG)' AND f2.id_direction=(SELECT id_direction FROM DIRECTION WHERE nom='Audit Interne et Inspection Générale' LIMIT 1) AND f2.dept_id=(SELECT dp3.dept_id FROM DEPARTEMENT dp3 JOIN ENTITE e3 ON e3.id_entite=dp3.id_entite WHERE dp3.nom='Inspection Generale' AND e3.nom='ECG' LIMIT 1)
);
INSERT IGNORE INTO FONCTION_REFERENCE (libelle, id_direction, dept_id)
SELECT 'Auditeur Interne', (SELECT id_direction FROM DIRECTION WHERE nom='Audit Interne et Inspection Générale' LIMIT 1), (SELECT dp2.dept_id FROM DEPARTEMENT dp2 JOIN ENTITE e2 ON e2.id_entite=dp2.id_entite WHERE dp2.nom='Audit interne' AND e2.nom='ECG' LIMIT 1)
FROM DUAL WHERE NOT EXISTS (
    SELECT 1 FROM FONCTION_REFERENCE f2
    WHERE f2.libelle='Auditeur Interne' AND f2.id_direction=(SELECT id_direction FROM DIRECTION WHERE nom='Audit Interne et Inspection Générale' LIMIT 1) AND f2.dept_id=(SELECT dp3.dept_id FROM DEPARTEMENT dp3 JOIN ENTITE e3 ON e3.id_entite=dp3.id_entite WHERE dp3.nom='Audit interne' AND e3.nom='ECG' LIMIT 1)
);
INSERT IGNORE INTO FONCTION_REFERENCE (libelle, id_direction, dept_id)
SELECT 'Représentants Résidents et responsables de la création et relations d''affaires', NULL, NULL
FROM DUAL WHERE NOT EXISTS (
    SELECT 1 FROM FONCTION_REFERENCE f2
    WHERE f2.libelle='Représentants Résidents et responsables de la création et relations d''affaires' AND f2.id_direction IS NULL AND f2.dept_id IS NULL
);
INSERT IGNORE INTO FONCTION_REFERENCE (libelle, id_direction, dept_id)
SELECT 'Chargé Trésorerie et financement', NULL, NULL
FROM DUAL WHERE NOT EXISTS (
    SELECT 1 FROM FONCTION_REFERENCE f2
    WHERE f2.libelle='Chargé Trésorerie et financement' AND f2.id_direction IS NULL AND f2.dept_id IS NULL
);
INSERT IGNORE INTO FONCTION_REFERENCE (libelle, id_direction, dept_id)
SELECT 'Responsable Ressources Humaines', NULL, (SELECT dp2.dept_id FROM DEPARTEMENT dp2 JOIN ENTITE e2 ON e2.id_entite=dp2.id_entite WHERE dp2.nom='Ressources Humaines' AND e2.nom='ECG' LIMIT 1)
FROM DUAL WHERE NOT EXISTS (
    SELECT 1 FROM FONCTION_REFERENCE f2
    WHERE f2.libelle='Responsable Ressources Humaines' AND f2.id_direction IS NULL AND f2.dept_id=(SELECT dp3.dept_id FROM DEPARTEMENT dp3 JOIN ENTITE e3 ON e3.id_entite=dp3.id_entite WHERE dp3.nom='Ressources Humaines' AND e3.nom='ECG' LIMIT 1)
);
INSERT IGNORE INTO FONCTION_REFERENCE (libelle, id_direction, dept_id)
SELECT 'Chargé des Ressources Humaines', NULL, (SELECT dp2.dept_id FROM DEPARTEMENT dp2 JOIN ENTITE e2 ON e2.id_entite=dp2.id_entite WHERE dp2.nom='Ressources Humaines' AND e2.nom='ECG' LIMIT 1)
FROM DUAL WHERE NOT EXISTS (
    SELECT 1 FROM FONCTION_REFERENCE f2
    WHERE f2.libelle='Chargé des Ressources Humaines' AND f2.id_direction IS NULL AND f2.dept_id=(SELECT dp3.dept_id FROM DEPARTEMENT dp3 JOIN ENTITE e3 ON e3.id_entite=dp3.id_entite WHERE dp3.nom='Ressources Humaines' AND e3.nom='ECG' LIMIT 1)
);
INSERT IGNORE INTO FONCTION_REFERENCE (libelle, id_direction, dept_id)
SELECT 'Responsable Communication et Relations Publiques', (SELECT id_direction FROM DIRECTION WHERE nom='Organisation et Projets' LIMIT 1), (SELECT dp2.dept_id FROM DEPARTEMENT dp2 JOIN ENTITE e2 ON e2.id_entite=dp2.id_entite WHERE dp2.nom='Communication Marketing et Relations Publiques' AND e2.nom='ECG' LIMIT 1)
FROM DUAL WHERE NOT EXISTS (
    SELECT 1 FROM FONCTION_REFERENCE f2
    WHERE f2.libelle='Responsable Communication et Relations Publiques' AND f2.id_direction=(SELECT id_direction FROM DIRECTION WHERE nom='Organisation et Projets' LIMIT 1) AND f2.dept_id=(SELECT dp3.dept_id FROM DEPARTEMENT dp3 JOIN ENTITE e3 ON e3.id_entite=dp3.id_entite WHERE dp3.nom='Communication Marketing et Relations Publiques' AND e3.nom='ECG' LIMIT 1)
);
INSERT IGNORE INTO FONCTION_REFERENCE (libelle, id_direction, dept_id)
SELECT 'chargé community management accueil et courrier', NULL, NULL
FROM DUAL WHERE NOT EXISTS (
    SELECT 1 FROM FONCTION_REFERENCE f2
    WHERE f2.libelle='chargé community management accueil et courrier' AND f2.id_direction IS NULL AND f2.dept_id IS NULL
);
INSERT IGNORE INTO FONCTION_REFERENCE (libelle, id_direction, dept_id)
SELECT 'Infographiste & Déploiement', (SELECT id_direction FROM DIRECTION WHERE nom='Organisation et Projets' LIMIT 1), (SELECT dp2.dept_id FROM DEPARTEMENT dp2 JOIN ENTITE e2 ON e2.id_entite=dp2.id_entite WHERE dp2.nom='Communication Marketing et Relations Publiques' AND e2.nom='ECG' LIMIT 1)
FROM DUAL WHERE NOT EXISTS (
    SELECT 1 FROM FONCTION_REFERENCE f2
    WHERE f2.libelle='Infographiste & Déploiement' AND f2.id_direction=(SELECT id_direction FROM DIRECTION WHERE nom='Organisation et Projets' LIMIT 1) AND f2.dept_id=(SELECT dp3.dept_id FROM DEPARTEMENT dp3 JOIN ENTITE e3 ON e3.id_entite=dp3.id_entite WHERE dp3.nom='Communication Marketing et Relations Publiques' AND e3.nom='ECG' LIMIT 1)
);
INSERT IGNORE INTO FONCTION_REFERENCE (libelle, id_direction, dept_id)
SELECT 'Directeur Organisations et Projets', (SELECT id_direction FROM DIRECTION WHERE nom='Organisation et Projets' LIMIT 1), NULL
FROM DUAL WHERE NOT EXISTS (
    SELECT 1 FROM FONCTION_REFERENCE f2
    WHERE f2.libelle='Directeur Organisations et Projets' AND f2.id_direction=(SELECT id_direction FROM DIRECTION WHERE nom='Organisation et Projets' LIMIT 1) AND f2.dept_id IS NULL
);
INSERT IGNORE INTO FONCTION_REFERENCE (libelle, id_direction, dept_id)
SELECT 'Responsable Systèmes d''Information', (SELECT id_direction FROM DIRECTION WHERE nom='Organisation et Projets' LIMIT 1), (SELECT dp2.dept_id FROM DEPARTEMENT dp2 JOIN ENTITE e2 ON e2.id_entite=dp2.id_entite WHERE dp2.nom='Gestion des Projets et Systèmes d''Informations' AND e2.nom='ECG' LIMIT 1)
FROM DUAL WHERE NOT EXISTS (
    SELECT 1 FROM FONCTION_REFERENCE f2
    WHERE f2.libelle='Responsable Systèmes d''Information' AND f2.id_direction=(SELECT id_direction FROM DIRECTION WHERE nom='Organisation et Projets' LIMIT 1) AND f2.dept_id=(SELECT dp3.dept_id FROM DEPARTEMENT dp3 JOIN ENTITE e3 ON e3.id_entite=dp3.id_entite WHERE dp3.nom='Gestion des Projets et Systèmes d''Informations' AND e3.nom='ECG' LIMIT 1)
);
INSERT IGNORE INTO FONCTION_REFERENCE (libelle, id_direction, dept_id)
SELECT 'Chargé Organisations et projets', (SELECT id_direction FROM DIRECTION WHERE nom='Organisation et Projets' LIMIT 1), (SELECT dp2.dept_id FROM DEPARTEMENT dp2 JOIN ENTITE e2 ON e2.id_entite=dp2.id_entite WHERE dp2.nom='Gestion des Projets et Systèmes d''Informations' AND e2.nom='ECG' LIMIT 1)
FROM DUAL WHERE NOT EXISTS (
    SELECT 1 FROM FONCTION_REFERENCE f2
    WHERE f2.libelle='Chargé Organisations et projets' AND f2.id_direction=(SELECT id_direction FROM DIRECTION WHERE nom='Organisation et Projets' LIMIT 1) AND f2.dept_id=(SELECT dp3.dept_id FROM DEPARTEMENT dp3 JOIN ENTITE e3 ON e3.id_entite=dp3.id_entite WHERE dp3.nom='Gestion des Projets et Systèmes d''Informations' AND e3.nom='ECG' LIMIT 1)
);
INSERT IGNORE INTO FONCTION_REFERENCE (libelle, id_direction, dept_id)
SELECT 'Chargé Marketing digital et Opérationnel', (SELECT id_direction FROM DIRECTION WHERE nom='Organisation et Projets' LIMIT 1), NULL
FROM DUAL WHERE NOT EXISTS (
    SELECT 1 FROM FONCTION_REFERENCE f2
    WHERE f2.libelle='Chargé Marketing digital et Opérationnel' AND f2.id_direction=(SELECT id_direction FROM DIRECTION WHERE nom='Organisation et Projets' LIMIT 1) AND f2.dept_id IS NULL
);
INSERT IGNORE INTO FONCTION_REFERENCE (libelle, id_direction, dept_id)
SELECT 'Administrateur Directeur Général', NULL, NULL
FROM DUAL WHERE NOT EXISTS (
    SELECT 1 FROM FONCTION_REFERENCE f2
    WHERE f2.libelle='Administrateur Directeur Général' AND f2.id_direction IS NULL AND f2.dept_id IS NULL
);
INSERT IGNORE INTO FONCTION_REFERENCE (libelle, id_direction, dept_id)
SELECT 'Directeur Général Adjoint', NULL, NULL
FROM DUAL WHERE NOT EXISTS (
    SELECT 1 FROM FONCTION_REFERENCE f2
    WHERE f2.libelle='Directeur Général Adjoint' AND f2.id_direction IS NULL AND f2.dept_id IS NULL
);
INSERT IGNORE INTO FONCTION_REFERENCE (libelle, id_direction, dept_id)
SELECT 'Responsable conformité et contrôle interne', NULL, NULL
FROM DUAL WHERE NOT EXISTS (
    SELECT 1 FROM FONCTION_REFERENCE f2
    WHERE f2.libelle='Responsable conformité et contrôle interne' AND f2.id_direction IS NULL AND f2.dept_id IS NULL
);
INSERT IGNORE INTO FONCTION_REFERENCE (libelle, id_direction, dept_id)
SELECT 'Directeur Développement et investissement', (SELECT id_direction FROM DIRECTION WHERE nom='Developpement et Investissement' LIMIT 1), NULL
FROM DUAL WHERE NOT EXISTS (
    SELECT 1 FROM FONCTION_REFERENCE f2
    WHERE f2.libelle='Directeur Développement et investissement' AND f2.id_direction=(SELECT id_direction FROM DIRECTION WHERE nom='Developpement et Investissement' LIMIT 1) AND f2.dept_id IS NULL
);
INSERT IGNORE INTO FONCTION_REFERENCE (libelle, id_direction, dept_id)
SELECT 'Responsable développement Pool Grande Entreprise & Fortunes', (SELECT id_direction FROM DIRECTION WHERE nom='Developpement et Investissement' LIMIT 1), (SELECT dp2.dept_id FROM DEPARTEMENT dp2 JOIN ENTITE e2 ON e2.id_entite=dp2.id_entite WHERE dp2.nom='Pool Grandes Entreprises & Fortunes' AND e2.nom='EXCA' LIMIT 1)
FROM DUAL WHERE NOT EXISTS (
    SELECT 1 FROM FONCTION_REFERENCE f2
    WHERE f2.libelle='Responsable développement Pool Grande Entreprise & Fortunes' AND f2.id_direction=(SELECT id_direction FROM DIRECTION WHERE nom='Developpement et Investissement' LIMIT 1) AND f2.dept_id=(SELECT dp3.dept_id FROM DEPARTEMENT dp3 JOIN ENTITE e3 ON e3.id_entite=dp3.id_entite WHERE dp3.nom='Pool Grandes Entreprises & Fortunes' AND e3.nom='EXCA' LIMIT 1)
);
INSERT IGNORE INTO FONCTION_REFERENCE (libelle, id_direction, dept_id)
SELECT 'Chargé développement Pool Grande Entreprise & Fortunes', (SELECT id_direction FROM DIRECTION WHERE nom='Developpement et Investissement' LIMIT 1), (SELECT dp2.dept_id FROM DEPARTEMENT dp2 JOIN ENTITE e2 ON e2.id_entite=dp2.id_entite WHERE dp2.nom='Pool Grandes Entreprises & Fortunes' AND e2.nom='EXCA' LIMIT 1)
FROM DUAL WHERE NOT EXISTS (
    SELECT 1 FROM FONCTION_REFERENCE f2
    WHERE f2.libelle='Chargé développement Pool Grande Entreprise & Fortunes' AND f2.id_direction=(SELECT id_direction FROM DIRECTION WHERE nom='Developpement et Investissement' LIMIT 1) AND f2.dept_id=(SELECT dp3.dept_id FROM DEPARTEMENT dp3 JOIN ENTITE e3 ON e3.id_entite=dp3.id_entite WHERE dp3.nom='Pool Grandes Entreprises & Fortunes' AND e3.nom='EXCA' LIMIT 1)
);
INSERT IGNORE INTO FONCTION_REFERENCE (libelle, id_direction, dept_id)
SELECT 'Responsable développement Pool Particuliers & PME', (SELECT id_direction FROM DIRECTION WHERE nom='Developpement et Investissement' LIMIT 1), (SELECT dp2.dept_id FROM DEPARTEMENT dp2 JOIN ENTITE e2 ON e2.id_entite=dp2.id_entite WHERE dp2.nom='Pool Particuliers & PME' AND e2.nom='EXCA' LIMIT 1)
FROM DUAL WHERE NOT EXISTS (
    SELECT 1 FROM FONCTION_REFERENCE f2
    WHERE f2.libelle='Responsable développement Pool Particuliers & PME' AND f2.id_direction=(SELECT id_direction FROM DIRECTION WHERE nom='Developpement et Investissement' LIMIT 1) AND f2.dept_id=(SELECT dp3.dept_id FROM DEPARTEMENT dp3 JOIN ENTITE e3 ON e3.id_entite=dp3.id_entite WHERE dp3.nom='Pool Particuliers & PME' AND e3.nom='EXCA' LIMIT 1)
);
INSERT IGNORE INTO FONCTION_REFERENCE (libelle, id_direction, dept_id)
SELECT 'Chargé développement Pool Particuliers & PMEs', (SELECT id_direction FROM DIRECTION WHERE nom='Developpement et Investissement' LIMIT 1), (SELECT dp2.dept_id FROM DEPARTEMENT dp2 JOIN ENTITE e2 ON e2.id_entite=dp2.id_entite WHERE dp2.nom='Pool Particuliers & PME' AND e2.nom='EXCA' LIMIT 1)
FROM DUAL WHERE NOT EXISTS (
    SELECT 1 FROM FONCTION_REFERENCE f2
    WHERE f2.libelle='Chargé développement Pool Particuliers & PMEs' AND f2.id_direction=(SELECT id_direction FROM DIRECTION WHERE nom='Developpement et Investissement' LIMIT 1) AND f2.dept_id=(SELECT dp3.dept_id FROM DEPARTEMENT dp3 JOIN ENTITE e3 ON e3.id_entite=dp3.id_entite WHERE dp3.nom='Pool Particuliers & PME' AND e3.nom='EXCA' LIMIT 1)
);
INSERT IGNORE INTO FONCTION_REFERENCE (libelle, id_direction, dept_id)
SELECT 'Responsable Trésorerie(ALM)', NULL, (SELECT dp2.dept_id FROM DEPARTEMENT dp2 JOIN ENTITE e2 ON e2.id_entite=dp2.id_entite WHERE dp2.nom='Trésorerie(ALM)' AND e2.nom='EXCA' LIMIT 1)
FROM DUAL WHERE NOT EXISTS (
    SELECT 1 FROM FONCTION_REFERENCE f2
    WHERE f2.libelle='Responsable Trésorerie(ALM)' AND f2.id_direction IS NULL AND f2.dept_id=(SELECT dp3.dept_id FROM DEPARTEMENT dp3 JOIN ENTITE e3 ON e3.id_entite=dp3.id_entite WHERE dp3.nom='Trésorerie(ALM)' AND e3.nom='EXCA' LIMIT 1)
);
INSERT IGNORE INTO FONCTION_REFERENCE (libelle, id_direction, dept_id)
SELECT 'Chargé de négociation', NULL, (SELECT dp2.dept_id FROM DEPARTEMENT dp2 JOIN ENTITE e2 ON e2.id_entite=dp2.id_entite WHERE dp2.nom='Trésorerie(ALM)' AND e2.nom='EXCA' LIMIT 1)
FROM DUAL WHERE NOT EXISTS (
    SELECT 1 FROM FONCTION_REFERENCE f2
    WHERE f2.libelle='Chargé de négociation' AND f2.id_direction IS NULL AND f2.dept_id=(SELECT dp3.dept_id FROM DEPARTEMENT dp3 JOIN ENTITE e3 ON e3.id_entite=dp3.id_entite WHERE dp3.nom='Trésorerie(ALM)' AND e3.nom='EXCA' LIMIT 1)
);
INSERT IGNORE INTO FONCTION_REFERENCE (libelle, id_direction, dept_id)
SELECT 'Directeur Conseil et Financement structurés', (SELECT id_direction FROM DIRECTION WHERE nom='Conseils et Financements Structurés' LIMIT 1), NULL
FROM DUAL WHERE NOT EXISTS (
    SELECT 1 FROM FONCTION_REFERENCE f2
    WHERE f2.libelle='Directeur Conseil et Financement structurés' AND f2.id_direction=(SELECT id_direction FROM DIRECTION WHERE nom='Conseils et Financements Structurés' LIMIT 1) AND f2.dept_id IS NULL
);
INSERT IGNORE INTO FONCTION_REFERENCE (libelle, id_direction, dept_id)
SELECT 'Responsable Financement et structuration', NULL, NULL
FROM DUAL WHERE NOT EXISTS (
    SELECT 1 FROM FONCTION_REFERENCE f2
    WHERE f2.libelle='Responsable Financement et structuration' AND f2.id_direction IS NULL AND f2.dept_id IS NULL
);
INSERT IGNORE INTO FONCTION_REFERENCE (libelle, id_direction, dept_id)
SELECT 'Analyste Financement et structuration', (SELECT id_direction FROM DIRECTION WHERE nom='Conseils et Financements Structurés' LIMIT 1), (SELECT dp2.dept_id FROM DEPARTEMENT dp2 JOIN ENTITE e2 ON e2.id_entite=dp2.id_entite WHERE dp2.nom='Financement & Structuration' AND e2.nom='EXCA' LIMIT 1)
FROM DUAL WHERE NOT EXISTS (
    SELECT 1 FROM FONCTION_REFERENCE f2
    WHERE f2.libelle='Analyste Financement et structuration' AND f2.id_direction=(SELECT id_direction FROM DIRECTION WHERE nom='Conseils et Financements Structurés' LIMIT 1) AND f2.dept_id=(SELECT dp3.dept_id FROM DEPARTEMENT dp3 JOIN ENTITE e3 ON e3.id_entite=dp3.id_entite WHERE dp3.nom='Financement & Structuration' AND e3.nom='EXCA' LIMIT 1)
);
INSERT IGNORE INTO FONCTION_REFERENCE (libelle, id_direction, dept_id)
SELECT 'Responsable du Développement', NULL, NULL
FROM DUAL WHERE NOT EXISTS (
    SELECT 1 FROM FONCTION_REFERENCE f2
    WHERE f2.libelle='Responsable du Développement' AND f2.id_direction IS NULL AND f2.dept_id IS NULL
);
INSERT IGNORE INTO FONCTION_REFERENCE (libelle, id_direction, dept_id)
SELECT 'Chargé distribution Grandes entreprises et Fortunes', (SELECT id_direction FROM DIRECTION WHERE nom='Direction de la Distribution' LIMIT 1), (SELECT dp2.dept_id FROM DEPARTEMENT dp2 JOIN ENTITE e2 ON e2.id_entite=dp2.id_entite WHERE dp2.nom='Distribution Grandes Entreprises, Institutions et Fortunes' AND e2.nom='ELCAM' LIMIT 1)
FROM DUAL WHERE NOT EXISTS (
    SELECT 1 FROM FONCTION_REFERENCE f2
    WHERE f2.libelle='Chargé distribution Grandes entreprises et Fortunes' AND f2.id_direction=(SELECT id_direction FROM DIRECTION WHERE nom='Direction de la Distribution' LIMIT 1) AND f2.dept_id=(SELECT dp3.dept_id FROM DEPARTEMENT dp3 JOIN ENTITE e3 ON e3.id_entite=dp3.id_entite WHERE dp3.nom='Distribution Grandes Entreprises, Institutions et Fortunes' AND e3.nom='ELCAM' LIMIT 1)
);
INSERT IGNORE INTO FONCTION_REFERENCE (libelle, id_direction, dept_id)
SELECT 'Chargé distribution particulier et PME', (SELECT id_direction FROM DIRECTION WHERE nom='Direction de la Distribution' LIMIT 1), (SELECT dp2.dept_id FROM DEPARTEMENT dp2 JOIN ENTITE e2 ON e2.id_entite=dp2.id_entite WHERE dp2.nom='Distribution particuliers et PME' AND e2.nom='ELCAM' LIMIT 1)
FROM DUAL WHERE NOT EXISTS (
    SELECT 1 FROM FONCTION_REFERENCE f2
    WHERE f2.libelle='Chargé distribution particulier et PME' AND f2.id_direction=(SELECT id_direction FROM DIRECTION WHERE nom='Direction de la Distribution' LIMIT 1) AND f2.dept_id=(SELECT dp3.dept_id FROM DEPARTEMENT dp3 JOIN ENTITE e3 ON e3.id_entite=dp3.id_entite WHERE dp3.nom='Distribution particuliers et PME' AND e3.nom='ELCAM' LIMIT 1)
);
INSERT IGNORE INTO FONCTION_REFERENCE (libelle, id_direction, dept_id)
SELECT 'Directeur Conformité et Contrôle interne', (SELECT id_direction FROM DIRECTION WHERE nom='Conformité et Controle Interne' LIMIT 1), NULL
FROM DUAL WHERE NOT EXISTS (
    SELECT 1 FROM FONCTION_REFERENCE f2
    WHERE f2.libelle='Directeur Conformité et Contrôle interne' AND f2.id_direction=(SELECT id_direction FROM DIRECTION WHERE nom='Conformité et Controle Interne' LIMIT 1) AND f2.dept_id IS NULL
);
INSERT IGNORE INTO FONCTION_REFERENCE (libelle, id_direction, dept_id)
SELECT 'Directeur Distribution', (SELECT id_direction FROM DIRECTION WHERE nom='Direction de la Distribution' LIMIT 1), NULL
FROM DUAL WHERE NOT EXISTS (
    SELECT 1 FROM FONCTION_REFERENCE f2
    WHERE f2.libelle='Directeur Distribution' AND f2.id_direction=(SELECT id_direction FROM DIRECTION WHERE nom='Direction de la Distribution' LIMIT 1) AND f2.dept_id IS NULL
);
INSERT IGNORE INTO FONCTION_REFERENCE (libelle, id_direction, dept_id)
SELECT 'Responsable Distribution Grandes Entreprises Institutions et Fortunes', NULL, NULL
FROM DUAL WHERE NOT EXISTS (
    SELECT 1 FROM FONCTION_REFERENCE f2
    WHERE f2.libelle='Responsable Distribution Grandes Entreprises Institutions et Fortunes' AND f2.id_direction IS NULL AND f2.dept_id IS NULL
);
INSERT IGNORE INTO FONCTION_REFERENCE (libelle, id_direction, dept_id)
SELECT 'Responsable Distribution Particuliers et PME', NULL, NULL
FROM DUAL WHERE NOT EXISTS (
    SELECT 1 FROM FONCTION_REFERENCE f2
    WHERE f2.libelle='Responsable Distribution Particuliers et PME' AND f2.id_direction IS NULL AND f2.dept_id IS NULL
);
INSERT IGNORE INTO FONCTION_REFERENCE (libelle, id_direction, dept_id)
SELECT 'Responsable Gestion et Analyste de portefeuille', NULL, NULL
FROM DUAL WHERE NOT EXISTS (
    SELECT 1 FROM FONCTION_REFERENCE f2
    WHERE f2.libelle='Responsable Gestion et Analyste de portefeuille' AND f2.id_direction IS NULL AND f2.dept_id IS NULL
);
INSERT IGNORE INTO FONCTION_REFERENCE (libelle, id_direction, dept_id)
SELECT 'Chargé de Gestions de portefeuille', NULL, NULL
FROM DUAL WHERE NOT EXISTS (
    SELECT 1 FROM FONCTION_REFERENCE f2
    WHERE f2.libelle='Chargé de Gestions de portefeuille' AND f2.id_direction IS NULL AND f2.dept_id IS NULL
);
INSERT IGNORE INTO FONCTION_REFERENCE (libelle, id_direction, dept_id)
SELECT 'Chargé Analyste de portefeuille', NULL, NULL
FROM DUAL WHERE NOT EXISTS (
    SELECT 1 FROM FONCTION_REFERENCE f2
    WHERE f2.libelle='Chargé Analyste de portefeuille' AND f2.id_direction IS NULL AND f2.dept_id IS NULL
);
INSERT IGNORE INTO FONCTION_REFERENCE (libelle, id_direction, dept_id)
SELECT 'Chargé Back Office & operations', NULL, NULL
FROM DUAL WHERE NOT EXISTS (
    SELECT 1 FROM FONCTION_REFERENCE f2
    WHERE f2.libelle='Chargé Back Office & operations' AND f2.id_direction IS NULL AND f2.dept_id IS NULL
);
INSERT IGNORE INTO FONCTION_REFERENCE (libelle, id_direction, dept_id)
SELECT 'Stagiaire professionnel', NULL, NULL
FROM DUAL WHERE NOT EXISTS (
    SELECT 1 FROM FONCTION_REFERENCE f2
    WHERE f2.libelle='Stagiaire professionnel' AND f2.id_direction IS NULL AND f2.dept_id IS NULL
);
INSERT IGNORE INTO FONCTION_REFERENCE (libelle, id_direction, dept_id)
SELECT 'Stagiaire académique', NULL, NULL
FROM DUAL WHERE NOT EXISTS (
    SELECT 1 FROM FONCTION_REFERENCE f2
    WHERE f2.libelle='Stagiaire académique' AND f2.id_direction IS NULL AND f2.dept_id IS NULL
);
INSERT IGNORE INTO FONCTION_REFERENCE (libelle, id_direction, dept_id)
SELECT 'PCA', NULL, NULL
FROM DUAL WHERE NOT EXISTS (
    SELECT 1 FROM FONCTION_REFERENCE f2
    WHERE f2.libelle='PCA' AND f2.id_direction IS NULL AND f2.dept_id IS NULL
);
INSERT IGNORE INTO FONCTION_REFERENCE (libelle, id_direction, dept_id)
SELECT 'Directeur', NULL, NULL
FROM DUAL WHERE NOT EXISTS (
    SELECT 1 FROM FONCTION_REFERENCE f2
    WHERE f2.libelle='Directeur' AND f2.id_direction IS NULL AND f2.dept_id IS NULL
);
INSERT IGNORE INTO FONCTION_REFERENCE (libelle, id_direction, dept_id)
SELECT 'DFC', NULL, NULL
FROM DUAL WHERE NOT EXISTS (
    SELECT 1 FROM FONCTION_REFERENCE f2
    WHERE f2.libelle='DFC' AND f2.id_direction IS NULL AND f2.dept_id IS NULL
);
INSERT IGNORE INTO FONCTION_REFERENCE (libelle, id_direction, dept_id)
SELECT 'Employé', NULL, NULL
FROM DUAL WHERE NOT EXISTS (
    SELECT 1 FROM FONCTION_REFERENCE f2
    WHERE f2.libelle='Employé' AND f2.id_direction IS NULL AND f2.dept_id IS NULL
);
INSERT IGNORE INTO FONCTION_REFERENCE (libelle, id_direction, dept_id)
SELECT 'RH', NULL, NULL
FROM DUAL WHERE NOT EXISTS (
    SELECT 1 FROM FONCTION_REFERENCE f2
    WHERE f2.libelle='RH' AND f2.id_direction IS NULL AND f2.dept_id IS NULL
);
INSERT IGNORE INTO FONCTION_REFERENCE (libelle, id_direction, dept_id)
SELECT 'Chargé Cloud et sécurité', (SELECT id_direction FROM DIRECTION WHERE nom='Organisation et Projets' LIMIT 1), (SELECT dp2.dept_id FROM DEPARTEMENT dp2 JOIN ENTITE e2 ON e2.id_entite=dp2.id_entite WHERE dp2.nom='Gestion des Projets et Systèmes d''Informations' AND e2.nom='ECG' LIMIT 1)
FROM DUAL WHERE NOT EXISTS (
    SELECT 1 FROM FONCTION_REFERENCE f2
    WHERE f2.libelle='Chargé Cloud et sécurité' AND f2.id_direction=(SELECT id_direction FROM DIRECTION WHERE nom='Organisation et Projets' LIMIT 1) AND f2.dept_id=(SELECT dp3.dept_id FROM DEPARTEMENT dp3 JOIN ENTITE e3 ON e3.id_entite=dp3.id_entite WHERE dp3.nom='Gestion des Projets et Systèmes d''Informations' AND e3.nom='ECG' LIMIT 1)
);
INSERT IGNORE INTO FONCTION_REFERENCE (libelle, id_direction, dept_id)
SELECT 'Chargé Transformation Digitale, Innovation & Solutions Applicatives', (SELECT id_direction FROM DIRECTION WHERE nom='Organisation et Projets' LIMIT 1), (SELECT dp2.dept_id FROM DEPARTEMENT dp2 JOIN ENTITE e2 ON e2.id_entite=dp2.id_entite WHERE dp2.nom='Gestion des Projets et Systèmes d''Informations' AND e2.nom='ECG' LIMIT 1)
FROM DUAL WHERE NOT EXISTS (
    SELECT 1 FROM FONCTION_REFERENCE f2
    WHERE f2.libelle='Chargé Transformation Digitale, Innovation & Solutions Applicatives' AND f2.id_direction=(SELECT id_direction FROM DIRECTION WHERE nom='Organisation et Projets' LIMIT 1) AND f2.dept_id=(SELECT dp3.dept_id FROM DEPARTEMENT dp3 JOIN ENTITE e3 ON e3.id_entite=dp3.id_entite WHERE dp3.nom='Gestion des Projets et Systèmes d''Informations' AND e3.nom='ECG' LIMIT 1)
);
INSERT IGNORE INTO FONCTION_REFERENCE (libelle, id_direction, dept_id)
SELECT 'Directeur Financier et Comptable(DFC)', (SELECT id_direction FROM DIRECTION WHERE nom='Direction Financière et Comptable' LIMIT 1), NULL
FROM DUAL WHERE NOT EXISTS (
    SELECT 1 FROM FONCTION_REFERENCE f2
    WHERE f2.libelle='Directeur Financier et Comptable(DFC)' AND f2.id_direction=(SELECT id_direction FROM DIRECTION WHERE nom='Direction Financière et Comptable' LIMIT 1) AND f2.dept_id IS NULL
);
INSERT IGNORE INTO FONCTION_REFERENCE (libelle, id_direction, dept_id)
SELECT 'Contrôleur de gestion', (SELECT id_direction FROM DIRECTION WHERE nom='Direction Financière et Comptable' LIMIT 1), (SELECT dp2.dept_id FROM DEPARTEMENT dp2 JOIN ENTITE e2 ON e2.id_entite=dp2.id_entite WHERE dp2.nom='Controle de gestion' AND e2.nom='ECG' LIMIT 1)
FROM DUAL WHERE NOT EXISTS (
    SELECT 1 FROM FONCTION_REFERENCE f2
    WHERE f2.libelle='Contrôleur de gestion' AND f2.id_direction=(SELECT id_direction FROM DIRECTION WHERE nom='Direction Financière et Comptable' LIMIT 1) AND f2.dept_id=(SELECT dp3.dept_id FROM DEPARTEMENT dp3 JOIN ENTITE e3 ON e3.id_entite=dp3.id_entite WHERE dp3.nom='Controle de gestion' AND e3.nom='ECG' LIMIT 1)
);
INSERT IGNORE INTO FONCTION_REFERENCE (libelle, id_direction, dept_id)
SELECT 'Comptable', (SELECT id_direction FROM DIRECTION WHERE nom='Direction Financière et Comptable' LIMIT 1), (SELECT dp2.dept_id FROM DEPARTEMENT dp2 JOIN ENTITE e2 ON e2.id_entite=dp2.id_entite WHERE dp2.nom='Comptabilité' AND e2.nom='ECG' LIMIT 1)
FROM DUAL WHERE NOT EXISTS (
    SELECT 1 FROM FONCTION_REFERENCE f2
    WHERE f2.libelle='Comptable' AND f2.id_direction=(SELECT id_direction FROM DIRECTION WHERE nom='Direction Financière et Comptable' LIMIT 1) AND f2.dept_id=(SELECT dp3.dept_id FROM DEPARTEMENT dp3 JOIN ENTITE e3 ON e3.id_entite=dp3.id_entite WHERE dp3.nom='Comptabilité' AND e3.nom='ECG' LIMIT 1)
);
INSERT IGNORE INTO FONCTION_REFERENCE (libelle, id_direction, dept_id)
SELECT 'Responsable Affaires Juridiques & fiscalité', NULL, (SELECT dp2.dept_id FROM DEPARTEMENT dp2 JOIN ENTITE e2 ON e2.id_entite=dp2.id_entite WHERE dp2.nom='Affaires Juridiques & Fiscalité' AND e2.nom='ECG' LIMIT 1)
FROM DUAL WHERE NOT EXISTS (
    SELECT 1 FROM FONCTION_REFERENCE f2
    WHERE f2.libelle='Responsable Affaires Juridiques & fiscalité' AND f2.id_direction IS NULL AND f2.dept_id=(SELECT dp3.dept_id FROM DEPARTEMENT dp3 JOIN ENTITE e3 ON e3.id_entite=dp3.id_entite WHERE dp3.nom='Affaires Juridiques & Fiscalité' AND e3.nom='ECG' LIMIT 1)
);
INSERT IGNORE INTO FONCTION_REFERENCE (libelle, id_direction, dept_id)
SELECT 'Chargé de la fiscalité', NULL, (SELECT dp2.dept_id FROM DEPARTEMENT dp2 JOIN ENTITE e2 ON e2.id_entite=dp2.id_entite WHERE dp2.nom='Affaires Juridiques & Fiscalité' AND e2.nom='ECG' LIMIT 1)
FROM DUAL WHERE NOT EXISTS (
    SELECT 1 FROM FONCTION_REFERENCE f2
    WHERE f2.libelle='Chargé de la fiscalité' AND f2.id_direction IS NULL AND f2.dept_id=(SELECT dp3.dept_id FROM DEPARTEMENT dp3 JOIN ENTITE e3 ON e3.id_entite=dp3.id_entite WHERE dp3.nom='Affaires Juridiques & Fiscalité' AND e3.nom='ECG' LIMIT 1)
);
INSERT IGNORE INTO FONCTION_REFERENCE (libelle, id_direction, dept_id)
SELECT 'Chargé des Moyens généraux', NULL, NULL
FROM DUAL WHERE NOT EXISTS (
    SELECT 1 FROM FONCTION_REFERENCE f2
    WHERE f2.libelle='Chargé des Moyens généraux' AND f2.id_direction IS NULL AND f2.dept_id IS NULL
);
INSERT IGNORE INTO FONCTION_REFERENCE (libelle, id_direction, dept_id)
SELECT 'Responsable Middle & Back Office', NULL, (SELECT dp2.dept_id FROM DEPARTEMENT dp2 JOIN ENTITE e2 ON e2.id_entite=dp2.id_entite WHERE dp2.nom='Middle et Back Office' AND e2.nom='ELCAM' LIMIT 1)
FROM DUAL WHERE NOT EXISTS (
    SELECT 1 FROM FONCTION_REFERENCE f2
    WHERE f2.libelle='Responsable Middle & Back Office' AND f2.id_direction IS NULL AND f2.dept_id=(SELECT dp3.dept_id FROM DEPARTEMENT dp3 JOIN ENTITE e3 ON e3.id_entite=dp3.id_entite WHERE dp3.nom='Middle et Back Office' AND e3.nom='ELCAM' LIMIT 1)
);
INSERT IGNORE INTO FONCTION_REFERENCE (libelle, id_direction, dept_id)
SELECT 'Comptable', NULL, (SELECT dp2.dept_id FROM DEPARTEMENT dp2 JOIN ENTITE e2 ON e2.id_entite=dp2.id_entite WHERE dp2.nom='Middle & Back Office' AND e2.nom='EXCA' LIMIT 1)
FROM DUAL WHERE NOT EXISTS (
    SELECT 1 FROM FONCTION_REFERENCE f2
    WHERE f2.libelle='Comptable' AND f2.id_direction IS NULL AND f2.dept_id=(SELECT dp3.dept_id FROM DEPARTEMENT dp3 JOIN ENTITE e3 ON e3.id_entite=dp3.id_entite WHERE dp3.nom='Middle & Back Office' AND e3.nom='EXCA' LIMIT 1)
);
INSERT IGNORE INTO FONCTION_REFERENCE (libelle, id_direction, dept_id)
SELECT 'Assistante AG', NULL, NULL
FROM DUAL WHERE NOT EXISTS (
    SELECT 1 FROM FONCTION_REFERENCE f2
    WHERE f2.libelle='Assistante AG' AND f2.id_direction IS NULL AND f2.dept_id IS NULL
);
INSERT IGNORE INTO FONCTION_REFERENCE (libelle, id_direction, dept_id)
SELECT 'Chargé de la flotte automobile', NULL, (SELECT dp2.dept_id FROM DEPARTEMENT dp2 JOIN ENTITE e2 ON e2.id_entite=dp2.id_entite WHERE dp2.nom='Moyens Généraux' AND e2.nom='ECG' LIMIT 1)
FROM DUAL WHERE NOT EXISTS (
    SELECT 1 FROM FONCTION_REFERENCE f2
    WHERE f2.libelle='Chargé de la flotte automobile' AND f2.id_direction IS NULL AND f2.dept_id=(SELECT dp3.dept_id FROM DEPARTEMENT dp3 JOIN ENTITE e3 ON e3.id_entite=dp3.id_entite WHERE dp3.nom='Moyens Généraux' AND e3.nom='ECG' LIMIT 1)
);
INSERT IGNORE INTO FONCTION_REFERENCE (libelle, id_direction, dept_id)
SELECT 'Chauffeur', NULL, (SELECT dp2.dept_id FROM DEPARTEMENT dp2 JOIN ENTITE e2 ON e2.id_entite=dp2.id_entite WHERE dp2.nom='Moyens Généraux' AND e2.nom='ECG' LIMIT 1)
FROM DUAL WHERE NOT EXISTS (
    SELECT 1 FROM FONCTION_REFERENCE f2
    WHERE f2.libelle='Chauffeur' AND f2.id_direction IS NULL AND f2.dept_id=(SELECT dp3.dept_id FROM DEPARTEMENT dp3 JOIN ENTITE e3 ON e3.id_entite=dp3.id_entite WHERE dp3.nom='Moyens Généraux' AND e3.nom='ECG' LIMIT 1)
);
INSERT IGNORE INTO FONCTION_REFERENCE (libelle, id_direction, dept_id)
SELECT 'Assistante Administrative et Commerciale', NULL, NULL
FROM DUAL WHERE NOT EXISTS (
    SELECT 1 FROM FONCTION_REFERENCE f2
    WHERE f2.libelle='Assistante Administrative et Commerciale' AND f2.id_direction IS NULL AND f2.dept_id IS NULL
);
INSERT IGNORE INTO FONCTION_REFERENCE (libelle, id_direction, dept_id)
SELECT 'Chauffeur Pool', NULL, (SELECT dp2.dept_id FROM DEPARTEMENT dp2 JOIN ENTITE e2 ON e2.id_entite=dp2.id_entite WHERE dp2.nom='Moyens Généraux' AND e2.nom='ECG' LIMIT 1)
FROM DUAL WHERE NOT EXISTS (
    SELECT 1 FROM FONCTION_REFERENCE f2
    WHERE f2.libelle='Chauffeur Pool' AND f2.id_direction IS NULL AND f2.dept_id=(SELECT dp3.dept_id FROM DEPARTEMENT dp3 JOIN ENTITE e3 ON e3.id_entite=dp3.id_entite WHERE dp3.nom='Moyens Généraux' AND e3.nom='ECG' LIMIT 1)
);
INSERT IGNORE INTO FONCTION_REFERENCE (libelle, id_direction, dept_id)
SELECT 'Chauffeur DG', NULL, (SELECT dp2.dept_id FROM DEPARTEMENT dp2 JOIN ENTITE e2 ON e2.id_entite=dp2.id_entite WHERE dp2.nom='Moyens Généraux' AND e2.nom='ECG' LIMIT 1)
FROM DUAL WHERE NOT EXISTS (
    SELECT 1 FROM FONCTION_REFERENCE f2
    WHERE f2.libelle='Chauffeur DG' AND f2.id_direction IS NULL AND f2.dept_id=(SELECT dp3.dept_id FROM DEPARTEMENT dp3 JOIN ENTITE e3 ON e3.id_entite=dp3.id_entite WHERE dp3.nom='Moyens Généraux' AND e3.nom='ECG' LIMIT 1)
);
INSERT IGNORE INTO FONCTION_REFERENCE (libelle, id_direction, dept_id)
SELECT 'Chauffeur AG', NULL, (SELECT dp2.dept_id FROM DEPARTEMENT dp2 JOIN ENTITE e2 ON e2.id_entite=dp2.id_entite WHERE dp2.nom='Moyens Généraux' AND e2.nom='ECG' LIMIT 1)
FROM DUAL WHERE NOT EXISTS (
    SELECT 1 FROM FONCTION_REFERENCE f2
    WHERE f2.libelle='Chauffeur AG' AND f2.id_direction IS NULL AND f2.dept_id=(SELECT dp3.dept_id FROM DEPARTEMENT dp3 JOIN ENTITE e3 ON e3.id_entite=dp3.id_entite WHERE dp3.nom='Moyens Généraux' AND e3.nom='ECG' LIMIT 1)
);
INSERT IGNORE INTO FONCTION_REFERENCE (libelle, id_direction, dept_id)
SELECT 'Contrôleur Interne', (SELECT id_direction FROM DIRECTION WHERE nom='Conformité et Controle Interne' LIMIT 1), (SELECT dp2.dept_id FROM DEPARTEMENT dp2 JOIN ENTITE e2 ON e2.id_entite=dp2.id_entite WHERE dp2.nom='Contrôle Interne' AND e2.nom='EXCA' LIMIT 1)
FROM DUAL WHERE NOT EXISTS (
    SELECT 1 FROM FONCTION_REFERENCE f2
    WHERE f2.libelle='Contrôleur Interne' AND f2.id_direction=(SELECT id_direction FROM DIRECTION WHERE nom='Conformité et Controle Interne' LIMIT 1) AND f2.dept_id=(SELECT dp3.dept_id FROM DEPARTEMENT dp3 JOIN ENTITE e3 ON e3.id_entite=dp3.id_entite WHERE dp3.nom='Contrôle Interne' AND e3.nom='EXCA' LIMIT 1)
);
INSERT IGNORE INTO FONCTION_REFERENCE (libelle, id_direction, dept_id)
SELECT 'Chargé du développement portefeuille particulier et PME', NULL, NULL
FROM DUAL WHERE NOT EXISTS (
    SELECT 1 FROM FONCTION_REFERENCE f2
    WHERE f2.libelle='Chargé du développement portefeuille particulier et PME' AND f2.id_direction IS NULL AND f2.dept_id IS NULL
);
INSERT IGNORE INTO FONCTION_REFERENCE (libelle, id_direction, dept_id)
SELECT 'Chargé du développement portefeuille Grandes entreprise et Fortune', NULL, NULL
FROM DUAL WHERE NOT EXISTS (
    SELECT 1 FROM FONCTION_REFERENCE f2
    WHERE f2.libelle='Chargé du développement portefeuille Grandes entreprise et Fortune' AND f2.id_direction IS NULL AND f2.dept_id IS NULL
);
INSERT IGNORE INTO FONCTION_REFERENCE (libelle, id_direction, dept_id)
SELECT 'Auditeur', NULL, NULL
FROM DUAL WHERE NOT EXISTS (
    SELECT 1 FROM FONCTION_REFERENCE f2
    WHERE f2.libelle='Auditeur' AND f2.id_direction IS NULL AND f2.dept_id IS NULL
);
INSERT IGNORE INTO FONCTION_REFERENCE (libelle, id_direction, dept_id)
SELECT 'Responsable Comptable, Contrôle et Consolidation', (SELECT id_direction FROM DIRECTION WHERE nom='Direction Financière et Comptable' LIMIT 1), (SELECT dp2.dept_id FROM DEPARTEMENT dp2 JOIN ENTITE e2 ON e2.id_entite=dp2.id_entite WHERE dp2.nom='Comptabilité' AND e2.nom='ECG' LIMIT 1)
FROM DUAL WHERE NOT EXISTS (
    SELECT 1 FROM FONCTION_REFERENCE f2
    WHERE f2.libelle='Responsable Comptable, Contrôle et Consolidation' AND f2.id_direction=(SELECT id_direction FROM DIRECTION WHERE nom='Direction Financière et Comptable' LIMIT 1) AND f2.dept_id=(SELECT dp3.dept_id FROM DEPARTEMENT dp3 JOIN ENTITE e3 ON e3.id_entite=dp3.id_entite WHERE dp3.nom='Comptabilité' AND e3.nom='ECG' LIMIT 1)
);
