-- Migration 063 : signatures validateurs
-- Ajoute la signature manuscrite sur profil employe et son snapshot en validation.

ALTER TABLE EMPLOYE
    ADD COLUMN signature_url VARCHAR(500) NULL AFTER photo_url;

ALTER TABLE Validation
    ADD COLUMN signature_url VARCHAR(500) NULL AFTER commentaire;
