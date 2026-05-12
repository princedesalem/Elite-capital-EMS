-- Migration 063 : Tables Elite Academy LMS
-- Créé le 2026-05-12

-- 1. Formations
CREATE TABLE IF NOT EXISTS formations (
  id                  INT AUTO_INCREMENT PRIMARY KEY,
  titre               VARCHAR(200) NOT NULL,
  description         TEXT NULL,
  categorie           VARCHAR(100) NULL,
  niveau              ENUM('Débutant','Intermédiaire','Avancé') NOT NULL DEFAULT 'Débutant',
  image_url           VARCHAR(500) NULL,
  duree_estimee_h     DECIMAL(5,1) NULL DEFAULT 0,
  est_onboarding      BOOLEAN NOT NULL DEFAULT FALSE,
  est_publie          BOOLEAN NOT NULL DEFAULT FALSE,
  cree_par            VARCHAR(32) NOT NULL,
  created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_formation_publie (est_publie),
  INDEX idx_formation_onboarding (est_onboarding)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. Modules de formation
CREATE TABLE IF NOT EXISTS modules_formation (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  formation_id    INT NOT NULL,
  titre           VARCHAR(200) NOT NULL,
  description     TEXT NULL,
  ordre           INT NOT NULL DEFAULT 0,
  CONSTRAINT fk_module_formation FOREIGN KEY (formation_id) REFERENCES formations(id) ON DELETE CASCADE,
  INDEX idx_module_formation (formation_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. Leçons
CREATE TABLE IF NOT EXISTS lecons (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  module_id       INT NOT NULL,
  titre           VARCHAR(200) NOT NULL,
  type            ENUM('video','pdf','texte','quiz','presentation') NOT NULL DEFAULT 'texte',
  contenu         MEDIUMTEXT NULL,
  ordre           INT NOT NULL DEFAULT 0,
  duree_min       INT NULL DEFAULT 0,
  CONSTRAINT fk_lecon_module FOREIGN KEY (module_id) REFERENCES modules_formation(id) ON DELETE CASCADE,
  INDEX idx_lecon_module (module_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. Questions de quiz
CREATE TABLE IF NOT EXISTS quiz_questions (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  lecon_id        INT NOT NULL,
  question        TEXT NOT NULL,
  options         JSON NOT NULL,
  bonne_reponse   INT NOT NULL DEFAULT 0,
  explication     TEXT NULL,
  ordre           INT NOT NULL DEFAULT 0,
  CONSTRAINT fk_question_lecon FOREIGN KEY (lecon_id) REFERENCES lecons(id) ON DELETE CASCADE,
  INDEX idx_question_lecon (lecon_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 5. Inscriptions à une formation
CREATE TABLE IF NOT EXISTS inscriptions_formation (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  employe_id      VARCHAR(32) NOT NULL,
  formation_id    INT NOT NULL,
  date_inscription DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  statut          ENUM('en_cours','termine','abandonne') NOT NULL DEFAULT 'en_cours',
  score_final     DECIMAL(5,2) NULL,
  date_completion DATETIME NULL,
  UNIQUE KEY uq_inscription (employe_id, formation_id),
  CONSTRAINT fk_inscription_employe   FOREIGN KEY (employe_id)   REFERENCES EMPLOYE(matricule) ON DELETE CASCADE,
  CONSTRAINT fk_inscription_formation FOREIGN KEY (formation_id) REFERENCES formations(id)    ON DELETE CASCADE,
  INDEX idx_inscription_employe (employe_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 6. Progression par leçon
CREATE TABLE IF NOT EXISTS progression_lecons (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  inscription_id  INT NOT NULL,
  lecon_id        INT NOT NULL,
  termine         BOOLEAN NOT NULL DEFAULT FALSE,
  score           DECIMAL(5,2) NULL,
  date_progression DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_progression (inscription_id, lecon_id),
  CONSTRAINT fk_prog_inscription FOREIGN KEY (inscription_id) REFERENCES inscriptions_formation(id) ON DELETE CASCADE,
  CONSTRAINT fk_prog_lecon       FOREIGN KEY (lecon_id)        REFERENCES lecons(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 7. Badges
CREATE TABLE IF NOT EXISTS badges (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  employe_id      VARCHAR(32) NOT NULL,
  type            ENUM('premier_cours','serie_5','perfectionniste','top_apprenant','assidu') NOT NULL,
  date_obtenu     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_badge (employe_id, type),
  CONSTRAINT fk_badge_employe FOREIGN KEY (employe_id) REFERENCES EMPLOYE(matricule) ON DELETE CASCADE,
  INDEX idx_badge_employe (employe_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 8. Certificats
CREATE TABLE IF NOT EXISTS certificats_formation (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  employe_id      VARCHAR(32) NOT NULL,
  formation_id    INT NOT NULL,
  date_emission   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  pdf_path        VARCHAR(500) NULL,
  UNIQUE KEY uq_certificat (employe_id, formation_id),
  CONSTRAINT fk_cert_employe   FOREIGN KEY (employe_id)   REFERENCES EMPLOYE(matricule) ON DELETE CASCADE,
  CONSTRAINT fk_cert_formation FOREIGN KEY (formation_id) REFERENCES formations(id)    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
