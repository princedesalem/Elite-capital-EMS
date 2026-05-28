-- Migration 072 : Correction des doublons laissés par 071
-- Travaille par libellé (texte) plutôt que par id_fonction
-- Pour chaque paire (ancien → nouveau) :
--   • Si le nouveau existe déjà → supprimer l'ancien (doublon)
--   • Si le nouveau n'existe pas → renommer l'ancien
-- Les employés sont toujours mis à jour vers le nouveau libellé.

-- ============================================================
-- HELPER : patterns DELETE + UPDATE via sous-requête dérivée
-- pour contourner la restriction MySQL "can't update/delete while reading same table"
-- ============================================================

-- ---- [3] Inspecteur Générale(IG) → Inspecteur Général(IG) ----
UPDATE EMPLOYE SET fonction = 'Inspecteur Général(IG)' WHERE fonction = 'Inspecteur Générale(IG)';
UPDATE EMPLOYE SET n1_fonction = 'Inspecteur Général(IG)' WHERE n1_fonction = 'Inspecteur Générale(IG)';
DELETE FROM FONCTION_REFERENCE WHERE libelle = 'Inspecteur Générale(IG)'
  AND EXISTS (SELECT 1 FROM (SELECT id_fonction FROM FONCTION_REFERENCE WHERE libelle = 'Inspecteur Général(IG)') t);
UPDATE FONCTION_REFERENCE SET libelle = 'Inspecteur Général(IG)' WHERE libelle = 'Inspecteur Générale(IG)'
  AND NOT EXISTS (SELECT 1 FROM (SELECT id_fonction FROM FONCTION_REFERENCE WHERE libelle = 'Inspecteur Général(IG)') t);

-- ---- [5] création + relations ----
UPDATE EMPLOYE SET fonction = 'Représentants Résidents et responsables de la création et relations d''affaires'
  WHERE fonction = 'Représentants Résidents et responsables de la creation et relation d''affaires';
UPDATE EMPLOYE SET n1_fonction = 'Représentants Résidents et responsables de la création et relations d''affaires'
  WHERE n1_fonction = 'Représentants Résidents et responsables de la creation et relation d''affaires';
DELETE FROM FONCTION_REFERENCE
  WHERE libelle = 'Représentants Résidents et responsables de la creation et relation d''affaires'
  AND EXISTS (SELECT 1 FROM (SELECT id_fonction FROM FONCTION_REFERENCE WHERE libelle = 'Représentants Résidents et responsables de la création et relations d''affaires') t);
UPDATE FONCTION_REFERENCE SET libelle = 'Représentants Résidents et responsables de la création et relations d''affaires'
  WHERE libelle = 'Représentants Résidents et responsables de la creation et relation d''affaires'
  AND NOT EXISTS (SELECT 1 FROM (SELECT id_fonction FROM FONCTION_REFERENCE WHERE libelle = 'Représentants Résidents et responsables de la création et relations d''affaires') t);

-- ---- [6] Directeur financier → Directeur Financier (DFC) ----
UPDATE EMPLOYE SET fonction = 'Directeur Financier et Comptable(DFC)' WHERE fonction = 'Directeur financier et Comptable(DFC)';
UPDATE EMPLOYE SET n1_fonction = 'Directeur Financier et Comptable(DFC)' WHERE n1_fonction = 'Directeur financier et Comptable(DFC)';
DELETE FROM FONCTION_REFERENCE WHERE libelle = 'Directeur financier et Comptable(DFC)'
  AND EXISTS (SELECT 1 FROM (SELECT id_fonction FROM FONCTION_REFERENCE WHERE libelle = 'Directeur Financier et Comptable(DFC)') t);
UPDATE FONCTION_REFERENCE SET libelle = 'Directeur Financier et Comptable(DFC)' WHERE libelle = 'Directeur financier et Comptable(DFC)'
  AND NOT EXISTS (SELECT 1 FROM (SELECT id_fonction FROM FONCTION_REFERENCE WHERE libelle = 'Directeur Financier et Comptable(DFC)') t);

