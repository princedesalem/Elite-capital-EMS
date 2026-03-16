-- Migration: Ajouter moyen_transport à la table MissionSegment
-- Date: 2024-03-09

-- Ajouter la colonne moyen_transport pour permettre un transport différent par segment
ALTER TABLE MissionSegment 
ADD COLUMN moyen_transport VARCHAR(50) DEFAULT 'aerien';

-- Note: Chaque segment peut maintenant avoir son propre moyen de transport
-- (aérien, routier, ferroviaire, maritime)
