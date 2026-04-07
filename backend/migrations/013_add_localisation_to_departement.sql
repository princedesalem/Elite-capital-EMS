-- Migration 013: Add id_localisation column to DEPARTEMENT table
-- Aligns DB schema with models.py which references Departement.id_localisation

ALTER TABLE DEPARTEMENT ADD COLUMN id_localisation INT NULL;
ALTER TABLE DEPARTEMENT ADD CONSTRAINT fk_departement_localisation
    FOREIGN KEY (id_localisation) REFERENCES LOCALISATION(id_localisation) ON DELETE SET NULL;
