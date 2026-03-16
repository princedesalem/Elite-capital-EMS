-- Migration 006: Ajout du système de paiement des frais de mission
-- Date: 2026-03-09
-- Description: Ajoute les champs pour gérer la validation et le paiement des frais de mission
-- Validation à deux niveaux: missionnaire et RH

ALTER TABLE Mission 
ADD COLUMN frais_valides_missionnaire BOOLEAN DEFAULT FALSE COMMENT 'Validation par le missionnaire que les frais sont corrects',
ADD COLUMN frais_valides_rh BOOLEAN DEFAULT FALSE COMMENT 'Validation par le RH que les frais sont payés',
ADD COLUMN frais_payes BOOLEAN DEFAULT FALSE COMMENT 'Indique si les frais ont été effectivement payés',
ADD COLUMN date_validation_frais_missionnaire DATETIME NULL COMMENT 'Date de validation des frais par le missionnaire',
ADD COLUMN date_validation_frais_rh DATETIME NULL COMMENT 'Date de validation du paiement par le RH',
ADD COLUMN date_paiement_frais DATETIME NULL COMMENT 'Date du paiement effectif des frais';
