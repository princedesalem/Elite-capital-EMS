-- Migration 036: Add FraisMissionnaire table for individual expense tracking per missionary
CREATE TABLE IF NOT EXISTS FraisMissionnaire (
    id INT AUTO_INCREMENT PRIMARY KEY,
    id_mission INT NOT NULL,
    matricule INT NOT NULL,
    frais_transport DECIMAL(12,2) DEFAULT 0,
    frais_hotel DECIMAL(12,2) DEFAULT 0,
    frais_deplacement DECIMAL(12,2) DEFAULT 0,
    frais_nutrition DECIMAL(12,2) DEFAULT 0,
    total_frais DECIMAL(12,2) DEFAULT 0,
    justificatif TEXT NULL,
    statut VARCHAR(20) DEFAULT 'soumis',
    date_soumission DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_mission) REFERENCES Mission(id_mission) ON DELETE CASCADE,
    FOREIGN KEY (matricule) REFERENCES EMPLOYE(matricule) ON DELETE CASCADE,
    UNIQUE KEY uq_mission_matricule (id_mission, matricule)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
