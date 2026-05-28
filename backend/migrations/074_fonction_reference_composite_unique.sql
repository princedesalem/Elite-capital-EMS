-- Migration 074: Remplacer la contrainte UNIQUE(libelle) par une contrainte composite
-- pour permettre la même fonction dans différents départements/directions.
-- La contrainte d'unicité devient (libelle, COALESCE(id_direction,0), COALESCE(dept_id,0))
-- via un index fonctionnel afin de gérer les valeurs NULL correctement.

-- 1. Supprimer toute contrainte UNIQUE existante sur libelle seul
-- (le nom peut varier selon la migration qui l'a créée)
SET @idx := (
    SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'FONCTION_REFERENCE'
      AND COLUMN_NAME = 'libelle'
      AND NON_UNIQUE = 0
      AND SEQ_IN_INDEX = 1
    LIMIT 1
);
SET @sql := IF(@idx IS NOT NULL,
    CONCAT('ALTER TABLE FONCTION_REFERENCE DROP INDEX `', @idx, '`'),
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2. Ajouter un index composite fonctionnel (libelle, dir_coalesced, dept_coalesced)
-- COALESCE(x, 0) traite NULL comme 0, rendant les nulls comparables pour l'unicité.
-- NB : les id_direction et dept_id réels commencent à 1, donc 0 = "aucun".
ALTER TABLE FONCTION_REFERENCE
    ADD UNIQUE KEY ux_fonction_libelle_dir_dept (libelle, id_direction, dept_id);
