-- Migration 010: Ajout des champs manquants dans OPERATIONS
-- Date: 2026-03-09
-- Description: Ajoute les colonnes type_demande, statut, date_debut, date_fin, duree_jours, motif, date_demande

USE EMS_DB;

-- Ajouter les colonnes manquantes
ALTER TABLE OPERATIONS
ADD COLUMN type_demande VARCHAR(50) COMMENT 'Type: Congé, Permission, Mission',
ADD COLUMN statut VARCHAR(20) DEFAULT 'en attente' COMMENT 'Statut: en attente, validé, rejeté, annulé',
ADD COLUMN date_debut DATE COMMENT 'Date début logique',
ADD COLUMN date_fin DATE COMMENT 'Date fin logique',
ADD COLUMN duree_jours INT COMMENT 'Durée en jours ouvrables',
ADD COLUMN motif TEXT COMMENT 'Motif/raison de la demande',
ADD COLUMN date_demande DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT 'Date de création de la demande';

-- Créer des index pour améliorer les performances
CREATE INDEX idx_operations_type_demande ON OPERATIONS(type_demande);
CREATE INDEX idx_operations_statut ON OPERATIONS(statut);
CREATE INDEX idx_operations_date_debut ON OPERATIONS(date_debut);
CREATE INDEX idx_operations_date_fin ON OPERATIONS(date_fin);
CREATE INDEX idx_operations_date_demande ON OPERATIONS(date_demande);

-- Migrer les données existantes depuis les tables liées
-- Pour les opérations existantes, deviner le type basé sur les tables liées
UPDATE OPERATIONS op
SET type_demande = 'Congé'
WHERE EXISTS (SELECT 1 FROM Conges c WHERE c.id_conges = op.id_operation);

UPDATE OPERATIONS op
SET type_demande = 'Permission'
WHERE EXISTS (SELECT 1 FROM Permission p WHERE p.id_permission = op.id_operation);

UPDATE OPERATIONS op
SET type_demande = 'Mission'
WHERE EXISTS (SELECT 1 FROM Mission m WHERE m.id_mission = op.id_operation);

-- Copier date_depart/date_retour vers date_debut/date_fin pour les données existantes
UPDATE OPERATIONS
SET date_debut = date_depart,
    date_fin = date_retour,
    duree_jours = duree,
    motif = commentaire,
    date_demande = NOW()
WHERE date_debut IS NULL;

-- Message de confirmation
SELECT 'Migration 010 terminée: Colonnes ajoutées à OPERATIONS' AS status;
