-- Create evaluation system tables (if not exist)

CREATE TABLE IF NOT EXISTS `Fiche_de_poste` (
    `id_fiche` INT AUTO_INCREMENT PRIMARY KEY,
    `objectifs` JSON NOT NULL,
    `matricule` INT NOT NULL,
    `cree_par` INT NOT NULL,
    `date_creation` DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`matricule`) REFERENCES `EMPLOYE`(`matricule`),
    FOREIGN KEY (`cree_par`) REFERENCES `EMPLOYE`(`matricule`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `Periode_evaluation` (
    `id_periode` INT AUTO_INCREMENT PRIMARY KEY,
    `date_debut` DATE NOT NULL,
    `date_fin` DATE NOT NULL,
    `cree_par` INT NOT NULL,
    FOREIGN KEY (`cree_par`) REFERENCES `EMPLOYE`(`matricule`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `Evaluation` (
    `id_eval` INT AUTO_INCREMENT PRIMARY KEY,
    `id_fiche` INT NOT NULL,
    `id_periode` INT NOT NULL,
    `matricule` INT NOT NULL,
    `auto_evaluation` JSON,
    `evaluations` JSON,
    `note_finale` DECIMAL(5,2),
    `statut` ENUM('EN_ATTENTE_AUTO_EVAL','EN_COURS','TERMINE') DEFAULT 'EN_ATTENTE_AUTO_EVAL',
    `date_creation` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `date_finalisation` DATETIME,
    FOREIGN KEY (`id_fiche`) REFERENCES `Fiche_de_poste`(`id_fiche`),
    FOREIGN KEY (`id_periode`) REFERENCES `Periode_evaluation`(`id_periode`),
    FOREIGN KEY (`matricule`) REFERENCES `EMPLOYE`(`matricule`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
