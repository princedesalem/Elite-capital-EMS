-- Migration 061 : Assignation manuelle des fiches de poste
-- Ajoute une FK explicite Employe.id_fiche_poste -> Fiche_poste_template.id_template
-- Idempotente : on utilise INFORMATION_SCHEMA pour ne rien créer en double.

SET @col_exists := (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'EMPLOYE' AND COLUMN_NAME = 'id_fiche_poste'
);
SET @sql := IF(@col_exists = 0,
    'ALTER TABLE EMPLOYE ADD COLUMN id_fiche_poste INT NULL',
    'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @fk_exists := (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'EMPLOYE' AND CONSTRAINT_NAME = 'fk_employe_fiche_poste'
);
SET @sql := IF(@fk_exists = 0,
    'ALTER TABLE EMPLOYE ADD CONSTRAINT fk_employe_fiche_poste FOREIGN KEY (id_fiche_poste) REFERENCES Fiche_poste_template(id_template) ON DELETE SET NULL',
    'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @idx_exists := (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'EMPLOYE' AND INDEX_NAME = 'idx_employe_id_fiche_poste'
);
SET @sql := IF(@idx_exists = 0,
    'CREATE INDEX idx_employe_id_fiche_poste ON EMPLOYE(id_fiche_poste)',
    'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
