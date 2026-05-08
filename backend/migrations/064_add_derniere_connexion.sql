-- Migration 064 : Ajoute la colonne derniere_connexion à la table EMPLOYE
-- Utilisée pour tracker la présence en ligne (heartbeat frontend toutes les 30s)

-- MySQL 8.0 : ADD COLUMN IF NOT EXISTS n'est pas supporté
-- Exécuter seulement si la colonne n'existe pas encore
ALTER TABLE EMPLOYE
  ADD COLUMN derniere_connexion DATETIME DEFAULT NULL;