-- ---- [7] DOUBLON : comptable et responsable... → supprimer, garder [99] ----
UPDATE EMPLOYE SET fonction = 'Responsable comptable contrôle et consolidation'
  WHERE fonction = 'comptable et responsable contrôle et consolidation';
UPDATE EMPLOYE SET n1_fonction = 'Responsable comptable contrôle et consolidation'
  WHERE n1_fonction = 'comptable et responsable contrôle et consolidation';
DELETE FROM FONCTION_REFERENCE WHERE libelle = 'comptable et responsable contrôle et consolidation';

-- ---- [8] responsable Trésorerie → Chargé Trésorerie ----
UPDATE EMPLOYE SET fonction = 'Chargé Trésorerie et financement' WHERE fonction = 'responsable Trésorerie et financement';
UPDATE EMPLOYE SET n1_fonction = 'Chargé Trésorerie et financement' WHERE n1_fonction = 'responsable Trésorerie et financement';
DELETE FROM FONCTION_REFERENCE WHERE libelle = 'responsable Trésorerie et financement'
  AND EXISTS (SELECT 1 FROM (SELECT id_fonction FROM FONCTION_REFERENCE WHERE libelle = 'Chargé Trésorerie et financement') t);
UPDATE FONCTION_REFERENCE SET libelle = 'Chargé Trésorerie et financement' WHERE libelle = 'responsable Trésorerie et financement'
  AND NOT EXISTS (SELECT 1 FROM (SELECT id_fonction FROM FONCTION_REFERENCE WHERE libelle = 'Chargé Trésorerie et financement') t);

-- ---- [9] contrôleur → Contrôleur ----
UPDATE EMPLOYE SET fonction = 'Contrôleur de gestion' WHERE fonction = 'contrôleur de gestion';
UPDATE EMPLOYE SET n1_fonction = 'Contrôleur de gestion' WHERE n1_fonction = 'contrôleur de gestion';
DELETE FROM FONCTION_REFERENCE WHERE libelle = 'contrôleur de gestion'
  AND EXISTS (SELECT 1 FROM (SELECT id_fonction FROM FONCTION_REFERENCE WHERE libelle = 'Contrôleur de gestion') t);
UPDATE FONCTION_REFERENCE SET libelle = 'Contrôleur de gestion' WHERE libelle = 'contrôleur de gestion'
  AND NOT EXISTS (SELECT 1 FROM (SELECT id_fonction FROM FONCTION_REFERENCE WHERE libelle = 'Contrôleur de gestion') t);

-- ---- [10] comptable → Comptable ----
UPDATE EMPLOYE SET fonction = 'Comptable' WHERE fonction = 'comptable';
UPDATE EMPLOYE SET n1_fonction = 'Comptable' WHERE n1_fonction = 'comptable';
DELETE FROM FONCTION_REFERENCE WHERE libelle = 'comptable'
  AND EXISTS (SELECT 1 FROM (SELECT id_fonction FROM FONCTION_REFERENCE WHERE libelle = 'Comptable') t);
UPDATE FONCTION_REFERENCE SET libelle = 'Comptable' WHERE libelle = 'comptable'
  AND NOT EXISTS (SELECT 1 FROM (SELECT id_fonction FROM FONCTION_REFERENCE WHERE libelle = 'Comptable') t);

-- ---- [11] Responsable des Ressources Humaines → Responsable Ressources Humaines ----
UPDATE EMPLOYE SET fonction = 'Responsable Ressources Humaines' WHERE fonction = 'Responsable des Ressources Humaines';
UPDATE EMPLOYE SET n1_fonction = 'Responsable Ressources Humaines' WHERE n1_fonction = 'Responsable des Ressources Humaines';
DELETE FROM FONCTION_REFERENCE WHERE libelle = 'Responsable des Ressources Humaines'
  AND EXISTS (SELECT 1 FROM (SELECT id_fonction FROM FONCTION_REFERENCE WHERE libelle = 'Responsable Ressources Humaines') t);
