-- Migration 065 : Seed catalogue Elite Academy avec une formation par module EMS
-- Toutes publiees pour apparaitre dans le catalogue

INSERT INTO formations (titre, description, categorie, niveau, duree_estimee_h, est_onboarding, est_publie, cree_par)
VALUES
('Bienvenue chez Elite Capital Group',
 'Decouvrez la vision, les valeurs et l''organisation du groupe. Un parcours essentiel pour toute nouvelle recrue.',
 'Onboarding', 'Débutant', 1.5, TRUE, TRUE, '9999'),

('Prise en main de l''extranet EMS',
 'Navigation, raccourcis, profil utilisateur, notifications : maitrisez les bases de la plateforme.',
 'Onboarding', 'Débutant', 1.0, TRUE, TRUE, '9999'),

('Gestion des conges et absences',
 'Demander, valider, suivre vos conges et absences. Comprendre les soldes et les regles RH.',
 'Ressources Humaines', 'Débutant', 2.0, FALSE, TRUE, '9999'),

('Permissions et sorties',
 'Procedures pour les permissions courtes, les sorties exceptionnelles et les preuves justificatives.',
 'Ressources Humaines', 'Débutant', 1.0, FALSE, TRUE, '9999'),

('Pointage et presence',
 'Pointage quotidien, regles d''assiduite et suivi du temps de travail dans EMS.',
 'Ressources Humaines', 'Débutant', 0.5, FALSE, TRUE, '9999'),

('Gestion des missions',
 'Creer, planifier et suivre une mission : segments, transports, missionnaires multiples et destinations.',
 'Operations', 'Intermédiaire', 3.0, FALSE, TRUE, '9999'),

('Notes de frais et remboursements',
 'Saisir, justifier et faire valider vos frais professionnels. Bonnes pratiques anti-rejet.',
 'Finance', 'Débutant', 1.5, FALSE, TRUE, '9999'),

('Operations terrain',
 'Suivi operationnel, vue operation, sorties et coordination des equipes sur le terrain.',
 'Operations', 'Intermédiaire', 2.5, FALSE, TRUE, '9999'),

('Evaluations et entretiens annuels',
 'Le cycle complet des evaluations : auto-evaluation, entretien, validation N+1 et plan de developpement.',
 'Performance', 'Intermédiaire', 2.5, FALSE, TRUE, '9999'),

('Performance reviews et objectifs',
 'Fixer des objectifs SMART, suivre les KPIs et conduire un entretien de performance constructif.',
 'Performance', 'Avancé', 3.0, FALSE, TRUE, '9999'),

('Procedures disciplinaires',
 'Cadre legal et procedures internes : avertissement, mise a pied, sanctions et recours.',
 'Ressources Humaines', 'Avancé', 2.5, FALSE, TRUE, '9999'),

('Score comportemental',
 'Comprendre le score comportemental, ses criteres et son impact sur le parcours de l''employe.',
 'Ressources Humaines', 'Intermédiaire', 1.5, FALSE, TRUE, '9999'),

('Demandes d''explication',
 'Rediger, repondre et traiter une demande d''explication selon les standards du groupe.',
 'Ressources Humaines', 'Intermédiaire', 1.0, FALSE, TRUE, '9999'),

('Fiche de poste : redaction et mise a jour',
 'Construire une fiche de poste complete : missions, responsabilites, competences et liaisons hierarchiques.',
 'Organisation', 'Intermédiaire', 2.0, FALSE, TRUE, '9999'),

('Organisation et organigramme',
 'Lire et maintenir l''organigramme du groupe : directions, departements, fonctions et liaisons.',
 'Organisation', 'Débutant', 1.5, FALSE, TRUE, '9999'),

('Workflow et gestion des taches',
 'Creer, assigner et suivre les taches via le module Workflow. Statuts, filtres et bonnes pratiques.',
 'Productivite', 'Débutant', 1.5, FALSE, TRUE, '9999'),

('Talent management',
 'Identifier les talents, construire les plans de succession et piloter le developpement des hauts potentiels.',
 'Strategie RH', 'Avancé', 3.0, FALSE, TRUE, '9999'),

('Workforce planning',
 'Planification des effectifs, anticipation des besoins et optimisation de la masse salariale.',
 'Strategie RH', 'Avancé', 3.0, FALSE, TRUE, '9999'),

('Gestion des remplacants',
 'Designer, accompagner et suivre les remplacants temporaires ou definitifs.',
 'Ressources Humaines', 'Intermédiaire', 1.5, FALSE, TRUE, '9999'),

('Analytics et tableaux de bord',
 'Exploiter les dashboards EMS : indicateurs cles, exports et lecture des tendances.',
 'Data & Analytics', 'Intermédiaire', 2.0, FALSE, TRUE, '9999'),

('Assistant IA et productivite',
 'Tirer parti de l''assistant IA integre a EMS pour gagner en efficacite au quotidien.',
 'Productivite', 'Débutant', 1.0, FALSE, TRUE, '9999'),

('Securite, confidentialite et bonnes pratiques',
 'Charte informatique, gestion des acces, protection des donnees et reflexes anti-phishing.',
 'Conformite', 'Débutant', 1.5, FALSE, TRUE, '9999'),

('Administration et parametrage EMS',
 'Pour les administrateurs : gestion des utilisateurs, roles, modules et parametres systeme.',
 'Administration', 'Avancé', 3.5, FALSE, TRUE, '9999'),

('Documentation et base de connaissances',
 'Trouver et contribuer a la documentation interne : standards, procedures et guides metier.',
 'Productivite', 'Débutant', 0.5, FALSE, TRUE, '9999');

INSERT INTO modules_formation (formation_id, titre, description, ordre)
SELECT id, 'Introduction', 'Premiere prise de contact avec le sujet.', 0
FROM formations
WHERE cree_par = '9999' AND NOT EXISTS (
  SELECT 1 FROM modules_formation m WHERE m.formation_id = formations.id
);

INSERT INTO lecons (module_id, titre, type, contenu, ordre, duree_min)
SELECT m.id, 'Vue d''ensemble', 'texte',
       CONCAT('<h2>', f.titre, '</h2><p>', COALESCE(f.description, ''), '</p><p>Le contenu detaille de cette formation sera enrichi prochainement par l''equipe Elite Academy.</p>'),
       0, 15
FROM modules_formation m
JOIN formations f ON f.id = m.formation_id
WHERE f.cree_par = '9999' AND NOT EXISTS (
  SELECT 1 FROM lecons l WHERE l.module_id = m.id
);
