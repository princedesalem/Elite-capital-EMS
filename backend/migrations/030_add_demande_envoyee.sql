-- Migration 030: ajouter demande_envoyee a Remplacant_propose (MySQL)
ALTER TABLE `Remplacant_propose` ADD COLUMN IF NOT EXISTS `demande_envoyee` TINYINT(1) NOT NULL DEFAULT 0;
