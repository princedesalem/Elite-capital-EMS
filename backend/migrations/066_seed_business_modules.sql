-- Migration 066 : Catalogue Elite Academy - 9 modules metier (initiation + perfectionnement)

INSERT INTO formations (titre, description, categorie, niveau, duree_estimee_h, est_onboarding, est_publie, cree_par)
VALUES
-- ACHATS
('Achats : fondamentaux',
 'Cycle achats, sourcing, demande d''achat, bon de commande et reception. Bonnes pratiques de base.',
 'Achats', 'Débutant', 2.0, FALSE, TRUE, '9999'),
('Achats : negociation et performance',
 'Strategies de negociation fournisseurs, suivi des KPIs achats et optimisation des couts.',
 'Achats', 'Avancé', 3.0, FALSE, TRUE, '9999'),

-- COMMERCIAL
('Commercial : techniques de vente',
 'Prospection, qualification, decouverte des besoins, argumentation et closing.',
 'Commercial', 'Débutant', 2.5, FALSE, TRUE, '9999'),
('Commercial : pilotage du pipeline',
 'Forecast, taux de transformation, management des opportunites et reporting commercial.',
 'Commercial', 'Avancé', 2.5, FALSE, TRUE, '9999'),

-- MARKETING
('Marketing : strategie et positionnement',
 'Etude de marche, segmentation, ciblage, positionnement et mix marketing 4P.',
 'Marketing', 'Débutant', 2.0, FALSE, TRUE, '9999'),
('Marketing digital et content',
 'SEO, SEA, social media, email marketing et content strategy.',
 'Marketing', 'Intermédiaire', 3.0, FALSE, TRUE, '9999'),

-- COMMUNICATION
('Communication interne et externe',
 'Plan de communication, relations presse, communication de crise et messages cles.',
 'Communication', 'Débutant', 1.5, FALSE, TRUE, '9999'),
('Communication : prise de parole et media training',
 'Maitriser sa posture, structurer son message, repondre aux medias et au public.',
 'Communication', 'Avancé', 2.0, FALSE, TRUE, '9999'),

-- SYSTEME D'INFORMATION
('SI : architecture et urbanisation',
 'Cartographie applicative, urbanisation, integration, API et flux de donnees.',
 'Système d''Information', 'Intermédiaire', 2.5, FALSE, TRUE, '9999'),
('SI : cybersecurite et gouvernance des donnees',
 'ISO 27001, RGPD, gestion des incidents, sauvegardes et plan de continuite.',
 'Système d''Information', 'Avancé', 3.0, FALSE, TRUE, '9999'),

-- FLOTTE
('Flotte : gestion operationnelle',
 'Suivi des vehicules, carburant, entretien, sinistres et conformite reglementaire.',
 'Flotte', 'Débutant', 1.5, FALSE, TRUE, '9999'),
('Flotte : optimisation TCO et eco-conduite',
 'TCO, telematique, eco-conduite et reduction de l''empreinte carbone du parc.',
 'Flotte', 'Avancé', 2.0, FALSE, TRUE, '9999'),

-- AUDIT
('Audit interne : fondamentaux',
 'Cadre de reference IIA, methodologie, conduite de mission et redaction du rapport.',
 'Audit', 'Intermédiaire', 2.5, FALSE, TRUE, '9999'),
('Audit : controle interne et gestion des risques',
 'Cartographie des risques, dispositif de controle interne et plan d''action correctif.',
 'Audit', 'Avancé', 3.0, FALSE, TRUE, '9999'),

-- PROJETS
('Gestion de projet : les essentiels',
 'Cadrage, planification, suivi, gestion des risques et cloture de projet.',
 'Projets', 'Débutant', 2.0, FALSE, TRUE, '9999'),
('Methodes agiles : Scrum et Kanban',
 'Roles, ceremonies, artefacts Scrum et tableau Kanban applique au quotidien.',
 'Projets', 'Intermédiaire', 2.5, FALSE, TRUE, '9999'),

-- CRM
('CRM : fondamentaux et parcours client',
 'Capter, qualifier et fideliser : cycle de vie client et exploitation d''un CRM.',
 'CRM', 'Débutant', 1.5, FALSE, TRUE, '9999'),
('CRM : segmentation, scoring et automation',
 'Segmentation comportementale, scoring, workflows d''automation et personnalisation.',
 'CRM', 'Avancé', 2.5, FALSE, TRUE, '9999');

-- Modules + lecons d'introduction pour chaque formation
INSERT INTO modules_formation (formation_id, titre, description, ordre)
SELECT id, 'Introduction', 'Premiere prise de contact avec le sujet.', 0
FROM formations
WHERE cree_par = '9999' AND NOT EXISTS (
  SELECT 1 FROM modules_formation m WHERE m.formation_id = formations.id
);

INSERT INTO lecons (module_id, titre, type, contenu, ordre, duree_min)
SELECT m.id, 'Vue d''ensemble', 'texte',
       CONCAT('<h2>', f.titre, '</h2><p>', COALESCE(f.description, ''), '</p><p>Cette formation vous permet de monter en competence sur le sujet. Suivez les modules et validez le quiz pour obtenir votre certificat.</p>'),
       0, 15
FROM modules_formation m
JOIN formations f ON f.id = m.formation_id
WHERE f.cree_par = '9999' AND NOT EXISTS (
  SELECT 1 FROM lecons l WHERE l.module_id = m.id
);

-- Lecon Quiz finale pour chaque formation seedee
INSERT INTO modules_formation (formation_id, titre, description, ordre)
SELECT f.id, 'Validation', 'Quiz de validation des acquis.', 99
FROM formations f
WHERE f.cree_par = '9999' AND NOT EXISTS (
  SELECT 1 FROM modules_formation m WHERE m.formation_id = f.id AND m.ordre = 99
);

INSERT INTO lecons (module_id, titre, type, contenu, ordre, duree_min)
SELECT m.id, 'Quiz final', 'quiz', NULL, 0, 10
FROM modules_formation m
WHERE m.ordre = 99 AND NOT EXISTS (
  SELECT 1 FROM lecons l WHERE l.module_id = m.id
);
