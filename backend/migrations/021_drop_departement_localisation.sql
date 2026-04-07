-- Migration 021: Drop id_localisation from DEPARTEMENT table
-- The localisation relationship should go through Implantation (Dept.id_entite → Implantation → Localisation → Pays)
-- This column was added by migration 013 but violates normalization (redundant with Implantation join)

ALTER TABLE DEPARTEMENT DROP FOREIGN KEY fk_departement_localisation;
ALTER TABLE DEPARTEMENT DROP COLUMN id_localisation;
