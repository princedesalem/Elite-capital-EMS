-- Migration 077: ajouter derniere_activite a SESSION_UTILISATION
-- Permet de calculer la vraie duree d'utilisation via inactivite
-- (heartbeat met a jour ce champ toutes les 30s)
ALTER TABLE SESSION_UTILISATION
    ADD COLUMN derniere_activite DATETIME NULL
        COMMENT 'Derniere activite connue (heartbeat). NULL = pas de heartbeat enregistre.';