UPDATE FONCTION_REFERENCE SET libelle = 'Responsable Ressources Humaines' WHERE libelle = 'Responsable des Ressources Humaines'
  AND NOT EXISTS (SELECT 1 FROM (SELECT id_fonction FROM FONCTION_REFERENCE WHERE libelle = 'Responsable Ressources Humaines') t);

-- ---- [102] DOUBLON : Responsable Des Resources Humaines → supprimer ----
UPDATE EMPLOYE SET fonction = 'Responsable Ressources Humaines' WHERE fonction = 'Responsable Des Resources Humaines';
UPDATE EMPLOYE SET n1_fonction = 'Responsable Ressources Humaines' WHERE n1_fonction = 'Responsable Des Resources Humaines';
DELETE FROM FONCTION_REFERENCE WHERE libelle = 'Responsable Des Resources Humaines';

-- ---- [12] chargé des resources → Chargé des Ressources ----
UPDATE EMPLOYE SET fonction = 'Chargé des Ressources Humaines' WHERE fonction = 'chargé des resources humaines';
UPDATE EMPLOYE SET n1_fonction = 'Chargé des Ressources Humaines' WHERE n1_fonction = 'chargé des resources humaines';
DELETE FROM FONCTION_REFERENCE WHERE libelle = 'chargé des resources humaines'
  AND EXISTS (SELECT 1 FROM (SELECT id_fonction FROM FONCTION_REFERENCE WHERE libelle = 'Chargé des Ressources Humaines') t);
UPDATE FONCTION_REFERENCE SET libelle = 'Chargé des Ressources Humaines' WHERE libelle = 'chargé des resources humaines'
  AND NOT EXISTS (SELECT 1 FROM (SELECT id_fonction FROM FONCTION_REFERENCE WHERE libelle = 'Chargé des Ressources Humaines') t);

-- ---- [13] responsable communication → Responsable Communication ----
UPDATE EMPLOYE SET fonction = 'Responsable Communication et Relations Publiques' WHERE fonction = 'responsable communication et relation publiques';
UPDATE EMPLOYE SET n1_fonction = 'Responsable Communication et Relations Publiques' WHERE n1_fonction = 'responsable communication et relation publiques';
DELETE FROM FONCTION_REFERENCE WHERE libelle = 'responsable communication et relation publiques'
  AND EXISTS (SELECT 1 FROM (SELECT id_fonction FROM FONCTION_REFERENCE WHERE libelle = 'Responsable Communication et Relations Publiques') t);
UPDATE FONCTION_REFERENCE SET libelle = 'Responsable Communication et Relations Publiques' WHERE libelle = 'responsable communication et relation publiques'
  AND NOT EXISTS (SELECT 1 FROM (SELECT id_fonction FROM FONCTION_REFERENCE WHERE libelle = 'Responsable Communication et Relations Publiques') t);

-- ---- [15] infographiste et → Infographiste & ----
UPDATE EMPLOYE SET fonction = 'Infographiste & Déploiement' WHERE fonction = 'infographiste et déploiement';
UPDATE EMPLOYE SET n1_fonction = 'Infographiste & Déploiement' WHERE n1_fonction = 'infographiste et déploiement';
DELETE FROM FONCTION_REFERENCE WHERE libelle = 'infographiste et déploiement'
  AND EXISTS (SELECT 1 FROM (SELECT id_fonction FROM FONCTION_REFERENCE WHERE libelle = 'Infographiste & Déploiement') t);
UPDATE FONCTION_REFERENCE SET libelle = 'Infographiste & Déploiement' WHERE libelle = 'infographiste et déploiement'
  AND NOT EXISTS (SELECT 1 FROM (SELECT id_fonction FROM FONCTION_REFERENCE WHERE libelle = 'Infographiste & Déploiement') t);

