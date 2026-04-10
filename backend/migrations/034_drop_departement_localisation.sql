-- Migration 034: Remove id_localisation from DEPARTEMENT
-- Departments do not own their city — they inherit it via Entite → Implantation.
-- A department like "Développement Commercial" must appear in ALL cities where
-- its entity is implanted (no redundant per-row city column needed).
ALTER TABLE DEPARTEMENT DROP COLUMN id_localisation;
