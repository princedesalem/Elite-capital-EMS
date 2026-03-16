-- Migration: Ajouter la table MissionnairesMission pour gérer plusieurs missionnaires par mission
-- Date: 2024-03-09

CREATE TABLE IF NOT EXISTS MissionnairesMission (
    id_missionnaire_mission INT AUTO_INCREMENT PRIMARY KEY,
    id_mission INT NOT NULL,
    matricule INT NOT NULL,
    role_mission VARCHAR(50) DEFAULT 'participant',
    date_ajout DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_mission) REFERENCES Mission(id_mission) ON DELETE CASCADE,
    FOREIGN KEY (matricule) REFERENCES EMPLOYE(matricule),
    INDEX idx_mission (id_mission),
    INDEX idx_matricule (matricule),
    UNIQUE KEY unique_mission_matricule (id_mission, matricule)
);

-- Note: Cette table permet d'associer plusieurs employés (missionnaires) à une même mission
-- role_mission peut être 'responsable' (initiateur) ou 'participant' (membre ajouté)
