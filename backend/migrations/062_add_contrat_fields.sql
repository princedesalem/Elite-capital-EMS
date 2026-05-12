-- Migration 062 : Ajout gestion des contrats (CDD/CDI/Stagiaire)
-- Créé le 2026-05-12

-- 1. Champs contrat sur la table EMPLOYE
ALTER TABLE EMPLOYE
  ADD COLUMN type_contrat ENUM('CDI','CDD','Stagiaire') NOT NULL DEFAULT 'CDI',
  ADD COLUMN date_debut_contrat DATE NULL,
  ADD COLUMN date_fin_contrat DATE NULL;

-- 2. Table des alertes de fin de contrat
CREATE TABLE IF NOT EXISTS alertes_contrat (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  employe_id      VARCHAR(32) NOT NULL,
  type_alerte     ENUM('J7','J2') NOT NULL,
  statut          ENUM('active','traitee') NOT NULL DEFAULT 'active',
  action          ENUM('renouvellement','arret','confirmation_cdi') NULL,
  date_generee    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  date_traitee    DATETIME NULL,
  traite_par      VARCHAR(32) NULL,
  CONSTRAINT fk_alerte_employe FOREIGN KEY (employe_id) REFERENCES EMPLOYE(matricule) ON DELETE CASCADE,
  INDEX idx_alerte_employe (employe_id),
  INDEX idx_alerte_statut (statut)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. Table des lettres RH (renouvellement / arrêt / confirmation CDI)
CREATE TABLE IF NOT EXISTS lettres_rh (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  employe_id        VARCHAR(32) NOT NULL,
  alerte_id         INT NULL,
  type_lettre       ENUM('renouvellement','arret','confirmation_cdi','info_contrat') NOT NULL,
  pdf_path          VARCHAR(500) NULL,
  signature_data    MEDIUMTEXT NULL,
  date_generation   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  genere_par        VARCHAR(32) NOT NULL,
  date_fin_nouvelle DATE NULL,
  CONSTRAINT fk_lettre_employe FOREIGN KEY (employe_id) REFERENCES EMPLOYE(matricule) ON DELETE CASCADE,
  CONSTRAINT fk_lettre_alerte  FOREIGN KEY (alerte_id)  REFERENCES alertes_contrat(id) ON DELETE SET NULL,
  INDEX idx_lettre_employe (employe_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
