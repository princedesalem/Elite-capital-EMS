-- Migration: Ajouter heure_retour à la table MissionSegment
-- Date: 2024-03-09

-- Ajouter la colonne heure_retour pour avoir 3 heures : départ, arrivée, retour
ALTER TABLE MissionSegment 
ADD COLUMN heure_retour TIME DEFAULT '18:00:00';

-- Note: heure_depart = heure de départ du lieu d'origine
--       heure_arrivee = heure d'arrivée à la destination
--       heure_retour = heure de retour prévue
