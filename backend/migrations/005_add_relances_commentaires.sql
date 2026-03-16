-- Migration: Ajouter tables pour relances et commentaires de missions
-- Date: 2024-03-09

-- Table pour tracker les relances envoyées
CREATE TABLE IF NOT EXISTS RelanceMission (
    id_relance INT AUTO_INCREMENT PRIMARY KEY,
    id_mission INT NOT NULL,
    type_relance ENUM('48h', '72h', '96h', 'escalade_rh_ig') NOT NULL,
    date_envoi DATETIME DEFAULT CURRENT_TIMESTAMP,
    destinataires TEXT,
    statut ENUM('envoyee', 'rapport_recu') DEFAULT 'envoyee',
    FOREIGN KEY (id_mission) REFERENCES Mission(id_mission) ON DELETE CASCADE,
    INDEX idx_mission_relance (id_mission),
    INDEX idx_date_envoi (date_envoi)
);

-- Table pour les commentaires sur les missions en cours
CREATE TABLE IF NOT EXISTS CommentaireMission (
    id_commentaire INT AUTO_INCREMENT PRIMARY KEY,
    id_mission INT NOT NULL,
    matricule INT NOT NULL,
    commentaire TEXT NOT NULL,
    date_creation DATETIME DEFAULT CURRENT_TIMESTAMP,
    lu_par JSON DEFAULT NULL,  -- Array des matricules qui ont lu le commentaire
    FOREIGN KEY (id_mission) REFERENCES Mission(id_mission) ON DELETE CASCADE,
    FOREIGN KEY (matricule) REFERENCES EMPLOYE(matricule),
    INDEX idx_mission_commentaire (id_mission),
    INDEX idx_date_creation (date_creation)
);

-- Commentaire: 
-- RelanceMission permet de suivre les relances envoyées pour les rapports non téléversés
-- CommentaireMission permet aux missionnaires d'émettre des commentaires visibles par tous les validateurs