-- ---- [16] Responsable affaires → Responsable Affaires ----
UPDATE EMPLOYE SET fonction = 'Responsable Affaires Juridiques & fiscalité' WHERE fonction = 'Responsable affaires juridiques & fiscalité';
UPDATE EMPLOYE SET n1_fonction = 'Responsable Affaires Juridiques & fiscalité' WHERE n1_fonction = 'Responsable affaires juridiques & fiscalité';
DELETE FROM FONCTION_REFERENCE WHERE libelle = 'Responsable affaires juridiques & fiscalité'
  AND EXISTS (SELECT 1 FROM (SELECT id_fonction FROM FONCTION_REFERENCE WHERE libelle = 'Responsable Affaires Juridiques & fiscalité') t);
UPDATE FONCTION_REFERENCE SET libelle = 'Responsable Affaires Juridiques & fiscalité' WHERE libelle = 'Responsable affaires juridiques & fiscalité'
  AND NOT EXISTS (SELECT 1 FROM (SELECT id_fonction FROM FONCTION_REFERENCE WHERE libelle = 'Responsable Affaires Juridiques & fiscalité') t);

-- ---- [17] chargé de la fiscalité → Chargé de la fiscalité ----
UPDATE EMPLOYE SET fonction = 'Chargé de la fiscalité' WHERE fonction = 'chargé de la fiscalité';
UPDATE EMPLOYE SET n1_fonction = 'Chargé de la fiscalité' WHERE n1_fonction = 'chargé de la fiscalité';
DELETE FROM FONCTION_REFERENCE WHERE libelle = 'chargé de la fiscalité'
  AND EXISTS (SELECT 1 FROM (SELECT id_fonction FROM FONCTION_REFERENCE WHERE libelle = 'Chargé de la fiscalité') t);
UPDATE FONCTION_REFERENCE SET libelle = 'Chargé de la fiscalité' WHERE libelle = 'chargé de la fiscalité'
  AND NOT EXISTS (SELECT 1 FROM (SELECT id_fonction FROM FONCTION_REFERENCE WHERE libelle = 'Chargé de la fiscalité') t);

-- ---- [18] Directeur des Organisations → Directeur Organisations ----
UPDATE EMPLOYE SET fonction = 'Directeur Organisations et Projets' WHERE fonction = 'Directeur des Organisations et projets';
UPDATE EMPLOYE SET n1_fonction = 'Directeur Organisations et Projets' WHERE n1_fonction = 'Directeur des Organisations et projets';
DELETE FROM FONCTION_REFERENCE WHERE libelle = 'Directeur des Organisations et projets'
  AND EXISTS (SELECT 1 FROM (SELECT id_fonction FROM FONCTION_REFERENCE WHERE libelle = 'Directeur Organisations et Projets') t);
UPDATE FONCTION_REFERENCE SET libelle = 'Directeur Organisations et Projets' WHERE libelle = 'Directeur des Organisations et projets'
  AND NOT EXISTS (SELECT 1 FROM (SELECT id_fonction FROM FONCTION_REFERENCE WHERE libelle = 'Directeur Organisations et Projets') t);

-- ---- [19] Responsable des systèmes → Responsable Systèmes ----
UPDATE EMPLOYE SET fonction = 'Responsable Systèmes d''Information' WHERE fonction = 'Responsable des systèmes d''information';
UPDATE EMPLOYE SET n1_fonction = 'Responsable Systèmes d''Information' WHERE n1_fonction = 'Responsable des systèmes d''information';
DELETE FROM FONCTION_REFERENCE WHERE libelle = 'Responsable des systèmes d''information'
  AND EXISTS (SELECT 1 FROM (SELECT id_fonction FROM FONCTION_REFERENCE WHERE libelle = 'Responsable Systèmes d''Information') t);
UPDATE FONCTION_REFERENCE SET libelle = 'Responsable Systèmes d''Information' WHERE libelle = 'Responsable des systèmes d''information'
  AND NOT EXISTS (SELECT 1 FROM (SELECT id_fonction FROM FONCTION_REFERENCE WHERE libelle = 'Responsable Systèmes d''Information') t);

