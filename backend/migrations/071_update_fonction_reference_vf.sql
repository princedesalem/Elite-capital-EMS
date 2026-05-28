-- Migration 071 : Harmoniser FONCTION_REFERENCE avec l'organigramme VF (17/03/2026)
-- 1. Suppression des doublons (réassignation des employés + suppression de l'entrée)
-- 2. Renommage des libellés pour correspondre exactement au Visio VF
--    Exception : les suffixes (DFC) et (IG) sont conservés

-- ============================================================
-- ÉTAPE 1 : Supprimer les doublons
-- ============================================================

-- Doublon [7] "comptable et responsable contrôle et consolidation"
-- → fusion avec [99] qui deviendra "Responsable comptable contrôle et consolidation"
UPDATE EMPLOYE SET fonction = 'Responsable comptable contrôle et consolidation'
WHERE fonction = 'comptable et responsable contrôle et consolidation';

UPDATE EMPLOYE SET n1_fonction = 'Responsable comptable contrôle et consolidation'
WHERE n1_fonction = 'comptable et responsable contrôle et consolidation';

DELETE FROM FONCTION_REFERENCE WHERE id_fonction = 7;

-- Doublon [102] "Responsable Des Resources Humaines" (fautes)
-- → fusion avec [11] qui deviendra "Responsable Ressources Humaines"
UPDATE EMPLOYE SET fonction = 'Responsable Ressources Humaines'
WHERE fonction = 'Responsable Des Resources Humaines';

UPDATE EMPLOYE SET n1_fonction = 'Responsable Ressources Humaines'
WHERE n1_fonction = 'Responsable Des Resources Humaines';

DELETE FROM FONCTION_REFERENCE WHERE id_fonction = 102;

-- ============================================================
-- ÉTAPE 2 : Renommer les libellés (Visio VF exactement)
-- ============================================================

-- [3] Inspecteur Générale(IG) → Inspecteur Général(IG)
UPDATE EMPLOYE SET fonction = 'Inspecteur Général(IG)'
WHERE fonction = 'Inspecteur Générale(IG)';
UPDATE EMPLOYE SET n1_fonction = 'Inspecteur Général(IG)'
WHERE n1_fonction = 'Inspecteur Générale(IG)';
UPDATE FONCTION_REFERENCE SET libelle = 'Inspecteur Général(IG)'
WHERE id_fonction = 3;

-- [5] Fautes : creation → création, relation → relations
UPDATE EMPLOYE SET fonction = 'Représentants Résidents et responsables de la création et relations d''affaires'
WHERE fonction = 'Représentants Résidents et responsables de la creation et relation d''affaires';
UPDATE EMPLOYE SET n1_fonction = 'Représentants Résidents et responsables de la création et relations d''affaires'
WHERE n1_fonction = 'Représentants Résidents et responsables de la creation et relation d''affaires';
UPDATE FONCTION_REFERENCE SET libelle = 'Représentants Résidents et responsables de la création et relations d''affaires'
WHERE id_fonction = 5;

-- [6] Directeur financier et Comptable(DFC) → Directeur Financier et Comptable(DFC)
UPDATE EMPLOYE SET fonction = 'Directeur Financier et Comptable(DFC)'
WHERE fonction = 'Directeur financier et Comptable(DFC)';
UPDATE EMPLOYE SET n1_fonction = 'Directeur Financier et Comptable(DFC)'
WHERE n1_fonction = 'Directeur financier et Comptable(DFC)';
UPDATE FONCTION_REFERENCE SET libelle = 'Directeur Financier et Comptable(DFC)'
WHERE id_fonction = 6;

-- [8] responsable Trésorerie et financement → Chargé Trésorerie et financement
UPDATE EMPLOYE SET fonction = 'Chargé Trésorerie et financement'
WHERE fonction = 'responsable Trésorerie et financement';
UPDATE EMPLOYE SET n1_fonction = 'Chargé Trésorerie et financement'
WHERE n1_fonction = 'responsable Trésorerie et financement';
UPDATE FONCTION_REFERENCE SET libelle = 'Chargé Trésorerie et financement'
WHERE id_fonction = 8;

-- [9] contrôleur de gestion → Contrôleur de gestion
UPDATE EMPLOYE SET fonction = 'Contrôleur de gestion'
WHERE fonction = 'contrôleur de gestion';
UPDATE EMPLOYE SET n1_fonction = 'Contrôleur de gestion'
WHERE n1_fonction = 'contrôleur de gestion';
UPDATE FONCTION_REFERENCE SET libelle = 'Contrôleur de gestion'
WHERE id_fonction = 9;

-- [10] comptable → Comptable
UPDATE EMPLOYE SET fonction = 'Comptable'
WHERE fonction = 'comptable';
UPDATE EMPLOYE SET n1_fonction = 'Comptable'
WHERE n1_fonction = 'comptable';
UPDATE FONCTION_REFERENCE SET libelle = 'Comptable'
WHERE id_fonction = 10;

-- [11] Responsable des Ressources Humaines → Responsable Ressources Humaines
UPDATE EMPLOYE SET fonction = 'Responsable Ressources Humaines'
WHERE fonction = 'Responsable des Ressources Humaines';
UPDATE EMPLOYE SET n1_fonction = 'Responsable Ressources Humaines'
WHERE n1_fonction = 'Responsable des Ressources Humaines';
UPDATE FONCTION_REFERENCE SET libelle = 'Responsable Ressources Humaines'
WHERE id_fonction = 11;

-- [12] chargé des resources humaines → Chargé des Ressources Humaines
UPDATE EMPLOYE SET fonction = 'Chargé des Ressources Humaines'
WHERE fonction = 'chargé des resources humaines';
UPDATE EMPLOYE SET n1_fonction = 'Chargé des Ressources Humaines'
WHERE n1_fonction = 'chargé des resources humaines';
UPDATE FONCTION_REFERENCE SET libelle = 'Chargé des Ressources Humaines'
WHERE id_fonction = 12;

-- [13] responsable communication et relation publiques → Responsable Communication et Relations Publiques
UPDATE EMPLOYE SET fonction = 'Responsable Communication et Relations Publiques'
WHERE fonction = 'responsable communication et relation publiques';
UPDATE EMPLOYE SET n1_fonction = 'Responsable Communication et Relations Publiques'
WHERE n1_fonction = 'responsable communication et relation publiques';
UPDATE FONCTION_REFERENCE SET libelle = 'Responsable Communication et Relations Publiques'
WHERE id_fonction = 13;

-- [15] infographiste et déploiement → Infographiste & Déploiement
UPDATE EMPLOYE SET fonction = 'Infographiste & Déploiement'
WHERE fonction = 'infographiste et déploiement';
UPDATE EMPLOYE SET n1_fonction = 'Infographiste & Déploiement'
WHERE n1_fonction = 'infographiste et déploiement';
UPDATE FONCTION_REFERENCE SET libelle = 'Infographiste & Déploiement'
WHERE id_fonction = 15;

-- [16] Responsable affaires juridiques & fiscalité → Responsable Affaires Juridiques & fiscalité
UPDATE EMPLOYE SET fonction = 'Responsable Affaires Juridiques & fiscalité'
WHERE fonction = 'Responsable affaires juridiques & fiscalité';
UPDATE EMPLOYE SET n1_fonction = 'Responsable Affaires Juridiques & fiscalité'
WHERE n1_fonction = 'Responsable affaires juridiques & fiscalité';
UPDATE FONCTION_REFERENCE SET libelle = 'Responsable Affaires Juridiques & fiscalité'
WHERE id_fonction = 16;

-- [17] chargé de la fiscalité → Chargé de la fiscalité
UPDATE EMPLOYE SET fonction = 'Chargé de la fiscalité'
WHERE fonction = 'chargé de la fiscalité';
UPDATE EMPLOYE SET n1_fonction = 'Chargé de la fiscalité'
WHERE n1_fonction = 'chargé de la fiscalité';
UPDATE FONCTION_REFERENCE SET libelle = 'Chargé de la fiscalité'
WHERE id_fonction = 17;

-- [18] Directeur des Organisations et projets → Directeur Organisations et Projets
UPDATE EMPLOYE SET fonction = 'Directeur Organisations et Projets'
WHERE fonction = 'Directeur des Organisations et projets';
UPDATE EMPLOYE SET n1_fonction = 'Directeur Organisations et Projets'
WHERE n1_fonction = 'Directeur des Organisations et projets';
UPDATE FONCTION_REFERENCE SET libelle = 'Directeur Organisations et Projets'
WHERE id_fonction = 18;

-- [19] Responsable des systèmes d'information → Responsable Systèmes d'Information
UPDATE EMPLOYE SET fonction = 'Responsable Systèmes d''Information'
WHERE fonction = 'Responsable des systèmes d''information';
UPDATE EMPLOYE SET n1_fonction = 'Responsable Systèmes d''Information'
WHERE n1_fonction = 'Responsable des systèmes d''information';
UPDATE FONCTION_REFERENCE SET libelle = 'Responsable Systèmes d''Information'
WHERE id_fonction = 19;

-- [20] chargé des organisations et projets → Chargé Organisations et projets
UPDATE EMPLOYE SET fonction = 'Chargé Organisations et projets'
WHERE fonction = 'chargé des organisations et projets';
UPDATE EMPLOYE SET n1_fonction = 'Chargé Organisations et projets'
WHERE n1_fonction = 'chargé des organisations et projets';
UPDATE FONCTION_REFERENCE SET libelle = 'Chargé Organisations et projets'
WHERE id_fonction = 20;

-- [21] chargé marketing digital opérationnel → Chargé Marketing digital et Opérationnel
UPDATE EMPLOYE SET fonction = 'Chargé Marketing digital et Opérationnel'
WHERE fonction = 'chargé marketing digital opérationnel';
UPDATE EMPLOYE SET n1_fonction = 'Chargé Marketing digital et Opérationnel'
WHERE n1_fonction = 'chargé marketing digital opérationnel';
UPDATE FONCTION_REFERENCE SET libelle = 'Chargé Marketing digital et Opérationnel'
WHERE id_fonction = 21;

-- [22] chargé des moyens généraux → Chargé des Moyens généraux
UPDATE EMPLOYE SET fonction = 'Chargé des Moyens généraux'
WHERE fonction = 'chargé des moyens généraux';
UPDATE EMPLOYE SET n1_fonction = 'Chargé des Moyens généraux'
WHERE n1_fonction = 'chargé des moyens généraux';
UPDATE FONCTION_REFERENCE SET libelle = 'Chargé des Moyens généraux'
WHERE id_fonction = 22;

-- [99] Responsable Comptable  Contrôle et Consolidation → Responsable comptable contrôle et consolidation
UPDATE EMPLOYE SET fonction = 'Responsable comptable contrôle et consolidation'
WHERE fonction = 'Responsable Comptable  Contrôle et Consolidation';
UPDATE EMPLOYE SET n1_fonction = 'Responsable comptable contrôle et consolidation'
WHERE n1_fonction = 'Responsable Comptable  Contrôle et Consolidation';
UPDATE FONCTION_REFERENCE SET libelle = 'Responsable comptable contrôle et consolidation'
WHERE id_fonction = 99;
