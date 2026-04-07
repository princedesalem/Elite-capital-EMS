-- Migration 012: Remove id_localisation from DEPARTEMENT (redundant with Direction.id_localisation)
-- When a department is under a direction, use direction's location
-- When a department has no direction, fallback to Entite's location via Implantation table

ALTER TABLE DEPARTEMENT 
DROP CONSTRAINT fk_departement_localisation;

ALTER TABLE DEPARTEMENT 
DROP COLUMN id_localisation;

ALTER TABLE DEPARTEMENT 
DROP INDEX idx_departement_localisation IF EXISTS;

-- Verify: DEPARTEMENT should now only have: dept_id, nom, id_entite, id_direction, id_responsable
DESCRIBE DEPARTEMENT;