-- ---- [20] chargé des organisations → Chargé Organisations ----
UPDATE EMPLOYE SET fonction = 'Chargé Organisations et projets' WHERE fonction = 'chargé des organisations et projets';
UPDATE EMPLOYE SET n1_fonction = 'Chargé Organisations et projets' WHERE n1_fonction = 'chargé des organisations et projets';
DELETE FROM FONCTION_REFERENCE WHERE libelle = 'chargé des organisations et projets'
  AND EXISTS (SELECT 1 FROM (SELECT id_fonction FROM FONCTION_REFERENCE WHERE libelle = 'Chargé Organisations et projets') t);
UPDATE FONCTION_REFERENCE SET libelle = 'Chargé Organisations et projets' WHERE libelle = 'chargé des organisations et projets'
  AND NOT EXISTS (SELECT 1 FROM (SELECT id_fonction FROM FONCTION_REFERENCE WHERE libelle = 'Chargé Organisations et projets') t);

-- ---- [21] chargé marketing → Chargé Marketing ----
UPDATE EMPLOYE SET fonction = 'Chargé Marketing digital et Opérationnel' WHERE fonction = 'chargé marketing digital opérationnel';
UPDATE EMPLOYE SET n1_fonction = 'Chargé Marketing digital et Opérationnel' WHERE n1_fonction = 'chargé marketing digital opérationnel';
DELETE FROM FONCTION_REFERENCE WHERE libelle = 'chargé marketing digital opérationnel'
  AND EXISTS (SELECT 1 FROM (SELECT id_fonction FROM FONCTION_REFERENCE WHERE libelle = 'Chargé Marketing digital et Opérationnel') t);
UPDATE FONCTION_REFERENCE SET libelle = 'Chargé Marketing digital et Opérationnel' WHERE libelle = 'chargé marketing digital opérationnel'
  AND NOT EXISTS (SELECT 1 FROM (SELECT id_fonction FROM FONCTION_REFERENCE WHERE libelle = 'Chargé Marketing digital et Opérationnel') t);

-- ---- [22] chargé des moyens généraux → Chargé des Moyens généraux ----
UPDATE EMPLOYE SET fonction = 'Chargé des Moyens généraux' WHERE fonction = 'chargé des moyens généraux';
UPDATE EMPLOYE SET n1_fonction = 'Chargé des Moyens généraux' WHERE n1_fonction = 'chargé des moyens généraux';
DELETE FROM FONCTION_REFERENCE WHERE libelle = 'chargé des moyens généraux'
  AND EXISTS (SELECT 1 FROM (SELECT id_fonction FROM FONCTION_REFERENCE WHERE libelle = 'Chargé des Moyens généraux') t);
UPDATE FONCTION_REFERENCE SET libelle = 'Chargé des Moyens généraux' WHERE libelle = 'chargé des moyens généraux'
  AND NOT EXISTS (SELECT 1 FROM (SELECT id_fonction FROM FONCTION_REFERENCE WHERE libelle = 'Chargé des Moyens généraux') t);

-- ---- [99] Responsable Comptable  Contrôle → Responsable comptable contrôle ----
UPDATE EMPLOYE SET fonction = 'Responsable comptable contrôle et consolidation'
  WHERE fonction = 'Responsable Comptable  Contrôle et Consolidation';
UPDATE EMPLOYE SET n1_fonction = 'Responsable comptable contrôle et consolidation'
  WHERE n1_fonction = 'Responsable Comptable  Contrôle et Consolidation';
DELETE FROM FONCTION_REFERENCE WHERE libelle = 'Responsable Comptable  Contrôle et Consolidation'
  AND EXISTS (SELECT 1 FROM (SELECT id_fonction FROM FONCTION_REFERENCE WHERE libelle = 'Responsable comptable contrôle et consolidation') t);
UPDATE FONCTION_REFERENCE SET libelle = 'Responsable comptable contrôle et consolidation'
  WHERE libelle = 'Responsable Comptable  Contrôle et Consolidation'
  AND NOT EXISTS (SELECT 1 FROM (SELECT id_fonction FROM FONCTION_REFERENCE WHERE libelle = 'Responsable comptable contrôle et consolidation') t);
