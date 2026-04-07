-- Migration 025: Add employee family fields
ALTER TABLE EMPLOYE
  ADD COLUMN statut_matrimonial ENUM('Celibataire','Marie') NULL,
  ADD COLUMN nombre_enfants INT NULL DEFAULT 0;
