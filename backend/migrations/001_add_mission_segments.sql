-- Migration: Ajout de la table MissionSegment pour gérer les missions multi-destinations
-- Date: 2026-03-06
-- Description: Permet à une mission d'avoir plusieurs segments (destinations) avec calcul automatique des frais d'hôtel par segment

-- Créer la table MissionSegment
CREATE TABLE IF NOT EXISTS MissionSegment (
    id_segment INT AUTO_INCREMENT PRIMARY KEY,
    id_mission INT NOT NULL,
    pays VARCHAR(100) NOT NULL,
    ville VARCHAR(100) NOT NULL,
    date_debut DATE NOT NULL,
    date_fin DATE NOT NULL,
    heure_arrivee TIME,
    heure_depart TIME,
    frais_hotel_unitaire DECIMAL(12,2) DEFAULT 0,
    frais_hotel_total DECIMAL(12,2) DEFAULT 0,
    nombre_nuits INT DEFAULT 0,
    ordre INT NOT NULL,
    FOREIGN KEY (id_mission) REFERENCES Mission(id_mission) ON DELETE CASCADE,
    INDEX idx_mission (id_mission),
    INDEX idx_ordre (id_mission, ordre)
);

-- Commentaires sur les colonnes
-- id_segment: Identifiant unique du segment
-- id_mission: Référence à la mission parente
-- pays/ville: Destination de ce segment
-- date_debut/date_fin: Période de ce segment spécifique
-- heure_arrivee/heure_depart: Horaires dans cette destination
-- frais_hotel_unitaire: Prix par nuit dans cette destination
-- frais_hotel_total: frais_hotel_unitaire × nombre_nuits (calculé automatiquement)
-- nombre_nuits: Calculé automatiquement (date_fin - date_debut)
-- ordre: Ordre chronologique du segment dans la mission
